import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function csvEscape(value: unknown): string {
  let text = String(value ?? "");

  // Evita que textos exportados sejam interpretados como fórmulas no Excel.
  if (/^[\t\r\n ]*[=+\-@]/.test(text)) {
    text = `'${text}`;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

function csvNumber(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

function getStartDate(period: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  const date = new Date(
    Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)),
  );

  const daysBack = period === "7days" ? 6 : period === "30days" ? 29 : 0;
  date.setUTCDate(date.getUTCDate() - daysBack);

  return `${date.toISOString().slice(0, 10)}T00:00:00-03:00`;
}

function paymentLabel(method: string): string {
  const labels: Record<string, string> = {
    cash: "Dinheiro",
    pix: "Pix",
    credit_card: "Cartão de crédito",
    debit_card: "Cartão de débito",
    other: "Outro",
  };

  return labels[method] ?? method;
}

function encodeBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";

  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }

  return btoa(binary);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método não permitido." }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");

    const publishableKeys = JSON.parse(
      Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}",
    ) as Record<string, string>;

    const secretKeys = JSON.parse(
      Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}",
    ) as Record<string, string>;

    const publishableKey = publishableKeys.default;
    const secretKey = secretKeys.default;

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const recipient = Deno.env.get("REPORT_EMAIL_TO");
    const sender = Deno.env.get("REPORT_EMAIL_FROM");

    if (
      !supabaseUrl ||
      !publishableKey ||
      !secretKey ||
      !resendKey ||
      !recipient ||
      !sender
    ) {
      throw new Error("Configuração obrigatória ausente na Edge Function.");
    }

    const authorization = req.headers.get("Authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Sessão não informada." }, 401);
    }

    const token = authorization.slice("Bearer ".length);

    // Valida a identidade usando o token recebido do usuário.
    const authClient = createClient(supabaseUrl, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authError } =
      await authClient.auth.getUser(token);

    if (authError || !authData.user) {
      return jsonResponse({ error: "Sessão inválida ou expirada." }, 401);
    }

    // Cliente privilegiado: utilizado somente depois da autenticação.
    const adminClient = createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", authData.user.id)
      .single();

    if (profileError || profile?.role !== "admin") {
      return jsonResponse(
        { error: "Somente administradores podem enviar relatórios." },
        403,
      );
    }

    let body: { period?: unknown };

    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Corpo da requisição inválido." }, 400);
    }

    const period = body.period;

    if (
      typeof period !== "string" ||
      !["today", "7days", "30days"].includes(period)
    ) {
      return jsonResponse({ error: "Período inválido." }, 400);
    }

    const { data: sales, error: salesError } = await adminClient
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
      .gte("sold_at", getStartDate(period))
      .order("sold_at", { ascending: false });

    if (salesError) {
      console.error("Erro ao consultar vendas:", salesError.message);
      return jsonResponse(
        { error: "Não foi possível consultar as vendas." },
        500,
      );
    }

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

    const rows = (sales ?? []).flatMap((sale) =>
      (sale.sale_items ?? []).map((item) => [
        sale.id,
        new Date(sale.sold_at).toLocaleString("pt-BR", {
          timeZone: "America/Sao_Paulo",
        }),
        paymentLabel(sale.payment_method),
        item.product_name,
        item.flavor ?? "",
        String(Number(item.quantity)),
        csvNumber(Number(item.unit_price)),
        csvNumber(Number(item.quantity) * Number(item.unit_price)),
      ]),
    );

    const csv =
      "\uFEFF" +
      [headers, ...rows]
        .map((row) => row.map(csvEscape).join(";"))
        .join("\r\n");

    const periodLabel: Record<string, string> = {
      today: "hoje",
      "7days": "ultimos-7-dias",
      "30days": "ultimos-30-dias",
    };

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: sender,
        to: [recipient],
        subject: `Relatório de vendas — Cantina MAPE (${periodLabel[period]})`,
        text:
          `Segue em anexo o relatório de vendas da Cantina MAPE referente a ${periodLabel[period]}.\n\n` +
          `Vendas encontradas: ${(sales ?? []).length}.\n` +
          "O arquivo CSV pode ser aberto no Excel ou Google Sheets.",
        attachments: [
          {
            filename: `cantina-mape-vendas-${periodLabel[period]}.csv`,
            content: encodeBase64(csv),
          },
        ],
      }),
    });

    if (!emailResponse.ok) {
      const resendError = await emailResponse.text();

      // Registra o motivo retornado pelo Resend, sem expor credenciais.
      console.error(
        `Resend recusou o envio. Status: ${emailResponse.status}. Resposta: ${resendError}`,
      );

      return jsonResponse(
        { error: "O serviço de e-mail não conseguiu enviar o relatório." },
        502,
      );
    }

    return jsonResponse({
      success: true,
      message: "Solicitação de envio aceita pelo serviço de e-mail.",
    });
  } catch (error) {
    console.error(
      "Erro inesperado na função:",
      error instanceof Error ? error.message : "Erro desconhecido",
    );

    return jsonResponse(
      { error: "Erro inesperado ao enviar o relatório." },
      500,
    );
  }
});
