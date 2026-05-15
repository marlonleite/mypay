# Refresh — Debugging & RCA

Protocolo para bugs recorrentes, críticos ou de causa raiz obscura. Estende `~/Code/cursor_rules/core/01-doutrina.mdc`.

**Quando ativar:** tentativas simples já falharam, bug recorrente, ou causa raiz obscura.

**Pré-requisito (informe no prompt):** comportamento observado, esperado, erro, ambiente/fluxo.

---

## Fase 1 — Isolar a anomalia

1. Declare o comportamento correto esperado.
2. Crie um caso de teste mínimo e reproduzível (idealmente script/teste automatizado determinístico).
3. Identifique gatilho exato: condições, entradas, sequência, estado, concorrência.

**Restrição:** nenhuma correção até a falha ser reproduzível sob comando.

---

## Fase 2 — Análise de causa raiz

Ciclo: hipótese testável → experimento seguro de coleta de evidência → conclusão.
Se refutada, formule nova hipótese baseada nas evidências novas; repita.

**Proibido:**
- Aplicar correção sem causa raiz confirmada por evidência.
- Repetir correção falha sem novos dados.
- Corrigir só sintoma (ex.: `null` check sem entender por que está `null`).

---

## Fase 3 — Remediação

Correção mínima e precisa contra a causa raiz confirmada. Padrões herdados da doutrina global:
- Leia antes de escrever; releia depois.
- Ownership sistêmico: se a causa está em componente compartilhado, corrija (ou aponte) todos os consumidores afetados.

---

## Fase 4 — Verificação & guarda de regressão

1. Reexecute o teste da Fase 1 — deve passar agora.
2. Rode os portões de qualidade (testes, linters).
3. Se sua correção quebrar outras coisas, corrija em cascata até estabilizar.

---

## Fase 5 — Autoauditoria de confiança zero

1. Reveja o estado final dos arquivos modificados.
2. Teste explicitamente o fluxo principal do componente corrigido e fluxos diretamente relacionados.
3. Reveja consumidores do trecho corrigido.

---

## Fase 6 — Relatório final

```
Causa raiz: [declaração definitiva + evidência]
Remediação: [arquivos + decisões]
Evidência: [teste que antes falhava agora passa + suíte limpa]
Veredito: ✅ Missão cumprida | 🚧 Bloqueio: [descrição + próximos passos]
```

Legenda: ✅ sucesso · ⚠️ autocorrigido · 🚧 bloqueio.
