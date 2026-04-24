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

A página **Lançamentos** (`Transactions.jsx`) chama o hook com `excludeCardExpenses: false` para listar também compras de cartão. Demais ecrãs mantêm o default (excluir cartão), alinhado ao OpenAPI.

**Busca / filtros de tipo, conta, categoria, tag** seguem em **client-side** após o fetch, com `matchTransaction` em `src/utils/searchTransactions.js` (normalização de acentos, tokens de valor com `>`, `R$`, `a..b`, e alguns atalhos de data). Quando o intervalo customizado (date range) está ativo, o hook ainda faz `GET` sem mês/ano e filtra por data no cliente (o backend não expõe `date_from`/`date_to` na listagem).

**URL (refresh):** na aba Lançamentos, `txq`, `txtype`, `txacc`, `txcat` (ids separados por vírgula), `txtag`, `txfrom`/`txto`, `txopen=1` sincronizam com o estado de busca e filtros.
