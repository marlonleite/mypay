# migration

Cria e executa migrações de dados do Firestore.

## Usage

```bash
/migration [nome-da-migracao] [--dry-run] [--execute]
```

## Description

Auxilia na criação e execução de migrações de dados no Firestore, seguindo o padrão estabelecido no projeto.

**Opções:**
- `--dry-run`: Simula migração e mostra o que seria feito
- `--execute`: Executa a migração de verdade

**Tipos comuns de migração:**
- Adicionar novos campos a documentos existentes
- Renomear campos
- Transformar estrutura de dados
- Mover dados entre coleções
- Limpar dados antigos/inválidos
- Normalizar formatos (datas, valores, etc)

**Exemplo de migração:**
Ver `scripts/migrate-categories.js` como referência

**Script de migração inclui:**
- Conexão com Firestore usando service account
- Função de migração por documento
- Contador de progresso
- Tratamento de erros
- Rollback em caso de falha
- Log detalhado de operações

## Instructions

1. Perguntar nome e propósito da migração
2. Criar script em `scripts/migrate-[nome].js`
3. Implementar:
   - Setup do Firebase Admin SDK
   - Função de migração
   - Dry-run mode
   - Progress tracking
   - Error handling
4. Se `--dry-run`:
   - Simular mudanças
   - Mostrar quantos docs seriam afetados
   - Mostrar exemplos de before/after
5. Se `--execute`:
   - Confirmar com usuário
   - Executar migração
   - Mostrar progresso
   - Log de resultados
6. Documentar migração no README ou em comentários
7. Sugerir backup antes de executar
