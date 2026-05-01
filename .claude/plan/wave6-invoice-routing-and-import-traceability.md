# Wave 6 — Invoice routing & import traceability (frontend)

## Contexto

Plano correlato no backend: `mypay-api/.cursor/plans/wave6_invoice_routing_and_import_traceability_e0836d70.plan.md`.

**Problema:** ao importar fatura de cartão (PDF via `/documents/process` + apply), transações com data fora do mês de fechamento são roteadas pelo backend para faturas diferentes da fatura importada — gerando faturas-fantasma e fatura-alvo com total incorreto. Não há marcação na transação dizendo "veio dessa importação".

**Causa no frontend:** em `src/pages/Documents.jsx:268-282` (`handleBatchCardExpenses`), o caminho principal `applyDocumentImport` envia `credit_card_invoice_id: e.creditCardInvoiceId || undefined`. Como o parser/IA não popula `creditCardInvoiceId` no expense, vai `undefined` → backend rotea pela data. O caminho legado (linhas 348+) já calcula `fallbackInvoiceId`, mas o caminho principal não.

## Estratégia

A correção principal é no backend (Wave 6 lá): backend passa a determinar a fatura-alvo a partir do `billing_month/year` do `ImportRecord`, ignorando a data individual de cada linha.

**No frontend, trabalho funcional é zero** se o backend implementar A+B. Só ajustes de UX (não bloqueantes).

## UX1 — Banner na revisão da fatura

**Arquivo:** `src/components/documents/FaturaResult.jsx`

Antes da lista de linhas, mostrar:

> "Esta fatura cobre o ciclo `<starting_date>` a `<closing_date>` (vencimento `<due_date>`). Todas as linhas — inclusive as com data anterior — serão lançadas nesta fatura."

**Como obter o ciclo:**
- A partir de `extractedData.mes_referencia/ano_referencia` (já disponível) + `card.closing_day`/`due_day`.
- **Preferível:** novo endpoint backend `GET /credit-card-invoices/preview?card_id=...&billing_month=...&billing_year=...` (item fora do escopo da Wave 6, dá pra adicionar depois). Sem ele, calcular localmente espelhando `_compute_period`.

## UX2 — Badge "Importada de fatura"

**Arquivos:**
- `src/components/transactions/TransactionDetail.jsx`
- `src/pages/Transactions.jsx` (lista)

Quando `transaction.import_id` existir (campo novo exposto pelo backend em `TransactionResponse`), mostrar badge "Vindo de importação" linkando para `Documents → import_id`.

Requer só ler o novo campo na response — sem mudança em mappers/serviços.

## UX3 — Filtro por importação (opcional)

**Arquivo:** `src/pages/Transactions.jsx`

Suportar query string `?import_id=...` que filtra a lista. Útil para o usuário ver tudo da importação e selecionar para deletar em massa via `POST /transactions/batch-delete` (já existe).

Backend precisa aceitar `import_id` como filtro de listagem — adicionar nos query params da rota `GET /transactions`. Trivial.

## Arquivos tocados

- `src/components/documents/FaturaResult.jsx` (UX1)
- `src/components/transactions/TransactionDetail.jsx` (UX2)
- `src/pages/Transactions.jsx` (UX2 + UX3)

Nenhuma mudança em `src/services/documentService.js` ou `src/hooks/useDocumentImport.js` — o roteamento melhora automaticamente quando o backend mergear.

## Cenário fallback (caso o backend NÃO implemente A)

Se o backend ficar conservador e exigir invoice explícita por linha:

### F-FE1 — Resolver fatura-alvo antes do apply

Em `src/pages/Documents.jsx:handleBatchCardExpenses` (linhas 247-282), antes do `items.map`:

```js
let targetInvoiceId
if (extractedData?.mes_referencia && extractedData?.ano_referencia && cardId) {
  // mes_referencia vem 1-indexed do backend; resolve... espera 0-indexed
  targetInvoiceId = await resolveCreditCardInvoiceIdForDueMonth(
    cardId,
    extractedData.mes_referencia - 1,
    extractedData.ano_referencia
  )
  // Se null: criar via POST /credit-card-invoices (precisa starting/closing/due)
  // ou pedir ao backend novo endpoint /ensure-for-billing-period
}
```

Depois passar `credit_card_invoice_id: e.creditCardInvoiceId || targetInvoiceId` no `buildInvoiceCardExpenseApiItem`.

### F-FE2 — Mesma lógica em `handleCreateCardExpense`

Já chama `resolveCreditCardInvoiceIdForDueMonth(cardId, month, year)` (linhas 199-203), mas usa `month/year` do contexto da página, **não do `mes_referencia` da fatura**. Trocar para o billing real.

### F-FE3 — Atenção a divergências de mês

- `month` 0-indexed (JS) vs `billing_month` 1-indexed (backend) — bug clássico, validar.
- `mes_referencia` é mês de **vencimento** ou **fechamento**? No plano backend Wave 6, é "fechamento". `resolveCreditCardInvoiceIdForDueMonth` filtra por `due_date.getMonth()` — confirmar offset.

## Critério de aceite

1. (Backend mergeou) Importar PDF de fatura outubro/2025 com linhas em datas diferentes → única fatura criada, total bate com o PDF.
2. (UX2) Transação importada exibe badge linkando para a importação de origem.
3. (UX3) `Transactions?import_id=<uuid>` lista só as linhas dessa importação.

## Itens fora do escopo

- Tela de "Reverter importação" (depende de `DELETE /imports/{id}/revert` no backend).
- Aviso "essa fatura já foi importada antes" (depende de detecção de duplicata no backend).
