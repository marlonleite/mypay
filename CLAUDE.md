# CLAUDE.md

Este arquivo fornece orientações ao Claude Code quando trabalhando neste repositório.

---

## Doutrina Operacional

**TODAS as regras definidas em `.claude/rules/` devem ser rigorosamente seguidas.**

### Cursor (`~/.cursor/rules/` + este repositório)

A doutrina **agnóstica de stack** (fluxo, comunicação, RCA, retrospectiva) já está em **`~/.cursor/rules/`**: por exemplo `doutrina-operacional.mdc`, `comunicacao.mdc`, `protocolo-debug-raiz.mdc`, `protocolo-retro.mdc`. Elas **somam** automaticamente a qualquer workspace.

Neste repo, **`.cursor/rules/*.mdc`** traz o que é **específico do myPay**: testes Vitest, princípios de código, frontend React, mapa de migração API e **`10-mypay-conventions.mdc`** (espelho enxuto de **`.claude/settings.json`** — estilo, Firebase, i18n, pastas). Não duplicar aqui o que o global já cobre.

### Regras Globais (Sempre Ativas)

Leia PRIMEIRO os seguintes arquivos antes de qualquer ação:

- **`.claude/rules/01-core.md`** - Doutrina operacional central (OBRIGATÓRIO)
  - Reconhecimento antes de tocar (completo vs. focalizado)
  - Fluxo mandatório: Reconhecimento → Planejamento → Execução → Verificação → Relato
  - Ética operacional, zero suposições, ownership extremo
  - Constraints de commits (somente sob solicitação explícita)

- **`.claude/rules/05-comunicacao.md`** - Estilo de comunicação (OBRIGATÓRIO)
  - Concisão profissional em português brasileiro
  - Proibição de bajulação e validações vazias
  - Modos: ask (conversa), plan (planejamento), agent (execução silenciosa)
  - Legenda de status: ✅ sucesso, ⚠️ autocorrigido, 🚧 bloqueio

- **`.claude/rules/06-testes.md`** - Guia de Testes React/Vitest (FUTURO)
  - ⚠️ **Testes não configurados neste projeto atualmente**
  - Guia completo para quando Vitest for configurado
  - Testing Library, mocking Firebase, padrões AAA

- **`.claude/rules/07-desenvolvimento.md`** - Princípios de código (OBRIGATÓRIO)
  - Modularização, responsabilidade única, nomeação clara
  - Segurança, escalabilidade, testabilidade
  - Tratamento robusto de erros, logs estruturados

### Regras Contextuais (Ativadas Conforme Necessário)

- **`.claude/rules/02-request.md`** - Protocolo de request padrão
  - **Quando:** Durante toda tarefa de request normal
  - **Conteúdo:** Profundidade de reconhecimento (completo vs. focalizado), digest estruturado

- **`.claude/rules/03-refresh.md`** - Protocolo de Debugging & RCA
  - **Quando:** Bugs recorrentes, críticos ou de causa raiz obscura
  - **Conteúdo:** Análise de causa raiz, isolamento de anomalia, remediação sistêmica

- **`.claude/rules/04-retro.md`** - Protocolo de Retrospectiva
  - **Quando:** Comando `/retro` explícito ou solicitação de lições aprendidas
  - **Conteúdo:** Reflexão, abstração de lições duráveis, evolução da doutrina

- **`.claude/rules/08-frontend.md`** - Doutrina Frontend (ATIVO)
  - **Quando:** Sempre (projeto React + Vite)
  - **Conteúdo:** Stack, arquitetura, Context API, Tailwind CSS, padrões de código
  - **Regra adaptada para este projeto específico**

---

## Fluxo Operacional Mandatório

Para **TODA** tarefa, siga estritamente:

```
┌─────────────────┐
│ Reconhecimento  │ → Leia antes de tocar (completo ou focalizado)
└────────┬────────┘
         ↓
┌─────────────────┐
│  Planejamento   │ → Digest + impacto sistêmico
└────────┬────────┘
         ↓
┌─────────────────┐
│   Execução      │ → Leia → Escreva → Releia (sempre)
└────────┬────────┘
         ↓
┌─────────────────┐
│  Verificação    │ → Testes + linters + autoauditoria
└────────┬────────┘
         ↓
┌─────────────────┐
│    Relato       │ → Relatório estruturado com evidências
└─────────────────┘
```

### Checklist de Aderência

Antes de declarar qualquer tarefa como completa, verifique:

- [ ] Reconhecimento realizado (completo ou focalizado)?
- [ ] Digest de reconhecimento documentado (no chat)?
- [ ] Arquivos relidos imediatamente após modificação?
- [ ] Portões de qualidade executados (testes, linters)?
- [ ] Autoauditoria de confiança zero concluída?
- [ ] Relatório final estruturado fornecido?
- [ ] Comunicação concisa sem bajulação?

---

## Stack Específica

```
Framework: React 18 + Vite (JavaScript)
Linguagem: JavaScript (sem TypeScript)
Estilização: Tailwind CSS
Backend/Auth: Firebase (Firestore, Auth, Storage)
Ícones: lucide-react
Roteamento: react-router-dom v6
Gráficos: recharts
Storage S3: @aws-sdk/client-s3
Deploy: Vercel
Linting: ESLint (React/Hooks)
Package Manager: npm
Testes: Não configurado (pendente)
```

---

## Comandos do Projeto

```bash
# Instalar dependências
npm install

# Rodar aplicação (desenvolvimento)
npm run dev

# Build para produção
npm run build

# Preview do build
npm run preview

# Linting
npm run lint

# Dev com proxy (para APIs externas)
npm run dev:full
```

---

## Estrutura do Projeto

```
src/
├── components/    # Componentes reutilizáveis
├── contexts/      # Context API (auth, theme, etc.)
├── firebase/      # Configuração Firebase
├── hooks/         # Custom hooks
├── pages/         # Páginas/rotas da aplicação
├── services/      # Serviços (API calls, Firebase)
└── utils/         # Utilitários e helpers
```

---

## Notas do Projeto

### Arquitetura
- SPA com React Router para navegação
- Firebase como backend completo (auth, db, storage)
- Context API para estado global (sem Redux/Zustand)

### Convenções
- Arquivos `.jsx` para componentes React
- Tailwind CSS para estilização (utility-first)
- Firebase SDK v10 (modular imports)

### Gotchas
- Proxy configurado em `vite.config.js` para `/api/organizze-proxy`
- Versão da app injetada via `VITE_APP_VERSION` no build
- Variáveis de ambiente Firebase devem estar em `.env`

---

## IMPORTANTE

1. **NUNCA** execute código sem reconhecimento baseado em evidências
2. **SEMPRE** leia arquivos antes de modificar
3. **SEMPRE** releia imediatamente após modificação
4. **NUNCA** crie commits sem solicitação explícita do usuário
5. **SEMPRE** execute portões de qualidade antes de relatar conclusão
6. **SEMPRE** mantenha comunicação concisa e profissional (sem bajulação)

---

**Em caso de dúvida sobre regras operacionais:** `.claude/rules/01-core.md` (Claude Code) ou `~/.cursor/rules/doutrina-operacional.mdc` (Cursor).
