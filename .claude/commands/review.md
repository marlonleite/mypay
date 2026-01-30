# Code Review

Faça uma revisão de código focada em qualidade e boas práticas.

## Instruções

1. Identifique os arquivos a revisar (staged, PR, ou arquivos especificados)
2. Analise cada arquivo considerando:

### Checklist de Revisão

**Correção**
- [ ] A lógica está correta?
- [ ] Casos de borda são tratados?
- [ ] Erros são tratados adequadamente?

**Segurança**
- [ ] Inputs são validados/sanitizados?
- [ ] Sem secrets hardcoded?
- [ ] Sem vulnerabilidades óbvias (SQL injection, etc)?

**Qualidade**
- [ ] Código é legível e autoexplicativo?
- [ ] Nomes são descritivos?
- [ ] Funções têm responsabilidade única?
- [ ] Sem código duplicado?

**Testes**
- [ ] Testes cobrem os cenários principais?
- [ ] Testes são independentes e determinísticos?

**Performance**
- [ ] Algoritmos são eficientes?
- [ ] Sem operações desnecessárias em loops?
- [ ] Queries são otimizadas?

## Output

Apresente o resultado no formato:

```
## Resumo
[1-2 linhas sobre o que o código faz]

## Issues Encontradas
### Críticas (bloqueia merge)
- ...

### Importantes (deveria corrigir)
- ...

### Sugestões (nice to have)
- ...

## Pontos Positivos
- ...
```
