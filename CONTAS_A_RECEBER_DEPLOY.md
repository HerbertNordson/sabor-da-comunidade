# Cantina MAPE — implantação de Contas a Receber

## O que foi incluído

- Opção **A prazo** no checkout, exigindo nome completo do comprador.
- Criação transacional da venda e do respectivo título em `accounts_receivable`.
- Área administrativa em `/admin/contas-a-receber` para pesquisar dívidas, consultar itens e histórico e registrar pagamentos parciais ou integrais.
- Registro de auditoria de cada recebimento (valor, método, data, usuário e observações).
- Bloqueio no banco para impedir pagamentos maiores que o saldo, inclusive em operações concorrentes.
- Fechamento de caixa mantém o dinheiro esperado baseado somente nas vendas em dinheiro; vendas a prazo continuam compondo o total vendido, não o dinheiro recebido.

## Aplicar as migrations no Supabase

Faça backup antes de alterar o banco de produção. Aplique na ordem abaixo e aguarde o primeiro comando terminar/confirmar antes de aplicar o segundo:

1. `supabase/migrations/202610290001_add_on_credit_payment_method.sql`
2. `supabase/migrations/202610290002_accounts_receivable.sql`

A primeira migration adiciona `on_credit` ao enum `public.payment_method`. Ela fica isolada porque o PostgreSQL exige que o novo valor do enum seja confirmado antes de ser usado pela função criada na migration seguinte.

Se estiver usando o SQL Editor, copie e execute o conteúdo de cada arquivo separadamente, na ordem acima. Não execute a segunda no mesmo bloco/transação da primeira.

## Verificação após a migration

Execute no SQL Editor:

```sql
select typname, enumlabel
from pg_type t
join pg_enum e on e.enumtypid = t.oid
where t.typname = 'payment_method'
order by e.enumsortorder;

select to_regclass('public.accounts_receivable') as accounts_receivable,
       to_regclass('public.receivable_payments') as receivable_payments;

select p.proname, pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('create_sale', 'record_receivable_payment')
order by p.proname, arguments;
```

Confirme que `on_credit`, as duas tabelas, a função `create_sale(jsonb, text, text)` e a função `record_receivable_payment(uuid, numeric, text, timestamptz, text)` aparecem.

## Teste funcional recomendado

Faça primeiro em ambiente de teste ou com um comprador e itens de baixo valor:

1. Abra o caixa como vendedor e registre uma venda comum; confirme que o fluxo anterior continua funcionando.
2. Registre uma venda **A prazo** com nome e sobrenome; confirme que aparece no painel administrativo.
3. Registre um pagamento parcial; confira o saldo e o histórico.
4. Registre o saldo restante; confira que a dívida muda para **Quitada**.
5. Feche um caixa de teste e confira que vendas a prazo não aumentam `expected_cash`.
6. Entre com um usuário vendedor e confirme que não consegue consultar as tabelas nem executar a função de recebimento.

## Segurança e arquivos

- O acesso à tela é protegido pela rota administrativa, mas a autorização também é aplicada no banco por RLS e pelas funções `SECURITY DEFINER`.
- Não compartilhe arquivos da pasta `supabase/.temp`; eles podem conter metadados do projeto vinculado.
- Configure as variáveis de ambiente da aplicação (`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`) no ambiente de implantação.

## Validação

A migration deve ser aplicada e testada no seu Supabase. A compilação automatizada deste pacote não pôde ser concluída neste ambiente porque a instalação das dependências excedeu o tempo disponível; portanto, não considere o build validado até executar `npm install` (ou `yarn install`) e `npm run build` localmente/na CI.
