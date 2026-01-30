# Commit Semântico

Analise as mudanças staged e crie um commit seguindo Conventional Commits.

## Instruções

1. Execute `git status` e `git diff --staged` para ver as mudanças
2. Analise o contexto das alterações
3. Crie uma mensagem de commit seguindo o padrão:
   - `feat:` nova funcionalidade
   - `fix:` correção de bug
   - `refactor:` refatoração sem mudança de comportamento
   - `test:` adição/modificação de testes
   - `docs:` documentação
   - `chore:` tarefas de manutenção
   - `perf:` melhorias de performance

4. A mensagem deve:
   - Ser em inglês
   - Ter no máximo 72 caracteres no título
   - Explicar o "porquê" no corpo se necessário
   - Incluir Co-Authored-By no final

5. Mostre o commit proposto e peça confirmação antes de executar

## Formato

```
<type>(<scope>): <description>

<body opcional>

Co-Authored-By: Claude <noreply@anthropic.com>
```
