import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "../supabase";
import { getUserProfile, signIn, signOut } from "../services/auth";
import type { UserProfile } from "../types";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async (currentUser: User | null) => {
    if (!currentUser) {
      setProfile(null);
      return;
    }

    const currentProfile = await getUserProfile(currentUser.id);
    setProfile(currentProfile);
  }, []);

  useEffect(() => {
    if (!supabase) {
      setError("Supabase não configurado. Confira o arquivo .env.local.");
      setLoading(false);
      return;
    }

    let active = true;

    const initialize = async () => {
      try {
        const { data, error: sessionError } = await supabase?.auth.getSession() as any;

        if (sessionError) throw sessionError;
        if (!active) return;

        setSession(data.session);
        setUser(data.session?.user ?? null);

        if (data.session?.user) {
          await loadProfile(data.session.user);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Não foi possível carregar a sessão.",
          );
          setProfile(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;

      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setError(null);

      if (!nextSession?.user) {
        setProfile(null);
        return;
      }

      // O callback do Supabase não deve aguardar consultas adicionais.
      void loadProfile(nextSession.user).catch((err: unknown) => {
        if (!active) return;

        setProfile(null);
        setError(
          err instanceof Error
            ? err.message
            : "Não foi possível carregar seu perfil.",
        );
      });
    });

    void initialize();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const login = async (email: string, password: string) => {
    setError(null);

    try {
      const data = await signIn(email, password);
      setSession(data.session);
      setUser(data.user);

      if (data.user) {
        await loadProfile(data.user);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao entrar.";

      setError(message);
      throw err;
    }
  };

  const logout = async () => {
    setError(null);
    await signOut();

    setSession(null);
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        error,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider.");
  }

  return context;
}
