import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "../contexts/AuthContext";
import type { AppRole } from "../types";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: AppRole[];
}

export function ProtectedRoute({
  children,
  allowedRoles,
}: ProtectedRouteProps) {
  const { user, profile, loading, error } = useAuth();

  if (loading) {
    return <div className="screen-center">Carregando...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (error || !profile) {
    return (
      <div className="screen-center">
        <div>
          <h2>Não foi possível carregar seu perfil</h2>
          <p>{error ?? "Seu perfil não está disponível."}</p>
          <p>Entre em contato com o administrador.</p>
        </div>
      </div>
    );
  }

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
}
