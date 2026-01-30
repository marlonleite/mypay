# Testes

Execute ou crie testes para o código especificado.

## Status do Projeto

⚠️ **Este projeto não tem framework de testes configurado.**

Para adicionar testes, seria necessário:
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

## Modos de Operação

### 1. Executar testes existentes
Se testes estiverem configurados:
- Execute `npm test` ou `npx vitest`
- Use `--reporter=verbose` para detalhes
- Mostre cobertura se solicitado (`--coverage`)

### 2. Criar novos testes
Se o usuário pedir para criar testes:

**Estrutura AAA (Arrange-Act-Assert)**
```javascript
describe('ComponentName', () => {
  it('should <comportamento> when <condição>', () => {
    // Arrange - preparar dados
    // Act - executar ação
    // Assert - verificar resultado
  });
});
```

**Checklist de cobertura**
- [ ] Caso feliz (happy path)
- [ ] Valores limite (0, 1, max, min)
- [ ] Inputs inválidos (null, undefined, vazio)
- [ ] Estados de erro/loading
- [ ] Interações do usuário

**Boas práticas para React**
- Use `render` da Testing Library
- Prefira `userEvent` sobre `fireEvent`
- Use seletores de acessibilidade (`getByRole`, `getByLabelText`)
- Mocke chamadas Firebase/API
- Cada teste deve ser independente
- Nomes descritivos: `should display error message when login fails`

## Output

Para execução:
```
✅ X passed, Y failed
Cobertura: Z%
[detalhes de falhas se houver]
```

Para criação:
- Mostre o código dos testes
- Explique brevemente cada cenário coberto
- Indique se é necessário configurar o framework primeiro
