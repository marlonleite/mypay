# Claude Code Configuration - Index

Welcome to the Claude Code configuration for myPay! This index helps you navigate all documentation.

## 🚀 Getting Started

**New to Claude Code on this project?**
1. Read [QUICKSTART.md](QUICKSTART.md) - Basic skills usage (5 min)
2. Read [AGENTS_QUICKSTART.md](AGENTS_QUICKSTART.md) - Advanced agent usage (10 min)
3. Check [CHEATSHEET.md](CHEATSHEET.md) - Quick command reference

## 📚 Documentation

### Core Documentation
- **[README.md](README.md)** - Complete configuration overview and project structure
- **[QUICKSTART.md](QUICKSTART.md)** - Quick start guide for skills
- **[CHEATSHEET.md](CHEATSHEET.md)** - Command reference for skills and agents

### Agent Documentation
- **[AGENTS_QUICKSTART.md](AGENTS_QUICKSTART.md)** - Comprehensive agent guide with examples
- **[agents/README.md](agents/README.md)** - Detailed agent specifications and protocols

### Configuration Files
- **[settings.json](settings.json)** - Project conventions and code style
- **[hooks.example.json](hooks.example.json)** - Example automation hooks

## 🛠️ Skills (10 Available)

Quick access to skill documentation:

| Skill | Purpose | Documentation |
|-------|---------|---------------|
| `/component` | Create React components | [skills/component.md](skills/component.md) |
| `/hook` | Create Firestore hooks | [skills/hook.md](skills/hook.md) |
| `/page` | Create pages with tabs | [skills/page.md](skills/page.md) |
| `/firebase` | Manage Firebase/Firestore | [skills/firebase.md](skills/firebase.md) |
| `/ai-prompt` | Manage AI prompts | [skills/ai-prompt.md](skills/ai-prompt.md) |
| `/refactor` | Code refactoring | [skills/refactor.md](skills/refactor.md) |
| `/migration` | Data migrations | [skills/migration.md](skills/migration.md) |
| `/test-feature` | Test app features | [skills/test-feature.md](skills/test-feature.md) |
| `/deploy` | Deploy to production | [skills/deploy.md](skills/deploy.md) |
| `/agent` | Invoke specialized agents | [skills/agent.md](skills/agent.md) |

## 🤖 Agents (5 Available)

Quick access to agent specifications:

| Agent | Expertise | Documentation |
|-------|-----------|---------------|
| `ui-designer` | Visual design, design systems | [agents/ui-designer.md](agents/ui-designer.md) |
| `frontend-developer` | React, TypeScript, UI | [agents/frontend-developer.md](agents/frontend-developer.md) |
| `backend-developer` | APIs, Firebase, backend | [agents/backend-developer.md](agents/backend-developer.md) |
| `fullstack-developer` | End-to-end features | [agents/fullstack-developer.md](agents/fullstack-developer.md) |
| `mobile-developer` | React Native, mobile | [agents/mobile-developer.md](agents/mobile-developer.md) |

## 📋 Common Use Cases

### Creating Components
```bash
# Simple component
/component Button --ui

# Complex component with design
/agent ui-designer Design a transaction card system
/agent frontend-developer Implement the card design
```

### Adding Features
```bash
# Simple feature
/hook budgets
/page Budgets

# Complex feature
/agent fullstack-developer Implement budget tracking with alerts
```

### Firebase Operations
```bash
# Manage Firebase
/firebase rules          # Review security rules
/firebase indexes        # Manage indexes
/firebase debug         # Debug issues

# Complex Firebase work
/agent backend-developer Implement complex query optimization
```

### Refactoring & Optimization
```bash
# Simple refactoring
/refactor extract-component
/refactor optimize-hook

# Complex refactoring
/agent fullstack-developer Refactor authentication system
```

### Design Work
```bash
# Always use ui-designer agent for design
/agent ui-designer Create design system for dashboard
/agent ui-designer Redesign mobile navigation
```

### Deployment
```bash
# Pre-deploy checks
/deploy --check

# Full deployment
/deploy
```

## 🎯 Decision Guide

**Choose the right tool:**

```
What do you need?

├─ Quick component/page/hook
│  └─ Use: /component, /page, /hook
│
├─ Design or visual work
│  └─ Use: /agent ui-designer
│
├─ Complex React implementation
│  └─ Use: /agent frontend-developer
│
├─ Backend/API/Firebase
│  └─ Use: /firebase or /agent backend-developer
│
├─ Complete feature (DB → UI)
│  └─ Use: /agent fullstack-developer
│
├─ Mobile development
│  └─ Use: /agent mobile-developer
│
├─ Code quality improvement
│  └─ Use: /refactor
│
├─ Data migration
│  └─ Use: /migration
│
├─ Testing
│  └─ Use: /test-feature
│
└─ Deploy
   └─ Use: /deploy
```

## 📁 Directory Structure

```
.claude/
├─ INDEX.md                    ← You are here
├─ README.md                   ← Complete overview
├─ QUICKSTART.md              ← Skills quick start
├─ AGENTS_QUICKSTART.md       ← Agents quick start
├─ CHEATSHEET.md              ← Command reference
├─ settings.json              ← Project settings
├─ hooks.example.json         ← Automation hooks
├─ .gitignore                 ← Git ignore rules
│
├─ skills/                    ← 10 custom skills
│  ├─ component.md
│  ├─ hook.md
│  ├─ page.md
│  ├─ firebase.md
│  ├─ ai-prompt.md
│  ├─ refactor.md
│  ├─ migration.md
│  ├─ test-feature.md
│  ├─ deploy.md
│  ├─ agent.md
│  └─ _template.md           ← Template for new skills
│
└─ agents/                    ← 5 specialized agents
   ├─ README.md              ← Agent documentation
   ├─ ui-designer.md
   ├─ frontend-developer.md
   ├─ backend-developer.md
   ├─ fullstack-developer.md
   └─ mobile-developer.md
```

## 🔧 Customization

### Adding New Skills
1. Copy `skills/_template.md`
2. Customize for your use case
3. Save as `skills/your-skill.md`
4. Use with `/your-skill`

### Modifying Agents
1. Edit agent file in `agents/`
2. Update frontmatter (name, description, tools)
3. Customize execution flows
4. Save and use immediately

### Setting Up Hooks
1. Copy `hooks.example.json` to `hooks.json`
2. Enable desired hooks
3. Customize commands
4. Test with small changes

### Updating Settings
1. Edit `settings.json`
2. Modify conventions, styles, or practices
3. Changes apply to all skills and agents

## 💡 Tips

1. **Tab Completion**: Type `/` and press Tab to see all skills
2. **Help**: Use `/help` in Claude Code for general help
3. **Context**: Skills and agents respect `CLAUDE.md` in project root
4. **Combine**: Use multiple skills/agents for complex workflows
5. **Documentation**: All `.md` files are readable documentation

## 🆘 Need Help?

**For Skills:**
- Read individual skill docs in `skills/`
- Check [QUICKSTART.md](QUICKSTART.md)
- Review examples in [CHEATSHEET.md](CHEATSHEET.md)

**For Agents:**
- Read [AGENTS_QUICKSTART.md](AGENTS_QUICKSTART.md)
- Check agent specs in `agents/`
- See protocol in [agents/README.md](agents/README.md)

**For Setup:**
- Review [README.md](README.md)
- Check [settings.json](settings.json)
- Review project root `CLAUDE.md`

## 📖 External Resources

- **Claude Code Docs**: [https://docs.anthropic.com/claude/docs](https://docs.anthropic.com/claude/docs)
- **Project Root**: `/CLAUDE.md` - Project-specific instructions
- **GitHub Issues**: Report issues in myPay repository

---

**Version:** 1.0.0
**Last Updated:** 2026-01-24
**myPay Project** - Personal Finance Management App
