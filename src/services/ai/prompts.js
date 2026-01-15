// Prompt genérico para auto-detecção de documentos
export const PROMPT_GENERIC = `Analise esta imagem de documento financeiro e extraia as informações.

Identifique o tipo de documento e extraia:
{
  "tipo_documento": "comprovante" | "boleto" | "recibo" | "nf" | "pix" | "ted" | "doc" | "fatura_cartao" | "extrato" | "outro",
  "descricao": "nome do estabelecimento, beneficiário ou descrição",
  "valor": 0.00,
  "data": "YYYY-MM-DD",
  "categoria_sugerida": "food" | "transport" | "housing" | "health" | "leisure" | "education" | "other",
  "tipo_transacao": "expense" | "income",
  "confianca": "alta" | "media" | "baixa",
  "dados_adicionais": {}
}

IMPORTANTE:
- O campo "valor" deve ser um número (sem aspas)
- O campo "categoria_sugerida" deve ser um dos IDs: food, transport, housing, health, leisure, education, other
- O campo "tipo_transacao" deve ser "expense" para despesas ou "income" para receitas
- Responda APENAS com JSON válido, sem explicações ou markdown.`

// Prompt para PIX / TED / DOC
export const PROMPT_TRANSFERENCIA = `Analise este comprovante de transferência bancária (PIX, TED ou DOC).

Extraia:
{
  "tipo_documento": "pix" | "ted" | "doc",
  "tipo_transacao": "expense" | "income",
  "valor": 0.00,
  "data": "YYYY-MM-DD",
  "hora": "HH:MM",
  "descricao": "descrição ou identificação da transferência",
  "origem": {
    "nome": "nome do pagador",
    "banco": "nome do banco",
    "chave_pix": "se aplicável"
  },
  "destino": {
    "nome": "nome do beneficiário",
    "banco": "nome do banco",
    "chave_pix": "se aplicável"
  },
  "identificador": "ID da transação / E2E",
  "categoria_sugerida": "other",
  "confianca": "alta" | "media" | "baixa"
}

IMPORTANTE:
- O campo "valor" deve ser um número (sem aspas)
- Se for um pagamento enviado, tipo_transacao = "expense"
- Se for um recebimento, tipo_transacao = "income"
- Responda APENAS com JSON válido, sem explicações ou markdown.`

// Prompt para Fatura de Cartão de Crédito
export const PROMPT_FATURA = `Analise esta fatura de cartão de crédito e extraia TODAS as informações.

{
  "tipo_documento": "fatura_cartao",
  "cartao": {
    "bandeira": "Visa | Mastercard | Elo | Amex | Hipercard | Outro",
    "banco": "nome do banco emissor",
    "final": "últimos 4 dígitos se visível"
  },
  "fatura": {
    "mes_referencia": "YYYY-MM",
    "data_fechamento": "YYYY-MM-DD",
    "data_vencimento": "YYYY-MM-DD",
    "valor_total": 0.00
  },
  "compras": [
    {
      "data": "YYYY-MM-DD",
      "descricao": "nome do estabelecimento",
      "valor": 0.00,
      "parcela": "1/3 ou null se à vista",
      "categoria_sugerida": "food" | "transport" | "housing" | "health" | "leisure" | "education" | "other"
    }
  ],
  "confianca": "alta" | "media" | "baixa"
}

IMPORTANTE:
- Liste TODAS as compras individualmente
- Valores devem ser números (sem aspas)
- categoria_sugerida deve ser um dos IDs: food, transport, housing, health, leisure, education, other
- Responda APENAS com JSON válido.`

// Prompt para Extrato Bancário
export const PROMPT_EXTRATO = `Analise este extrato bancário e extraia TODAS as transações.

{
  "tipo_documento": "extrato",
  "conta": {
    "banco": "nome do banco",
    "agencia": "0000",
    "conta": "00000-0"
  },
  "periodo": {
    "inicio": "YYYY-MM-DD",
    "fim": "YYYY-MM-DD"
  },
  "saldos": {
    "anterior": 0.00,
    "final": 0.00
  },
  "transacoes": [
    {
      "data": "YYYY-MM-DD",
      "descricao": "descrição da transação",
      "valor": 0.00,
      "tipo_transacao": "income" | "expense",
      "categoria_sugerida": "food" | "transport" | "housing" | "health" | "leisure" | "education" | "salary" | "freelance" | "investments" | "other"
    }
  ],
  "confianca": "alta" | "media" | "baixa"
}

IMPORTANTE:
- Liste TODAS as transações
- Valores devem ser números (sem aspas)
- Créditos = income, Débitos = expense
- Responda APENAS com JSON válido.`

// Prompt para Boleto
export const PROMPT_BOLETO = `Analise este boleto bancário e extraia as informações.

{
  "tipo_documento": "boleto",
  "beneficiario": "nome do beneficiário/empresa",
  "pagador": "nome do pagador se visível",
  "valor": 0.00,
  "data_vencimento": "YYYY-MM-DD",
  "data_documento": "YYYY-MM-DD",
  "codigo_barras": "número do código de barras se legível",
  "descricao": "descrição ou referência do boleto",
  "categoria_sugerida": "housing" | "health" | "education" | "other",
  "tipo_transacao": "expense",
  "confianca": "alta" | "media" | "baixa"
}

IMPORTANTE:
- O campo "valor" deve ser um número (sem aspas)
- Responda APENAS com JSON válido.`

// Prompt para Nota Fiscal
export const PROMPT_NF = `Analise esta nota fiscal e extraia as informações.

{
  "tipo_documento": "nf",
  "emitente": "nome da empresa emitente",
  "cnpj_emitente": "CNPJ se visível",
  "valor_total": 0.00,
  "data_emissao": "YYYY-MM-DD",
  "numero_nf": "número da nota",
  "itens": [
    {
      "descricao": "descrição do item",
      "quantidade": 1,
      "valor_unitario": 0.00,
      "valor_total": 0.00
    }
  ],
  "descricao": "descrição resumida da compra",
  "categoria_sugerida": "food" | "transport" | "housing" | "health" | "leisure" | "education" | "other",
  "tipo_transacao": "expense",
  "confianca": "alta" | "media" | "baixa"
}

IMPORTANTE:
- Valores devem ser números (sem aspas)
- Responda APENAS com JSON válido.`

// Prompt para Recibo
export const PROMPT_RECIBO = `Analise este recibo e extraia as informações.

{
  "tipo_documento": "recibo",
  "emitente": "nome de quem emitiu o recibo",
  "valor": 0.00,
  "data": "YYYY-MM-DD",
  "descricao": "descrição do serviço ou produto",
  "categoria_sugerida": "food" | "transport" | "housing" | "health" | "leisure" | "education" | "other",
  "tipo_transacao": "expense",
  "confianca": "alta" | "media" | "baixa"
}

IMPORTANTE:
- O campo "valor" deve ser um número (sem aspas)
- Responda APENAS com JSON válido.`

/**
 * Retorna o prompt apropriado para o tipo de documento
 */
export const getPromptForType = (documentType) => {
  const prompts = {
    auto: PROMPT_GENERIC,
    comprovante: PROMPT_GENERIC,
    boleto: PROMPT_BOLETO,
    pix: PROMPT_TRANSFERENCIA,
    ted: PROMPT_TRANSFERENCIA,
    fatura: PROMPT_FATURA,
    extrato: PROMPT_EXTRATO,
    nf: PROMPT_NF,
    recibo: PROMPT_RECIBO
  }

  return prompts[documentType] || PROMPT_GENERIC
}
