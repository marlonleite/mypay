# Protocolo de Debugging & Análise de Causa Raiz

> Referência: este protocolo estende a **Doutrina Operacional** definida em `01-core.md` e o fluxo de request em `02-request.md`.
> Comunicação: siga sempre o estilo definido em `05-comunicacao.md` (comunicação concisa, modos ask/plan/agent e sem bajulação).

**Quando usar:**
Ative este protocolo apenas quando:
- tentativas anteriores e mais simples de resolver o problema já falharam, ou
- o bug é recorrente, crítico ou de causa raiz obscura.

**Contexto (obrigatório):**
Descreva de forma concisa porém completa o bug ou problema persistente:
- comportamento observado,
- comportamento esperado,
- mensagens de erro relevantes,
- ambiente/fluxo em que ocorre.

---

## Briefing da Missão: Análise de Causa Raiz & Remediação

Os procedimentos padrão estão suspensos. Você iniciará um **protocolo de diagnóstico profundo**.

Sua abordagem deve ser:
- sistemática,
- baseada em evidências,
- implacavelmente focada em identificar e corrigir a **causa raiz absoluta**.

> Corrigir apenas sintomas é considerado **falha crítica**.

---

## Fase 1: Isolar a Anomalia

- **Diretiva:** seu primeiro e mais crítico objetivo é criar um **caso de teste mínimo e reproduzível** que acione o bug de forma confiável e previsível.

- **Ações:**
  1. **Defina a correção esperada:**
     Declare claramente o comportamento correto, sem o bug.
  2. **Crie um teste falho dedicado:**
     Se possível, escreva um novo teste automatizado e específico que falhe **exatamente** por causa deste bug.
     Este teste será o principal sinal de sucesso da remediação.
  3. **Identifique o gatilho:**
     Descubra as condições, entradas ou sequência de eventos exatas que causam a falha (dados, estado, ordem de chamadas, concorrência, etc.).

- **Restrição:**
  Você **não** tentará nenhuma correção até conseguir reproduzir a falha de forma confiável sob comando (idealmente via teste automatizado ou script determinístico).

---

## Fase 2: Análise de Causa Raiz (RCA)

- **Diretiva:** com uma falha reproduzível, investigue metodicamente o caminho de falha para encontrar a **causa raiz definitiva**, não apenas o ponto em que o erro explode.

- **Protocolo de Coleta de Evidências:**
  1. **Formule uma hipótese testável:**
     Declare uma teoria clara e simples sobre a causa
     (ex.: "Hipótese: o token de autenticação do usuário está expirando prematuramente.").
  2. **Elabore um experimento seguro:**
     Projete um teste, instrumento de logging ou observação não destrutiva para coletar evidências que comprovem ou refutem sua hipótese.
  3. **Execute e conclua:**
     Realize o experimento, apresente as evidências e declare sua conclusão:
     - hipótese confirmada → avance para remediação,
     - hipótese refutada → formule uma nova hipótese, baseada nas evidências recém-obtidas, e repita o ciclo.

- **Anti-padrões (ações proibidas):**
  - **PROIBIDO:** aplicar uma correção sem uma causa raiz confirmada e suportada por evidências.
  - **PROIBIDO:** repetir uma correção já falha sem novos dados.
  - **PROIBIDO:** corrigir apenas o sintoma (ex.: adicionar um `null` check) sem entender **por que** o valor está se tornando `null`.

---

## Fase 3: Remediação

- **Diretiva:** projete e implemente uma **correção mínima e precisa** que fortaleça o sistema de forma duradoura contra a causa raiz confirmada.

- **Protocolos centrais em efeito (herdados de `01-core.md` e `02-request.md`):**
  - **Ler-Escrever-Releia:**
    Para cada arquivo que modificar, leia imediatamente antes e imediatamente depois da alteração.
  - **Cânone de execução de comandos:**
    Todos os comandos de shell devem usar o wrapper de segurança obrigatório (timeout, captura de stdout/stderr, execução não interativa, fail-fast).
  - **Ownership sistêmico:**
    Se a causa raiz estiver em um componente compartilhado, você é **OBRIGADO** a:
    - analisar outros consumidores afetados pela mesma falha,
    - corrigir ou, no mínimo, apontar explicitamente onde mais a mesma vulnerabilidade se aplica.

> Prefira uma correção pequena, clara e robusta, a um "big refactor" sem justificativa.

---

## Fase 4: Verificação & Guarda de Regressão

- **Diretiva:** prove, com evidências, que sua correção resolveu o problema **sem criar novos**.

- **Etapas de verificação:**
  1. **Confirme a correção específica:**
     Reexecute o caso de teste (ou script) que falhava na Fase 1.
     Ele **DEVE** passar agora.
  2. **Execute todos os portões de qualidade relevantes:**
     Rode a suíte de testes pertinente (unitários, integração, e2e) e linters para garantir que nenhuma regressão foi introduzida em outros lugares.
  3. **Correção autônoma em cascata:**
     Se sua correção introduzir novas falhas, você irá:
     - diagnosticar as novas falhas,
     - aplicar correções adicionais,
     - repetir a verificação até que o sistema esteja estável dentro do escopo afetado.

---

## Fase 5: Autoauditoria Obrigatória de Confiança Zero

- **Diretiva:** sua remediação está completa, mas seu trabalho **NÃO ACABOU.**
  Agora, conduza uma auditoria cética e de confiança zero da sua própria correção.

- **Protocolo de auditoria:**
  1. **Reverifique o estado final:**
     Com comandos recentes, confirme que:
     - todos os arquivos modificados estão corretos e consistentes,
     - todos os serviços/processos relevantes estão em estado saudável.
  2. **Procure regressões funcionais:**
     Teste explicitamente o fluxo principal do componente que você corrigiu (e fluxos diretamente relacionados) para garantir que a funcionalidade geral permanece intacta.
  3. **Consistência sistêmica:**
     Verifique novamente os consumidores relevantes do trecho corrigido (funções chamadoras, endpoints, filas, jobs, etc.).

---

## Fase 6: Relatório Final & Veredito

- **Diretiva:** conclua sua missão com um **Relatório Pós-Ação** estruturado, claro e conciso.

- **Estrutura mínima do relatório:**
  - **Contexto:** resumo curto do problema original (em uma ou poucas linhas).
  - **Causa raiz:**
    Declaração definitiva do problema subjacente, suportada pela principal evidência da sua RCA.
  - **Remediação aplicada:**
    Lista de todas as alterações relevantes (arquivos e decisões principais).
  - **Evidências de verificação:**
    Provas de que:
    - o bug original foi corrigido (ex.: saída do teste que antes falhava),
    - nenhuma nova regressão visível foi introduzida (ex.: saída da suíte de testes, checks adicionais).
  - **Veredito final:** escolha exatamente uma das declarações abaixo:
    - `Autoauditoria completa. Causa raiz foi endereçada e o estado do sistema está verificado. Nenhuma regressão identificada. Missão cumprida.`
    - `Autoauditoria completa. PROBLEMA CRÍTICO ENCONTRADO durante a auditoria. Trabalho interrompido. [Descreva o problema e recomende etapas imediatas de diagnóstico].`

- **Restrição:**
  Mantenha um registro TODO inline usando os marcadores:
  - `✅` itens concluídos,
  - `⚠️` problemas detectados e corrigidos,
  - `🚧` bloqueios ou pendências.
