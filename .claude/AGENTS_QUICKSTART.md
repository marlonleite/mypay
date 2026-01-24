# Agents Quick Start Guide

## What are Agents?

Agents are specialized AI experts that follow structured protocols to deliver high-quality work in their domain. Think of them as senior specialists you can invoke for complex tasks.

## Available Agents

### 🎨 UI Designer
**Expert in:** Visual design, design systems, accessibility, UX

**When to use:**
- Creating component designs and specs
- Building design systems
- Dark mode and responsive layouts
- Motion design and animations
- Visual accessibility

**Example:**
```bash
/agent ui-designer Create a card component system with hover states and dark mode support
```

**Deliverables:**
- Component specifications
- Design tokens and variables
- Interaction documentation
- Accessibility guidelines

---

### ⚛️ Frontend Developer
**Expert in:** React 18+, TypeScript, modern web development

**When to use:**
- Implementing React components
- State management integration
- Performance optimization
- Frontend testing
- TypeScript type safety

**Example:**
```bash
/agent frontend-developer Implement a dashboard with transaction charts and filters
```

**Deliverables:**
- React components with TypeScript
- Test suites (>85% coverage)
- Storybook documentation
- Performance metrics

---

### 🔧 Backend Developer
**Expert in:** APIs, Firebase, databases, security

**When to use:**
- Creating API endpoints
- Firebase Firestore operations
- Authentication/authorization
- Data migrations
- Backend logic

**Example:**
```bash
/agent backend-developer Create API endpoint for exporting transactions to CSV
```

**Deliverables:**
- API implementations
- Database schemas/queries
- Migration scripts
- Security configurations
- API documentation

---

### 🚀 Fullstack Developer
**Expert in:** End-to-end features, system architecture

**When to use:**
- Complete features (database → UI)
- Real-time features
- Complex integrations
- System architecture
- End-to-end testing

**Example:**
```bash
/agent fullstack-developer Implement monthly budgets with tracking and alerts
```

**Deliverables:**
- Complete feature (DB + API + UI)
- End-to-end tests
- Integration documentation
- Deployment configs

---

### 📱 Mobile Developer
**Expert in:** React Native, iOS, Android, mobile-first

**When to use:**
- Mobile app features
- Platform-specific code
- Mobile performance
- App store deployment
- Offline-first features

**Example:**
```bash
/agent mobile-developer Add biometric authentication for iOS and Android
```

**Deliverables:**
- Native mobile code
- Platform integrations
- Mobile-optimized UI
- App store configs

---

## How Agents Work

### The Voltagent Protocol

All agents follow a 3-phase protocol:

#### Phase 1: Context Discovery 🔍
The agent first gathers project context:
- Analyzes existing codebase
- Identifies patterns and conventions
- Maps dependencies
- Asks only critical questions

#### Phase 2: Development Execution ⚡
The agent implements the solution:
- Follows best practices
- Maintains code consistency
- Provides progress updates
- Documents decisions

#### Phase 3: Handoff & Documentation 📋
The agent completes the delivery:
- Lists all changes
- Documents APIs and usage
- Highlights decisions
- Provides next steps

## When to Use Agents vs Skills

### Use Skills for:
✅ Simple, straightforward tasks
✅ Quick component creation
✅ Standard CRUD operations
✅ Following established patterns

```bash
/component Button --ui      # Simple UI component
/hook budgets              # Standard Firestore hook
/page Reports              # Simple page
```

### Use Agents for:
✅ Complex, expert-level work
✅ Architecture decisions
✅ Complete feature development
✅ Performance-critical code
✅ Security-sensitive operations

```bash
/agent ui-designer Create comprehensive design system
/agent fullstack-developer Build budget tracking with real-time sync
/agent backend-developer Implement complex authorization system
```

## Practical Examples

### Example 1: Building a New Feature

**Task:** Add budget tracking to myPay

**Approach using Fullstack Agent:**
```bash
/agent fullstack-developer Implement monthly budget tracking with:
- Budget creation and limits per category
- Real-time spending tracking
- Alerts when approaching limit
- Visual progress indicators
- History and reports
```

**What the agent delivers:**
1. **Database layer:**
   - `budgets` collection schema
   - Firestore queries and indexes
   - Migration script if needed

2. **Backend logic:**
   - `useBudgets` hook in useFirestore.js
   - Budget calculation utilities
   - Alert trigger logic

3. **Frontend:**
   - BudgetPage component
   - BudgetCard UI components
   - Real-time progress bars
   - Alert notifications

4. **Integration:**
   - Updates App.jsx with new tab
   - Integrates with existing transactions
   - End-to-end tests

5. **Documentation:**
   - API documentation
   - Usage examples
   - Next steps

---

### Example 2: Improving Design

**Task:** Redesign transaction cards

**Approach using UI Designer Agent:**
```bash
/agent ui-designer Redesign transaction cards with:
- Better visual hierarchy
- Category color coding
- Swipe actions for mobile
- Smooth animations
- Dark mode optimization
```

**What the agent delivers:**
1. **Design specifications:**
   - Card layout variants
   - Color and typography tokens
   - Spacing and sizing specs
   - State variations (hover, active, disabled)

2. **Interaction design:**
   - Animation specifications
   - Transition timings
   - Gesture documentation
   - Accessibility notes

3. **Developer handoff:**
   - Component structure
   - CSS/Tailwind classes
   - Implementation notes
   - Figma/design file links

4. **Next steps:**
   - Frontend developer can implement
   - Test cases to verify
   - Performance considerations

---

### Example 3: Adding Mobile Support

**Task:** Create React Native mobile app

**Approach using Mobile Developer Agent:**
```bash
/agent mobile-developer Create React Native app with:
- Firebase authentication
- Transaction sync
- Offline support
- Push notifications
- Biometric login
```

**What the agent delivers:**
1. **Mobile setup:**
   - React Native project structure
   - iOS and Android configurations
   - Firebase integration

2. **Core features:**
   - Authentication flow
   - Data synchronization
   - Offline-first storage
   - Push notification setup

3. **Platform integrations:**
   - Biometric authentication
   - Deep linking
   - App icons and splash screens

4. **Deployment:**
   - Build configurations
   - App store metadata
   - CI/CD pipeline

---

## Agent Communication

Agents use structured communication for complex workflows:

### Progress Updates
```json
{
  "agent": "fullstack-developer",
  "update_type": "progress",
  "current_task": "Implementing budget API",
  "completed_items": ["Database schema", "Firestore hooks"],
  "next_steps": ["UI components", "Integration tests"]
}
```

### Context Requests
```json
{
  "requesting_agent": "frontend-developer",
  "request_type": "get_project_context",
  "payload": {
    "query": "Current component library and design tokens"
  }
}
```

### Completion Reports
```
"Budget tracking feature delivered successfully. Created complete solution including:
- Firestore collection schema in users/{uid}/budgets/
- useBudgets hook with CRUD operations in src/hooks/useFirestore.js
- BudgetPage component with real-time tracking in src/pages/
- BudgetCard and BudgetForm UI components in src/components/ui/
- Alert system for budget limits
- 92% test coverage with E2E tests
- Integrated with App.jsx tab navigation

Ready for testing. Recommend testing budget alerts with live data."
```

## Tips for Working with Agents

### 1. Be Specific
❌ "Improve the app"
✅ "Optimize transaction list performance for 1000+ items with virtualization"

### 2. Provide Context
Include relevant details:
- What exists already
- What's the goal
- Any constraints or requirements
- Performance/accessibility needs

### 3. Trust the Protocol
Let agents follow their 3-phase protocol:
- They'll gather context first
- They'll ask critical questions
- They'll document deliverables

### 4. Review Deliverables
Agents provide comprehensive deliverables:
- Review code quality
- Check test coverage
- Verify documentation
- Test functionality

### 5. Combine Agents
For complex projects, agents can work together:
```bash
# Design phase
/agent ui-designer Create dashboard design system

# Implementation phase
/agent frontend-developer Implement dashboard from design specs

# Backend integration
/agent backend-developer Add analytics API for dashboard

# Final integration
/agent fullstack-developer Integrate dashboard with real-time data
```

## Next Steps

1. **Try an agent:** Start with a simple task
   ```bash
   /agent ui-designer Review and improve card component design
   ```

2. **Read agent docs:** Check `.claude/agents/README.md`

3. **Experiment:** Try different agents for different tasks

4. **Combine:** Use agents + skills for optimal workflow

5. **Customize:** Edit agent files to match your workflow

**Happy coding with AI agents! 🚀**
