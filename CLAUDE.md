@.rules/08-frontend.mdc
@.rules/09-migration-map.mdc
@.rules/10-mypay-conventions.mdc

# myPay (frontend)

> Doutrina, comunicação e princípios genéricos são globais (`~/Code/cursor_rules/core/*.mdc`), auto-carregados via `~/.claude/CLAUDE.md`. Este projeto adiciona só os deltas acima.

## Regras particulares deste repo (`.rules/`)

| Arquivo | Conteúdo |
|---|---|
| `08-frontend.mdc` | Stack e padrões React/Vite/Tailwind |
| `09-migration-map.mdc` | Migração Firebase → API Postgres (frontend side) |
| `10-mypay-conventions.mdc` | Estilo (aspas, sem semis), Firebase, i18n |

Symlinks em `.cursor/rules/*.mdc` apontam pra `.rules/` — fonte única.

## Comandos sob demanda (`.claude/commands/`)

- **`/test`** — Testes (quando configurados; específico do projeto)
- **`/map`** — Mapa de migração backend (específico do projeto)

> Globais disponíveis: `/debug-raiz`, `/retro`, `/review`, `/commit` — vêm de `~/Code/cursor_rules/playbooks/`.

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

## Portões de qualidade

Antes de relatar conclusão:

```bash
npm run lint
npm run build    # quando alteração afetar bundle/imports
```
