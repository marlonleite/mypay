# Protocolo de Request Padrão

> Comunicação: durante todas as fases, siga estritamente as diretrizes em `05-comunicacao.md` (estilo conciso, modos ask/plan/agent e proibição de bajulação).

---

## Fase 0: Reconhecimento & Modelagem Mental (Somente Leitura)

- **Princípio central:** respeite "entenda antes de tocar", conforme definido em `01-core.md`. Toda ação deve se basear em evidências (código, configs, testes), nunca em suposições.

### Níveis de profundidade

- **Fase 0 Completa (padrão):**
  - Use quando:
    - o escopo for amplo (múltiplos módulos/serviços),
    - houver mudanças arquiteturais, de contrato público ou de infraestrutura,
    - a origem do problema/bug não estiver clara.
  - Ações típicas (alinhadas a `01-core.md`):
    - Inventário do repositório: linguagens, frameworks, ferramentas de build, divisões arquiteturais.
    - Topologia de dependências: análise de manifests e módulos.
    - Corpo de configuração: variáveis de ambiente, pipelines CI/CD, IaC, etc.
    - Padrões idiomáticos: camadas, estilos de código, estratégias de teste.
    - Substrato operacional: containers, processos, serviços em nuvem.
    - Portões de qualidade: testes, linters, scanners, checadores de tipo.
  - **Saída:** digest de reconhecimento mais abrangente (até ~200 linhas), ancorando todas as ações subsequentes.

- **Fase 0 Focalizada (atalho para tarefas pequenas):**
  - Permitida quando:
    - o pedido do usuário for claramente localizado (por exemplo, um arquivo, componente, teste ou função específicos),
    - não houver alteração de infraestrutura nem de contratos amplamente consumidos,
    - não se tratar de bug com causa desconhecida de impacto sistêmico.
  - Ações mínimas:
    - Ler cuidadosamente os arquivos explicitamente mencionados pelo usuário.
    - Identificar e inspecionar consumidores imediatos e testes/configurações diretamente relacionados.
    - Mapear rapidamente dependências locais relevantes.
  - **Saída:** mini-digest conciso descrevendo:
    - contexto do(s) arquivo(s) envolvidos,
    - dependências e consumidores diretos,
    - portões de qualidade aplicáveis,
    - riscos ou incertezas identificados.

---

## Fases Subsequentes

Após o reconhecimento, siga o fluxo mandatório definido em `01-core.md`:

### Fase 1: Planejamento

- Elabore um plano sistêmico considerando impacto total
- Liste todos os arquivos que serão modificados
- Identifique testes que precisam ser criados/atualizados
- Considere consumidores dos componentes alterados

### Fase 2: Execução

- **Leia antes de escrever**
- **Releia imediatamente após escrever**
- Siga os princípios de `07-desenvolvimento.md`
- Aplique padrões de `06-testes.md` para testes

### Fase 3: Verificação

- Execute portões de qualidade (testes, linters, type checkers)
- Corrija falhas autonomamente
- Verifique fluxo principal do usuário

### Fase 4: Relato

- Apresente relatório estruturado com:
  - Alterações aplicadas
  - Evidências de verificação
  - Veredito final

---

## Checklist de Aderência

Antes de declarar qualquer tarefa como completa, verifique:

- [ ] Reconhecimento realizado (completo ou focalizado)?
- [ ] Digest de reconhecimento documentado (no chat)?
- [ ] Arquivos relidos imediatamente após modificação?
- [ ] Portões de qualidade executados?
- [ ] Autoauditoria de confiança zero concluída?
- [ ] Relatório final estruturado fornecido?
- [ ] Comunicação concisa sem bajulação?
