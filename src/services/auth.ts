import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../supabase";
import type { UserProfile } from "../types";

function getClient() {
  if (!supabase) {
    throw new Error("Supabase não configurado. Confira o arquivo .env.local.");
  }

  return supabase;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await getClient().auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;

  return data;
}

export async function signOut() {
  const { error } = await getClient().auth.signOut();

  if (error) throw error;
}

export async function getUserProfile(userId: string): Promise<UserProfile> {
  const { data, error } = await getClient()
    .from("profiles")
    .select("id, full_name, role, created_at")
    .eq("id", userId)
    .single();

  if (error) throw error;

  if (data.role !== "admin" && data.role !== "seller") {
    throw new Error("Perfil com permissão inválida.");
  }

  return data as UserProfile;
}

export function onAuthStateChange(
  callback: (session: Session | null, user: User | null) => void,
) {
  return getClient().auth.onAuthStateChange((_event, session) => {
    callback(session, session?.user ?? null);
  });
}

export async function getCurrentSession() {
  const { data, error } = await getClient().auth.getSession();

  if (error) throw error;

  return data.session;
}
