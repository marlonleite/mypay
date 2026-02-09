import { getPromptForType } from './prompts'

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

/**
 * Processa um documento usando a API do Google Gemini
 */
export async function processDocument(base64, mimeType, documentType = 'auto') {
  const apiKey = import.meta.env.VITE_GOOGLE_AI_KEY

  if (!apiKey) {
    throw new Error('API key do Google AI não configurada. Adicione VITE_GOOGLE_AI_KEY no arquivo .env')
  }

  const prompt = getPromptForType(documentType)

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              inline_data: {
                mime_type: mimeType,
                data: base64
              }
            },
            {
              text: prompt
            }
          ]
        }],
        generationConfig: {
          temperature: 0.1,
          topK: 32,
          topP: 1,
          maxOutputTokens: 65536
        }
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.error?.message || `Erro na API: ${response.status}`

      console.error('Gemini API Error:', response.status, errorData)

      if (response.status === 429) {
        throw new Error(`Limite de requisições excedido. ${errorMessage}`)
      }

      if (response.status === 401 || response.status === 403) {
        throw new Error(`API key inválida. ${errorMessage}`)
      }

      throw new Error(errorMessage)
    }

    const data = await response.json()
    return parseGeminiResponse(data)

  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Erro de conexão. Verifique sua internet.')
    }
    throw error
  }
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

  const text = candidate.content?.parts?.[0]?.text

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
    valor_total_fatura: parseFloat(data.valor_total_fatura || 0),
    soma_lancamentos: somaReal,
    diferenca: parseFloat(data.valor_total_fatura || 0) - somaReal,
    transacoes,
    dados_completos: data,
  }
}

export default { processDocument }
