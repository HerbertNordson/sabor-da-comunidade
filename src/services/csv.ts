import type { SaleReport } from "./reports";
import { paymentMethodLabel } from "./reports";

function escapeCsv(value: string | number | null | undefined): string {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function formatCsvNumber(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

export function exportSalesCsv(sales: SaleReport[]): void {
  const headers = [
    "ID da venda",
    "Data da venda",
    "Forma de pagamento",
    "Produto",
    "Sabor",
    "Quantidade",
    "Preço unitário (R$)",
    "Total do item (R$)",
  ];

  const rows = sales.flatMap((sale) =>
    (sale.sale_items ?? []).map((item) => [
      sale.id,
      new Date(sale.sold_at).toLocaleString("pt-BR"),
      paymentMethodLabel(sale.payment_method),
      item.product_name,
      item.flavor ?? "",
      String(Number(item.quantity)),
      formatCsvNumber(Number(item.unit_price)),
      formatCsvNumber(Number(item.quantity) * Number(item.unit_price)),
    ]),
  );

  const csv = [headers, ...rows]
    .map((row) => row.map(escapeCsv).join(";"))
    .join("\r\n");

  // BOM para melhorar a compatibilidade com acentos no Excel.
  const blob = new Blob(["\uFEFF", csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);

  link.href = url;
  link.download = `cantina-mape-vendas-${date}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
