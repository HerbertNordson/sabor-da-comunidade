export type AppRole = "admin" | "seller";

export interface UserProfile {
  id: string;
  full_name: string;
  role: AppRole;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  category: string | null;
  flavor: string | null;
  description: string | null;
  price: number;
  cost: number | null;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type PaymentMethod =
  | "cash"
  | "pix"
  | "credit_card"
  | "debit_card"
  | "other";
