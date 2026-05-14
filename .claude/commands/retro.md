# Retro — Evolução da doutrina

Destila aprendizados da sessão em princípios duráveis e integra à doutrina.

---

## Fase 1 — Destilar lições

Filtre só o que passa nos três critérios:
- **Universal:** aplica-se a tarefas futuras, não é correção pontual.
- **Abstrato:** princípio geral, não detalhe específico desta sessão.
- **Alto impacto:** previne falha crítica, reforça segurança, ou melhora eficiência/clareza/manutenibilidade.

Se não passar: registre na conversa, **não** promova a regra.

---

## Fase 2 — Integrar

**Onde:**
- Específico do projeto → `.claude/rules/*.md`
- Universal e atemporal → `~/.cursor/rules/` (global) ou regras globais Claude

**Como:**
1. Leia o arquivo-alvo para entender tom e estrutura.
2. Encontre a seção lógica.
3. **Refine antes de adicionar**: se já existe regra similar, melhore-a; evite duplicar.
4. Mantenha consistência de tom e formato.

**Evite:** promover detalhes muito específicos (nomes de arquivos, bugs únicos) — foque em padrões reaplicáveis.

---

## Fase 3 — Relatório

```
Doutrina atualizada:
- [arquivo]: [diff textual conciso — nova regra / refinamento / remoção]
(ou) ℹ️ Nenhuma lição durável destilada.

Aprendizados da sessão:
- [bullet]: integrado a [arquivo] / só nota local
```
