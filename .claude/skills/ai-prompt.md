# ai-prompt

Gerencia e otimiza prompts do Gemini AI para processamento de documentos.

## Usage

```bash
/ai-prompt [tipo-documento] [--test] [--optimize]
```

Tipos de documento: invoice, receipt, bank-statement, credit-card

## Description

Auxilia na criação e otimização de prompts para extração de dados de documentos usando Gemini AI.

**Opções:**
- `--test`: Testa um prompt com um documento de exemplo
- `--optimize`: Analisa e otimiza prompt existente

**Gerencia prompts em:**
- `src/services/ai/prompts.js` - Biblioteca de prompts
- `src/services/ai/gemini.js` - Integração com API

**Funcionalidades:**
- Cria novos prompts para tipos de documentos
- Otimiza prompts existentes para melhor extração
- Testa prompts com documentos reais
- Sugere melhorias baseadas em resultados
- Documenta estrutura esperada de resposta

**Padrão de prompt:**
```javascript
export const DOCUMENT_PROMPTS = {
  [tipo]: {
    system: "Contexto e instruções gerais",
    user: "Instruções específicas e formato de saída",
    schema: { /* Estrutura esperada */ }
  }
}
```

## Instructions

1. Se tipo não especificado, mostrar tipos disponíveis
2. Para criar novo prompt:
   - Perguntar tipo de documento
   - Perguntar campos a extrair
   - Criar prompt seguindo padrão
   - Adicionar schema de validação
3. Para otimizar:
   - Ler prompt atual
   - Analisar problemas comuns
   - Sugerir melhorias
   - Testar com exemplos
4. Para testar:
   - Pedir path de documento de exemplo
   - Executar processamento
   - Mostrar resultado
   - Sugerir ajustes se necessário
5. Documentar mudanças em comentários
6. Manter consistência com prompts existentes
