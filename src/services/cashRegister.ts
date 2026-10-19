import { supabase } from "../supabase";

export interface CashRegisterSession {
  id: string;
  seller_id: string;
  operator_name: string | null;
  status: "open" | "closed";
  opened_at: string;
  closed_at: string | null;
  expected_cash: number | null;
  counted_cash: number | null;
  difference: number | null;
  sales_count: number | null;
  total_sales: number | null;
  payment_totals: Record<string, number>;
  notes: string | null;
}

export interface CashRegisterClosure {
  session_id: string;
  status: "closed";
  closed_at: string;
  sales_count: number;
  total_sales: number;
  expected_cash: number;
  counted_cash: number;
  difference: number;
  payment_totals: Record<string, number>;
}

function getClient() {
  if (!supabase) {
    throw new Error("Supabase não configurado.");
  }

  return supabase;
}

export async function openCashRegister(operatorName: string): Promise<string> {
  const normalizedName = operatorName.trim();

  if (!normalizedName) {
    throw new Error("Informe o nome do operador do caixa.");
  }

  if (normalizedName.length > 120) {
    throw new Error("O nome do operador deve ter no máximo 120 caracteres.");
  }

  const { data, error } = await getClient().rpc("open_cash_register", {
    p_operator_name: normalizedName,
  });

  if (error) {
    throw new Error(error.message || "Não foi possível abrir o caixa.");
  }

  if (typeof data !== "string" || !data) {
    throw new Error("O Supabase não retornou o identificador do caixa.");
  }

  return data;
}

export async function getOpenCashRegister(): Promise<CashRegisterSession | null> {
  const { data, error } = await getClient()
    .from("cash_register_sessions")
    .select("*")
    .eq("status", "open")
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Não foi possível consultar o caixa.");
  }

  return data as CashRegisterSession | null;
}

export async function getCashRegisterSalesCount(
  sessionId: string,
): Promise<number> {
  const { count, error } = await getClient()
    .from("sales")
    .select("id", { count: "exact", head: true })
    .eq("cash_session_id", sessionId);

  if (error) {
    throw new Error(error.message || "Não foi possível consultar as vendas.");
  }

  return count ?? 0;
}

export async function closeCashRegister(
  sessionId: string,
  countedCash: number,
  notes?: string,
): Promise<CashRegisterClosure> {
  if (!Number.isFinite(countedCash) || countedCash < 0) {
    throw new Error("Informe um valor válido para o dinheiro contado.");
  }

  const { data, error } = await getClient().rpc("close_cash_register", {
    p_session_id: sessionId,
    p_counted_cash: countedCash,
    p_notes: notes?.trim() || null,
  });

  if (error) {
    throw new Error(error.message || "Não foi possível fechar o caixa.");
  }

  if (!data || typeof data !== "object" || data.status !== "closed") {
    throw new Error("Não foi possível confirmar o fechamento do caixa.");
  }

  return data as CashRegisterClosure;
}
