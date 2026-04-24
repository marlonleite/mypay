/**
 * Heurística: sugere cartão a partir do nome do ficheiro (ex. fatura_c6_2026-04.pdf).
 * Não substitui escolha manual; só ajuda quando há um match claro.
 */

const STOPWORDS = new Set([
  'fatura',
  'invoice',
  'cartao',
  'cartão',
  'credito',
  'crédito',
  'card',
  'pdf',
  'extrato',
  'statement',
  'gastos',
  'compras',
  'despesas',
  'mensal',
  'bank',
  'banco',
  'arquivo',
  'file',
  'download',
])

function fileNameTokens(fileName) {
  if (!fileName || typeof fileName !== 'string') return []
  const base = fileName.replace(/\.[^.]+$/i, '').toLowerCase()
  const raw = base.split(/[^a-z0-9àáâãéêíóôõúç]+/i).filter(Boolean)
  return raw.filter((t) => {
    if (t.length < 2) return false
    if (/^\d+$/.test(t)) return false
    if (STOPWORDS.has(t)) return false
    return true
  })
}

function cardHaystack(card) {
  return `${card.name || ''} ${card.description || ''}`.toLowerCase()
}

function scoreMatch(hay, token) {
  if (!token || !hay.includes(token)) return 0
  return token.length >= 5 ? 12 : token.length >= 3 ? 8 : 5
}

/**
 * @param {string} fileName
 * @param {Array<{ id: string, name?: string, description?: string|null, archived?: boolean }>} cards
 * @returns {string|null} id do cartão ou null se ambíguo / sem match
 */
export function guessCardIdFromFileName(fileName, cards) {
  const list = Array.isArray(cards) ? cards.filter((c) => c && !c.archived) : []
  if (list.length === 0) return null

  const tokens = fileNameTokens(fileName)
  if (tokens.length === 0) return null

  const scored = list.map((card) => {
    const hay = cardHaystack(card)
    let score = 0
    for (const t of tokens) {
      score += scoreMatch(hay, t)
    }
    return { id: card.id, score }
  })

  scored.sort((a, b) => b.score - a.score)
  const best = scored[0]
  const second = scored[1]
  if (!best || best.score <= 0) return null
  if (second && second.score === best.score) return null
  return best.id
}
