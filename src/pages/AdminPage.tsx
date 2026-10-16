import { useCallback, useEffect, useState } from "react";
import {
  BarChart3,
  Package,
  ShoppingCart,
  TrendingUp,
  RefreshCw,
} from "lucide-react";
import { Link } from "react-router-dom";

import { useAuth } from "../contexts/AuthContext";
import {
  formatCurrency,
  getSalesReport,
  paymentMethodLabel,
  summarizeSales,
  type ReportPeriod,
  type SalesSummary,
} from "../services/reports";

const emptySummary: SalesSummary = {
  salesCount: 0,
  itemsCount: 0,
  revenue: 0,
  averageTicket: 0,
  byPayment: {},
};

export default function AdminPage() {
  const { profile, logout } = useAuth();

  const [period, setPeriod] = useState<ReportPeriod>("today");
  const [summary, setSummary] = useState<SalesSummary>(emptySummary);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const sales = await getSalesReport(period);
      setSummary(summarizeSales(sales));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível carregar o dashboard.",
      );
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  return (
    <main className="app-page">
      <header className="app-header">
        <div>
          <p className="eyebrow">Sabor da Comunidade</p>
          <h1>Painel administrativo</h1>
          <p className="muted">Olá, {profile?.full_name || "Administrador"}.</p>
        </div>

        <button
          className="secondary-button"
          type="button"
          onClick={() => void logout()}
        >
          Sair
        </button>
      </header>

      <section className="dashboard-toolbar">
        <div>
          <h2>Visão geral</h2>
          <p className="muted">Acompanhe os resultados da cantina.</p>
        </div>

        <div className="dashboard-controls">
          <select
            aria-label="Período do dashboard"
            value={period}
            onChange={(event) => setPeriod(event.target.value as ReportPeriod)}
          >
            <option value="today">Hoje</option>
            <option value="7days">Últimos 7 dias</option>
            <option value="30days">Últimos 30 dias</option>
          </select>

          <button
            className="secondary-button"
            type="button"
            onClick={() => void loadDashboard()}
            disabled={loading}
          >
            <RefreshCw size={16} /> Atualizar
          </button>
        </div>
      </section>

      {error && <p className="error-message">{error}</p>}

      <section className="metrics-grid">
        <article className="metric-card">
          <div className="metric-icon">
            <TrendingUp size={20} />
          </div>
          <p>Faturamento</p>
          <strong>{loading ? "..." : formatCurrency(summary.revenue)}</strong>
          <span>Valor das vendas no período</span>
        </article>

        <article className="metric-card">
          <div className="metric-icon">
            <ShoppingCart size={20} />
          </div>
          <p>Vendas realizadas</p>
          <strong>{loading ? "..." : summary.salesCount}</strong>
          <span>Quantidade de transações</span>
        </article>

        <article className="metric-card">
          <div className="metric-icon">
            <Package size={20} />
          </div>
          <p>Itens vendidos</p>
          <strong>{loading ? "..." : summary.itemsCount}</strong>
          <span>Unidades registradas</span>
        </article>

        <article className="metric-card">
          <div className="metric-icon">
            <BarChart3 size={20} />
          </div>
          <p>Ticket médio</p>
          <strong>
            {loading ? "..." : formatCurrency(summary.averageTicket)}
          </strong>
          <span>Faturamento dividido pelas vendas</span>
        </article>
      </section>

      <section className="dashboard-content-grid">
        <article className="dashboard-panel">
          <h2>Formas de pagamento</h2>
          <p className="muted">Distribuição do faturamento no período.</p>

          {loading ? (
            <p className="muted">Carregando...</p>
          ) : Object.keys(summary.byPayment).length === 0 ? (
            <p className="muted">Ainda não há vendas neste período.</p>
          ) : (
            <div className="payment-breakdown">
              {Object.entries(summary.byPayment)
                .sort((a, b) => b[1] - a[1])
                .map(([method, amount]) => {
                  const percentage =
                    summary.revenue > 0 ? (amount / summary.revenue) * 100 : 0;

                  return (
                    <div className="payment-stat" key={method}>
                      <div className="payment-stat-heading">
                        <span>{paymentMethodLabel(method)}</span>
                        <strong>{formatCurrency(amount)}</strong>
                      </div>
                      <div className="progress-track">
                        <div
                          className="progress-fill"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="payment-percentage">
                        {percentage.toLocaleString("pt-BR", {
                          maximumFractionDigits: 1,
                        })}
                        %
                      </span>
                    </div>
                  );
                })}
            </div>
          )}
        </article>

        <article className="dashboard-panel dashboard-links">
          <h2>Gestão da cantina</h2>
          <p className="muted">Acesse as principais ferramentas.</p>

          <Link className="management-link" to="/admin/produtos">
            <Package size={20} />
            <span>
              <strong>Gerenciar produtos</strong>
              <small>Cadastro, preços e disponibilidade</small>
            </span>
          </Link>

          <Link className="management-link" to="/admin/vendas">
            <ShoppingCart size={20} />
            <span>
              <strong>Histórico de vendas</strong>
              <small>Consultar transações e itens vendidos</small>
            </span>
          </Link>

          <Link className="management-link" to="/vendas">
            <TrendingUp size={20} />
            <span>
              <strong>Registrar venda</strong>
              <small>Abrir a frente de caixa</small>
            </span>
          </Link>
        </article>
      </section>
    </main>
  );
}
