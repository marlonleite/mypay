import { getPromptForType } from './prompts'

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

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
          maxOutputTokens: 4096
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
  try {
    // Extrai o texto da resposta do Gemini
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text

    if (!text) {
      throw new Error('Resposta vazia da IA')
    }

    // Remove possíveis marcadores de código markdown
    let jsonStr = text.trim()

    // Remove ```json e ``` se existirem
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7)
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3)
    }

    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3)
    }

    jsonStr = jsonStr.trim()

    // Tenta fazer parse do JSON
    const parsed = JSON.parse(jsonStr)

    // Normaliza os dados para o formato esperado pelo app
    return normalizeExtractedData(parsed)

  } catch (error) {
    console.error('Erro ao parsear resposta:', error)
    throw new Error('Não foi possível extrair dados do documento. Tente novamente.')
  }
}

/**
 * Normaliza os dados extraídos para o formato padrão do app
 */
function normalizeExtractedData(data) {
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

  // Se for fatura de cartão, inclui as compras
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

export default { processDocument }
