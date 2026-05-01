# Wave 7 — Drop soft-delete (frontend)

## Contexto

Plano correlato no backend: `mypay-api/.cursor/plans/wave7_drop_soft_delete_f3f46dc5.plan.md`.

Backend vai remover soft-delete (`deleted_at`) de `Transaction`, `Goal` e `Transfer`, junto com:
- Endpoints `POST /transactions/{id}/restore`, `POST /goals/{id}/restore`, `POST /transfers/{id}/restore` (todos serão **removidos**).
- Filtros `WHERE deleted_at IS NULL` em queries.

## Estado atual no frontend (mypay)

`grep -rn "deleted_at\|softDelete\|/restore\|restoreTransaction" src/` retorna:

- `src/contexts/UndoContext.jsx`: infra completa de undo stack — **mas `pushUndo` nunca é chamado em lugar nenhum**. É dead code.
- `src/App.jsx:96,114,117`: importa `useUndo`, registra handler `Cmd+Z` que chama `undo()` (sem ação real, pois stack sempre vazia).
- `src/contexts/GoalsContext.jsx:15`: comentário "Backend faz soft delete (deleted_at) — `archiveGoal`..." (desatualizado após Wave 7).
- **Nenhuma chamada para `/restore`** em qualquer service/hook/componente.

Conclusão: nada funcional quebra ao remover. Só limpeza de dead code + atualização de comentário.

## Pré-requisito de produto

Confirmar com produto: **vai existir lixeira/undo no front em <2 sprints?**

- **Sim** → cancelar Wave 7 (backend mantém soft-delete). Conectar `pushUndo` nos callsites de delete (`useTransactions.deleteTransaction`, `useFirestore` análogos, etc.) e implementar UI da lixeira.
- **Não** → executar este plano.

## FE-F1 — Remover dead code do UndoContext

1. Apagar `src/contexts/UndoContext.jsx`.
2. `src/App.jsx`:
   - Linha 96: remover `const { undo, canUndo } = useUndo()`.
   - Linhas 114-119: remover handler `Cmd+Z`.
   - Remover `<UndoProvider>` do render tree (se existir).
   - Remover import de `useUndo` / `UndoProvider`.
3. Buscar imports órfãos: `grep -rn "useUndo\|UndoProvider\|UndoContext" src/` deve retornar zero após o passo 1.
4. Se houver testes do UndoContext, remover.

## FE-F2 — Atualizar comentários desatualizados

`src/contexts/GoalsContext.jsx:15` — atualizar comentário:

```diff
- Backend faz soft delete (deleted_at) — `archiveGoal` é uma mudança lógica
+ Backend faz hard delete — `archiveGoal` é uma mudança lógica (status apenas)
```

Varredura final: `grep -rn "deleted_at\|softDelete\|soft delete\|soft-delete\|/restore" src/` → zero ocorrências.

## FE-F3 — UX de delete (opcional, recomendado)

Como o "Cmd+Z" some (mesmo nunca tendo funcionado de verdade), adicionar:

**Modal de confirmação mais explícito** nos pontos de delete:

- `Transactions.jsx`: ao apagar transação, modal "Esta ação é permanente. Apagar `<descricao>` de R$ `<valor>`?".
- `Goals.jsx`: análogo.
- `Cards.jsx` → fatura → delete em massa: modal "Apagar `<N>` lançamentos da fatura `<X>`. Esta ação é permanente."

**Pequeno banner no modal** (se `Atividades` existir como página):

> "O histórico desta ação fica disponível em **Atividades**."

Confirmar se há página `Atividades` que renderiza `activities` do backend antes de prometer isso.

## Arquivos tocados

- `src/contexts/UndoContext.jsx` (deletado)
- `src/App.jsx`
- `src/contexts/GoalsContext.jsx` (comentário)
- (opcional) Componentes de delete (modais de confirmação)
- (opcional) Testes do UndoContext (deletados)

## Critério de aceite

1. `grep -rn "useUndo\|UndoProvider\|UndoContext\|deleted_at\|/restore" src/` retorna zero.
2. App compila e roda sem warnings de imports faltando.
3. Cmd+Z não está mais bindado (ou bindado a outro comportamento intencional).
4. Delete de transação/goal/transfer continua funcionando (backend agora hard-delete) — verificar manualmente.

## Itens fora do escopo

- Implementar lixeira/undo de fato (alternativa, se a decisão de produto mudar).
- Página de Atividades (se ainda não existir e o banner UX-F3 a referenciar).
