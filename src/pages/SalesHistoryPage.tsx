import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ChevronDown, Download, Mail, RefreshCw, Share2 } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { Link } from "react-router-dom";

import { exportSalesCsv } from "../services/csv";
import { sendSalesReport } from "../services/emailReports";

import {
  formatCurrency,
  formatDateTime,
  getSalesReport,
  paymentMethodLabel,
  type ReportPeriod,
  type SaleReport,
} from "../services/reports";

export default function SalesHistoryPage() {
  const [period, setPeriod] = useState<ReportPeriod>("today");
  const [sales, setSales] = useState<SaleReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);

  const loadSales = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setSales(await getSalesReport(period));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível carregar o histórico.",
      );
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void loadSales();
  }, [loadSales]);

  async function handleSendEmail() {
    if (sendingEmail) return;

    setSendingEmail(true);
    setEmailMessage(null);
    setEmailError(null);

    try {
      await sendSalesReport(period);
      setEmailMessage(
        "Solicitação aceita pelo serviço de e-mail. Verifique a caixa de entrada e o spam.",
      );
    } catch (err) {
      setEmailError(
        err instanceof Error
          ? err.message
          : "Não foi possível enviar o relatório por e-mail.",
      );
    } finally {
      setSendingEmail(false);
    }
  }

  function handleShareWhatsApp() {
    // if (loading || sales.length === 0) return;

    const periodLabels: Record<ReportPeriod, string> = {
      today: "hoje",
      "7days": "os últimos 7 dias",
      "30days": "os últimos 30 dias",
    };

    const message = [
      "Olá! Segue o relatório de vendas da Cantina MAPE - Sabor da Comunidade.",
      `Período: ${periodLabels[period]}.`,
      `Quantidade de vendas: ${sales.length}.`,
      "",
      "*O arquivo CSV foi baixado no dispositivo. Anexe o arquivo nesta conversa antes de enviar a mensagem.*",
    ].join("\n");

    const whatsappNumber = "5571993314919";
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;

    // Abre o WhatsApp durante a interação do usuário.
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");

    // Reutiliza o serviço de exportação já existente.
    exportSalesCsv(sales);
  }

  return (
    <main className="app-page">
      <header className="app-header">
        <div>
          <Link className="back-link" to="/admin">
            <ArrowLeft size={16} /> Voltar ao painel
          </Link>
          <p className="eyebrow">Sabor da Comunidade</p>
          <h1>Histórico de vendas</h1>
          <p className="muted">
            Consulte as vendas, exporte os registros ou envie o relatório por
            e-mail.
          </p>
        </div>

        <button
          className="secondary-button"
          type="button"
          onClick={() => void loadSales()}
          disabled={loading}
        >
          <RefreshCw size={16} />
          Atualizar
        </button>
      </header>

      <section className="products-panel">
        <div className="history-toolbar">
          <div className="history-period-content">
            <label htmlFor="history-period">Período</label>
            <select
              id="history-period"
              value={period}
              disabled={sendingEmail}
              onChange={(event) => {
                setPeriod(event.target.value as ReportPeriod);
                setEmailMessage(null);
                setEmailError(null);
              }}
            >
              <option value="today">Hoje</option>
              <option value="7days">Últimos 7 dias</option>
              <option value="30days">Últimos 30 dias</option>
            </select>
          </div>

          <div className="history-actions">
            <div className="share-dropdown">
              <button
                type="button"
                className="primary-button share-trigger"
                onClick={() => setShareMenuOpen((open) => !open)}
                aria-expanded={shareMenuOpen}
                aria-haspopup="menu"
                // disabled={loading || sales.length === 0}
              >
                <Share2 size={18} />
                Compartilhar relatório
                <ChevronDown size={16} />
              </button>

              {shareMenuOpen && (
                <>
                  <button
                    type="button"
                    className="share-menu-backdrop"
                    aria-label="Fechar menu"
                    onClick={() => setShareMenuOpen(false)}
                  />

                  <div className="share-menu" role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        exportSalesCsv(sales);
                        setShareMenuOpen(false);
                      }}
                    >
                      <Download size={18} />
                      Exportar CSV
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setShareMenuOpen(false);
                        handleShareWhatsApp();
                      }}
                    >
                      <FaWhatsapp size={18} color="#25D366" />
                      WhatsApp
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      disabled={sendingEmail}
                      onClick={() => {
                        setShareMenuOpen(false);
                        void handleSendEmail();
                      }}
                    >
                      <Mail size={18} />
                      {sendingEmail ? "Enviando..." : "Enviar por e-mail"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {emailMessage && (
          <p className="success-message" role="status">
            {emailMessage}
          </p>
        )}

        {emailError && (
          <p className="error-message" role="alert">
            {emailError}
          </p>
        )}

        {error && <p className="error-message">{error}</p>}

        {loading ? (
          <p className="muted">Carregando vendas...</p>
        ) : sales.length === 0 ? (
          <div className="empty-state">
            <p>Nenhuma venda encontrada neste período.</p>
          </div>
        ) : (
          <div className="history-list">
            {sales.map((sale) => {
              const total = (sale.sale_items ?? []).reduce(
                (sum, item) =>
                  sum + Number(item.quantity) * Number(item.unit_price),
                0,
              );

              return (
                <article className="history-sale" key={sale.id}>
                  <div className="history-sale-header">
                    <div>
                      <strong>
                        Venda #{sale.id.slice(0, 8).toUpperCase()}
                      </strong>
                      <span>{formatDateTime(sale.sold_at)}</span>
                    </div>

                    <strong className="history-total">
                      {formatCurrency(total)}
                    </strong>
                  </div>

                  <p className="history-payment">
                    Pagamento: {paymentMethodLabel(sale.payment_method)}
                  </p>

                  <div className="history-items">
                    {(sale.sale_items ?? []).map((item, index) => (
                      <div className="history-item" key={`${sale.id}-${index}`}>
                        <span>
                          {item.quantity} × {item.product_name}
                          {item.flavor ? ` (${item.flavor})` : ""}
                        </span>
                        <span>
                          {formatCurrency(
                            Number(item.quantity) * Number(item.unit_price),
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {!loading && sales.length > 0 && (
          <p className="muted history-count">
            {sales.length}{" "}
            {sales.length === 1 ? "venda encontrada" : "vendas encontradas"}
          </p>
        )}
      </section>
    </main>
  );
}
