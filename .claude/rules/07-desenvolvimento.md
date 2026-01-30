# Guia de Desenvolvimento: Princípios para Código Escalável, Seguro e Manutenível

**Integração com Framework:** Estes princípios devem ser aplicados durante todas as fases do fluxo operacional (Reconhecimento → Planejamento → Execução → Verificação), com ênfase especial na **Fase 2: Execução & Implementação** da doutrina operacional.

## Modularização
- Quando uma função começar a ficar complexa ou possuir múltiplas responsabilidades, divida-a em funções menores, cada uma com responsabilidade única.
- Quando um arquivo crescer demais ou acumular muitos contextos, recomende dividi-lo em múltiplos arquivos ou módulos.
- **Aplicação:** Durante a execução, identifique pontos de complexidade e proponha refatoração imediata.

## Responsabilidade Única
- Garanta que funções, classes e módulos possuam responsabilidades bem definidas e delimitadas.
- Evite misturar lógica de diferentes contextos na mesma unidade de código.
- **Aplicação:** Antes de modificar qualquer componente, verifique se sua responsabilidade está bem definida.

## Nomeação Clara
- Use nomes explícitos e descritivos para funções, variáveis e classes.
- Evite abreviações ou nomes genéricos; prefira termos que comuniquem a intenção do código.
- **Aplicação:** Revise todos os nomes durante a fase de verificação e correção autônoma.

## Segurança
- Sempre valide e sanitize entradas, especialmente dados provenientes de fontes externas.
- Nunca confie cegamente em entradas do usuário ou sistemas terceiros.
- Oriente a escrita de código com foco na prevenção de vulnerabilidades comuns (injeção, vazamento de dados, etc.).
- **Aplicação:** Durante o reconhecimento, identifique pontos de entrada de dados e implemente validações adequadas.

## Escalabilidade
- Escreva código com foco na possibilidade de crescimento do sistema.
- Evite soluções acopladas ou dependentes de casos específicos.
- Prefira abordagens que permitam extensão, manutenção e evolução com o mínimo de impacto.
- **Aplicação:** No planejamento, considere o impacto sistêmico e projete para crescimento futuro.

## Testabilidade
- Escreva código que seja naturalmente testável.
- Sempre proponha a criação de testes automatizados para funções e fluxos importantes.
- Priorize interfaces claras e isoladas para facilitar a verificação de comportamento.
- **Aplicação:** Integre com as diretrizes de testes (`06-testes.md`) durante a fase de verificação.

## Documentação
- Documente o propósito e o funcionamento das funções públicas.
- Quando a lógica for complexa ou conter decisões importantes, explique o motivo das escolhas feitas.
- Prefira código autoexplicativo, mas não hesite em adicionar comentários quando necessário.
- **Aplicação:** Documente decisões arquiteturais durante o planejamento e implementação.

## Tratamento de Erros
- Nunca ignore ou oculte erros silenciosamente.
- Proponha tratamento adequado para exceções, com mensagens claras e ações seguras.
- Para operações críticas, sugira mecanismos de resiliência, como retries e timeouts.
- **Aplicação:** Implemente tratamento robusto durante a execução, especialmente para operações críticas.

## Logs e Monitoramento
- Oriente a inclusão de logs informativos em pontos críticos do código.
- Garanta que logs sejam úteis para diagnóstico, mas nunca exponham informações sensíveis.
- Prefira logs estruturados e consistentes.
- **Aplicação:** Adicione logging estratégico durante pontos críticos identificados no reconhecimento.

## Reutilização e Evite Repetição
- Sempre que identificar padrões ou trechos repetidos, proponha abstrações.
- Busque maximizar a reutilização de código e minimizar duplicações desnecessárias.
- **Aplicação:** Durante a execução, identifique oportunidades de abstração e refatoração.

## Performance
- Escreva código eficiente, escolhendo algoritmos e estruturas de dados adequados ao contexto.
- Evite otimizações prematuras, mas esteja atento a possíveis gargalos.
- **Aplicação:** Considere implicações de performance durante o planejamento e execução.

## Dependências
- Avalie criticamente a introdução de novas dependências.
- Priorize soluções nativas ou amplamente utilizadas, com manutenção ativa e comunidade robusta.
- Evite dependências desnecessárias que aumentem o acoplamento ou riscos de segurança.
- **Aplicação:** Analise dependências durante o reconhecimento e planejamento.

## Estilo e Padrões
- Respeite os padrões de estilo adotados pelo projeto e pela linguagem.
- Oriente o uso de ferramentas automáticas de lint, formatação e análise estática.
- Prefira um código limpo, simples e legível a soluções excessivamente complexas.
- **Aplicação:** Aplique consistentemente durante toda a execução.

## Revisão Contínua
- Sempre revise o código sugerido, buscando clareza, simplicidade e robustez.
- Adote uma mentalidade crítica, focada na qualidade e na manutenção a longo prazo.
- **Aplicação:** Integre com a fase de autoauditoria obrigatória de confiança zero.

## Mentalidade
- Pondere sempre: "Esse código será compreendido, mantido e estendido com segurança no futuro?"
- Priorize soluções que favoreçam manutenibilidade, segurança e clareza.
- Considere sempre as implicações de segurança, performance e escalabilidade em cada decisão.
- **Aplicação:** Mantenha esta mentalidade durante todas as fases operacionais.

---

> **DIRETIVA FINAL:** Código é uma forma de comunicação. Escreva para humanos, não apenas para máquinas. Cada linha deve ter um propósito claro e contribuir para a legibilidade e manutenibilidade do sistema. Integre estes princípios com rigor na fase de execução e verificação da doutrina operacional.
