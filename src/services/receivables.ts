import { supabase } from "../supabase";

export type ReceivableStatus = "pending" | "partial" | "paid";
export type ReceiptPaymentMethod = "cash" | "pix" | "credit_card" | "debit_card" | "other";

export interface ReceivablePayment {
  id: string;
  amount: number;
  payment_method: ReceiptPaymentMethod;
  received_at: string;
  received_by: string;
  notes: string | null;
}

export interface Receivable {
  id: string;
  sale_id: string;
  customer_name: string;
  original_amount: number;
  status: ReceivableStatus;
  created_at: string;
  updated_at: string;
  sale: {
    id: string;
    sold_at: string;
    seller_id: string;
    sale_items: { product_name: string; flavor: string | null; quantity: number; unit_price: number }[];
  };
  payments: Pick<ReceivablePayment, "amount">[];
}

export interface ReceivableDetails extends Omit<Receivable, "payments"> {
  payments: ReceivablePayment[];
}

function getClient() {
  if (!supabase) throw new Error("Supabase não configurado.");
  return supabase;
}

export async function getReceivables(): Promise<Receivable[]> {
  const { data, error } = await getClient()
    .from("accounts_receivable")
    .select(`
      id, sale_id, customer_name, original_amount, status, created_at, updated_at,
      sale:sales!accounts_receivable_sale_id_fkey (
        id, sold_at, seller_id,
        sale_items (product_name, flavor, quantity, unit_price)
      ),
      payments:receivable_payments (amount)
    `)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message || "Não foi possível carregar as dívidas.");
  return (data ?? []) as unknown as Receivable[];
}

export async function getReceivableDetails(id: string): Promise<ReceivableDetails> {
  const { data, error } = await getClient()
    .from("accounts_receivable")
    .select(`
      id, sale_id, customer_name, original_amount, status, created_at, updated_at,
      sale:sales!accounts_receivable_sale_id_fkey (
        id, sold_at, seller_id,
        sale_items (product_name, flavor, quantity, unit_price)
      ),
      payments:receivable_payments (id, amount, payment_method, received_at, received_by, notes)
    `)
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message || "Não foi possível carregar os detalhes da dívida.");
  return data as unknown as ReceivableDetails;
}

export async function recordReceivablePayment(input: {
  receivableId: string;
  amount: number;
  paymentMethod: ReceiptPaymentMethod;
  receivedAt?: string;
  notes?: string;
}): Promise<{ balance: number; status: ReceivableStatus; paid_amount: number }> {
  const { data, error } = await getClient().rpc("record_receivable_payment", {
    p_receivable_id: input.receivableId,
    p_amount: input.amount,
    p_payment_method: input.paymentMethod,
    p_received_at: input.receivedAt ?? new Date().toISOString(),
    p_notes: input.notes?.trim() || null,
  });

  if (error) throw new Error(error.message || "Não foi possível registrar o recebimento.");
  return data as { balance: number; status: ReceivableStatus; paid_amount: number };
}

export function getReceivablePaidAmount(receivable: Pick<Receivable, "payments">): number {
  return receivable.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
}

export function receiptPaymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    cash: "Dinheiro",
    pix: "Pix",
    credit_card: "Cartão de crédito",
    debit_card: "Cartão de débito",
    other: "Outro",
  };
  return labels[method] ?? method;
}
