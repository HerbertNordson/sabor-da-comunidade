import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Banknote, CheckCircle2, Clock3, RefreshCw, Search, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  getReceivableDetails,
  getReceivables,
  getReceivablePaidAmount,
  receiptPaymentMethodLabel,
  recordReceivablePayment,
  type Receivable,
  type ReceivableDetails,
  type ReceivableStatus,
  type ReceiptPaymentMethod,
} from "../services/receivables";

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function statusLabel(status: ReceivableStatus) {
  if (status === "paid") return "Quitada";
  if (status === "partial") return "Parcial";
  return "Pendente";
}

export default function ReceivablesPage() {
  const { profile } = useAuth();
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ReceivableStatus>("all");
  const [selected, setSelected] = useState<ReceivableDetails | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<ReceiptPaymentMethod>("pix");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReceivables(await getReceivables());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar o contas a receber.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const rows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return receivables.filter((item) => {
      const matchesName = !term || item.customer_name.toLocaleLowerCase("pt-BR").includes(term) || item.sale_id.toLocaleLowerCase().includes(term);
      return matchesName && (statusFilter === "all" || item.status === statusFilter);
    });
  }, [receivables, search, statusFilter]);

  const totals = useMemo(() => {
    return receivables.reduce((acc, item) => {
      const paid = getReceivablePaidAmount(item);
      const balance = Math.max(0, Number(item.original_amount) - paid);
      acc.outstanding += balance;
      if (balance > 0) acc.openCount += 1;
      if (item.status === "paid") acc.paidCount += 1;
      return acc;
    }, { outstanding: 0, openCount: 0, paidCount: 0 });
  }, [receivables]);

  async function openDetails(id: string) {
    setDetailLoading(true);
    setPaymentError(null);
    setMessage(null);
    try {
      const details = await getReceivableDetails(id);
      setSelected(details);
      setPaymentAmount((Number(details.original_amount) - details.payments.reduce((sum, payment) => sum + Number(payment.amount), 0)).toFixed(2));
      setPaymentMethod("pix");
      setPaymentNotes("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível abrir a dívida.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function submitPayment() {
    if (!selected || savingPayment) return;
    const amount = Number(paymentAmount.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentError("Informe um valor maior que zero.");
      return;
    }
    const paid = selected.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const balance = Number(selected.original_amount) - paid;
    if (amount > balance + 0.00001) {
      setPaymentError(`O valor excede o saldo devedor de ${money(balance)}.`);
      return;
    }

    setSavingPayment(true);
    setPaymentError(null);
    setMessage(null);
    try {
      await recordReceivablePayment({
        receivableId: selected.id,
        amount,
        paymentMethod,
        notes: paymentNotes,
      });
      await load();
      const refreshed = await getReceivableDetails(selected.id);
      setSelected(refreshed);
      const refreshedPaid = refreshed.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
      setPaymentAmount(Math.max(0, Number(refreshed.original_amount) - refreshedPaid).toFixed(2));
      setPaymentNotes("");
      setMessage("Recebimento registrado com sucesso.");
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : "Não foi possível registrar o recebimento.");
    } finally {
      setSavingPayment(false);
    }
  }

  return (
    <main className="app-page">
      <Link className="back-link" to="/admin"><ArrowLeft size={16} /> Voltar ao painel</Link>
      <header className="app-header">
        <div>
          <p className="eyebrow">CANTINA MAPE</p>
          <h1>Contas a receber</h1>
          <p className="muted">Controle de vendas a prazo, pagamentos parciais e quitação de dívidas.</p>
        </div>
        <button className="secondary-button" type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={16} /> Atualizar</button>
      </header>

      {error && <p className="error-message" role="alert">{error}</p>}

      <section className="metrics-grid">
        <article className="metric-card"><div className="metric-icon"><Banknote size={20} /></div><p>Saldo em aberto</p><strong>{loading ? "..." : money(totals.outstanding)}</strong><span>Total ainda não recebido</span></article>
        <article className="metric-card"><div className="metric-icon"><Clock3 size={20} /></div><p>Dívidas em aberto</p><strong>{loading ? "..." : totals.openCount}</strong><span>Pendentes ou parcialmente pagas</span></article>
        <article className="metric-card"><div className="metric-icon"><CheckCircle2 size={20} /></div><p>Dívidas quitadas</p><strong>{loading ? "..." : totals.paidCount}</strong><span>Registros integralmente pagos</span></article>
      </section>

      <section className="dashboard-panel receivables-panel">
        <div className="receivables-toolbar">
          <label className="receivables-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar comprador ou código da venda" /></label>
          <select aria-label="Filtrar por situação" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | ReceivableStatus)}>
            <option value="all">Todas as situações</option><option value="pending">Pendentes</option><option value="partial">Parciais</option><option value="paid">Quitadas</option>
          </select>
        </div>

        {loading ? <p className="muted">Carregando dívidas...</p> : rows.length === 0 ? <div className="empty-state"><Banknote size={28} /><p>Nenhuma dívida encontrada.</p></div> : (
          <div className="receivables-table-wrap"><table className="receivables-table"><thead><tr><th>Comprador</th><th>Data da venda</th><th>Valor original</th><th>Recebido</th><th>Saldo</th><th>Situação</th><th></th></tr></thead><tbody>
            {rows.map((item) => {
              const paid = getReceivablePaidAmount(item);
              const balance = Math.max(0, Number(item.original_amount) - paid);
              return <tr key={item.id}><td><strong>{item.customer_name}</strong><small>{item.sale_id.slice(0, 8).toUpperCase()}</small></td><td>{dateTime(item.sale.sold_at)}</td><td>{money(Number(item.original_amount))}</td><td>{money(paid)}</td><td><strong>{money(balance)}</strong></td><td><span className={`receivable-status status-${item.status}`}>{statusLabel(item.status)}</span></td><td><button className="secondary-button receivable-action" type="button" onClick={() => void openDetails(item.id)}>{item.status === "paid" ? "Detalhes" : "Receber"}</button></td></tr>;
            })}
          </tbody></table></div>
        )}
      </section>

      {detailLoading && <div className="receivable-loading">Carregando detalhes...</div>}
      {selected && (
        <div className="cash-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !savingPayment) setSelected(null); }}>
          <section className="cash-modal receivable-detail-modal" role="dialog" aria-modal="true" aria-labelledby="receivable-detail-title">
            <header className="receivable-detail-header"><div><p className="eyebrow">CONTAS A RECEBER</p><h2 id="receivable-detail-title">{selected.customer_name}</h2><p className="muted">Venda em {dateTime(selected.sale.sold_at)}</p></div><button className="cash-history-close" type="button" aria-label="Fechar detalhes" onClick={() => setSelected(null)} disabled={savingPayment}><X size={20} /></button></header>
            <div className="receivable-detail-summary"><div><span>Valor original</span><strong>{money(Number(selected.original_amount))}</strong></div><div><span>Já recebido</span><strong>{money(selected.payments.reduce((sum, payment) => sum + Number(payment.amount), 0))}</strong></div><div><span>Saldo</span><strong>{money(Math.max(0, Number(selected.original_amount) - selected.payments.reduce((sum, payment) => sum + Number(payment.amount), 0)))}</strong></div></div>
            <h3>Itens da venda</h3>
            <ul className="receivable-items">{selected.sale.sale_items.map((item, index) => <li key={`${item.product_name}-${index}`}><span>{item.quantity}× {item.product_name}{item.flavor ? ` · ${item.flavor}` : ""}</span><strong>{money(item.quantity * Number(item.unit_price))}</strong></li>)}</ul>
            <h3>Histórico de pagamentos</h3>
            {selected.payments.length === 0 ? <p className="muted">Nenhum recebimento registrado até agora.</p> : <div className="receivable-payment-history">{[...selected.payments].sort((a, b) => b.received_at.localeCompare(a.received_at)).map((payment) => <article key={payment.id}><div><strong>{money(Number(payment.amount))}</strong><span>{dateTime(payment.received_at)} · {receiptPaymentMethodLabel(payment.payment_method)}</span>{payment.notes && <small>{payment.notes}</small>}</div><span className="receivable-audit">Admin: {payment.received_by.slice(0, 8)}…</span></article>)}</div>}
            {selected.status !== "paid" && <><h3>Registrar recebimento</h3><div className="receivable-payment-form"><label>Valor recebido (R$)<input type="number" min="0.01" step="0.01" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} disabled={savingPayment} /></label><label>Forma de pagamento<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as ReceiptPaymentMethod)} disabled={savingPayment}><option value="pix">Pix</option><option value="cash">Dinheiro</option><option value="credit_card">Cartão de crédito</option><option value="debit_card">Cartão de débito</option><option value="other">Outro</option></select></label><label className="receivable-notes">Observações (opcional)<input type="text" maxLength={500} value={paymentNotes} onChange={(event) => setPaymentNotes(event.target.value)} placeholder="Ex.: pagamento parcial" disabled={savingPayment} /></label></div>
              {paymentError && <p className="error-message" role="alert">{paymentError}</p>}
              <button className="primary-button receivable-submit" type="button" onClick={() => void submitPayment()} disabled={savingPayment}>{savingPayment ? "Registrando..." : "Confirmar recebimento"}</button>
            </>}
            {selected.status === "paid" && <p className="receivable-paid-note"><CheckCircle2 size={17} /> Dívida quitada integralmente.</p>}
            {message && <p className="success-message" role="status">{message}</p>}
          </section>
        </div>
      )}
      <p className="receivables-footer-note">Acesso administrativo · Recebimentos registrados com data, usuário responsável e histórico auditável.</p>
      <span className="sr-only">Sessão administrativa: {profile?.full_name ?? "Administrador"}</span>
    </main>
  );
}
