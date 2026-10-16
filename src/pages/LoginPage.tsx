import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { LockKeyhole, Store } from "lucide-react";

import { useAuth } from "../contexts/AuthContext";

export default function LoginPage() {
  const { user, profile, loading, login, error: authError } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (loading) {
    return <div className="screen-center">Carregando...</div>;
  }

  if (user && profile) {
    return (
      <Navigate to={profile.role === "admin" ? "/admin" : "/vendas"} replace />
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      await login(email.trim(), password);
    } catch {
      setFormError("Não foi possível entrar. Confira seu e-mail e sua senha.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="brand-icon">
          <Store size={30} />
        </div>

        <p className="eyebrow">Sabor da Comunidade</p>
        <h1>Bom ter você por aqui!</h1>
        <p className="login-subtitle">
          Entre com sua conta para acessar a cantina.
        </p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            placeholder="seu@email.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <label htmlFor="password">Senha</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="Digite sua senha"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          {(formError || authError) && (
            <p className="error-message" role="alert">
              {formError || authError}
            </p>
          )}

          <button
            className="primary-button"
            type="submit"
            disabled={submitting}
          >
            <LockKeyhole size={17} />
            {submitting ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="login-footer">Acesso restrito a usuários autorizados.</p>
      </section>
    </main>
  );
}
