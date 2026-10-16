import { supabase } from "../supabase";

export interface SaleReportItem {
  quantity: number;
  unit_price: number;
  product_name: string;
  flavor: string | null;
}

export interface SaleReport {
  id: string;
  seller_id: string;
  payment_method: string;
  sold_at: string;
  created_at: string;
  sale_items: SaleReportItem[];
}

export interface SalesSummary {
  salesCount: number;
  itemsCount: number;
  revenue: number;
  averageTicket: number;
  byPayment: Record<string, number>;
}

function getClient() {
  if (!supabase) {
    throw new Error("Supabase não configurado.");
  }

  return supabase;
}

export type ReportPeriod = "today" | "7days" | "30days";

function getPeriodStart(period: ReportPeriod): Date {
  const start = new Date();

  if (period === "today") {
    start.setHours(0, 0, 0, 0);
  } else {
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (period === "7days" ? 6 : 29));
  }

  return start;
}

export async function getSalesReport(
  period: ReportPeriod = "today",
): Promise<SaleReport[]> {
  const start = getPeriodStart(period);

  const { data, error } = await getClient()
    .from("sales")
    .select(
      `
      id,
      seller_id,
      payment_method,
      sold_at,
      created_at,
      sale_items (
        quantity,
        unit_price,
        product_name,
        flavor
      )
    `,
    )
    .gte("sold_at", start.toISOString())
    .order("sold_at", { ascending: false });

  if (error) throw error;

  return (data ?? []) as unknown as SaleReport[];
}

export function summarizeSales(sales: SaleReport[]): SalesSummary {
  const summary: SalesSummary = {
    salesCount: sales.length,
    itemsCount: 0,
    revenue: 0,
    averageTicket: 0,
    byPayment: {},
  };

  for (const sale of sales) {
    let saleTotal = 0;

    for (const item of sale.sale_items ?? []) {
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unit_price);

      summary.itemsCount += quantity;
      saleTotal += quantity * unitPrice;
    }

    summary.revenue += saleTotal;

    summary.byPayment[sale.payment_method] =
      (summary.byPayment[sale.payment_method] ?? 0) + saleTotal;
  }

  summary.averageTicket =
    summary.salesCount > 0 ? summary.revenue / summary.salesCount : 0;

  return summary;
}

export function paymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    cash: "Dinheiro",
    pix: "Pix",
    credit_card: "Cartão de crédito",
    debit_card: "Cartão de débito",
    other: "Outro",
  };

  return labels[method] ?? method;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
