# Instruções para agentes (Cursor)

Este repositório segue a mesma doutrina modular que o **Claude Code** usa em `.claude/rules/`, espelhada em **`.cursor/rules/*.mdc`**.

## Regras Cursor (par com `.claude/rules/`)

| Área | `.mdc` |
|------|--------|
| Doutrina central | `01-core.mdc` |
| Request / fases | `02-request.mdc` |
| Debugging / RCA | `03-refresh.mdc` |
| Retrospectiva | `04-retro.mdc` |
| Comunicação | `05-comunicacao.mdc` |
| Testes (Vitest) | `06-testes.mdc` |
| Desenvolvimento | `07-desenvolvimento.mdc` |
| Frontend React | `08-frontend.mdc` |
| Migração API | `09-migration-map.mdc` |
| Convenções (`settings.json`) | `10-mypay-conventions.mdc` |

## Outros artefatos (Claude Code)

- Comandos slash: `.claude/commands/` (ex.: `/review`, `/commit`, `/test`) — no Cursor, equivalente manual ou fluxo do IDE.
- Skills: `.claude/skills/` — referência para prompts e checklists; não há loader automático no Cursor.
- Visão geral humana: `CLAUDE.md`.

## Redundância com `~/.cursor/rules/`

Se as mesmas normas já existirem como regras **globais** no seu usuário, o Cursor aplica **global + projeto**. Ajuste ou desative globais se notar instruções duplicadas.

## API — performance e comunicação (mypay-api)

Referência canônica no backend: seção **Comunicação rápida com o front** no `README` do repositório **mypay-api** (ajuste o path/URL se for fork privado).

- **Recorrências / futuro:** `GET /api/v1/transactions` **não** materializa recorrências na hora. Linhas futuras entram após `POST .../jobs/materialize-upcoming` (cron) e/ou mutação de recorrência no backend. O front não agenda jobs; em períodos futuros, lista pode depender do próximo job — tratar vazio transitório como timing, não necessariamente bug.
- **Paginação (opcional):** `limit`, `cursor` (próxima página). Resposta da primeira página sem cursor; páginas seguintes reutilizam o cursor do response anterior. Header **`X-Next-Cursor`** quando há próxima página. Telas com muitas linhas: preferir scroll infinito ou “carregar mais” em vez de buscar tudo de uma vez.
- **Listagens estáveis:** categorias, tags, contas, settings costumam responder com **ETag** e **Cache-Control: private** (TTL curto). Um cliente HTTP único; com cache de biblioteca, subir `staleTime` nesses GETs e invalidar após create/update/delete; se enviar **If-None-Match**, o servidor pode responder **304**. Gzip já vem do browser.
- **Montagem de telas:** disparar GETs independentes (contas, categorias, tags, …) em **paralelo** (`Promise.all` / queries paralelas), não em cascata sequencial.
- **CORS:** app e API em origens diferentes exigem `CORS_ORIGINS` no `.env` da API com a origem exata do front (`https://app...`, sem path). É ops/backend; o time de front precisa informar a URL de origem correta.
- **Fora do escopo do front:** cron `materialize-upcoming`, `weekly-overdue-email`, `JOB_SECRET`, deploy da API, proxy.

### Checklist rápido (Network)

Paralelismo nos GETs iniciais; transações longas com `limit` + `cursor` + `X-Next-Cursor`; menos refetch ao navegar (cache em listagens estáveis); sem regressão ao esperar transações futuras após mudança de recorrência (validar timing vs cron).

## API `GET /api/v1/transactions` (levantado do OpenAPI local)

Parâmetros de query suportados pelo backend (não há `q`, `account_id`, `category_id`, `date_from`/`date_to` na listagem; **paginação opcional:** `limit`, `cursor` — ver seção acima):

- `month` (1–12), `year` — janela calendário.
- `exclude_card_expenses` (default `true` no back) — se `true`, omite linhas com `credit_card_id`.
- Filtros de cartão: `credit_card_id`, `credit_card_invoice_id`, `paid_credit_card_id`, `paid_credit_card_invoice_id`.

**Recorrência e parcelas (por linha no JSON):** `recurrence_id` (vínculo ao template, `GET /api/v1/recurrences`); `installment` + `total_installments` com `total_installments > 1` = parcela; `installment_group_id` liga as parcelas de uma mesma compra. A UI **não** trata descrição/valor duplicados como bug sem olhar estes campos. Helpers: `src/utils/transactionSemantics.js` (`isRecurrenceLinkedTransaction`, `isInstallmentPlanTransaction`, `formatInstallmentFraction`).

Em **Lançamentos**, o parâmetro `excludeCardExpenses` do hook acompanha a **Origem** (só com `Todas` ou `Despesas na fatura` o `GET` traz `credit_card_id`); demais ecrãs usam o default da API quando aplicável.

**Busca / filtros de tipo, conta, categoria, tag** seguem em **client-side** após o fetch, com `matchTransaction` em `src/utils/searchTransactions.js` (normalização de acentos, tokens de valor com `>`, `R$`, `a..b`, e alguns atalhos de data). Quando o intervalo customizado (date range) está ativo, o hook ainda faz `GET` sem mês/ano e filtra por data no cliente (o backend não expõe `date_from`/`date_to` na listagem).

**Regras por tela (conta vs cartão):** a classificação usa sempre `credit_card_id` (compra na fatura), `paid_credit_card_id` / `paid_credit_card_invoice_id` (saída da conta para quitar a fatura), `account_id` e `is_transfer` — não inferir “cartão” por categoria ou descrição. **Lançamentos** chama o `GET` com `exclude_card_expenses=true` quando a **Origem** é `Conta` ou `Pagamentos de fatura` (padrão `txsrc=account`): o backend **não devolve** linhas com `credit_card_id` — compras na fatura ficam na aba **Cartões**; em **Lançamentos** entram contas, transferências e **saída para pagar fatura** (`paid_credit_card_id`). Só com **Origem** `Todas` (`txsrc=all`) ou `Despesas na fatura` (`txsrc=card`) o front usa `exclude_card_expenses=false` para exibir itens de fatura. A linha de cada item mostra “Fatura:” ou “Pag. fatura:” com base nesses FKs. **Dashboard, Contas, Orçamentos, notificações, exportação (parte contas)** usam o default da API (`exclude_card_expenses=true`) e, onde há gráfico de fatura, somam `useAllCardExpenses` (filtra client-side `credit_card_id`); **Relatórios** idem, somando contas e despesas de cartão de forma explícita. **Cartões** usa `useCardExpenses` / `useAllCardExpenses` para compras na fatura e `useBillPayments` (`GET` com `exclude_card_expenses=true` e filtro `paid_credit_card_id`). **Busca global** (⌘K) busca no mês atual com `excludeCardExpenses: false` para incluir cartão na listagem. Predicados reutilizáveis: `src/utils/transactionSemantics.js`.

**URL (refresh):** na aba Lançamentos, `txq`, `txtype`, `txsrc` (origem: `all` \| `account` \| `card` \| `bill_payment`), `txacc`, `txcat` (ids separados por vírgula), `txtag`, `txfrom`/`txto`, `txopen=1` sincronizam com o estado de busca e filtros.

## Faturas de cartão — escrita e amarração à invoice

Em qualquer fluxo “dentro de uma fatura” (Cartões com fatura aberta, importação com o **mês/ano do app** alinhado ao vencimento dessa fatura):

- Ao **criar** compra no cartão ou **batch apply** (`POST .../imports/{id}/apply` / itens de batch): enviar sempre **`credit_card_id`** e, quando a invoice já existir para aquele vencimento, **`credit_card_invoice_id`** (uuid da fatura, o mesmo do `GET /api/v1/credit-card-invoices?card_id=...` cuja `due_date` cai no **month/year do seletor global** — mesmo critério que `useCreditCardInvoices.findInvoiceByDueMonth`).
- O campo **`date`** continua sendo a **data da compra** no extrato; ela não precisa cair no intervalo de fechamento para a linha pertencer à fatura **desde que** `credit_card_invoice_id` esteja correto (evita depender só do auto-resolve do backend pela data).
- **Listar / somar** compras de uma fatura na UI: usar **`?credit_card_invoice_id=`** no `GET /transactions` ou filtrar por FK — **não** inferir só por `date` / `billMonth` legado.
- Front: `resolveCreditCardInvoiceIdForDueMonth` em `useFirestore.js`; `FaturaResult` e `Documents` preenchem `creditCardInvoiceId`; `buildInvoiceCardExpenseApiItem` / `buildCardExpenseBatchItem` / `useImportHistory.addCardExpense` propagam `credit_card_invoice_id`; Cartões inclui `creditCardInvoiceId` ao editar quando há `currentInvoice`.

## Exclusão em lote de transações

- **`POST /api/v1/transactions/batch-delete`**: modos exclusivos no JSON — `{ "transaction_ids": [...] }` (1–200 ids, sem duplicatas) **ou** `{ "credit_card_invoice_id": "..." }` (soft delete das compras da fatura, não remove pagamento). Resposta 200 com `results`, `deleted_count`, `failed_count` (modo fatura pode vir `results` vazio).
- Front: `src/services/transactionService.js` + `deleteCardExpensesBatch` em `useCardExpenses`; Cartões usa batch por ids no fluxo “Selecionar vários”. Sem `Idempotency-Key` nessa rota.

