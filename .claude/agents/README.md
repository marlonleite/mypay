# Agentes - myPay

Agentes especializados para o projeto myPay (React + Firebase).

## Agentes Disponíveis

### 1. UI Designer (`ui-designer.md`)
**Expertise:** Tailwind CSS, dark mode, design system

**Usar para:**
- Criar padrões visuais e componentes
- Definir hierarquia visual e layouts
- Estilização consistente com dark mode
- Acessibilidade visual

**Entregáveis:**
- Padrões de componentes em Tailwind
- Classes CSS organizadas
- Variantes de estados (hover, active, disabled)

---

### 2. Frontend Developer (`frontend-developer.md`)
**Expertise:** React 18, JavaScript, Tailwind CSS

**Usar para:**
- Criar componentes React
- Implementar UIs responsivas
- Integrar com Context API
- Otimização de performance

**Entregáveis:**
- Componentes `.jsx`
- Custom hooks
- Integração com Firebase

---

### 3. Backend Developer (`backend-developer.md`)
**Expertise:** Firebase, Firestore, Cloud Functions

**Usar para:**
- Modelagem de dados Firestore
- Criar serviços de acesso a dados
- Configurar security rules
- Cloud Functions quando necessário

**Entregáveis:**
- Services em `src/services/`
- Estrutura de coleções Firestore
- Regras de segurança

---

### 4. Fullstack Developer (`fullstack-developer.md`)
**Expertise:** React + Firebase end-to-end

**Usar para:**
- Features completas (Firestore → UI)
- Integrações entre camadas
- CRUD completo de entidades
- Fluxos de usuário inteiros

**Entregáveis:**
- Service + Hook + Component + Page
- Documentação de integração
- Estrutura Firestore

---

## Quando Usar Cada Agente

| Tarefa | Agente Recomendado |
|--------|-------------------|
| Novo componente visual | `ui-designer` |
| Componente com lógica | `frontend-developer` |
| Nova coleção Firestore | `backend-developer` |
| Feature completa | `fullstack-developer` |
| Ajuste de estilo | `ui-designer` |
| Bug em componente | `frontend-developer` |
| Query Firestore | `backend-developer` |
| Nova página com CRUD | `fullstack-developer` |

## Stack do Projeto

```
Frontend: React 18 + Vite (JavaScript)
Styling: Tailwind CSS
State: Context API
Database: Cloud Firestore
Auth: Firebase Authentication
Storage: Firebase Storage + AWS S3
Deploy: Vercel
Icons: lucide-react
Charts: recharts
```

## Como Invocar

```bash
# Via skill /agent
/agent ui-designer Criar card de transação

# Ou mencionando diretamente
"Use o frontend-developer para criar o componente de filtro"
```

## Boas Práticas

1. **Escolha o agente certo** - Use o mais especializado para a tarefa
2. **Contexto claro** - Descreva bem o que precisa ser feito
3. **Uma coisa por vez** - Evite tarefas muito amplas
4. **Revise entregáveis** - Confira se segue os padrões do projeto

## O Que Os Agentes NÃO Fazem

- ❌ Adicionar TypeScript
- ❌ Instalar novas bibliotecas de UI
- ❌ Criar testes (framework não configurado)
- ❌ Usar pnpm (projeto usa npm)
- ❌ Criar APIs REST tradicionais
- ❌ Configurar Docker/microservices
