# Voltagent Agents - myPay

This directory contains specialized AI agents following the Voltagent protocol for the myPay project.

## Available Agents

### 1. UI Designer (`ui-designer.md`)
**Expertise:** Visual design, design systems, interaction patterns, accessibility

**Use for:**
- Creating component designs and specifications
- Building design systems and token libraries
- Defining visual hierarchy and layouts
- Dark mode and responsive design
- Motion design and animations
- Accessibility audits

**Deliverables:**
- Component specifications
- Design tokens
- Visual mockups
- Interaction documentation
- Accessibility annotations

---

### 2. Frontend Developer (`frontend-developer.md`)
**Expertise:** React 18+, TypeScript, modern web development

**Use for:**
- Building React components
- Implementing responsive UIs
- State management integration
- Frontend testing
- Performance optimization
- Accessibility implementation

**Deliverables:**
- React components with TypeScript
- Test suites (>85% coverage)
- Storybook documentation
- Performance reports
- Accessibility compliance

---

### 3. Backend Developer (`backend-developer.md`)
**Expertise:** APIs, databases, server-side logic, security

**Use for:**
- Creating API endpoints
- Database schema design
- Business logic implementation
- Authentication/authorization
- Data migrations
- Performance optimization

**Deliverables:**
- API implementations
- Database schemas
- Migration scripts
- API documentation
- Security configurations

---

### 4. Fullstack Developer (`fullstack-developer.md`)
**Expertise:** End-to-end feature development, system architecture

**Use for:**
- Complete feature implementations (DB → UI)
- Cross-stack integrations
- Real-time features
- End-to-end testing
- Full deployment pipelines
- System architecture design

**Deliverables:**
- Complete feature implementations
- Database + API + UI
- End-to-end tests
- Deployment configurations
- Architecture documentation

---

## Agent Protocol

All agents follow the Voltagent protocol with three phases:

### Phase 1: Context Discovery
- Query context-manager for project state
- Analyze existing codebase patterns
- Identify dependencies and constraints
- Ask only critical missing details

### Phase 2: Development Execution
- Implement solution following best practices
- Maintain consistency with existing code
- Provide progress updates
- Document architectural decisions

### Phase 3: Handoff and Documentation
- List all created/modified files
- Document APIs and usage patterns
- Highlight important decisions
- Provide clear next steps

## How to Use Agents

### Using the /agent Skill

```bash
# Invoke an agent with a task
/agent [agent-name] [task-description]

# Examples:
/agent ui-designer Create card component system with dark mode
/agent frontend-developer Implement dashboard with charts
/agent fullstack-developer Build budget tracking feature
/agent backend-developer Create CSV export API
```

### Direct Use

You can also reference agents directly in conversations:

```
"Can the frontend-developer agent implement a transaction list component?"
```

Claude will automatically follow the agent's protocol and expertise.

## Agent Communication Format

Agents use structured JSON for inter-agent communication:

```json
{
  "requesting_agent": "frontend-developer",
  "request_type": "get_project_context",
  "payload": {
    "query": "Frontend architecture and patterns"
  }
}
```

```json
{
  "agent": "ui-designer",
  "update_type": "progress",
  "current_task": "Component design",
  "completed_items": ["Visual exploration", "Component structure"],
  "next_steps": ["Motion design", "Documentation"]
}
```

## Choosing the Right Agent

**For visual/design work:**
→ Use `ui-designer`

**For React/frontend implementation:**
→ Use `frontend-developer`

**For APIs/backend logic:**
→ Use `backend-developer`

**For complete features (DB + API + UI):**
→ Use `fullstack-developer`

**For mobile apps:**
→ Use `mobile-developer`

**For simple components/pages:**
→ Use regular skills (`/component`, `/page`) instead

## Agent Expertise Matrix

| Task             | UI Designer | Frontend Dev | Backend Dev | Fullstack Dev | Mobile Dev |
| ---------------- | ----------- | ------------ | ----------- | ------------- | ---------- |
| Design Systems   | ✅✅✅         | ✅            | -           | ✅             | ✅          |
| React Components | ✅           | ✅✅✅          | -           | ✅✅            | ✅          |
| APIs             | -           | ✅            | ✅✅✅         | ✅✅            | ✅          |
| Database         | -           | -            | ✅✅✅         | ✅✅            | ✅          |
| E2E Features     | ✅           | ✅✅           | ✅✅          | ✅✅✅           | ✅✅         |
| Mobile Apps      | ✅           | ✅            | -           | ✅             | ✅✅✅        |
| Testing          | ✅           | ✅✅✅          | ✅✅✅         | ✅✅✅           | ✅✅✅        |
| Performance      | ✅           | ✅✅✅          | ✅✅✅         | ✅✅✅           | ✅✅✅        |

✅✅✅ = Primary expertise
✅✅ = Strong capability
✅ = Supporting capability
- = Not applicable

## Project Integration

All agents are configured to follow myPay project conventions:

- **Tech Stack:** React 18, Firebase, Tailwind CSS
- **Language:** Portuguese (pt-BR) for UI, English for code
- **Theme:** Dark mode only with `dark-*` colors
- **Patterns:** See `/CLAUDE.md` and `.claude/settings.json`

## Customization

To customize an agent:

1. Edit the agent's `.md` file
2. Modify the frontmatter (name, description, tools)
3. Update execution flows and guidelines
4. Add project-specific patterns

## Best Practices

1. **Choose the right agent** for the task complexity
2. **Provide clear task descriptions** with context
3. **Let agents follow their protocol** - they'll gather context first
4. **Review deliverables** and provide feedback
5. **Document decisions** made by agents

## Integration with Skills

Agents work alongside regular skills:

- Use **skills** for quick, simple tasks
- Use **agents** for complex, expert-level work
- Combine both for optimal workflow

Example workflow:
```bash
# Simple component → use skill
/component Button --ui

# Complex feature → use agent
/agent fullstack-developer Implement budget tracking system

# Simple page → use skill
/page Reports

# Complex design → use agent
/agent ui-designer Create design system for dashboard
```
