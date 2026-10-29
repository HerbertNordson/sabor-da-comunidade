import { Navigate, Route, Routes } from "react-router-dom";

import { useAuth } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";

import LoginPage from "./pages/LoginPage";
import AdminPage from "./pages/AdminPage";
import SalesPage from "./pages/SalesPage";
import ProductsPage from "./pages/ProductsPage";
import SalesHistoryPage from "./pages/SalesHistoryPage";
import ReceivablesPage from "./pages/ReceivablesPage";

function AppHome() {
  const { profile, loading, user } = useAuth();

  if (loading) {
    return <div className="screen-center">Carregando...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!profile) {
    return (
      <div className="screen-center">
        Seu perfil não está disponível. Entre em contato com o administrador.
      </div>
    );
  }

  return (
    <Navigate to={profile.role === "admin" ? "/admin" : "/vendas"} replace />
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/produtos"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <ProductsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/contas-a-receber"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <ReceivablesPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/vendas"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <SalesHistoryPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/vendas"
        element={
          <ProtectedRoute allowedRoles={["admin", "seller"]}>
            <SalesPage />
          </ProtectedRoute>
        }
      />

      <Route path="/app" element={<AppHome />} />
      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}
