# Claude Code - Complete Cheatsheet

## Quick Reference: Skills + Agents

## Development

| Command | Description | Example |
|---------|-------------|---------|
| `/component [name] [--ui\|--page]` | Create React component | `/component Button --ui` |
| `/hook [collection]` | Create Firestore hook | `/hook budgets` |
| `/page [name]` | Create new page with tab | `/page Reports` |

## Code Quality

| Command | Description | Example |
|---------|-------------|---------|
| `/refactor extract-component` | Extract reusable component | `/refactor extract-component` |
| `/refactor optimize-hook` | Optimize hook performance | `/refactor optimize-hook` |
| `/refactor split-file` | Split large files | `/refactor split-file` |
| `/refactor remove-duplication` | Remove duplicate code | `/refactor remove-duplication` |
| `/refactor improve-performance` | Optimize performance | `/refactor improve-performance` |

## Firebase

| Command | Description | Example |
|---------|-------------|---------|
| `/firebase rules` | Review Firestore rules | `/firebase rules` |
| `/firebase indexes` | Manage indexes | `/firebase indexes` |
| `/firebase collections` | Document collections | `/firebase collections` |
| `/firebase security` | Security audit | `/firebase security` |
| `/firebase debug` | Debug Firebase issues | `/firebase debug` |

## AI & Documents

| Command | Description | Example |
|---------|-------------|---------|
| `/ai-prompt [type]` | Manage AI prompts | `/ai-prompt invoice` |
| `/ai-prompt [type] --test` | Test prompt | `/ai-prompt receipt --test` |
| `/ai-prompt [type] --optimize` | Optimize prompt | `/ai-prompt invoice --optimize` |

## Data

| Command | Description | Example |
|---------|-------------|---------|
| `/migration [name]` | Create migration script | `/migration add-field` |
| `/migration [name] --dry-run` | Simulate migration | `/migration fix-dates --dry-run` |
| `/migration [name] --execute` | Run migration | `/migration cleanup --execute` |

## Testing & Deploy

| Command | Description | Example |
|---------|-------------|---------|
| `/test-feature [feature]` | Test functionality | `/test-feature auth` |
| `/deploy` | Full deploy | `/deploy` |
| `/deploy --check` | Pre-deploy check | `/deploy --check` |
| `/deploy --build-only` | Build only | `/deploy --build-only` |

## Agents (Complex Tasks)

| Command | Expert In | Example |
|---------|-----------|---------|
| `/agent ui-designer` | Tailwind, dark mode | `/agent ui-designer Create card system` |
| `/agent frontend-developer` | React, JavaScript | `/agent frontend-developer Build dashboard` |
| `/agent backend-developer` | Firebase, Firestore | `/agent backend-developer Create export service` |
| `/agent fullstack-developer` | End-to-end features | `/agent fullstack-developer Add budgets` |

## Features to Test

- `auth` - Authentication
- `transactions` - Transactions CRUD
- `cards` - Credit cards
- `categories` - Categories
- `documents` - Document processing
- `accounts` - Bank accounts

## Common Workflows

### Add New Feature
```bash
/hook [collection]      # 1. Create data layer
/page [PageName]        # 2. Create UI
/component [Name] --ui  # 3. Create components
/test-feature [feature] # 4. Test it
```

### Improve Code
```bash
/refactor [type]           # 1. Refactor
/firebase security         # 2. Check security
/deploy --check           # 3. Verify deploy
```

### New Document Type
```bash
/ai-prompt [type]          # 1. Create prompt
/ai-prompt [type] --test   # 2. Test
/test-feature documents    # 3. Test in app
```

## Quick Tips

- Type `/` to see all available skills
- Skills will prompt for missing arguments
- All text output is in Portuguese (pt-BR)
- Code (variables, functions) is in English
- Check `.claude/README.md` for full docs
