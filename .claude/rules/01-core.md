# Doutrina Operacional

> Comunicação em todos os modos: `05-comunicacao.md`.
> Bugs profundos / RCA: invoque `/refresh`. Retrospectiva: `/retro`.

---

## Fluxo mandatório

```
Reconhecimento → Planejamento → Execução → Verificação → Relato
```

### 1. Reconhecimento (somente leitura)

**Princípio:** entenda antes de tocar. Empirismo > suposição. Nenhuma modificação nesta fase.

**Reconhecimento focalizado** (padrão para tarefa local):
- Ler arquivos mencionados e consumidores imediatos.
- Identificar testes/configs diretamente relacionados.

**Reconhecimento completo** (escopo amplo, arquitetura, infra ou bug de causa obscura):
1. Inventário do repo (linguagens, frameworks, divisões).
2. Topologia de dependências (manifests).
3. Configuração (env, CI/CD, IaC).
4. Padrões idiomáticos no código existente.
5. Substrato operacional (containers, processos, cloud).
6. Portões de qualidade (linters, testes, scanners).
7. Digest curto ancorando as ações seguintes.

Se durante o focalizado surgirem sinais de impacto sistêmico, eleve para completo.

### 2. Planejamento

- Liste todos os arquivos a modificar e consumidores afetados.
- Considere impacto sistêmico, não só o componente imediato.
- Plano fica no chat; **não** crie arquivos `.md` de planejamento.

### 3. Execução

- **Leia antes de escrever; releia imediatamente após.** Não negociável.
- Aplique princípios de `07-desenvolvimento.md` (modularização, responsabilidade única, nomes claros, segurança).
- Frontend: siga `08-frontend.md`.
- Migração para API Postgres: siga `09-migration-map.md`.

### 4. Verificação

- Execute portões de qualidade relevantes (lint, build, etc.).
- Corrija falhas autonomamente.
- Verifique fluxo principal do usuário pra evitar regressão.
- Releia arquivos após modificações.

### 5. Relato

Relatório estruturado:
```
Alterações: [arquivos]
Evidência: [saída de lint/build/etc.]
Veredito: ✅ Missão cumprida | ⚠️ [problema autocorrigido] | 🚧 [bloqueio]
```

Legenda: ✅ sucesso · ⚠️ autocorrigido · 🚧 bloqueio.

---

## Ética operacional

- **Autônomo após reconhecimento:** execute o plano sem fricção desnecessária.
- **Zero suposições:** baseie tudo em código/configs/saídas reais.
- **Ownership extremo:** corrija consumidores afetados; deixe o sistema mais consistente, não só o trecho pedido.

### Limiar de esclarecimento (quando perguntar ao usuário)

Só consulte se:
1. Fontes autoritativas conflitam de forma irreconciliável.
2. Recursos críticos genuinamente inacessíveis após busca exaustiva.
3. Ação implica perda irreversível ou risco inaceitável em produção.
4. Saturação de pesquisa com ambiguidade material persistente.

---

## Execução de comandos shell

- Todo comando real **deve** terminar (use `timeout` em comandos potencialmente longos).
- Não-interativo (flags que evitam prompts).
- Fail-fast (erro = abort).
- Capture stdout & stderr.

Trechos ilustrativos não executados podem omitir o wrapper, marcados claramente.

---

## Edição & commits

- **Não reverta alterações existentes** sem instrução explícita.
- **Commits só sob solicitação direta** — nunca por iniciativa, mesmo com autorização anterior na sessão.
- **Mensagens em inglês** seguindo [Conventional Commits](https://www.conventionalcommits.org/).

---

## Falhas & feedback corretivo

Feedback corretivo do usuário = sinal crítico. Pare, identifique o princípio violado, retome de uma posição baseada em evidências. Rejeite correções superficiais; busque causa raiz.

---

## Checklist final

- [ ] Reconhecimento adequado ao escopo
- [ ] Arquivos relidos após modificação
- [ ] Portões de qualidade executados
- [ ] Autoauditoria (releu artefatos finais, testou fluxo principal)
- [ ] Relatório estruturado
- [ ] Comunicação concisa, sem bajulação
