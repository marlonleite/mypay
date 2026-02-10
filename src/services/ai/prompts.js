// Categorias fixas originais (fallback quando o usuário não tem categorias)
const DEFAULT_EXPENSE_CATEGORIES = 'food, transport, housing, health, leisure, education, other'
const DEFAULT_ALL_CATEGORIES = 'food, transport, housing, health, leisure, education, salary, freelance, investments, other'
const DEFAULT_BOLETO_CATEGORIES = 'housing, health, education, other'

/**
 * Formata categorias do usuário para injeção no prompt.
 * Se categories estiver vazio/null, retorna null (usar fallback).
 */
function formatCategoriesForPrompt(categories) {
  if (!categories?.length) return null

  return categories
    .map(c => `- "${c.id}": ${c.name}`)
    .join('\n')
}

/**
 * Gera o bloco de categorias para o prompt.
 * Se houver categorias do usuário, instrui a IA a usar o ID exato.
 * Senão, usa as categorias fixas originais como fallback.
 */
function buildCategoryBlock(categories, fallbackList) {
  const formatted = formatCategoriesForPrompt(categories)

  if (formatted) {
    return `CATEGORIAS (use o ID exato do campo entre aspas):
${formatted}`
  }

  return `CATEGORIAS (escolha a mais adequada):
${fallbackList}`
}

// Prompt genérico para auto-detecção de documentos
export function buildGenericPrompt(categories) {
  const catBlock = buildCategoryBlock(categories, DEFAULT_ALL_CATEGORIES)
  const hasUserCategories = categories?.length > 0

  return `Analise esta imagem de documento financeiro e extraia as informações.

Identifique o tipo de documento e extraia:
{
  "tipo_documento": "comprovante" | "boleto" | "recibo" | "nf" | "pix" | "ted" | "doc" | "fatura_cartao" | "extrato" | "outro",
  "descricao": "nome do estabelecimento, beneficiário ou descrição",
  "valor": 0.00,
  "data": "YYYY-MM-DD",
  "categoria_sugerida": "${hasUserCategories ? 'ID da categoria' : 'food | transport | housing | health | leisure | education | other'}",
  "tipo_transacao": "expense" | "income",
  "confianca": "alta" | "media" | "baixa",
  "dados_adicionais": {}
}

${catBlock}

IMPORTANTE:
- O campo "valor" deve ser um número (sem aspas)
- O campo "categoria_sugerida" deve ser ${hasUserCategories ? 'um dos IDs listados acima' : 'um dos IDs: food, transport, housing, health, leisure, education, other'}
- O campo "tipo_transacao" deve ser "expense" para despesas ou "income" para receitas
- Responda APENAS com JSON válido, sem explicações ou markdown.`
}

// Prompt para PIX / TED / DOC (sem categorias do usuário — usa "other" fixo)
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

// Prompt para Fatura de Cartão de Crédito (extração batch)
export function buildFaturaPrompt(categories) {
  const catBlock = buildCategoryBlock(categories, DEFAULT_EXPENSE_CATEGORIES)
  const hasUserCategories = categories?.length > 0

  return `Analise esta fatura de cartão de crédito brasileiro e extraia TODAS as compras de TODAS as páginas.

ATENÇÃO - COMPLETUDE (CRÍTICO):
- Extraia transações de TODAS as páginas do documento, não apenas da primeira ou segunda.
- A fatura pode ter MÚLTIPLOS CARTÕES (titular + adicional). Cada seção começa com nome do titular e número do cartão. Extraia compras de TODOS os cartões.
- Após o subtotal de um cartão ("Total para..."), pode haver outro cartão com mais transações. NÃO pare no primeiro subtotal.
- IMPORTANTE: Após linhas de "Encargos sobre parcelado" e IOFs de parcelamento, a tabela de transações CONTINUA. NÃO pare nessa seção.
- IMPORTANTE: Compras parceladas têm datas ANTERIORES ao período da fatura (ex: "19/12 DELL 11/12" numa fatura de outubro). São parcelas de compras antigas que devem ser INCLUÍDAS.
- Ignore informações nas laterais da página (limites, taxas mensais, programa de fidelidade, total parcelados para próximas faturas).

REGRAS DE EXTRAÇÃO:

INCLUIR (são compras — extraia TODAS):
- Compras nacionais e internacionais em estabelecimentos
- IOF de transações internacionais (ex: "CUSTO TRANS. EXTERIOR-IOF", "IOF Transações Exterior", "IOF S/ TRANS INTER REAIS")
- Assinaturas e serviços recorrentes (Netflix, Spotify, Google, etc.)
- Compras parceladas, mesmo com datas de meses anteriores (ex: "19/12 DELL 11/12" = parcela 11 de 12 da compra original de 19/12)

IGNORAR (NÃO são compras):
- Linhas de pagamento: "PAGTO.", "Pagamento Fatura", "PAGAMENTO", "PAGTO. POR DEB EM C/C"
- Saldo anterior, créditos, estornos
- Encargos sobre parcelado, IOF diário sobre parcelado, IOF adicional sobre parcelado
- Juros, multas, encargos de financiamento, CET, IOF de financiamento (IOF que NÃO seja de transação internacional)
- Linhas de subtotal: "Total para...", "Subtotal deste cartão", "Total da fatura em real"
- Cabeçalhos de cartão com nome do titular e número do cartão
- Informações de limite, taxas, parcelamento de fatura, programa de fidelidade
- Linhas de data isolada após encargos (ex: "03/06" sozinha numa linha)

TRATAMENTO ESPECIAL:
- Compras internacionais: use o valor em R$ (já convertido), não o valor em USD/EUR
- Parcelas: o número após a descrição é a parcela (ex: "AMAZON BR 09/10" = parcela 9 de 10). Inclua na descrição.
- Data: use a data que aparece na coluna "Data" da tabela, normalize para DD/MM

${catBlock}

Retorne APENAS este JSON, sem markdown nem texto adicional:
{
  "mes_referencia": 4,
  "ano_referencia": 2025,
  "valor_total_fatura": 0.00,
  "soma_lancamentos": 0.00,
  "diferenca": 0.00,
  "transacoes": [
    {"data": "DD/MM", "descricao": "texto", "valor": 0.00, "categoria": "${hasUserCategories ? 'ID da categoria' : 'other'}"}
  ]
}

REGRAS DE PERÍODO:
- mes_referencia: mês de VENCIMENTO da fatura (1-12), extraído do campo "Data de Vencimento" (ex: vencimento 10/04/2025 → mes_referencia = 4)
- ano_referencia: ano de VENCIMENTO da fatura (ex: 2025)

REGRAS DO JSON:
- Valores numéricos (sem aspas, sem "R$")
- soma_lancamentos = soma de todos os valores em transacoes
- diferenca = valor_total_fatura - soma_lancamentos
- NÃO duplique: cada lançamento aparece UMA única vez
- Apenas JSON puro, sem comentários`
}

// Prompt para Extrato Bancário
export function buildExtratoPrompt(categories) {
  const catBlock = buildCategoryBlock(categories, DEFAULT_ALL_CATEGORIES)
  const hasUserCategories = categories?.length > 0

  return `Analise este extrato bancário e extraia TODAS as transações.

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
      "categoria_sugerida": "${hasUserCategories ? 'ID da categoria' : 'food | transport | housing | health | leisure | education | salary | freelance | investments | other'}"
    }
  ],
  "confianca": "alta" | "media" | "baixa"
}

${catBlock}

IMPORTANTE:
- Liste TODAS as transações
- Valores devem ser números (sem aspas)
- Créditos = income, Débitos = expense
- Responda APENAS com JSON válido.`
}

// Prompt para Boleto
export function buildBoletoPrompt(categories) {
  const catBlock = buildCategoryBlock(categories, DEFAULT_BOLETO_CATEGORIES)
  const hasUserCategories = categories?.length > 0

  return `Analise este boleto bancário e extraia as informações.

{
  "tipo_documento": "boleto",
  "beneficiario": "nome do beneficiário/empresa",
  "pagador": "nome do pagador se visível",
  "valor": 0.00,
  "data_vencimento": "YYYY-MM-DD",
  "data_documento": "YYYY-MM-DD",
  "codigo_barras": "número do código de barras se legível",
  "descricao": "descrição ou referência do boleto",
  "categoria_sugerida": "${hasUserCategories ? 'ID da categoria' : 'housing | health | education | other'}",
  "tipo_transacao": "expense",
  "confianca": "alta" | "media" | "baixa"
}

${catBlock}

IMPORTANTE:
- O campo "valor" deve ser um número (sem aspas)
- Responda APENAS com JSON válido.`
}

// Prompt para Nota Fiscal
export function buildNfPrompt(categories) {
  const catBlock = buildCategoryBlock(categories, DEFAULT_EXPENSE_CATEGORIES)
  const hasUserCategories = categories?.length > 0

  return `Analise esta nota fiscal e extraia as informações.

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
  "categoria_sugerida": "${hasUserCategories ? 'ID da categoria' : 'food | transport | housing | health | leisure | education | other'}",
  "tipo_transacao": "expense",
  "confianca": "alta" | "media" | "baixa"
}

${catBlock}

IMPORTANTE:
- Valores devem ser números (sem aspas)
- Responda APENAS com JSON válido.`
}

// Prompt para Recibo
export function buildReciboPrompt(categories) {
  const catBlock = buildCategoryBlock(categories, DEFAULT_EXPENSE_CATEGORIES)
  const hasUserCategories = categories?.length > 0

  return `Analise este recibo e extraia as informações.

{
  "tipo_documento": "recibo",
  "emitente": "nome de quem emitiu o recibo",
  "valor": 0.00,
  "data": "YYYY-MM-DD",
  "descricao": "descrição do serviço ou produto",
  "categoria_sugerida": "${hasUserCategories ? 'ID da categoria' : 'food | transport | housing | health | leisure | education | other'}",
  "tipo_transacao": "expense",
  "confianca": "alta" | "media" | "baixa"
}

${catBlock}

IMPORTANTE:
- O campo "valor" deve ser um número (sem aspas)
- Responda APENAS com JSON válido.`
}

/**
 * Retorna o prompt apropriado para o tipo de documento
 */
export const getPromptForType = (documentType, categories) => {
  const prompts = {
    auto: buildGenericPrompt(categories),
    comprovante: buildGenericPrompt(categories),
    boleto: buildBoletoPrompt(categories),
    pix: PROMPT_TRANSFERENCIA,
    ted: PROMPT_TRANSFERENCIA,
    fatura: buildFaturaPrompt(categories),
    extrato: buildExtratoPrompt(categories),
    nf: buildNfPrompt(categories),
    recibo: buildReciboPrompt(categories)
  }

  return prompts[documentType] || buildGenericPrompt(categories)
}
