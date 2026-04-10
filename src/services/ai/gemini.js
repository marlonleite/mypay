import { getPromptForType } from './prompts'

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models'
const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
]

function getApiKeys() {
  const keys = [
    import.meta.env.VITE_GOOGLE_AI_KEY
  ].filter(Boolean)

  if (keys.length === 0) {
    throw new Error('API key do Google AI não configurada. Adicione VITE_GOOGLE_AI_KEY no arquivo .env')
  }

  return keys
}

function isRetryableError(status, errorMessage) {
  if (status === 429 || status === 503) return true
  if (!errorMessage) return false
  const msg = errorMessage.toLowerCase()
  return msg.includes('high demand') || msg.includes('overloaded') || msg.includes('quota exceeded')
}

async function callGemini(apiKey, parts, model) {
  const url = `${GEMINI_BASE_URL}/${model}:generateContent`
  const generationConfig = {
    temperature: 0.1,
    topK: 32,
    topP: 1,
    maxOutputTokens: 65536,
    responseMimeType: 'application/json',
  }

  // thinkingConfig só é suportado em modelos 2.5+
  if (model.includes('2.5')) {
    generationConfig.thinkingConfig = { thinkingBudget: 0 }
  }

  const response = await fetch(`${url}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig
    })
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    const errorMessage = errorData.error?.message || `Erro na API: ${response.status}`

    console.error('Gemini API Error:', response.status, errorData)

    if (response.status === 401 || response.status === 403) {
      throw new Error(`API key inválida. ${errorMessage}`)
    }

    const error = new Error(errorMessage)
    error.status = response.status
    error.isRetryable = isRetryableError(response.status, errorMessage)
    throw error
  }

  return response.json()
}

const MAX_RETRIES = 2
const RETRY_DELAY_MS = 15000

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Tenta todas as combinações de modelo + key.
 * Retorna o resultado ou lança erro (com flag isRetryable se aplicável).
 */
async function tryAllCombinations(apiKeys, parts) {
  let lastError = null

  for (const model of GEMINI_MODELS) {
    for (const apiKey of apiKeys) {
      try {
        const data = await callGemini(apiKey, parts, model)
        return parseGeminiResponse(data)
      } catch (error) {
        lastError = error

        if (error.isRetryable) {
          console.warn(`Gemini: ${model} indisponível, tentando alternativa...`)
          continue
        }

        if (error.name === 'TypeError' && error.message.includes('fetch')) {
          throw new Error('Erro de conexão. Verifique sua internet.')
        }

        throw error
      }
    }
  }

  const retryableError = new Error(lastError.message)
  retryableError.isRetryable = true
  throw retryableError
}

/**
 * Processa um documento usando a API do Google Gemini.
 * Tenta todas as combinações de modelo + key, com retry automático.
 */
export async function processDocument(base64, mimeType, documentType = 'auto', categories = null, pdfText = null) {
  const apiKeys = getApiKeys()

  const prompt = getPromptForType(documentType, categories)

  const parts = pdfText
    ? [{ text: prompt + '\n\n--- TEXTO EXTRAÍDO DO DOCUMENTO ---\n' + pdfText }]
    : [
        { inline_data: { mime_type: mimeType, data: base64 } },
        { text: prompt }
      ]

  let lastError = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      console.warn(`Gemini: retry ${attempt}/${MAX_RETRIES} após ${RETRY_DELAY_MS / 1000}s...`)
      await wait(RETRY_DELAY_MS)
    }

    try {
      return await tryAllCombinations(apiKeys, parts)
    } catch (error) {
      lastError = error

      if (!error.isRetryable || attempt === MAX_RETRIES) {
        throw error
      }
    }
  }

  throw lastError
}

/**
 * Parseia a resposta do Gemini e extrai o JSON
 */
function parseGeminiResponse(response) {
  const candidate = response.candidates?.[0]

  // Verifica bloqueio por safety filters
  if (!candidate) {
    const blockReason = response.promptFeedback?.blockReason
    console.error('Gemini: sem candidatos. blockReason:', blockReason)
    throw new Error(
      blockReason
        ? `Documento bloqueado pelo filtro de segurança (${blockReason}).`
        : 'Resposta vazia da IA. Tente novamente.'
    )
  }

  // Verifica truncamento por tokens
  const finishReason = candidate.finishReason
  if (finishReason === 'MAX_TOKENS') {
    console.warn('Gemini: resposta truncada (MAX_TOKENS)')
  }

  // Pula thinking parts (thought: true) e pega a parte com o JSON real
  const parts = candidate.content?.parts || []
  const responsePart = parts.find(p => !p.thought) || parts[0]
  const text = responsePart?.text

  if (!text) {
    console.error('Gemini: resposta sem texto. finishReason:', finishReason)
    throw new Error(
      finishReason === 'SAFETY'
        ? 'Documento bloqueado pelo filtro de segurança.'
        : 'Resposta vazia da IA. Tente novamente.'
    )
  }

  try {
    const parsed = JSON.parse(extractJson(text))
    return normalizeExtractedData(parsed)
  } catch (error) {
    console.error('Erro ao parsear resposta:', error)
    console.error('Texto bruto (primeiros 500 chars):', text.slice(0, 500))

    if (finishReason === 'MAX_TOKENS') {
      throw new Error('Fatura muito grande: resposta da IA foi truncada. Tente com uma fatura menor.')
    }
    throw new Error('Não foi possível extrair dados do documento. Tente novamente.')
  }
}

/**
 * Extrai JSON válido de uma string que pode conter texto extra
 */
function extractJson(text) {
  let str = text.trim()

  // Remove marcadores markdown
  if (str.startsWith('```json')) {
    str = str.slice(7)
  } else if (str.startsWith('```')) {
    str = str.slice(3)
  }
  if (str.endsWith('```')) {
    str = str.slice(0, -3)
  }
  str = str.trim()

  // Se já é JSON válido, retorna
  if ((str.startsWith('{') && str.endsWith('}')) || (str.startsWith('[') && str.endsWith(']'))) {
    return str
  }

  // Tenta extrair JSON de texto misto (ex: "Aqui está: {...}")
  const firstBrace = str.indexOf('{')
  const lastBrace = str.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return str.slice(firstBrace, lastBrace + 1)
  }

  return str
}

/**
 * Normaliza os dados extraídos para o formato padrão do app
 */
function normalizeExtractedData(data) {
  // Detecta formato batch de fatura (novo prompt)
  if (data.valor_total_fatura !== undefined && Array.isArray(data.transacoes)) {
    return normalizeFaturaBatch(data)
  }

  // Dados básicos
  const normalized = {
    tipo_documento: data.tipo_documento || 'outro',
    descricao: data.descricao || data.beneficiario || data.emitente || '',
    valor: parseFloat(data.valor || data.valor_total || 0),
    data: data.data || data.data_vencimento || data.data_emissao || new Date().toISOString().split('T')[0],
    categoria_sugerida: data.categoria_sugerida || 'other',
    tipo_transacao: data.tipo_transacao || 'expense',
    confianca: data.confianca || 'media',
    dados_completos: data
  }

  // Se for fatura de cartão (formato legado), inclui as compras
  if (data.tipo_documento === 'fatura_cartao' && data.compras) {
    normalized.compras = data.compras
    normalized.cartao = data.cartao
    normalized.fatura = data.fatura
  }

  // Se for extrato, inclui as transações
  if (data.tipo_documento === 'extrato' && data.transacoes) {
    normalized.transacoes = data.transacoes
    normalized.conta = data.conta
    normalized.periodo = data.periodo
    normalized.saldos = data.saldos
  }

  // Se for transferência, inclui dados de origem/destino
  if (['pix', 'ted', 'doc'].includes(data.tipo_documento)) {
    normalized.origem = data.origem
    normalized.destino = data.destino
    normalized.identificador = data.identificador
    normalized.hora = data.hora
  }

  return normalized
}

/**
 * Normaliza dados de fatura batch (novo formato com transacoes)
 */
function normalizeFaturaBatch(data) {
  const originalCount = data.transacoes.length
  const originalSum = data.transacoes.reduce((s, t) => s + parseFloat(t.valor || 0), 0)

  // Deduplica transações com mesma data + descrição + valor
  const seen = new Set()
  const removed = []
  const deduped = data.transacoes.filter((t) => {
    const key = `${t.data}|${(t.descricao || '').trim().toLowerCase()}|${parseFloat(t.valor || 0).toFixed(2)}`
    if (seen.has(key)) {
      removed.push(t)
      return false
    }
    seen.add(key)
    return true
  })

  if (removed.length > 0) {
    console.warn(`Fatura batch: ${removed.length} duplicatas removidas:`, removed)
  }
  console.log(`Fatura batch: IA retornou ${originalCount} transações (R$ ${originalSum.toFixed(2)}), após dedup: ${deduped.length}`)

  const transacoes = deduped.map((t, index) => ({
    id: index + 1,
    data: t.data || '',
    descricao: t.descricao || '',
    valor: parseFloat(t.valor || 0),
    categoria: t.categoria || 'other',
  }))

  const somaReal = transacoes.reduce((sum, t) => sum + t.valor, 0)

  return {
    tipo_documento: 'fatura_batch',
    mes_referencia: data.mes_referencia || null,
    ano_referencia: data.ano_referencia || null,
    valor_total_fatura: parseFloat(data.valor_total_fatura || 0),
    soma_lancamentos: somaReal,
    diferenca: parseFloat(data.valor_total_fatura || 0) - somaReal,
    transacoes,
    dados_completos: data,
  }
}

export { normalizeExtractedData }
export default { processDocument }
