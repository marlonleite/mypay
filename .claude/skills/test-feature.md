# test-feature

Testa funcionalidades do app myPay no ambiente de desenvolvimento.

## Usage

```bash
/test-feature [funcionalidade]
```

Funcionalidades disponíveis: auth, transactions, cards, categories, documents, accounts

## Description

Executa testes manuais e verificações para garantir que funcionalidades específicas estão funcionando corretamente.

**Para cada funcionalidade, verifica:**

**auth:**
- Firebase config está correto
- Login com Google funciona
- Logout funciona
- AuthContext está provendo user corretamente
- ProtectedRoute está bloqueando rotas

**transactions:**
- CRUD de transações
- Recorrência funciona
- Filtros por mês/ano
- Cálculo de totais (receitas/despesas)
- Integração com categorias e contas

**cards:**
- CRUD de cartões
- Despesas de cartão com parcelamento
- Cálculo de faturas
- Dia de fechamento e vencimento

**categories:**
- CRUD de categorias
- Subcategorias funcionam
- Soft delete (archive) funciona
- Integração com transações

**documents:**
- Upload para S3/MinIO
- Processamento com Gemini AI
- Extração de dados
- Criação de transações a partir de documentos

**accounts:**
- CRUD de contas
- Saldos calculados corretamente
- Integração com transações

## Instructions

1. Se funcionalidade não especificada, mostrar lista e perguntar
2. Iniciar servidor dev se não estiver rodando
3. Verificar arquivos relevantes para a funcionalidade
4. Listar checklist de testes manuais
5. Verificar erros comuns:
   - Console do navegador
   - Network requests falhando
   - Firebase rules bloqueando operações
   - Variáveis de ambiente faltando
6. Sugerir correções se encontrar problemas
7. Criar um guia passo-a-passo para testar manualmente
