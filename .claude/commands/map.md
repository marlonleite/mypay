---
description: Mapa de migracao (ponteiro para mypay-api/.claude/map)
argument-hint: "[entity | update | scan]"
---

# Mapa de Migracao (referencia cruzada)

Consulta o mapa de migracao do backend. O mapa canonico vive em mypay-api.

## Instrucoes

1. Leia os entity/service files em `/Users/marlon/Code/mypay-api/.claude/map/`
2. Siga as mesmas regras do comando `/map` do mypay-api
3. Ao mostrar entidades, destaque as mudancas necessarias no frontend
4. O status dashboard esta em `/Users/marlon/Code/mypay-api/.claude/map/_status.md`

## Dados Importantes

- Backend map dir: `/Users/marlon/Code/mypay-api/.claude/map/`
- Frontend hooks: `src/hooks/useFirestore.js` (10 hooks para migrar)
- Frontend services: `src/services/` (6 servicos, alguns migram pro backend)
- Frontend contexts: `src/contexts/GoalsContext.jsx` (acesso direto ao Firestore)
