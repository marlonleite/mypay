# Instruções para agentes (Cursor)

Este repositório segue a mesma doutrina modular que o **Claude Code** usa em `.claude/rules/`, espelhada em **`.cursor/rules/*.mdc`**.

## Regras Cursor (par com `.claude/rules/`)

| Área | `.mdc` |
|------|--------|
| Doutrina central | `01-core.mdc` |
| Request / fases | `02-request.mdc` |
| Debugging / RCA | `03-refresh.mdc` |
| Retrospectiva | `04-retro.mdc` |
| Comunicação | `05-comunicacao.mdc` |
| Testes (Vitest) | `06-testes.mdc` |
| Desenvolvimento | `07-desenvolvimento.mdc` |
| Frontend React | `08-frontend.mdc` |
| Migração API | `09-migration-map.mdc` |
| Convenções (`settings.json`) | `10-mypay-conventions.mdc` |

## Outros artefatos (Claude Code)

- Comandos slash: `.claude/commands/` (ex.: `/review`, `/commit`, `/test`) — no Cursor, equivalente manual ou fluxo do IDE.
- Skills: `.claude/skills/` — referência para prompts e checklists; não há loader automático no Cursor.
- Visão geral humana: `CLAUDE.md`.

## Redundância com `~/.cursor/rules/`

Se as mesmas normas já existirem como regras **globais** no seu usuário, o Cursor aplica **global + projeto**. Ajuste ou desative globais se notar instruções duplicadas.
