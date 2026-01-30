# agent

Invoca agentes especializados para tarefas específicas do projeto myPay.

## Usage

```bash
/agent [nome-agente] [tarefa]
```

Agentes disponíveis:
- `ui-designer` - Design Tailwind CSS e dark mode
- `frontend-developer` - Componentes React com JavaScript
- `backend-developer` - Firebase/Firestore e Cloud Functions
- `fullstack-developer` - Features completas (Firestore → React)

## Description

Esta skill invoca agentes especializados definidos em `.claude/agents/`.

**Quando usar cada agente:**

**ui-designer:**
- Criar padrões visuais em Tailwind
- Design system e tokens
- Layouts responsivos dark mode
- Estados de componentes (hover, active, disabled)

**frontend-developer:**
- Implementar componentes React (.jsx)
- Custom hooks
- Integração com Context API
- Performance e memoização

**backend-developer:**
- Modelagem de dados Firestore
- Services de acesso a dados
- Security rules
- Cloud Functions (quando necessário)

**fullstack-developer:**
- Features completas end-to-end
- Service + Hook + Component + Page
- CRUD com Firestore
- Integração entre camadas

## Instructions

1. Se agente não especificado, mostrar lista e perguntar
2. Se tarefa não especificada, perguntar objetivo
3. Ler o arquivo do agente em `.claude/agents/[nome].md`
4. Seguir o protocolo do agente:
   - **Context Discovery**: Analisar código existente
   - **Execution**: Implementar seguindo padrões do projeto
   - **Handoff**: Documentar entregas
5. Respeitar stack do projeto (JavaScript, npm, Firebase)

**Protocolo de execução:**

**Fase 1 - Context Discovery:**
- Explorar codebase relevante
- Identificar padrões existentes
- Verificar convenções do projeto

**Fase 2 - Execution:**
- Implementar solução
- Manter consistência com código existente
- Documentar decisões

**Fase 3 - Handoff:**
- Listar arquivos criados/modificados
- Documentar uso dos componentes
- Fornecer próximos passos

## Examples

### Example 1: Design de componente
```bash
/agent ui-designer Criar sistema de cards responsivos
```
Entrega: Padrões Tailwind para cards com variantes

### Example 2: Feature fullstack
```bash
/agent fullstack-developer Implementar sistema de orçamentos
```
Entrega: Service + Hook + Components + Page integrados

### Example 3: Componente React
```bash
/agent frontend-developer Criar filtro de transações
```
Entrega: Componente .jsx com hook de estado

### Example 4: Serviço Firebase
```bash
/agent backend-developer Criar serviço de categorias
```
Entrega: Service com CRUD para Firestore

## Stack do Projeto

```
React 18 + Vite (JavaScript)
Tailwind CSS
Firebase (Firestore, Auth, Storage)
Context API
npm
Vercel (deploy)
```

**Agentes NÃO adicionam:** TypeScript, pnpm, bibliotecas de UI, testes, Docker.

## Related Skills

- `/component` - Componentes simples
- `/page` - Páginas simples
- `/hook` - Hooks customizados
- `/firebase` - Operações Firebase diretas
