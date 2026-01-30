# Guia de Testes: React + Vitest (myPay)

> **Status atual:** ⚠️ Framework de testes não configurado neste projeto.
> Este guia serve como referência para quando testes forem implementados.

## Configuração Recomendada

Para adicionar testes ao projeto:

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

```javascript
// vite.config.js
export default defineConfig({
  // ... config existente
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
  },
});
```

```javascript
// src/test/setup.js
import '@testing-library/jest-dom';
```

```json
// package.json
{
  "scripts": {
    "test": "vitest",
    "test:coverage": "vitest --coverage"
  }
}
```

---

## Estrutura de Testes

### Organização de Arquivos

- **Convenção:** `*.test.jsx` ou `*.test.js`
- **Localização:** co-localizados com o código fonte
  ```
  src/components/
  ├── Button.jsx
  └── Button.test.jsx
  ```

### Nomenclatura

```javascript
describe('ComponentName', () => {
  it('should render correctly with default props', () => {});
  it('should call onClick when clicked', () => {});
  it('should display error state when error prop is true', () => {});
});
```

---

## Padrão AAA (Arrange-Act-Assert)

```javascript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button', () => {
  it('should call onClick handler when clicked', async () => {
    // Arrange
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<Button onClick={handleClick}>Click me</Button>);

    // Act
    await user.click(screen.getByRole('button', { name: /click me/i }));

    // Assert
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

---

## Testing Library: Boas Práticas

### Seletores por Acessibilidade (Preferidos)

```javascript
// ✅ Preferido: acessibilidade
screen.getByRole('button', { name: /submit/i })
screen.getByLabelText(/email/i)
screen.getByPlaceholderText(/search/i)
screen.getByText(/welcome/i)

// ⚠️ Aceitável quando necessário
screen.getByTestId('transaction-card')

// ❌ Evitar
container.querySelector('.button-class')
```

### Interações com userEvent

```javascript
import userEvent from '@testing-library/user-event';

// Sempre criar user no início do teste
const user = userEvent.setup();

// Interações
await user.click(button);
await user.type(input, 'texto');
await user.clear(input);
await user.selectOptions(select, 'option-value');
await user.keyboard('{Enter}');
```

### Queries Assíncronas

```javascript
// Para elementos que aparecem após async
await screen.findByText(/loaded/i);

// Para verificar ausência
await waitFor(() => {
  expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
});

// Para múltiplas asserções após mudança de estado
await waitFor(() => {
  expect(screen.getByText(/success/i)).toBeInTheDocument();
  expect(mockFn).toHaveBeenCalled();
});
```

---

## Mocking

### Mocking de Módulos

```javascript
// Mock de hook
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { uid: 'test-user-id', email: 'test@example.com' },
    loading: false,
  }),
}));

// Mock de serviço Firebase
vi.mock('../services/transactionService', () => ({
  getTransactions: vi.fn().mockResolvedValue([
    { id: '1', description: 'Test', amount: 100 },
  ]),
}));
```

### Mocking de Context

```javascript
// Wrapper para providers
const renderWithProviders = (ui, { user = mockUser } = {}) => {
  return render(
    <AuthContext.Provider value={{ user, loading: false }}>
      {ui}
    </AuthContext.Provider>
  );
};

// Uso
renderWithProviders(<Dashboard />);
```

### Mocking de Firebase

```javascript
// Mock básico do Firestore
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({
    docs: [{ id: '1', data: () => ({ name: 'Test' }) }],
  }),
  addDoc: vi.fn().mockResolvedValue({ id: 'new-id' }),
}));
```

---

## Casos de Teste Essenciais

### Para Componentes

- [ ] Renderização com props padrão
- [ ] Renderização com props variadas
- [ ] Estados visuais (hover, active, disabled)
- [ ] Interações do usuário (click, input, submit)
- [ ] Estados de loading e error
- [ ] Acessibilidade básica (labels, roles)

### Para Hooks

- [ ] Retorno inicial correto
- [ ] Atualização de estado
- [ ] Efeitos colaterais
- [ ] Cleanup de effects
- [ ] Tratamento de erros

### Para Pages

- [ ] Renderização inicial
- [ ] Carregamento de dados
- [ ] Interações principais
- [ ] Navegação
- [ ] Estados vazios

---

## Cobertura

### Metas (quando configurado)

- **Mínimo aceitável:** 70%
- **Ideal:** 85%+
- **Código crítico (auth, pagamentos):** 90%+

### Exclusões Típicas

```javascript
// vite.config.js
test: {
  coverage: {
    exclude: [
      'src/firebase/**',      // Config Firebase
      'src/test/**',          // Setup de testes
      '**/*.d.ts',
      '**/index.js',          // Re-exports
    ],
  },
}
```

---

## Antipadrões

### ❌ Evitar

```javascript
// Snapshot de componentes grandes
expect(container).toMatchSnapshot(); // Frágil, difícil manutenção

// Testar detalhes de implementação
expect(component.state.isOpen).toBe(true); // Não use

// Seletores frágeis
container.querySelector('div > span.class'); // Evite

// Timers reais
await new Promise(r => setTimeout(r, 1000)); // Use fake timers
```

### ✅ Preferir

```javascript
// Asserções específicas
expect(screen.getByRole('dialog')).toBeVisible();

// Testar comportamento observável
expect(screen.getByText(/success/i)).toBeInTheDocument();

// Seletores de acessibilidade
screen.getByRole('button', { name: /save/i });

// Fake timers
vi.useFakeTimers();
vi.advanceTimersByTime(1000);
```

---

## Exemplo Completo

```javascript
// src/components/TransactionCard.test.jsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TransactionCard } from './TransactionCard';

const mockTransaction = {
  id: '1',
  description: 'Supermercado',
  amount: 150.50,
  type: 'expense',
  date: new Date('2024-01-15'),
};

describe('TransactionCard', () => {
  it('should render transaction details', () => {
    render(<TransactionCard transaction={mockTransaction} />);

    expect(screen.getByText('Supermercado')).toBeInTheDocument();
    expect(screen.getByText(/150,50/)).toBeInTheDocument();
  });

  it('should display expense amount in red', () => {
    render(<TransactionCard transaction={mockTransaction} />);

    const amount = screen.getByText(/150,50/);
    expect(amount).toHaveClass('text-red-500');
  });

  it('should call onEdit when edit button is clicked', async () => {
    const handleEdit = vi.fn();
    const user = userEvent.setup();

    render(
      <TransactionCard
        transaction={mockTransaction}
        onEdit={handleEdit}
      />
    );

    await user.click(screen.getByRole('button', { name: /edit/i }));

    expect(handleEdit).toHaveBeenCalledWith(mockTransaction);
  });

  it('should call onDelete when delete button is clicked', async () => {
    const handleDelete = vi.fn();
    const user = userEvent.setup();

    render(
      <TransactionCard
        transaction={mockTransaction}
        onDelete={handleDelete}
      />
    );

    await user.click(screen.getByRole('button', { name: /delete/i }));

    expect(handleDelete).toHaveBeenCalledWith('1');
  });
});
```

---

> **DIRETIVA FINAL:**
> Testes devem refletir o comportamento real do usuário.
> Priorize seletores de acessibilidade e teste comportamento observável, não implementação interna.
