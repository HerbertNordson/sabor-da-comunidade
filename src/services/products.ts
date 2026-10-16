import { supabase } from "../supabase";
import type { Product } from "../types";

function getClient() {
  if (!supabase) {
    throw new Error("Supabase não configurado.");
  }

  return supabase;
}

export interface ProductInput {
  name: string;
  category: string | null;
  flavor: string | null;
  description: string | null;
  price: number;
  active: boolean;
}

export async function getProducts(includeInactive = false) {
  let query = getClient()
    .from("products")
    .select(
      "id, name, category, flavor, description, price, cost, active, created_by, created_at, updated_at",
    )
    .order("name", { ascending: true });

  if (!includeInactive) {
    query = query.eq("active", true);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data ?? []) as Product[];
}

export async function saveProduct(input: ProductInput, productId?: string) {
  const payload = {
    name: input.name.trim(),
    category: input.category?.trim() || null,
    flavor: input.flavor?.trim() || null,
    description: input.description?.trim() || null,
    price: input.price,
    active: input.active,
  };

  if (!payload.name) {
    throw new Error("Informe o nome do produto.");
  }

  if (!Number.isFinite(payload.price) || payload.price < 0) {
    throw new Error("Informe um preço válido.");
  }

  const client = getClient();

  if (productId) {
    const { data, error } = await client
      .from("products")
      .update(payload)
      .eq("id", productId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await client
    .from("products")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function setProductActive(productId: string, active: boolean) {
  const { error } = await getClient()
    .from("products")
    .update({ active })
    .eq("id", productId);

  if (error) throw error;
}
