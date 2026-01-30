# Protocolo de Retrospectiva & Evolução da Doutrina

> Referência: este protocolo consome aprendizados gerados pelos fluxos padrão (`01-core.md`, `02-request.md`) e pelo protocolo de debugging profundo (`03-refresh.md`), integrando-os de volta na doutrina global e nas regras específicas de projeto.
> Comunicação: siga o estilo definido em `05-comunicacao.md`.

---

## Fase 1: Destilação & Abstração de Lições

- **Diretiva:** a partir da sessão concluída (implementação, debugging ou investigação), filtre e abstraia **apenas** os aprendizados mais valiosos em **princípios duráveis e universais.** Seja implacável na filtragem.

- **Filtro de qualidade (uma lição só é durável se for):**
  - ✅ **Universal & Reutilizável:**
    Aplica-se a muitas tarefas futuras em diferentes projetos, ou foi apenas uma correção pontual e específica deste caso?
  - ✅ **Abstrata:**
    É um princípio geral (ex.: "sempre verifique se uma variável de ambiente existe antes de usar"), ou depende de detalhes muito específicos desta sessão?
  - ✅ **Alto impacto:**
    Previne uma falha crítica, reforça um padrão de segurança essencial ou melhora significativamente eficiência, clareza ou manutenibilidade?

- **Categorização do destino da lição:**
  - **Doutrina Global:**
    Princípios de engenharia atemporais, aplicáveis a **qualquer** projeto (por exemplo, novas regras para `01-core.md`, `05-comunicacao.md`, `07-desenvolvimento.md`, `06-testes.md`, `08-frontend.md`).
  - **Doutrina do Projeto:**
    Boas práticas específicas da tecnologia, arquitetura ou fluxo de trabalho deste projeto (por exemplo, arquivos em `.claude/rules/` dentro do repositório atual).

> Se a lição não passar em todos os critérios de qualidade acima, registre-a apenas no relatório da sessão, mas **não** a promova para doutrina.

---

## Fase 2: Integração à Doutrina

- **Diretiva:** integre as lições destiladas no arquivo de doutrina **mais adequado**, refinando regras existentes sempre que possível.

### Protocolo de Descoberta de Regras

1. **Priorize regras do projeto:**
   Primeiro, procure arquivos de regras dentro do diretório de trabalho do projeto atual (por exemplo: `CLAUDE.md`, `.claude/rules/*.md`).
   Estes são os principais alvos para aprendizados específicos daquele código/stack.

2. **Recurso à Doutrina Global:**
   Se não existirem regras no projeto, ou se a lição for realmente universal:
   - use os arquivos de doutrina global (por exemplo: `01-core.md`, `05-comunicacao.md`, `07-desenvolvimento.md`, `06-testes.md`, `08-frontend.md`),
   - escolha o arquivo/seção mais alinhado com a natureza da lição (operacional, comunicação, desenvolvimento, testes, frontend, etc.).

### Protocolo de Integração

1. **Leia o arquivo-alvo:**
   Entenda a estrutura, o tom e a granularidade das regras já existentes.

2. **Encontre a seção mais lógica:**
   Localize a seção em que a nova lição se encaixa naturalmente (por exemplo: Fase 0, comunicação, testes, segurança, arquitetura, etc.).

3. **Refine, não apenas acrescente:**
   - Se já existir uma regra similar:
     - **melhore-a** incorporando o novo insight,
     - evite duplicar o mesmo princípio em vários lugares.
   - Se não houver nada equivalente:
     - **adicione uma nova regra**, garantindo:
       - compatibilidade de formato (títulos, bullets, estilo),
       - consistência de tom com o restante da doutrina,
       - clareza sobre quando e como aplicar o novo princípio.

4. **Evite ruído:**
   Não promova detalhes excessivamente específicos (como nomes de arquivos ou bugs únicos) para a doutrina; mantenha o foco em padrões reaplicáveis.

---

## Fase 3: Relatório Final da Retrospectiva

- **Diretiva:** conclua a retrospectiva apresentando um relatório claro e estruturado, mostrando **como** a doutrina evoluiu (ou por que não precisou evoluir).

- **Estrutura do relatório:**

1. **Resumo da atualização da doutrina:**
   - Indique qual(is) arquivo(s) de doutrina foram atualizados, por exemplo:
     - `Doutrina Global: 01-core.md / 05-comunicacao.md / 07-desenvolvimento.md / ...`
     - `Doutrina do Projeto: .claude/rules/...`
   - Forneça um resumo dos **diffs** das mudanças realizadas (nível textual, não necessariamente o patch completo), destacando:
     - novas regras adicionadas,
     - regras existentes refinadas,
     - seções removidas ou simplificadas.
   - Se nenhuma atualização foi feita, declare explicitamente:
     `ℹ️ Nenhuma lição durável foi destilada que justificasse alteração na doutrina.`

2. **Aprendizados da sessão:**
   - Liste, de forma concisa e pontuada, os principais padrões identificados nas fases anteriores (por exemplo, da execução normal em `02-request.md` ou da RCA em `03-refresh.md`).
   - Para cada aprendizado, indique:
     - se ele foi integrado à Doutrina Global,
     - se foi integrado apenas à Doutrina do Projeto,
     - ou se foi registrado apenas como nota local (sem promoção a regra).

---

> **LEMBRETE:** Este protocolo é o motor da sua evolução.
> Use-o para transformar bugs dolorosos e sessões complexas em vantagens futuras, consolidando lições em regras claras, coesas e reaplicáveis.

**Inicie sua retrospectiva agora.**
