# firebase

Auxilia com operações e configurações do Firebase.

## Usage

```bash
/firebase [comando]
```

Comandos: rules, indexes, collections, security, debug

## Description

Ajuda a gerenciar e debugar questões relacionadas ao Firebase/Firestore.

**Comandos disponíveis:**

**rules:**
- Revisa e atualiza firestore.rules
- Verifica segurança (todos os paths protegidos por auth)
- Sugere melhorias
- Valida sintaxe

**indexes:**
- Revisa firestore.indexes.json
- Sugere novos indexes baseado em queries do código
- Verifica se queries complexas precisam de indexes

**collections:**
- Lista todas as coleções usadas no app
- Verifica estrutura de dados
- Mostra path completo: users/{userId}/[coleção]
- Documenta campos de cada coleção

**security:**
- Audit de segurança completo
- Verifica se todas as queries usam user.uid
- Confirma que rules bloqueiam acessos não autorizados
- Testa cenários de segurança

**debug:**
- Ajuda a debugar problemas comuns:
  - "Permission denied" errors
  - Queries não retornando dados
  - Real-time listeners não atualizando
  - Problemas com indexes
- Verifica configuração do Firebase no projeto
- Testa conexão com Firestore

## Instructions

1. Se comando não especificado, perguntar qual
2. Para `rules`:
   - Ler firestore.rules
   - Verificar todos os paths
   - Garantir que todos têm check de auth
   - Sugerir melhorias se necessário
3. Para `indexes`:
   - Ler firestore.indexes.json
   - Analisar queries no código (src/hooks/useFirestore.js)
   - Sugerir indexes para queries com orderBy + where
4. Para `collections`:
   - Listar todas as coleções
   - Documentar estrutura de cada uma
   - Mostrar exemplo de documento
5. Para `security`:
   - Fazer audit completo
   - Criar checklist de segurança
   - Testar cenários de ataque comuns
6. Para `debug`:
   - Perguntar qual é o problema específico
   - Analisar código relevante
   - Verificar console errors
   - Sugerir soluções
