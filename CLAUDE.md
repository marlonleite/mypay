# CLAUDE.md

Orientações ao Claude Code para o repositório **myPay**.

## Regras ativas (sempre carregadas)

Em `.claude/rules/`:
- **`01-core.md`** — Doutrina operacional (fluxo, ética, execução, commits)
- **`05-comunicacao.md`** — Estilo de comunicação (PT-BR, modos ask/plan/agent)
- **`07-desenvolvimento.md`** — Princípios de código
- **`08-frontend.md`** — Stack e padrões React/Vite/Tailwind
- **`09-migration-map.md`** — Migração Firebase → API Postgres

Espelhadas para Cursor em `.cursor/rules/*.mdc` (idênticas em conteúdo).

## Comandos sob demanda

Em `.claude/commands/`:
- **`/refresh`** — Protocolo de debugging & RCA (use quando bug for crítico/recorrente)
- **`/retro`** — Retrospectiva e evolução da doutrina
- **`/review`** — Code review
- **`/commit`** — Commit semântico
- **`/test`** — Testes (quando configurados)
- **`/map`** — Mapa de migração backend

## Doutrina global (Cursor)

`~/.cursor/rules/` já carrega doutrina agnóstica de stack. Não duplicar.

## Stack

```
React 18 + Vite (JS, sem TS)  ·  Tailwind  ·  Context API
Firebase (Auth/Firestore/Storage)  ·  lucide-react  ·  recharts
react-router-dom v6  ·  npm  ·  Vercel
```

Testes: não configurados.

## Comandos do projeto

```bash
npm install
npm run dev           # desenvolvimento
npm run dev:full      # dev com proxy /api/organizze-proxy
npm run build         # produção
npm run preview
npm run lint
```

## Estrutura

```
src/
├── components/    # reutilizáveis por domínio
├── contexts/      # Auth, Theme, Notification, Privacy
├── firebase/      # config Firebase
├── hooks/         # custom hooks (Firebase, derivados)
├── pages/         # rotas
├── services/      # Firestore, APIs externas
└── utils/         # helpers puros
```

## Gotchas

- Proxy em `vite.config.js` para `/api/organizze-proxy`.
- `VITE_APP_VERSION` injetada no build.
- Firebase env vars em `.env`.

## Princípios mandatórios

1. Reconhecimento antes de tocar (leia antes de escrever).
2. Releia imediatamente após escrever.
3. Nunca crie commits sem solicitação explícita.
4. Sempre rode portões de qualidade (lint/build) antes de relatar conclusão.
5. Comunicação concisa, sem bajulação.

> Em dúvida sobre fluxo: `.claude/rules/01-core.md`. Para Cursor: `~/.cursor/rules/doutrina-operacional.mdc`.
