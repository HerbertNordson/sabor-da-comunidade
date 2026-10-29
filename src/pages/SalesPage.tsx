import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Minus,
  Plus,
  ShoppingBasket,
  Trash2,
  ReceiptText,
  History,
  X,
  Banknote,
  CreditCard,
} from "lucide-react";
import { Link } from "react-router-dom";

import { useAuth } from "../contexts/AuthContext";
import { getProducts } from "../services/products";
import { createSale } from "../services/sales";
import {
  openCashRegister,
  getOpenCashRegister,
  closeCashRegister,
  getCashRegisterSalesCount,
  type CashRegisterSession,
  type CashRegisterClosure,
} from "../services/cashRegister";
import { supabase } from "../supabase";
import type { Product, PaymentMethod } from "../types";

interface CartItem {
  product: Product;
  quantity: number;
}

interface CashSale {
  id: string;
  sold_at: string;
  payment_method: PaymentMethod;
  sale_items: {
    product_name: string;
    flavor: string | null;
    quantity: number;
    unit_price: number;
  }[];
}

const paymentOptions: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Dinheiro" },
  { value: "pix", label: "Pix" },
  { value: "credit_card", label: "Cartão de crédito" },
  { value: "debit_card", label: "Cartão de débito" },
  { value: "other", label: "Outro" },
  { value: "on_credit", label: "A prazo" },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

interface SaleConfirmationModalProps {
  totalItems: number;
  total: number;
  paymentMethod: PaymentMethod;
  customerName: string;
  submitting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

function SaleConfirmationModal({
  totalItems,
  total,
  paymentMethod,
  customerName,
  submitting,
  error,
  onCancel,
  onConfirm,
}: SaleConfirmationModalProps) {
  const paymentLabel =
    paymentOptions.find((option) => option.value === paymentMethod)?.label ??
    paymentMethod;

  return (
    <div
      className="sale-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) {
          onCancel();
        }
      }}
    >
      <section
        className="sale-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sale-modal-title"
      >
        <div className="sale-modal-icon">
          <ShoppingBasket size={28} />
        </div>

        <p className="sale-modal-eyebrow">CANTINA MAPE</p>
        <h2 id="sale-modal-title">Confirmar venda</h2>
        <p className="sale-modal-description">
          Confira os detalhes antes de finalizar esta venda.
        </p>

        <div className="sale-modal-summary">
          <div>
            <span>Quantidade de itens</span>
            <strong>
              {totalItems} {totalItems === 1 ? "item" : "itens"}
            </strong>
          </div>

          <div>
            <span>Forma de pagamento</span>
            <strong>{paymentLabel}</strong>
          </div>

          {paymentMethod === "on_credit" && (
            <div>
              <span>Comprador</span>
              <strong>{customerName}</strong>
            </div>
          )}

          <div className="sale-modal-total">
            <span>Total da compra</span>
            <strong>{formatCurrency(total)}</strong>
          </div>
        </div>

        {error && (
          <p className="error-message modal-error" role="alert">
            {error}
          </p>
        )}

        <div className="sale-modal-actions">
          <button
            type="button"
            className="sale-modal-cancel"
            onClick={onCancel}
            disabled={submitting}
          >
            Voltar
          </button>

          <button
            type="button"
            className="sale-modal-confirm"
            onClick={onConfirm}
            disabled={submitting}
          >
            {submitting ? (
              "Registrando..."
            ) : (
              <>
                <ReceiptText size={18} />
                Confirmar venda
              </>
            )}
          </button>
        </div>
      </section>
    </div>
  );
}

interface CashHistoryModalProps {
  sales: CashSale[];
  onClose: () => void;
}

function CashHistoryModal({ sales, onClose }: CashHistoryModalProps) {
  const total = sales.reduce(
    (sum, sale) =>
      sum +
      sale.sale_items.reduce(
        (itemSum, item) => itemSum + item.quantity * item.unit_price,
        0,
      ),
    0,
  );

  return (
    <div
      className="cash-history-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="cash-history-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cash-history-title"
      >
        <header className="cash-history-modal-header">
          <div>
            <p className="eyebrow">CANTINA MAPE</p>
            <h2 id="cash-history-title">Histórico de vendas</h2>
            <p className="muted">Todas as vendas registradas nesta sessão.</p>
          </div>
          <button
            className="cash-history-close"
            type="button"
            onClick={onClose}
            aria-label="Fechar histórico"
          >
            <X size={20} />
          </button>
        </header>

        <div className="cash-history-modal-summary">
          <div>
            <span>Vendas</span>
            <strong>{sales.length}</strong>
          </div>
          <div>
            <span>Total vendido</span>
            <strong>{formatCurrency(total)}</strong>
          </div>
        </div>

        <div className="cash-history-list">
          {sales.length === 0 ? (
            <div className="empty-state">
              <ReceiptText size={28} />
              <p>Nenhuma venda nesta sessão.</p>
            </div>
          ) : (
            sales.map((sale) => {
              const saleTotal = sale.sale_items.reduce(
                (sum, item) => sum + item.quantity * item.unit_price,
                0,
              );
              const itemCount = sale.sale_items.reduce(
                (sum, item) => sum + item.quantity,
                0,
              );
              const paymentLabel =
                paymentOptions.find(
                  (option) => option.value === sale.payment_method,
                )?.label ?? sale.payment_method;

              return (
                <article className="cash-history-sale" key={sale.id}>
                  <div className="cash-history-sale-top">
                    <div>
                      <strong>{formatCurrency(saleTotal)}</strong>
                      <span>
                        {new Date(sale.sold_at).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {" · "}
                        {itemCount} {itemCount === 1 ? "item" : "itens"}
                      </span>
                    </div>
                    <span className="cash-history-payment">
                      {sale.payment_method === "cash" ? (
                        <Banknote size={15} />
                      ) : (
                        <CreditCard size={15} />
                      )}
                      {paymentLabel}
                    </span>
                  </div>
                  <ul className="cash-history-items">
                    {sale.sale_items.map((item, index) => (
                      <li key={`${sale.id}-${item.product_name}-${index}`}>
                        <span>
                          {item.quantity}× {item.product_name}
                          {item.flavor ? ` · ${item.flavor}` : ""}
                        </span>
                        <strong>
                          {formatCurrency(item.quantity * item.unit_price)}
                        </strong>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })
          )}
        </div>

        <footer className="cash-history-modal-footer">
          <button className="primary-button" type="button" onClick={onClose}>
            Fechar histórico
          </button>
        </footer>
      </section>
    </div>
  );
}

export default function SalesPage() {
  const { profile, logout } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");
  const [customerName, setCustomerName] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [cashSession, setCashSession] = useState<CashRegisterSession | null>(
    null,
  );
  const [cashSales, setCashSales] = useState<CashSale[]>([]);
  const [cashSalesCount, setCashSalesCount] = useState(0);
  const [cashLoading, setCashLoading] = useState(true);
  const [cashError, setCashError] = useState<string | null>(null);
  const [showOperatorModal, setShowOperatorModal] = useState(false);
  const [operatorName, setOperatorName] = useState("");
  const [openingCash, setOpeningCash] = useState(false);

  const [showSaleConfirmation, setShowSaleConfirmation] = useState(false);
  const [showCashHistoryModal, setShowCashHistoryModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [countedCash, setCountedCash] = useState("");
  const [closureNotes, setClosureNotes] = useState("");
  const [closing, setClosing] = useState(false);
  const [closure, setClosure] = useState<CashRegisterClosure | null>(null);
  const [csvDownloaded, setCsvDownloaded] = useState(false);
  const [saleModalError, setSaleModalError] = useState<string | null>(null);
  const [closeModalError, setCloseModalError] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getProducts();
      setProducts(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível carregar os produtos.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCashRegister = useCallback(async () => {
    setCashLoading(true);
    setCashError(null);

    try {
      if (!supabase) {
        throw new Error("Supabase não configurado.");
      }

      const existingSession = await getOpenCashRegister();

      if (!existingSession) {
        setCashSession(null);
        setOperatorName("");
        setShowOperatorModal(false);
        setCashSales([]);
        setCashSalesCount(0);
        return;
      }

      setCashSession(existingSession);

      if (!existingSession.operator_name?.trim()) {
        setOperatorName("");
        // Sessão criada antes da identificação do operador: solicitar o nome
        // e preencher o campo apenas se ainda estiver vazio no banco.
        setShowOperatorModal(true);
        setCashSales([]);
        setCashSalesCount(0);
        return;
      }

      setOperatorName(existingSession.operator_name ?? "");

      const session = existingSession;
      const count = await getCashRegisterSalesCount(session.id);
      setCashSalesCount(count);

      const { data: salesData, error: salesError } = await supabase
        .from("sales")
        .select(
          `
          id,
          sold_at,
          payment_method,
          sale_items (
            product_name,
            flavor,
            quantity,
            unit_price
          )
        `,
        )
        .eq("cash_session_id", session.id)
        .order("sold_at", { ascending: false });

      if (salesError) throw salesError;

      setCashSales((salesData ?? []) as unknown as CashSale[]);
    } catch (err) {
      setCashError(
        err instanceof Error
          ? err.message
          : "Não foi possível carregar o caixa.",
      );
    } finally {
      setCashLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.all([loadProducts(), loadCashRegister()]);
  }, [loadProducts, loadCashRegister]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");

    if (!term) return products;

    return products.filter((product) =>
      [product.name, product.category ?? "", product.flavor ?? ""]
        .join(" ")
        .toLocaleLowerCase("pt-BR")
        .includes(term),
    );
  }, [products, search]);

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  const total = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0,
  );

  const getSaleTotal = (sale: CashSale) =>
    sale.sale_items.reduce(
      (sum, item) => sum + item.quantity * item.unit_price,
      0,
    );

  const cashHistoryTotal = cashSales.reduce(
    (sum, sale) => sum + getSaleTotal(sale),
    0,
  );

  const cashReceivedTotal = cashSales
    .filter((sale) => sale.payment_method === "cash")
    .reduce((sum, sale) => sum + getSaleTotal(sale), 0);

  function addProduct(product: Product) {
    setError(null);
    setSuccess(null);

    setCart((current) => {
      const existing = current.find((item) => item.product.id === product.id);

      if (existing) {
        return current.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }

      return [...current, { product, quantity: 1 }];
    });
  }

  function changeQuantity(productId: string, change: number) {
    setError(null);
    setSuccess(null);

    setCart((current) =>
      current
        .map((item) =>
          item.product.id === productId
            ? { ...item, quantity: item.quantity + change }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

  function removeProduct(productId: string) {
    setCart((current) =>
      current.filter((item) => item.product.id !== productId),
    );
    setError(null);
    setSuccess(null);
  }

  async function handleSubmitSale() {
    if (cart.length === 0 || submitting) return;

    const normalizedCustomerName = customerName.trim().replace(/\s+/g, " ");
    if (paymentMethod === "on_credit" && normalizedCustomerName.split(" ").filter(Boolean).length < 2) {
      setSaleModalError("Informe o nome completo do comprador (nome e sobrenome) para venda a prazo.");
      return;
    }

    setSubmitting(true);
    setSaleModalError(null);
    setError(null);
    setSuccess(null);

    try {
      const saleId = await createSale(
        cart.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
        })),
        paymentMethod,
        paymentMethod === "on_credit" ? normalizedCustomerName : null,
      );

      setCart([]);
      setCustomerName("");
      setShowSaleConfirmation(false);
      setSaleModalError(null);
      setSuccess(`Venda registrada com sucesso! Código: ${saleId}`);

      await Promise.all([loadProducts(), loadCashRegister()]);
    } catch (err) {
      setSaleModalError(
        err instanceof Error
          ? err.message
          : "Não foi possível registrar a venda.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOpenCashRegister() {
    const normalizedName = operatorName.trim();

    if (!normalizedName) {
      setCashError("Informe o nome do operador para abrir o caixa.");
      return;
    }

    if (normalizedName.length > 120) {
      setCashError("O nome do operador deve ter no máximo 120 caracteres.");
      return;
    }

    setOpeningCash(true);
    setCashError(null);

    try {
      await openCashRegister(normalizedName);
      setShowOperatorModal(false);
      await loadCashRegister();
    } catch (err) {
      setCashError(
        err instanceof Error ? err.message : "Não foi possível abrir o caixa.",
      );
    } finally {
      setOpeningCash(false);
    }
  }

  function requestLogout() {
    if (cashLoading) {
      setCashError("Aguarde a consulta do caixa antes de sair.");
      return;
    }

    if (cashError) {
      setCashError(
        "Não foi possível verificar o caixa. Tente novamente antes de sair.",
      );
      return;
    }

    if (cashSalesCount > 0 && cashSession?.status === "open") {
      setCountedCash("");
      setClosureNotes("");
      setClosure(null);
      setCloseModalError(null);
      setShowCloseModal(true);
      return;
    }

    void logout();
  }

  async function handleCloseCash() {
    if (!cashSession || closing) return;

    const amount = Number(countedCash.replace(",", "."));

    if (!countedCash.trim() || !Number.isFinite(amount) || amount < 0) {
      setCloseModalError(
        "Informe o dinheiro contado, incluindo R$ 0,00 se necessário.",
      );
      return;
    }

    setClosing(true);
    setCloseModalError(null);
    setCashError(null);

    try {
      const result = await closeCashRegister(
        cashSession.id,
        amount,
        closureNotes,
      );

      setClosure(result);
      setCashSession((current) =>
        current ? { ...current, status: "closed" } : current,
      );

      setShowCloseModal(false);
      setCloseModalError(null);
    } catch (err) {
      setCloseModalError(
        err instanceof Error ? err.message : "Não foi possível fechar o caixa.",
      );
    } finally {
      setClosing(false);
    }
  }

  function downloadCashCsv() {
    const rows = [
      [
        "Venda",
        "Operador do caixa",
        "Data",
        "Forma de pagamento",
        "Produto",
        "Sabor",
        "Quantidade",
        "Preço unitário",
        "Total do item",
      ],
      ...cashSales.flatMap((sale) =>
        sale.sale_items.map((item) => [
          sale.id,
          cashSession?.operator_name || "Não identificado",
          new Date(sale.sold_at).toLocaleString("pt-BR"),
          paymentOptions.find((option) => option.value === sale.payment_method)
            ?.label ?? sale.payment_method,
          item.product_name,
          item.flavor ?? "",
          item.quantity,
          item.unit_price.toFixed(2).replace(".", ","),
          (item.quantity * item.unit_price).toFixed(2).replace(".", ","),
        ]),
      ),
    ];

    const csv =
      "\uFEFF" +
      rows
        .map((row) =>
          row
            .map((value) => `"${String(value).replace(/"/g, '""')}"`)
            .join(";"),
        )
        .join("\r\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `fechamento-caixa-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function handleDownloadClosureCsv() {
    if (!closure) return;

    downloadCashCsv();
    setCsvDownloaded(true);
  }

  async function handleShareClosure() {
    if (!closure || !csvDownloaded) return;
    if (!supabase) {
      setCashError("Supabase não configurado.");
      return;
    }

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw new Error(
          "Não foi possível identificar o usuário autenticado. Tente novamente.",
        );
      }

      const authenticatedUser =
        user?.email ??
        user?.user_metadata?.full_name ??
        profile?.full_name ??
        (user?.id ? `ID: ${user.id}` : "Não identificado");

      const message = [
        "Fechamento de caixa — Cantina MAPE",
        `Operador do caixa: ${cashSession?.operator_name || "Não identificado"}`,
        `Usuário autenticado: ${authenticatedUser}`,
        `Vendas: ${closure.sales_count}`,
        `Total vendido: ${formatCurrency(closure.total_sales)}`,
        `Dinheiro esperado: ${formatCurrency(closure.expected_cash)}`,
        `Dinheiro contado: ${formatCurrency(closure.counted_cash)}`,
        `Diferença: ${formatCurrency(closure.difference)}`,
        "",
        "O CSV detalhado foi baixado. Anexe o arquivo à conversa.",
      ].join("\n");

      window.open(
        `https://wa.me/5571993314919?text=${encodeURIComponent(message)}`,
        "_blank",
        "noopener,noreferrer",
      );
    } catch (err) {
      setCashError(
        err instanceof Error
          ? err.message
          : "Não foi possível identificar o usuário autenticado.",
      );
    }
  }

  return (
    <main className="app-page">
      <header className="app-header">
        <div>
          {profile?.role === "admin" && (
            <Link className="back-link" to="/admin">
              Voltar ao painel
            </Link>
          )}
          <p className="eyebrow">CANTINA MAPE</p>
          <h1>Frente de caixa</h1>
          <p className="muted">
            Olá, {profile?.full_name || "Vendedor"}. Registre uma nova venda.
          </p>
        </div>

        <button
          className="secondary-button"
          onClick={requestLogout}
          disabled={cashLoading}
        >
          Sair
        </button>
      </header>

      {cashError && (
        <p className="error-message" role="alert">
          {cashError}
        </p>
      )}

      <section className="cash-register-panel">
        <div className="cash-register-heading">
          <div className="sales-section-title">
            <ReceiptText size={22} />
            <div>
              <h2>Meu caixa de hoje</h2>
              <p className="muted">Resumo da sua sessão atual</p>
              <p className="cash-operator-label">
                Operador:{" "}
                <strong>
                  {cashSession?.operator_name || "Aguardando identificação"}
                </strong>
              </p>
            </div>
          </div>
          <div className="cash-register-status-actions">
            <span
              className={`cash-status-pill ${
                cashSession?.status === "open" ? "is-open" : "is-closed"
              }`}
            >
              <span className="cash-status-dot" />
              {cashSession?.status === "open"
                ? "Caixa aberto"
                : "Caixa fechado"}
            </span>

            {cashSession?.status !== "open" && (
              <button
                className="primary-button"
                type="button"
                onClick={() => {
                  setCashError(null);
                  setOperatorName("");
                  setShowOperatorModal(true);
                }}
                disabled={cashLoading || openingCash}
              >
                <Banknote size={17} />
                Abrir caixa
              </button>
            )}
          </div>
        </div>

        {cashLoading ? (
          <p className="muted">Carregando resumo do caixa...</p>
        ) : (
          <>
            <div className="cash-register-summary">
              <div className="cash-summary-total">
                <span>Total vendido</span>
                <strong>{formatCurrency(cashHistoryTotal)}</strong>
              </div>
              <div className="cash-summary-metric">
                <span>Vendas realizadas</span>
                <strong>{cashSalesCount}</strong>
              </div>
              <div className="cash-summary-metric">
                <span>Recebido em dinheiro</span>
                <strong>{formatCurrency(cashReceivedTotal)}</strong>
              </div>
            </div>

            <div className="cash-register-footer">
              <p className="muted">
                {cashSalesCount === 0
                  ? "Nenhuma venda registrada nesta sessão ainda."
                  : `${cashSalesCount} ${cashSalesCount === 1 ? "venda registrada" : "vendas registradas"} nesta sessão.`}
              </p>
              <button
                className="cash-history-button"
                type="button"
                onClick={() => setShowCashHistoryModal(true)}
                disabled={cashSales.length === 0}
              >
                <History size={17} />
                Ver histórico de vendas
              </button>
            </div>
          </>
        )}
      </section>

      <div className="sales-layout">
        <section className="sales-catalog">
          <div className="sales-section-title">
            <ShoppingBasket size={22} />
            <h2>Produtos disponíveis</h2>
          </div>

          <input
            className="product-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome, categoria ou sabor..."
            aria-label="Buscar produtos"
          />

          {loading ? (
            <p className="muted">Carregando produtos...</p>
          ) : filteredProducts.length === 0 ? (
            <div className="empty-state">
              <ShoppingBasket size={28} />
              <p>Nenhum produto disponível para essa busca.</p>
            </div>
          ) : (
            <div className="sales-product-grid">
              {filteredProducts.map((product) => (
                <button
                  className="sales-product-card"
                  key={product.id}
                  type="button"
                  onClick={() => addProduct(product)}
                  disabled={
                    !product.active ||
                    submitting ||
                    cashSession?.status !== "open"
                  }
                >
                  <span className="sales-product-category">
                    {product.category || "Produto"}
                  </span>
                  <strong>{product.name}</strong>
                  {product.flavor && (
                    <span className="sales-product-flavor">
                      {product.flavor}
                    </span>
                  )}
                  <span className="sales-product-price">
                    {formatCurrency(product.price)}
                  </span>
                  <span className="add-product-label">
                    <Plus size={15} /> Adicionar
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        <aside className="cart-panel">
          <div className="sales-section-title">
            <ReceiptText size={22} />
            <h2>Venda atual</h2>
          </div>

          <div className="cart-summary">
            <span>
              {totalItems} {totalItems === 1 ? "item" : "itens"}
            </span>
            <strong>{formatCurrency(total)}</strong>
          </div>

          {cart.length === 0 ? (
            <div className="cart-empty">
              <ShoppingBasket size={30} />
              <p>Sua venda está vazia.</p>
              <span>Selecione produtos para começar.</span>
            </div>
          ) : (
            <div className="cart-items">
              {cart.map((item) => (
                <article className="cart-item" key={item.product.id}>
                  <div className="cart-item-heading">
                    <div>
                      <strong>{item.product.name}</strong>
                      <span>{formatCurrency(item.product.price)} cada</span>
                    </div>

                    <button
                      className="icon-button"
                      type="button"
                      aria-label={`Remover ${item.product.name}`}
                      onClick={() => removeProduct(item.product.id)}
                      disabled={submitting}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="cart-item-bottom">
                    <div className="quantity-control">
                      <button
                        type="button"
                        className="quantity-button"
                        aria-label="Diminuir quantidade"
                        onClick={() => changeQuantity(item.product.id, -1)}
                        disabled={submitting}
                      >
                        <Minus size={14} />
                      </button>

                      <span>{item.quantity}</span>

                      <button
                        type="button"
                        className="quantity-button"
                        aria-label="Aumentar quantidade"
                        onClick={() => changeQuantity(item.product.id, 1)}
                        disabled={submitting}
                      >
                        <Plus size={14} />
                      </button>
                    </div>

                    <strong>
                      {formatCurrency(item.product.price * item.quantity)}
                    </strong>
                  </div>
                </article>
              ))}
            </div>
          )}

          <div className="payment-field">
            <label htmlFor="payment-method">Forma de pagamento</label>
            <select
              id="payment-method"
              value={paymentMethod}
              onChange={(event) =>
                setPaymentMethod(event.target.value as PaymentMethod)
              }
              disabled={submitting}
            >
              {paymentOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {paymentMethod === "on_credit" && (
            <div className="payment-field">
              <label htmlFor="credit-customer-name">Nome completo do comprador</label>
              <input
                id="credit-customer-name"
                type="text"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder="Nome e sobrenome do comprador"
                autoComplete="name"
                maxLength={160}
                disabled={submitting}
                required
              />
              <small>O nome será vinculado à dívida no contas a receber.</small>
            </div>
          )}

          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}

          {success && (
            <p className="success-message" role="status">
              {success}
            </p>
          )}

          <button
            className="primary-button checkout-button"
            type="button"
            onClick={() => {
              setError(null);
              setShowSaleConfirmation(true);
            }}
            disabled={
              cart.length === 0 ||
              submitting ||
              loading ||
              cashLoading ||
              cashSession?.status !== "open"
            }
          >
            Confirmar venda · {formatCurrency(total)}
          </button>

          <p className="cart-security-note">
            O preço final será validado pelo banco de dados.
          </p>
        </aside>
      </div>

      {showCashHistoryModal && (
        <CashHistoryModal
          sales={cashSales}
          onClose={() => setShowCashHistoryModal(false)}
        />
      )}

      {showOperatorModal && (
        <div className="cash-modal-backdrop">
          <section
            className="cash-modal operator-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="operator-modal-title"
          >
            <div className="operator-modal-mark">
              <Banknote size={26} />
            </div>
            <p className="eyebrow">CANTINA MAPE</p>
            <h2 id="operator-modal-title">Identificação do operador</h2>
            <p className="muted">
              Antes de iniciar as vendas, informe o nome da pessoa que ficará
              responsável por este caixa. Essa identificação ficará registrada
              na sessão, independentemente do usuário conectado.
            </p>

            <label htmlFor="cash-operator-name">Nome do operador</label>
            <input
              id="cash-operator-name"
              type="text"
              value={operatorName}
              onChange={(event) => setOperatorName(event.target.value)}
              placeholder="Digite o nome completo"
              maxLength={120}
              autoComplete="name"
              autoFocus
              disabled={openingCash}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !openingCash) {
                  void handleOpenCashRegister();
                }
              }}
            />

            {cashError && (
              <p className="error-message" role="alert">
                {cashError}
              </p>
            )}

            <div className="cash-modal-actions">
              <button
                className="primary-button"
                type="button"
                onClick={() => void handleOpenCashRegister()}
                disabled={openingCash || !operatorName.trim()}
              >
                {openingCash
                  ? "Registrando operador..."
                  : "Confirmar e abrir caixa"}
              </button>
            </div>
          </section>
        </div>
      )}

      {showSaleConfirmation && (
        <SaleConfirmationModal
          totalItems={totalItems}
          total={total}
          paymentMethod={paymentMethod}
          customerName={customerName.trim()}
          submitting={submitting}
          error={saleModalError}
          onCancel={() => {
            setShowSaleConfirmation(false);
            setSaleModalError(null);
          }}
          onConfirm={() => void handleSubmitSale()}
        />
      )}

      {showCloseModal && (
        <div className="cash-modal-backdrop">
          <section
            className="cash-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cash-modal-title"
          >
            <h2 id="cash-modal-title">Fechamento de caixa</h2>

            <p>
              Você tem <strong>{cashSalesCount} venda(s)</strong> nesta sessão.
              Confira o dinheiro físico antes de fechar.
            </p>

            <label htmlFor="counted-cash">Dinheiro contado (R$)</label>
            <input
              id="counted-cash"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={countedCash}
              onChange={(event) => {
                setCountedCash(event.target.value);
                setCloseModalError(null);
              }}
              placeholder="0,00"
              disabled={closing}
            />
            {closeModalError && (
              <p className="error-message modal-error" role="alert">
                {closeModalError}
              </p>
            )}
            <label htmlFor="closure-notes">Observações (opcional)</label>
            <textarea
              id="closure-notes"
              value={closureNotes}
              onChange={(event) => setClosureNotes(event.target.value)}
              placeholder="Ex.: diferença conferida com o responsável"
              rows={3}
              disabled={closing}
            />

            <div className="cash-modal-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setShowCloseModal(false)}
                disabled={closing}
              >
                Continuar no caixa
              </button>

              <button
                className="primary-button"
                type="button"
                onClick={() => void handleCloseCash()}
                disabled={closing}
              >
                {closing ? "Fechando..." : "Confirmar fechamento"}
              </button>
            </div>
          </section>
        </div>
      )}

      {closure && (
        <div className="cash-modal-backdrop">
          <section
            className="cash-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cash-closure-title"
          >
            <h2 id="cash-closure-title">Caixa fechado com sucesso</h2>

            <div className="cash-closure-results">
              <p>
                Total vendido:{" "}
                <strong>{formatCurrency(closure.total_sales)}</strong>
              </p>
              <p>
                Dinheiro esperado:{" "}
                <strong>{formatCurrency(closure.expected_cash)}</strong>
              </p>
              <p>
                Dinheiro contado:{" "}
                <strong>{formatCurrency(closure.counted_cash)}</strong>
              </p>
              <p>
                Diferença:{" "}
                <strong>
                  {closure.difference > 0 ? "+" : ""}
                  {formatCurrency(closure.difference)}
                </strong>
              </p>
            </div>

            <p className="muted">
              O CSV será baixado para você anexar no WhatsApp do responsável.
            </p>

            <div className="cash-modal-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setClosure(null);
                  setCsvDownloaded(false);
                  setShowOperatorModal(false);
                }}
              >
                Permanecer na tela
              </button>

              <button
                className="primary-button"
                type="button"
                onClick={handleDownloadClosureCsv}
              >
                {csvDownloaded ? "Baixar CSV novamente" : "1. Baixar CSV"}
              </button>

              <button
                className="primary-button"
                type="button"
                onClick={handleShareClosure}
                disabled={!csvDownloaded}
              >
                2. Enviar resumo pelo WhatsApp
              </button>

              <button
                className="secondary-button"
                type="button"
                onClick={() => void logout()}
              >
                Sair da conta
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
