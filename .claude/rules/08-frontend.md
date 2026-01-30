# Doutrina de Frontend: React + Vite (myPay)

Esta doutrina governa o desenvolvimento frontend do projeto myPay.
O foco é performance, manutenção escalável e **zero magic numbers**.

---

## Stack do Projeto

- **Framework:** React 18 + Vite
- **Linguagem:** JavaScript (sem TypeScript)
- **Gerenciador de pacotes:** npm
- **Estilização:** Tailwind CSS
- **Estado global:** Context API
- **Backend:** Firebase (Firestore, Auth, Storage)
- **Ícones:** lucide-react
- **Gráficos:** recharts
- **Roteamento:** react-router-dom v6

---

## Arquitetura de Componentes

### Padrão de Separação

- **Pages (`src/pages/`):**
  - Componentes de rota
  - Orquestram hooks e componentes
  - `export default` para integração com router

- **Components (`src/components/`):**
  - Componentes reutilizáveis
  - `export function` (named exports)
  - Organizados por domínio em subpastas

- **Hooks (`src/hooks/`):**
  - Lógica reutilizável
  - Integração com Firebase
  - Estado derivado e efeitos

- **Services (`src/services/`):**
  - Operações Firestore
  - Chamadas a APIs externas
  - Lógica de negócio pura

- **Contexts (`src/contexts/`):**
  - Estado global (Auth, Theme, etc.)
  - Providers no nível do App

### Composição

- Evite prop-drilling profundo (use Context quando necessário)
- Use `children` para composição flexível
- Prefira componentes pequenos e focados

### Exportação

```javascript
// Componentes: named export
export function Button({ children, onClick }) { ... }

// Pages: default export
export default function Dashboard() { ... }

// Hooks: named export
export function useTransactions() { ... }
```

---

## Performance & Otimização

### Memoização

```javascript
// Callbacks passados como props
const handleClick = React.useCallback(() => {
  doSomething(id);
}, [id]);

// Cálculos pesados ou derivados
const filteredItems = React.useMemo(() => {
  return items.filter(item => item.active);
}, [items]);

// Valores que não precisam disparar render
const timerRef = React.useRef(null);
```

### Listas

- Para listas grandes (100+ itens), considere virtualização
- Sempre use `key` única e estável (preferencialmente `id`)
- Evite criar objetos/funções inline em loops

### Eventos de Alta Frequência

- **Debounce obrigatório** em inputs de busca
- Use helpers centralizados em `src/utils/`

```javascript
// src/utils/helpers.js
export function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}
```

---

## Estado & Data Fetching

### Context API (Estado Global)

Usado para:
- Autenticação (`AuthContext`)
- Tema (`ThemeContext`)
- Notificações (`NotificationContext`)
- Privacidade (`PrivacyContext`)

```javascript
// Consumo
import { useAuth } from '../contexts/AuthContext';

function Component() {
  const { user, loading } = useAuth();
  // ...
}
```

### Firebase/Firestore (Server State)

- Acesso via `src/services/` ou hooks em `src/hooks/`
- Firebase já gerencia cache e sincronização
- Sempre trate estados de loading e error

```javascript
// Padrão de hook com Firebase
export function useTransactions() {
  const { user } = useAuth();
  const [transactions, setTransactions] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    if (!user) return;

    setLoading(true);
    getTransactions(user.uid)
      .then(setTransactions)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [user]);

  return { transactions, loading, error };
}
```

---

## UI & Estilização

### Tailwind CSS

- **Única fonte de estilização** (não usar CSS modules, styled-components, etc.)
- Classes utilitárias diretamente no JSX
- Dark mode: projeto usa apenas tema escuro (`dark-*` tokens)

### Padrão de Cores

```
Backgrounds: dark-950, dark-900, dark-800, dark-700
Text: white, dark-300, dark-400, dark-500
Accent: primary-600, primary-500
Status: green-500 (sucesso), red-500 (erro), yellow-500 (warning)
```

### Componentes de UI

- **Não usar** bibliotecas de UI (MUI, Chakra, etc.)
- Criar componentes customizados com Tailwind
- Ícones via `lucide-react`

```javascript
import { Plus, Edit, Trash2 } from 'lucide-react';

<button className="p-2 text-dark-400 hover:text-white">
  <Plus size={20} />
</button>
```

---

## Código & Padrões

### Imports

```javascript
// React via namespace (padrão do projeto)
import * as React from 'react';

// Uso
React.useState()
React.useEffect()
React.useCallback()
```

### Constantes

- **PROIBIDO:** literais mágicos embutidos na lógica
- **OBRIGATÓRIO:** constantes nomeadas fora do componente

```javascript
// ❌ Errado
if (status === 2) { ... }
setTimeout(fn, 500);

// ✅ Correto
const STATUS_ACTIVE = 2;
const DEBOUNCE_DELAY_MS = 500;

if (status === STATUS_ACTIVE) { ... }
setTimeout(fn, DEBOUNCE_DELAY_MS);
```

### Estrutura de Componente

```javascript
import * as React from 'react';
import { Icon } from 'lucide-react';

// Constantes
const ITEMS_PER_PAGE = 10;

// Componente
export function ComponentName({ prop1, prop2, onAction }) {
  // 1. Hooks (Context, State, Refs)
  const { user } = useAuth();
  const [items, setItems] = React.useState([]);
  const inputRef = React.useRef(null);

  // 2. Derived state (useMemo)
  const filteredItems = React.useMemo(() =>
    items.filter(i => i.active),
    [items]
  );

  // 3. Callbacks (useCallback)
  const handleClick = React.useCallback(() => {
    onAction(prop1);
  }, [prop1, onAction]);

  // 4. Effects
  React.useEffect(() => {
    // side effects
  }, [dependency]);

  // 5. Render
  return (
    <div className="tailwind-classes">
      {/* content */}
    </div>
  );
}
```

### ESLint

- Respeitar regras do ESLint
- `eslint-disable` apenas pontualmente e com justificativa
- Corrigir warnings de hooks (`react-hooks/exhaustive-deps`)

---

## O Que NÃO Fazer

- ❌ Adicionar TypeScript
- ❌ Usar pnpm (projeto usa npm)
- ❌ Instalar bibliotecas de UI (MUI, Chakra, etc.)
- ❌ Adicionar Redux, Zustand, MobX (usar Context API)
- ❌ Adicionar TanStack Query (usar Firebase direto)
- ❌ Criar arquivos CSS/SCSS separados (usar Tailwind)
- ❌ Usar `eslint-disable` sem justificativa

---

> **DIRETIVA FINAL:**
> Mantenha simplicidade e consistência. Siga os padrões existentes no código.
> Em caso de dúvida, leia componentes similares antes de criar novos padrões.
