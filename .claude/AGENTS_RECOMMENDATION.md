# Recomendação de Agentes para myPay

## 🎯 Agentes Essenciais

### 1. UI Designer ⭐⭐⭐
**Uso:** ALTO - Use frequentemente

**Quando usar:**
- Criar/melhorar componentes visuais
- Design system e tokens
- Layouts responsivos
- Dark mode (seu projeto usa muito)
- Acessibilidade visual

**Exemplos práticos no myPay:**
```bash
/agent ui-designer Redesenhar cards de transação com hierarquia visual melhor
/agent ui-designer Criar sistema de cores para categorias
/agent ui-designer Melhorar navegação por tabs
```

---

### 2. Frontend Developer ⭐⭐⭐
**Uso:** ALTO - Use frequentemente

**Quando usar:**
- Implementar componentes React
- Otimizar performance
- Gerenciar estado complexo
- Integração com hooks Firebase
- Testes frontend

**Exemplos práticos no myPay:**
```bash
/agent frontend-developer Criar dashboard com gráficos de receitas/despesas
/agent frontend-developer Implementar filtros avançados de transações
/agent frontend-developer Otimizar re-renders da lista de transações
```

---

### 3. Backend Developer ⭐⭐
**Uso:** MÉDIO - Use quando necessário

**Quando usar no myPay:**
- Otimizar queries Firestore
- Firestore rules complexas
- Cloud Functions (se adicionar)
- Processamento de documentos com IA
- Migrações de dados

**Exemplos práticos no myPay:**
```bash
/agent backend-developer Otimizar queries de transações para milhares de registros
/agent backend-developer Criar Cloud Function para backup automático
/agent backend-developer Melhorar processamento de documentos com Gemini
```

---

## ⚠️ Agentes Opcionais

### 4. Fullstack Developer ⭐
**Uso:** BAIXO - Use raramente

**Quando usar:**
- Features MUITO complexas (DB + API + UI + testes)
- Refatorações arquiteturais grandes
- Quando feature cruza múltiplas camadas de forma não-trivial

**Quando NÃO usar:**
- Para features normais → Use Frontend ou Backend
- Para componentes → Use UI Designer ou Frontend
- Para Firebase → Use Backend

**Exemplos raros no myPay:**
```bash
/agent fullstack-developer Migrar de Firebase para backend próprio com API REST
/agent fullstack-developer Implementar sistema de sincronização offline completo
```

**⚡ Alternativa melhor:** Na maioria dos casos, use skills ou combine Frontend + Backend agents

---

### 5. Mobile Developer ❌
**Uso:** NÃO APLICÁVEL

**Status:** Remover do projeto

**Motivo:**
- Projeto é web-only (React + Vite)
- Não há código mobile
- Não há planos de mobile nativo

**Se adicionar mobile no futuro:**
- PWA simples → Use Frontend Developer
- React Native → Re-adicione Mobile Developer

---

## 📊 Matriz de Uso Recomendado

| Agente | Frequência | Complexidade | Casos de Uso no myPay |
|--------|------------|--------------|----------------------|
| UI Designer | 🔥🔥🔥 Alta | Média | Design, componentes visuais, UX |
| Frontend Developer | 🔥🔥🔥 Alta | Média-Alta | React, estado, performance, testes |
| Backend Developer | 🔥🔥 Média | Média | Firebase, queries, rules, Cloud Functions |
| Fullstack Developer | 🔥 Baixa | Muito Alta | Features complexas cross-stack |
| ~~Mobile Developer~~ | ❌ Nenhuma | N/A | Não aplicável |

## 🎯 Workflow Recomendado

### Feature Simples/Média
```bash
# Design primeiro
/agent ui-designer Criar design de [feature]

# Implementação
/agent frontend-developer Implementar [feature] seguindo design

# Se precisar de backend
/agent backend-developer Otimizar queries/rules para [feature]
```

### Feature Complexa
```bash
# Opção 1: Usar Fullstack (mais rápido, menos controle)
/agent fullstack-developer Implementar [feature completa]

# Opção 2: Dividir (mais controle, melhor para aprender)
/agent ui-designer Design da [feature]
/agent backend-developer Estrutura de dados e queries
/agent frontend-developer Implementação UI
```

### Tarefas Simples
```bash
# NÃO use agentes! Use skills:
/component [ComponentName] --ui
/hook [collection]
/page [PageName]
```

## 🔧 Ações Recomendadas

### 1. Remover Mobile Developer
```bash
# Delete o arquivo
rm .claude/agents/mobile-developer.md
```

### 2. Atualizar documentação
- Remover referências ao Mobile Developer
- Atualizar matriz de expertise
- Atualizar exemplos

### 3. Manter Fullstack por enquanto
- Útil para features raras muito complexas
- Documenta que deve ser usado raramente
- Pode remover depois se nunca usar

## 💡 Quando Usar Skills vs Agentes

### Use Skills (90% dos casos)
```bash
/component TransactionCard --ui     # Componente simples
/hook budgets                       # Hook CRUD padrão
/page Reports                       # Página simples
/firebase rules                     # Revisar rules
/refactor extract-component         # Refatoração simples
```

### Use Agentes (10% dos casos)
```bash
/agent ui-designer [design complexo com sistema]
/agent frontend-developer [feature com estado complexo]
/agent backend-developer [otimização crítica]
```

## 📈 Configuração Otimizada Final

**Agentes a manter:**
1. ✅ UI Designer (uso frequente)
2. ✅ Frontend Developer (uso frequente)
3. ✅ Backend Developer (uso médio)
4. ⚠️ Fullstack Developer (uso raro, mas útil)
5. ❌ Mobile Developer (remover)

**Skills a usar mais:**
- `/component` - Para componentes simples
- `/hook` - Para hooks CRUD
- `/page` - Para páginas simples
- `/firebase` - Para operações Firebase
- `/refactor` - Para refatorações

**Total:** 4 agentes + 11 skills = 15 ferramentas

---

**Resumo:** Remova Mobile Developer, mantenha Fullstack mas use raramente, foque em UI Designer e Frontend Developer para 80% das tarefas.
