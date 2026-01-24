# Quick Start Guide - Claude Code Skills

## Setup Complete! 🎉

Você agora tem 9 skills personalizadas para o projeto myPay.

## Como Usar

### 1. Criar Componentes Rapidamente

```bash
# Criar um componente UI reutilizável
/component TransactionCard --ui

# Criar uma nova página
/component Dashboard --page

# Componente comum
/component TransactionForm
```

### 2. Adicionar Hooks do Firestore

```bash
# Criar hook para nova coleção
/hook budgets
# Cria useBudgets com CRUD completo em src/hooks/useFirestore.js
```

### 3. Criar Nova Página/Tab

```bash
/page Budgets
# Cria a página completa e integra ao App.jsx automaticamente
```

### 4. Trabalhar com Firebase

```bash
# Revisar regras de segurança
/firebase rules

# Gerenciar indexes
/firebase indexes

# Debug de problemas
/firebase debug

# Documentar estrutura
/firebase collections
```

### 5. Processar Documentos com IA

```bash
# Criar prompt para novo tipo de documento
/ai-prompt boleto

# Testar prompt existente
/ai-prompt invoice --test

# Otimizar prompt
/ai-prompt receipt --optimize
```

### 6. Refatorar Código

```bash
# Extrair componente reutilizável
/refactor extract-component

# Otimizar performance de hook
/refactor optimize-hook

# Remover código duplicado
/refactor remove-duplication
```

### 7. Migrar Dados

```bash
# Criar migração
/migration add-budget-field

# Testar migração (dry-run)
/migration add-budget-field --dry-run

# Executar migração
/migration add-budget-field --execute
```

### 8. Testar Funcionalidades

```bash
# Testar autenticação
/test-feature auth

# Testar transações
/test-feature transactions

# Testar processamento de documentos
/test-feature documents
```

### 9. Deploy

```bash
# Verificar se está tudo OK para deploy
/deploy --check

# Apenas fazer build
/deploy --build-only

# Deploy completo
/deploy
```

## Exemplos Práticos

### Exemplo 1: Adicionar Feature de Orçamentos

```bash
# 1. Criar hook
/hook budgets

# 2. Criar página
/page Budgets

# 3. Criar componente de formulário
/component BudgetForm --ui

# 4. Testar
/test-feature budgets
```

### Exemplo 2: Melhorar Performance

```bash
# 1. Identificar problemas
/refactor improve-performance

# 2. Otimizar hooks
/refactor optimize-hook

# 3. Testar mudanças
/test-feature [funcionalidade afetada]
```

### Exemplo 3: Novo Tipo de Documento

```bash
# 1. Criar prompt
/ai-prompt contrato-aluguel

# 2. Testar com documento real
/ai-prompt contrato-aluguel --test

# 3. Otimizar se necessário
/ai-prompt contrato-aluguel --optimize
```

## Dicas

1. **Use Tab Completion**: Digite `/` e pressione Tab para ver todas as skills

2. **Flags são Opcionais**: As skills vão perguntar o que falta
   ```bash
   /component  # Vai perguntar nome e tipo
   ```

3. **Combine Skills**: Use várias skills em sequência para tarefas complexas

4. **Customize**: Edite os arquivos em `.claude/skills/` para ajustar às suas necessidades

5. **Settings**: Ajuste `.claude/settings.json` para mudar convenções do projeto

## Próximos Passos

- [ ] Explore cada skill executando `/[skill-name]` no Claude Code
- [ ] Customize as skills para seu workflow
- [ ] Adicione novas skills conforme necessário
- [ ] Configure hooks em `.claude/hooks.json` (copie de `hooks.example.json`)

## Estrutura Criada

```
.claude/
├── skills/              # Skills personalizadas (9 skills)
│   ├── component.md     # Criar componentes
│   ├── hook.md          # Criar hooks
│   ├── page.md          # Criar páginas
│   ├── firebase.md      # Gerenciar Firebase
│   ├── ai-prompt.md     # Prompts de IA
│   ├── refactor.md      # Refatorações
│   ├── migration.md     # Migrações de dados
│   ├── test-feature.md  # Testes
│   └── deploy.md        # Deploy
├── settings.json        # Configurações do projeto
├── hooks.example.json   # Exemplo de hooks
├── README.md           # Documentação completa
├── QUICKSTART.md       # Este arquivo
└── .gitignore          # Ignora settings locais
```

## Precisa de Ajuda?

- Leia a documentação completa em `.claude/README.md`
- Veja o conteúdo de cada skill em `.claude/skills/[nome].md`
- Ajuste `CLAUDE.md` na raiz do projeto para instruções gerais

**Divirta-se codando com Claude! 🚀**
