import { supabase } from "../supabase";
import type { PaymentMethod } from "../types";

export interface SaleItemInput {
  product_id: string;
  quantity: number;
}

function getClient() {
  if (!supabase) {
    throw new Error("Supabase não configurado.");
  }

  return supabase;
}

export async function createSale(
  items: SaleItemInput[],
  paymentMethod: PaymentMethod,
  customerName: string | null = null,
): Promise<string> {
  if (items.length === 0) {
    throw new Error("Adicione pelo menos um produto à venda.");
  }

  const { data, error } = await getClient().rpc("create_sale", {
    p_items: items,
    p_payment_method: paymentMethod,
    p_customer_name: customerName,
  });

  if (error) {
    throw new Error(error.message || "Não foi possível registrar a venda.");
  }

  if (typeof data !== "string" || !data) {
    throw new Error(
      "A venda foi enviada, mas não recebemos seu identificador.",
    );
  }

  return data;
}
