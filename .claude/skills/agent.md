# agent

Invoca agentes especializados para tarefas específicas do projeto.

## Usage

```bash
/agent [nome-agente] [tarefa]
```

Agentes disponíveis:
- `ui-designer` - Design de interfaces e sistemas de design
- `frontend-developer` - Desenvolvimento React/frontend
- `backend-developer` - Desenvolvimento backend/APIs
- `fullstack-developer` - Features completas end-to-end
- `mobile-developer` - Desenvolvimento mobile (iOS/Android)

## Description

Esta skill invoca agentes especializados definidos em `.claude/agents/` seguindo o protocolo Voltagent.

**Cada agente possui:**
- Expertise especializada em sua área
- Protocolo de comunicação estruturado
- Fluxo de execução padronizado
- Integrações com outros agentes
- Documentação de entregas

**Quando usar cada agente:**

**ui-designer:**
- Criar componentes visuais
- Design systems e tokens
- Layouts responsivos
- Acessibilidade visual
- Dark mode
- Motion design

**frontend-developer:**
- Implementar componentes React
- Integração com APIs
- Estado e performance
- Testes frontend
- TypeScript

**backend-developer:**
- APIs e endpoints
- Lógica de negócio
- Integração com banco de dados
- Autenticação/autorização
- Migrations

**fullstack-developer:**
- Features completas (DB → UI)
- Arquitetura end-to-end
- Fluxos de dados
- Real-time features
- Deploy completo

**mobile-developer:**
- Apps nativos (iOS/Android)
- React Native
- Integrações mobile
- Performance mobile
- App store deployment

## Instructions

1. Se agente não especificado, mostrar lista e perguntar
2. Se tarefa não especificada, perguntar objetivo
3. Ler o arquivo do agente em `.claude/agents/[nome].md`
4. Seguir o protocolo do agente:
   - **Context Discovery**: Gather project context first
   - **Execution**: Execute task following agent guidelines
   - **Handoff**: Document deliverables and completion
5. Aplicar expertise e boas práticas do agente
6. Seguir estrutura de comunicação do agente
7. Documentar entregas conforme padrão do agente
8. Notificar sobre arquivos criados/modificados
9. Fornecer next steps claros

**Protocolo de execução:**

**Fase 1 - Context Discovery:**
- Explorar codebase relevante
- Identificar padrões existentes
- Verificar convenções do projeto
- Mapear dependências
- Perguntar apenas detalhes críticos

**Fase 2 - Development Execution:**
- Implementar solução seguindo best practices do agente
- Manter consistência com código existente
- Documentar decisões arquiteturais
- Fornecer updates de progresso

**Fase 3 - Handoff:**
- Listar todos os arquivos criados/modificados
- Documentar API/uso dos componentes
- Destacar decisões importantes
- Fornecer próximos passos
- Atualizar documentação relevante

## Examples

### Example 1: Design de componente
```bash
/agent ui-designer Criar sistema de cards responsivos com dark mode
```
O ui-designer vai:
1. Analisar design system existente
2. Criar variações de cards
3. Documentar tokens e specs
4. Preparar handoff para frontend

### Example 2: Feature fullstack
```bash
/agent fullstack-developer Implementar sistema de orçamentos mensais
```
O fullstack-developer vai:
1. Design do schema no Firestore
2. Criar hook useFirestore
3. Implementar UI components
4. Integrar com sistema existente
5. Testes end-to-end

### Example 3: Implementar UI
```bash
/agent frontend-developer Criar dashboard de transações com gráficos
```
O frontend-developer vai:
1. Criar componentes React
2. Integração com hooks existentes
3. Implementar gráficos com biblioteca
4. Testes e acessibilidade
5. Documentação Storybook

### Example 4: API backend
```bash
/agent backend-developer Criar API de export de dados em CSV
```
O backend-developer vai:
1. Criar endpoint de export
2. Implementar geração de CSV
3. Adicionar autenticação
4. Testes de API
5. Documentação

## Related Skills

- `/component` - Criar componentes simples (use agent para componentes complexos)
- `/page` - Criar páginas simples (use agent para features completas)
- `/refactor` - Use com agent para refatorações arquiteturais
- `/firebase` - Use com backend-developer para operações Firebase

## Notes

- Agentes seguem protocolos estruturados e produzem código de alta qualidade
- Use agentes para tarefas complexas que requerem expertise específica
- Para tarefas simples, use skills regulares (/component, /hook, etc)
- Agentes automaticamente seguem best practices da sua área
- Todos os agentes respeitam convenções do CLAUDE.md e settings.json
