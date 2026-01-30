# Guia Rápido de Agentes

## O que são Agentes?

Agentes são especialistas de IA que seguem protocolos estruturados para entregar trabalho de alta qualidade em seu domínio. Pense neles como desenvolvedores seniores especializados.

## Agentes Disponíveis

### 🎨 UI Designer
**Especialista em:** Tailwind CSS, dark mode, design system

```bash
/agent ui-designer Criar sistema de cards com estados de hover e dark mode
```

---

### ⚛️ Frontend Developer
**Especialista em:** React 18, JavaScript, Tailwind CSS

```bash
/agent frontend-developer Implementar dashboard com gráficos de transações
```

---

### 🔧 Backend Developer
**Especialista em:** Firebase, Firestore, Cloud Functions

```bash
/agent backend-developer Criar serviço de exportação de transações para CSV
```

---

### 🚀 Fullstack Developer
**Especialista em:** React + Firebase end-to-end

```bash
/agent fullstack-developer Implementar orçamentos mensais com tracking
```

---

## Quando Usar Agentes vs Skills

### Use Skills para:
- ✅ Tarefas simples e diretas
- ✅ Criação rápida de componentes
- ✅ Operações CRUD padrão

```bash
/component Button    # Componente simples
/page Reports        # Página simples
```

### Use Agentes para:
- ✅ Trabalho complexo
- ✅ Decisões arquiteturais
- ✅ Features completas
- ✅ Código crítico de performance

```bash
/agent fullstack-developer Criar sistema de budgets com alertas
```

---

## Exemplo Prático: Nova Feature

**Tarefa:** Adicionar tracking de orçamentos

```bash
/agent fullstack-developer Implementar orçamentos mensais com:
- Criação de limites por categoria
- Tracking de gastos em tempo real
- Alertas ao se aproximar do limite
- Indicadores visuais de progresso
```

**O que o agente entrega:**

1. **Firestore:** Collection `users/{uid}/budgets`
2. **Service:** `src/services/budgetService.js`
3. **Hook:** `src/hooks/useBudgets.js`
4. **Componentes:** `BudgetCard.jsx`, `BudgetForm.jsx`
5. **Página:** `src/pages/Budgets.jsx`
6. **Integração:** Rota no App.jsx

---

## Dicas

### 1. Seja Específico
❌ "Melhore o app"
✅ "Otimizar lista de transações para 1000+ itens"

### 2. Forneça Contexto
- O que já existe
- Qual o objetivo
- Restrições ou requisitos

### 3. Confie no Protocolo
Os agentes seguem 3 fases:
1. **Descoberta** - Analisam o código existente
2. **Execução** - Implementam a solução
3. **Entrega** - Documentam e entregam

### 4. Combine Agentes
```bash
# Fase de design
/agent ui-designer Criar design do dashboard

# Fase de implementação
/agent frontend-developer Implementar dashboard

# Integração backend
/agent backend-developer Criar queries otimizadas
```

---

## Stack do Projeto

Os agentes são configurados para:

```
React 18 + Vite (JavaScript)
Tailwind CSS
Firebase (Firestore, Auth)
Vercel (deploy)
npm (package manager)
```

**⚠️ Agentes NÃO adicionam:** TypeScript, pnpm, bibliotecas de UI, testes (não configurado), Docker.

---

Para mais detalhes: `.claude/agents/README.md`
