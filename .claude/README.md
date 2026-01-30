# Claude Code Configuration for myPay

This directory contains custom skills and settings for Claude Code when working on the myPay project.

## Overview

This configuration includes:
- **10 Custom Skills** - Slash commands for common tasks
- **4 Specialized Agents** - Expert AI agents for myPay (React + Firebase)
- **Project Settings** - Conventions and best practices
- **Hooks System** - Automation and event triggers

## Skills

Custom slash commands available in this project:

### Development Skills

- **/component** - Create new React components following project patterns
  - `--ui` for UI components in `src/components/ui/`
  - `--page` for page components in `src/pages/`

- **/hook** - Create custom Firestore hooks in `src/hooks/useFirestore.js`

- **/page** - Create complete new pages with tab integration in App.jsx

### Code Quality

- **/refactor** - Perform common refactorings
  - `extract-component` - Extract reusable components
  - `optimize-hook` - Optimize hooks for performance
  - `split-file` - Split large files
  - `remove-duplication` - Remove code duplication
  - `improve-performance` - Optimize performance

### Firebase & Backend

- **/firebase** - Manage Firebase/Firestore operations
  - `rules` - Review and update Firestore rules
  - `indexes` - Manage Firestore indexes
  - `collections` - Document collections structure
  - `security` - Security audit
  - `debug` - Debug Firebase issues

- **/migration** - Create and run data migrations
  - `--dry-run` to simulate
  - `--execute` to run

### AI & Document Processing

- **/ai-prompt** - Manage Gemini AI prompts for document processing
  - `--test` to test with example docs
  - `--optimize` to improve existing prompts

### Testing & Deployment

- **/test-feature** - Test app features (auth, transactions, cards, etc.)

- **/deploy** - Deploy to production
  - `--check` for pre-deploy verification
  - `--build-only` to just build

### Agents

- **/agent** - Invoke specialized AI agents for complex tasks
  - `ui-designer` - Tailwind CSS, dark mode, design patterns
  - `frontend-developer` - React + JavaScript components
  - `backend-developer` - Firebase/Firestore, Cloud Functions
  - `fullstack-developer` - Complete features (Firestore → React)

See `.claude/agents/README.md` for detailed agent documentation.

## Settings

The `settings.json` file contains project-wide conventions and preferences:

- Code style (single quotes, no semicolons, functional components)
- File organization structure
- Import order preferences
- Best practices for React, Firebase, and styling
- AI assistance behavior

## How to Use

1. Skills are invoked with `/` prefix: `/component MyButton --ui`
2. Claude will follow the instructions in each skill file
3. Settings are automatically applied to all interactions

## Adding New Skills

Create a new `.md` file in `.claude/skills/`:

```markdown
# skill-name

Brief description

## Usage
\`\`\`bash
/skill-name [args] [--flags]
\`\`\`

## Description
Detailed description of what the skill does

## Instructions
Step-by-step instructions for Claude to follow
```

## Project Structure Reference

```
src/
├── components/
│   └── ui/           # Reusable UI components
├── pages/            # Main page components
├── hooks/            # Custom hooks (especially useFirestore.js)
├── services/         # External services (Firebase, AI, storage)
├── contexts/         # React contexts (Auth)
└── utils/            # Utility functions

.claude/
├── skills/           # Custom slash commands
├── settings.json     # Project settings
└── README.md         # This file
```

## Tips

- Use skills to maintain consistency across the codebase
- Skills enforce project patterns automatically
- Customize skills as the project evolves
- Document any new patterns in CLAUDE.md or settings.json
