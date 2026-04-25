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

## API `GET /api/v1/transactions` (levantado do OpenAPI local)

Parâmetros de query suportados pelo backend (não há `q`, `account_id`, `category_id`, `date_from`/`date_to` nem `limit`/`offset` na listagem):

- `month` (1–12), `year` — janela calendário.
- `exclude_card_expenses` (default `true` no back) — se `true`, omite linhas com `credit_card_id`.
- Filtros de cartão: `credit_card_id`, `credit_card_invoice_id`, `paid_credit_card_id`, `paid_credit_card_invoice_id`.

**Recorrência e parcelas (por linha no JSON):** `recurrence_id` (vínculo ao template, `GET /api/v1/recurrences`); `installment` + `total_installments` com `total_installments > 1` = parcela; `installment_group_id` liga as parcelas de uma mesma compra. A UI **não** trata descrição/valor duplicados como bug sem olhar estes campos. Helpers: `src/utils/transactionSemantics.js` (`isRecurrenceLinkedTransaction`, `isInstallmentPlanTransaction`, `formatInstallmentFraction`).

Em **Lançamentos**, o parâmetro `excludeCardExpenses` do hook acompanha a **Origem** (só com `Todas` ou `Despesas na fatura` o `GET` traz `credit_card_id`); demais ecrãs usam o default da API quando aplicável.

**Busca / filtros de tipo, conta, categoria, tag** seguem em **client-side** após o fetch, com `matchTransaction` em `src/utils/searchTransactions.js` (normalização de acentos, tokens de valor com `>`, `R$`, `a..b`, e alguns atalhos de data). Quando o intervalo customizado (date range) está ativo, o hook ainda faz `GET` sem mês/ano e filtra por data no cliente (o backend não expõe `date_from`/`date_to` na listagem).

**Regras por tela (conta vs cartão):** a classificação usa sempre `credit_card_id` (compra na fatura), `paid_credit_card_id` / `paid_credit_card_invoice_id` (saída da conta para quitar a fatura), `account_id` e `is_transfer` — não inferir “cartão” por categoria ou descrição. **Lançamentos** chama o `GET` com `exclude_card_expenses=true` quando a **Origem** é `Conta` ou `Pagamentos de fatura` (padrão `txsrc=account`): o backend **não devolve** linhas com `credit_card_id` — compras na fatura ficam na aba **Cartões**; em **Lançamentos** entram contas, transferências e **saída para pagar fatura** (`paid_credit_card_id`). Só com **Origem** `Todas` (`txsrc=all`) ou `Despesas na fatura` (`txsrc=card`) o front usa `exclude_card_expenses=false` para exibir itens de fatura. A linha de cada item mostra “Fatura:” ou “Pag. fatura:” com base nesses FKs. **Dashboard, Contas, Orçamentos, notificações, exportação (parte contas)** usam o default da API (`exclude_card_expenses=true`) e, onde há gráfico de fatura, somam `useAllCardExpenses` (filtra client-side `credit_card_id`); **Relatórios** idem, somando contas e despesas de cartão de forma explícita. **Cartões** usa `useCardExpenses` / `useAllCardExpenses` para compras na fatura e `useBillPayments` (`GET` com `exclude_card_expenses=true` e filtro `paid_credit_card_id`). **Busca global** (⌘K) busca no mês atual com `excludeCardExpenses: false` para incluir cartão na listagem. Predicados reutilizáveis: `src/utils/transactionSemantics.js`.

**URL (refresh):** na aba Lançamentos, `txq`, `txtype`, `txsrc` (origem: `all` \| `account` \| `card` \| `bill_payment`), `txacc`, `txcat` (ids separados por vírgula), `txtag`, `txfrom`/`txto`, `txopen=1` sincronizam com o estado de busca e filtros.
