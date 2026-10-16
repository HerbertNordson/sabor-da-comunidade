import { supabase } from "../supabase";
import type { ReportPeriod } from "./reports";

export async function sendSalesReport(period: ReportPeriod): Promise<void> {
  if (!supabase) {
    throw new Error("Supabase não configurado.");
  }

  const { data, error } = await supabase.functions.invoke("send-sales-report", {
    body: { period },
  });

  if (error) {
    throw new Error(
      error.message || "Não foi possível enviar o relatório por e-mail.",
    );
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  if (!data?.success) {
    throw new Error("Não foi possível confirmar o envio do relatório.");
  }
}
