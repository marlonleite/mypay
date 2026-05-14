# AGENTS.md

Instruções de agentes para o **myPay**. Doutrina modular espelhada entre `.claude/rules/` (Claude Code) e `.cursor/rules/` (Cursor).

## Regras (par `.md` / `.mdc`)

| Área | Arquivo |
|------|---------|
| Doutrina central (fluxo, ética, commits) | `01-core` |
| Comunicação (PT-BR, modos) | `05-comunicacao` |
| Princípios de código | `07-desenvolvimento` |
| Frontend React | `08-frontend` |
| Migração API Postgres | `09-migration-map` |
| Convenções (`settings.json`) Cursor | `10-mypay-conventions` (só `.mdc`) |

## Outros artefatos (Claude Code)

- **Slash commands** (`.claude/commands/`): `/refresh` (RCA), `/retro`, `/review`, `/commit`, `/test`, `/map`.
- **Skills** (`.claude/skills/`): referência de prompts/checklists.
- **Visão geral**: `CLAUDE.md`.

## Notas backend / API (mypay-api)

Referência canônica: seção **Comunicação rápida com o front** no README do `mypay-api`.

### Listagem de transações — `GET /api/v1/transactions`

- Parâmetros: `month` (1–12), `year`, `exclude_card_expenses` (default `true`), `credit_card_id`, `credit_card_invoice_id`, `paid_credit_card_id`, `paid_credit_card_invoice_id`, `limit`, `cursor`.
- **Sem** `q`, `account_id`, `category_id`, `date_from`/`date_to` — busca e filtros adicionais são client-side via `matchTransaction` em `src/utils/searchTransactions.js`.
- Paginação opcional via cursor + header `X-Next-Cursor`.

### Semântica de transação

- **Recorrência**: `recurrence_id` vincula ao template (`GET /api/v1/recurrences`). Linhas futuras só aparecem após `POST .../jobs/materialize-upcoming` (cron) — front não agenda jobs; vazio transitório pode ser timing.
- **Parcela**: `total_installments > 1`. `installment_group_id` liga parcelas da mesma compra.
- Helpers: `src/utils/transactionSemantics.js`.

### Classificação conta vs cartão

Use sempre os FKs (`credit_card_id`, `paid_credit_card_id`, `paid_credit_card_invoice_id`, `account_id`, `is_transfer`). **Não** inferir cartão por categoria ou descrição.

- **Lançamentos**: `Origem` controla `exclude_card_expenses`:
  - `Conta` ou `Pagamentos de fatura` (`txsrc=account/bill_payment`) → `true` (oculta compras de fatura)
  - `Todas` ou `Despesas na fatura` (`txsrc=all/card`) → `false`
- **Dashboard, Contas, Orçamentos, Relatórios, Notificações**: default API (`true`), soma cartões com `useAllCardExpenses`.
- **Cartões**: `useCardExpenses` / `useAllCardExpenses` para compras; `useBillPayments` para saída.
- **Busca global** (⌘K): `excludeCardExpenses: false` no mês atual.

### URL sync (Lançamentos)

`txq`, `txtype`, `txsrc`, `txacc`, `txcat` (ids `,`), `txtag`, `txfrom`/`txto`, `txopen=1`.

### Faturas — escrita e amarração

- **Criar/batch-apply em fatura**: envie `credit_card_id` e, quando a invoice existe pro vencimento, `credit_card_invoice_id` (uuid da fatura — vencimento alinhado ao mês/ano do seletor global; ver `useCreditCardInvoices.findInvoiceByDueMonth`).
- `date` continua sendo a data da compra; FK explícito tem precedência sobre auto-resolve por data.
- **Listar/somar fatura**: filtre por `credit_card_invoice_id`, não por `date` / `billMonth` legado.
- Front: `resolveCreditCardInvoiceIdForDueMonth` (`useFirestore.js`), `FaturaResult`, `Documents`, `buildInvoiceCardExpenseApiItem`, `buildCardExpenseBatchItem`, `useImportHistory.addCardExpense`.

### Exclusão / atualização em lote

- **`POST /api/v1/transactions/batch-delete`**: modos exclusivos — `{ transaction_ids: [1..200] }` **ou** `{ credit_card_invoice_id }` (soft-delete das compras, preserva pagamento). Sem `Idempotency-Key`.
- **`POST /api/v1/transactions/batch-update`**: até 200 ids únicos + `patch` (≥1 campo). `atomic: true` reverte tudo em erro.
- Front: `transactionService.batchUpdateTransactions` / `batchDeleteTransactions`, `useTransactions().updateTransactionsBatch`.

### Settings — aparência

`GET/PUT /api/v1/settings` aceita opcional snake_case em `user_settings`:
- `accent_preset`: `violet` | `nubank` | `aqua` | `calm` | `neon` | `bank`
- `contrast_follow_system`: bool
- `high_contrast`: bool

Migração de tabela pendente no backend; até lá front usa `localStorage` e só `console.warn` em falha. Ver `settingsService.mapSettings`, `ThemeContext.jsx`, `appearance.js`.

### Performance

- GETs iniciais em paralelo (`Promise.all`).
- Listagens estáveis (categorias, tags, contas, settings) costumam vir com **ETag** + `Cache-Control: private` — usar `staleTime` alto e invalidar após mutação; servidor pode responder **304** com `If-None-Match`.
- Transações longas: preferir scroll infinito / "carregar mais" via `cursor` + `X-Next-Cursor`.

### Fora do escopo do front

Cron `materialize-upcoming`, `weekly-overdue-email`, `JOB_SECRET`, deploy da API, CORS (`CORS_ORIGINS` no `.env` da API).
