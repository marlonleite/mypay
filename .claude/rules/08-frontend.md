# Frontend (myPay)

## Stack

- React 18 + Vite, JavaScript puro (sem TypeScript).
- npm; Tailwind CSS (única forma de estilizar); Context API (sem Redux/Zustand).
- Firebase (Auth/Firestore/Storage); lucide-react; recharts; react-router-dom v6.

## Arquitetura

| Pasta | Conteúdo | Export |
|---|---|---|
| `src/pages/` | rotas | `export default` |
| `src/components/` | reutilizáveis por domínio | `export function` (named) |
| `src/hooks/` | lógica reutilizável, integração Firebase | named |
| `src/services/` | operações Firestore, APIs externas | named |
| `src/contexts/` | estado global (Auth, Theme, Notification, Privacy) | named |
| `src/utils/` | helpers puros | named |

## Padrões obrigatórios

### Imports React via namespace

```js
import * as React from 'react';
// React.useState, React.useEffect, React.useCallback, React.useMemo, React.useRef
```

### Zero magic numbers — constantes nomeadas fora do componente

```js
const DEBOUNCE_DELAY_MS = 500;        // ✅
setTimeout(fn, 500);                  // ❌
```

### Memoização

- `useCallback` para callbacks passados como prop.
- `useMemo` para cálculos derivados pesados.
- `useRef` para valores que não devem disparar render.

### Performance

- Debounce obrigatório em inputs de busca (use helper em `src/utils/`).
- Listas grandes (100+): considere virtualização.
- `key` única e estável (preferencialmente `id`).

### Estilização

- Tailwind apenas. Backgrounds: `dark-950/900/800/700`. Texto: `white`, `dark-300/400/500`. Accent: `primary-600/500`. Status: `green-500`, `red-500`, `yellow-500`.
- Ícones via `lucide-react`.
- Dark mode é o único tema.

### Firebase

- Sempre tratar `loading` e `error`.
- Cleanup de subscriptions (`onSnapshot`).
- Verificar `user` antes de queries.

## Estrutura do componente

```js
import * as React from 'react';
import { Icon } from 'lucide-react';

const ITEMS_PER_PAGE = 10;

export function Component({ prop1, onAction }) {
  // 1. Hooks (Context, State, Refs)
  // 2. useMemo (derived state)
  // 3. useCallback (handlers)
  // 4. useEffect (side effects)
  // 5. Render
}
```

## Proibido

- TypeScript, pnpm, Redux/Zustand/MobX, TanStack Query
- Bibliotecas de UI (MUI, Chakra, etc.)
- CSS/SCSS separados (só Tailwind)
- `eslint-disable` sem justificativa documentada
- Snapshot/CSS modules

> Em dúvida: leia componentes similares antes de criar novo padrão.
