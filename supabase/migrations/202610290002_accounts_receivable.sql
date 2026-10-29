-- Cantina MAPE: accounts receivable, payment history, and transactional credit sales.

CREATE TABLE IF NOT EXISTS public.accounts_receivable (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL UNIQUE REFERENCES public.sales(id) ON DELETE RESTRICT,
  customer_name text NOT NULL CHECK (char_length(trim(customer_name)) >= 3),
  original_amount numeric(12,2) NOT NULL CHECK (original_amount > 0),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'partial', 'paid')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.receivable_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receivable_id uuid NOT NULL REFERENCES public.accounts_receivable(id) ON DELETE RESTRICT,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  payment_method text NOT NULL
    CHECK (payment_method IN ('cash', 'pix', 'credit_card', 'debit_card', 'other')),
  received_at timestamptz NOT NULL DEFAULT now(),
  received_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  notes text CHECK (notes IS NULL OR char_length(notes) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS accounts_receivable_status_created_idx
  ON public.accounts_receivable(status, created_at DESC);
CREATE INDEX IF NOT EXISTS accounts_receivable_customer_idx
  ON public.accounts_receivable USING btree (lower(customer_name));
CREATE INDEX IF NOT EXISTS receivable_payments_receivable_received_idx
  ON public.receivable_payments(receivable_id, received_at DESC);

ALTER TABLE public.accounts_receivable ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receivable_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS accounts_receivable_admin_select ON public.accounts_receivable;
CREATE POLICY accounts_receivable_admin_select
  ON public.accounts_receivable FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'::public.app_role
  ));

DROP POLICY IF EXISTS receivable_payments_admin_select ON public.receivable_payments;
CREATE POLICY receivable_payments_admin_select
  ON public.receivable_payments FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'::public.app_role
  ));

REVOKE ALL ON public.accounts_receivable FROM anon, authenticated;
REVOKE ALL ON public.receivable_payments FROM anon, authenticated;
GRANT SELECT ON public.accounts_receivable TO authenticated;
GRANT SELECT ON public.receivable_payments TO authenticated;

-- Three-argument overload used by the updated app. The existing two-argument
-- function remains available for non-credit sales and still rejects on_credit.
CREATE OR REPLACE FUNCTION public.create_sale(
  p_items jsonb,
  p_payment_method text,
  p_customer_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
declare
  v_user_id uuid := (select auth.uid());
  v_sale_id uuid;
  v_cash_session_id uuid;
  v_item jsonb;
  v_product_id uuid;
  v_quantity integer;
  v_price numeric(10,2);
  v_name text;
  v_flavor text;
  v_active boolean;
  v_customer_name text := nullif(regexp_replace(trim(coalesce(p_customer_name, '')), '\s+', ' ', 'g'), '');
  v_total numeric(12,2);
begin
  if v_user_id is null then
    raise exception 'Autenticação obrigatória';
  end if;

  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1
     or jsonb_array_length(p_items) > 100 then
    raise exception 'Lista de itens inválida';
  end if;

  if p_payment_method is null
     or p_payment_method not in (
       'cash', 'pix', 'credit_card', 'debit_card', 'other', 'on_credit'
     ) then
    raise exception 'Forma de pagamento inválida';
  end if;

  if p_payment_method = 'on_credit' then
    if v_customer_name is null
       or char_length(v_customer_name) > 160
       or array_length(regexp_split_to_array(v_customer_name, '\s+'), 1) < 2 then
      raise exception 'Informe o nome completo do comprador (nome e sobrenome)';
    end if;
  elsif v_customer_name is not null then
    -- Do not attach customer debt data to an immediate-payment sale.
    v_customer_name := null;
  end if;

  -- Keep the existing lock that synchronizes sales and cash-register closing.
  select id
    into v_cash_session_id
  from public.cash_register_sessions
  where seller_id = v_user_id
    and status = 'open'
  for update;

  if not found then
    raise exception 'Não existe caixa aberto. Abra o caixa antes de vender.';
  end if;

  insert into public.sales (seller_id, payment_method, cash_session_id)
  values (v_user_id, p_payment_method::public.payment_method, v_cash_session_id)
  returning id into v_sale_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    begin
      v_product_id := (v_item ->> 'product_id')::uuid;
      v_quantity := (v_item ->> 'quantity')::integer;
    exception when others then
      raise exception 'Item inválido: informe produto e quantidade';
    end;

    if v_product_id is null then
      raise exception 'Produto inválido';
    end if;
    if v_quantity is null or v_quantity < 1 then
      raise exception 'Quantidade inválida';
    end if;

    select price, name, flavor, active
      into v_price, v_name, v_flavor, v_active
    from public.products
    where id = v_product_id
    for share;

    if not found or not v_active then
      raise exception 'Produto inexistente ou indisponível';
    end if;

    insert into public.sale_items (
      sale_id, product_id, product_name, flavor, quantity, unit_price
    ) values (
      v_sale_id, v_product_id, v_name, coalesce(v_flavor, ''), v_quantity, v_price
    );
  end loop;

  if p_payment_method = 'on_credit' then
    select coalesce(sum(quantity * unit_price), 0)::numeric(12,2)
      into v_total
    from public.sale_items
    where sale_id = v_sale_id;

    if v_total <= 0 then
      raise exception 'Não foi possível calcular o valor da venda';
    end if;

    insert into public.accounts_receivable (
      sale_id, customer_name, original_amount, status
    ) values (
      v_sale_id, v_customer_name, v_total, 'pending'
    );
  end if;

  return v_sale_id;
end;
$function$;

REVOKE ALL ON FUNCTION public.create_sale(jsonb, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_sale(jsonb, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_receivable_payment(
  p_receivable_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_received_at timestamptz DEFAULT now(),
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
declare
  v_user_id uuid := (select auth.uid());
  v_original_amount numeric(12,2);
  v_status text;
  v_paid numeric(12,2);
  v_balance numeric(12,2);
  v_new_paid numeric(12,2);
  v_new_balance numeric(12,2);
  v_new_status text;
  v_payment_id uuid;
  v_received_at timestamptz := coalesce(p_received_at, now());
begin
  if v_user_id is null then
    raise exception 'Autenticação obrigatória';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = v_user_id and p.role = 'admin'::public.app_role
  ) then
    raise exception 'Somente administradores podem registrar recebimentos';
  end if;

  if p_receivable_id is null then
    raise exception 'Dívida não informada';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2) then
    raise exception 'Informe um valor de pagamento válido, maior que zero e com até duas casas decimais';
  end if;
  if p_payment_method is null or p_payment_method not in ('cash', 'pix', 'credit_card', 'debit_card', 'other') then
    raise exception 'Forma de recebimento inválida';
  end if;
  if char_length(coalesce(p_notes, '')) > 500 then
    raise exception 'As observações devem ter no máximo 500 caracteres';
  end if;

  select original_amount, status
    into v_original_amount, v_status
  from public.accounts_receivable
  where id = p_receivable_id
  for update;

  if not found then
    raise exception 'Dívida não encontrada';
  end if;
  if v_status = 'paid' then
    raise exception 'Esta dívida já está quitada';
  end if;

  select coalesce(sum(amount), 0)::numeric(12,2)
    into v_paid
  from public.receivable_payments
  where receivable_id = p_receivable_id;

  v_balance := (v_original_amount - v_paid)::numeric(12,2);
  if p_amount > v_balance then
    raise exception 'O pagamento excede o saldo devedor de R$ %', to_char(v_balance, 'FM999999990D00');
  end if;

  insert into public.receivable_payments (
    receivable_id, amount, payment_method, received_at, received_by, notes
  ) values (
    p_receivable_id, p_amount::numeric(12,2), p_payment_method, v_received_at,
    v_user_id, nullif(trim(p_notes), '')
  ) returning id into v_payment_id;

  v_new_paid := (v_paid + p_amount)::numeric(12,2);
  v_new_balance := (v_original_amount - v_new_paid)::numeric(12,2);
  v_new_status := case when v_new_balance = 0 then 'paid' else 'partial' end;

  update public.accounts_receivable
  set status = v_new_status, updated_at = now()
  where id = p_receivable_id;

  return jsonb_build_object(
    'payment_id', v_payment_id,
    'receivable_id', p_receivable_id,
    'original_amount', v_original_amount,
    'paid_amount', v_new_paid,
    'balance', v_new_balance,
    'status', v_new_status,
    'received_at', v_received_at
  );
end;
$function$;

REVOKE ALL ON FUNCTION public.record_receivable_payment(uuid, numeric, text, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_receivable_payment(uuid, numeric, text, timestamptz, text) TO authenticated;
