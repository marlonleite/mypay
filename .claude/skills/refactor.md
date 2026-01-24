# refactor

Auxilia em refatorações comuns do código myPay.

## Usage

```bash
/refactor [tipo]
```

Tipos: extract-component, optimize-hook, split-file, remove-duplication, improve-performance

## Description

Realiza refatorações seguindo as melhores práticas do projeto.

**Tipos de refatoração:**

**extract-component:**
- Identifica código que pode virar componente reutilizável
- Extrai para src/components/ui/ ou src/components/
- Atualiza imports e uso
- Mantém props tipadas

**optimize-hook:**
- Revisa custom hooks
- Adiciona useMemo/useCallback onde apropriado
- Otimiza re-renders
- Melhora cleanup de listeners
- Verifica dependências de useEffect

**split-file:**
- Identifica arquivos muito grandes (>300 linhas)
- Sugere como dividir
- Mantém coesão
- Separa responsabilidades

**remove-duplication:**
- Encontra código duplicado
- Extrai para funções/componentes reutilizáveis
- Cria utils se necessário

**improve-performance:**
- Analisa componentes com muitos re-renders
- Adiciona React.memo onde apropriado
- Otimiza queries do Firestore
- Verifica keys em listas
- Lazy loading de componentes

## Instructions

1. Se tipo não especificado, perguntar qual
2. Analisar código relevante
3. Identificar oportunidades de melhoria
4. Propor refatoração com before/after
5. Perguntar confirmação antes de aplicar
6. Executar refatoração mantendo funcionalidade
7. Verificar que nada quebrou
8. Sugerir testes manuais se necessário
