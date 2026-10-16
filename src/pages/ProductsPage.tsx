import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Package, Pencil, Plus, Power, Save } from "lucide-react";
import { Link } from "react-router-dom";

import { useAuth } from "../contexts/AuthContext";
import {
  getProducts,
  saveProduct,
  setProductActive,
  type ProductInput,
} from "../services/products";
import type { Product } from "../types";

const emptyForm: ProductInput = {
  name: "",
  category: "",
  flavor: "",
  description: "",
  price: 0,
  active: true,
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export default function ProductsPage() {
  const { profile } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState<ProductInput>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadProducts() {
    setLoading(true);
    setError(null);

    try {
      const data = await getProducts(true);
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
  }

  useEffect(() => {
    void loadProducts();
  }, []);

  function updateField<K extends keyof ProductInput>(
    field: K,
    value: ProductInput[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function startEditing(product: Product) {
    setEditingId(product.id);
    setForm({
      name: product.name,
      category: product.category ?? "",
      flavor: product.flavor ?? "",
      description: product.description ?? "",
      price: product.price,
      active: product.active,
    });
    setError(null);
    setSuccess(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await saveProduct(form, editingId ?? undefined);
      setSuccess(
        editingId
          ? "Produto atualizado com sucesso."
          : "Produto cadastrado com sucesso.",
      );
      resetForm();
      await loadProducts();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível salvar o produto.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(product: Product) {
    setError(null);
    setSuccess(null);

    try {
      await setProductActive(product.id, !product.active);
      setSuccess(product.active ? "Produto desativado." : "Produto reativado.");
      await loadProducts();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível alterar o produto.",
      );
    }
  }

  const visibleProducts = products.filter(
    (product) => showInactive || product.active,
  );

  return (
    <main className="app-page">
      <header className="app-header">
        <div>
          <Link className="back-link" to="/admin">
            <ArrowLeft size={16} /> Voltar ao painel
          </Link>
          <p className="eyebrow">Sabor da Comunidade</p>
          <h1>Produtos</h1>
          <p className="muted">
            Cadastre e mantenha o catálogo da cantina atualizado.
          </p>
        </div>
      </header>

      <section className="product-form-panel">
        <div className="section-heading">
          <Package size={22} />
          <h2>{editingId ? "Editar produto" : "Novo produto"}</h2>
        </div>

        <form className="product-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="product-name">Nome do produto *</label>
            <input
              id="product-name"
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
              placeholder="Ex.: Bolo de chocolate"
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="product-category">Categoria</label>
            <input
              id="product-category"
              value={form.category ?? ""}
              onChange={(event) => updateField("category", event.target.value)}
              placeholder="Ex.: Lanche"
            />
          </div>

          <div className="form-field">
            <label htmlFor="product-flavor">Sabor</label>
            <input
              id="product-flavor"
              value={form.flavor ?? ""}
              onChange={(event) => updateField("flavor", event.target.value)}
              placeholder="Ex.: Frango"
            />
          </div>

          <div className="form-field">
            <label htmlFor="product-price">Preço (R$) *</label>
            <input
              id="product-price"
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={(event) =>
                updateField("price", Number(event.target.value))
              }
              required
            />
          </div>

          <div className="form-field form-field-wide">
            <label htmlFor="product-description">Descrição</label>
            <textarea
              id="product-description"
              rows={3}
              value={form.description ?? ""}
              onChange={(event) =>
                updateField("description", event.target.value)
              }
              placeholder="Informações adicionais sobre o produto"
            />
          </div>

          {editingId && (
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) =>
                  updateField("active", event.target.checked)
                }
              />
              Produto ativo
            </label>
          )}

          {error && <p className="error-message">{error}</p>}
          {success && <p className="success-message">{success}</p>}

          <div className="form-actions">
            <button className="primary-button" type="submit" disabled={saving}>
              <Save size={17} />
              {saving
                ? "Salvando..."
                : editingId
                  ? "Salvar alterações"
                  : "Cadastrar produto"}
            </button>

            {editingId && (
              <button
                className="secondary-button"
                type="button"
                onClick={resetForm}
              >
                Cancelar edição
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="products-panel">
        <div className="section-heading section-heading-between">
          <h2>Catálogo de produtos</h2>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(event) => setShowInactive(event.target.checked)}
            />
            Mostrar inativos
          </label>
        </div>

        {loading ? (
          <p className="muted">Carregando produtos...</p>
        ) : visibleProducts.length === 0 ? (
          <div className="empty-state">
            <Package size={28} />
            <p>Nenhum produto encontrado.</p>
          </div>
        ) : (
          <div className="products-list">
            {visibleProducts.map((product) => (
              <article className="product-row" key={product.id}>
                <div className="product-info">
                  <h3>{product.name}</h3>
                  <p>
                    {[product.category, product.flavor]
                      .filter(Boolean)
                      .join(" · ") || "Sem categoria ou sabor"}
                  </p>
                  <strong>{formatCurrency(product.price)}</strong>
                  {!product.active && (
                    <span className="inactive-label">Inativo</span>
                  )}
                </div>

                <div className="product-actions">
                  <button
                    className="icon-button"
                    type="button"
                    onClick={() => startEditing(product)}
                    aria-label={`Editar ${product.name}`}
                    title="Editar produto"
                  >
                    <Pencil size={17} />
                  </button>

                  <button
                    className="icon-button"
                    type="button"
                    onClick={() => void toggleActive(product)}
                    aria-label={`${product.active ? "Desativar" : "Reativar"} ${product.name}`}
                    title={product.active ? "Desativar" : "Reativar"}
                  >
                    {product.active ? <Power size={17} /> : <Plus size={17} />}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <p className="muted page-note">
        Sessão de {profile?.full_name || "administrador"}. Produtos vendidos
        anteriormente devem ser desativados, não excluídos.
      </p>
    </main>
  );
}
