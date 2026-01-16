/**
 * Serviço para comunicação com a API do Organizze
 * Documentação: https://github.com/organizze/api-doc
 */

const BASE_URL = 'https://api.organizze.com.br/rest/v2'

/**
 * Cria headers de autenticação para a API do Organizze
 */
function createHeaders(email, apiKey) {
  const credentials = btoa(`${email}:${apiKey}`)
  return {
    'Authorization': `Basic ${credentials}`,
    'Content-Type': 'application/json',
    'User-Agent': `myPay Migration (${email})`,
  }
}

/**
 * Faz requisição para a API do Organizze
 */
async function fetchOrganizze(endpoint, email, apiKey) {
  // Usar proxy para evitar CORS
  const proxyUrl = `/api/organizze-proxy`

  const response = await fetch(proxyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      endpoint,
      email,
      apiKey,
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.message || `Erro ${response.status}`)
  }

  return response.json()
}

/**
 * Busca todas as contas bancárias
 */
export async function getAccounts(email, apiKey) {
  return fetchOrganizze('/accounts', email, apiKey)
}

/**
 * Busca todas as categorias
 */
export async function getCategories(email, apiKey) {
  return fetchOrganizze('/categories', email, apiKey)
}

/**
 * Busca todos os cartões de crédito
 */
export async function getCreditCards(email, apiKey) {
  return fetchOrganizze('/credit_cards', email, apiKey)
}

/**
 * Busca faturas de um cartão
 */
export async function getCardInvoices(cardId, email, apiKey) {
  return fetchOrganizze(`/credit_cards/${cardId}/invoices`, email, apiKey)
}

/**
 * Busca transações em um período
 */
export async function getTransactions(startDate, endDate, email, apiKey) {
  return fetchOrganizze(
    `/transactions?start_date=${startDate}&end_date=${endDate}`,
    email,
    apiKey
  )
}

/**
 * Busca todos os dados do Organizze para migração
 */
export async function fetchAllData(email, apiKey, startDate, endDate, onProgress) {
  const results = {
    accounts: [],
    categories: [],
    creditCards: [],
    transactions: [],
    invoices: [],
  }

  try {
    // 1. Buscar contas
    onProgress?.('Buscando contas...')
    results.accounts = await getAccounts(email, apiKey)

    // 2. Buscar categorias
    onProgress?.('Buscando categorias...')
    results.categories = await getCategories(email, apiKey)

    // 3. Buscar cartões
    onProgress?.('Buscando cartões de crédito...')
    results.creditCards = await getCreditCards(email, apiKey)

    // 4. Buscar faturas de cada cartão
    onProgress?.('Buscando faturas...')
    for (const card of results.creditCards) {
      try {
        const invoices = await getCardInvoices(card.id, email, apiKey)
        results.invoices.push(...invoices.map(inv => ({ ...inv, cardId: card.id, cardName: card.name })))
      } catch (e) {
        console.warn(`Erro ao buscar faturas do cartão ${card.name}:`, e)
      }
    }

    // 5. Buscar transações
    onProgress?.('Buscando transações...')
    results.transactions = await getTransactions(startDate, endDate, email, apiKey)

    return results
  } catch (error) {
    throw new Error(`Erro ao buscar dados: ${error.message}`)
  }
}

/**
 * Converte dados do Organizze para formato do myPay
 */
export function convertToMyPay(organizzeData) {
  const { accounts, categories, creditCards, transactions } = organizzeData

  // Criar mapa de categorias por ID
  const categoryMap = {}
  categories.forEach(cat => {
    categoryMap[cat.id] = {
      id: cat.id.toString(),
      name: cat.name,
      color: cat.color,
      parentId: cat.parent_id,
    }
  })

  // Criar mapa de contas por ID
  const accountMap = {}
  accounts.forEach(acc => {
    accountMap[acc.id] = {
      id: acc.id.toString(),
      name: acc.name,
      type: acc.type || 'checking',
      archived: acc.archived,
    }
  })

  // Converter contas
  const myPayAccounts = accounts
    .filter(acc => !acc.archived)
    .map(acc => ({
      name: acc.name,
      type: mapAccountType(acc.type),
      balance: 0, // Será calculado pelas transações
      isActive: !acc.archived,
      _organizzeId: acc.id,
    }))

  // Converter categorias (separar por tipo receita/despesa)
  const incomeCategories = []
  const expenseCategories = []

  categories.forEach(cat => {
    const converted = {
      id: cat.name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
      name: cat.name,
      icon: 'Tag',
      _organizzeId: cat.id,
    }

    // Tentar determinar tipo pela cor ou nome
    // Verde geralmente é receita no Organizze
    if (cat.color === '#2ecc71' || cat.color === '#27ae60' ||
        cat.name.toLowerCase().includes('salário') ||
        cat.name.toLowerCase().includes('receita') ||
        cat.name.toLowerCase().includes('freelancer')) {
      incomeCategories.push(converted)
    } else {
      expenseCategories.push(converted)
    }
  })

  // Converter cartões de crédito
  const myPayCards = creditCards
    .filter(card => !card.archived)
    .map(card => ({
      name: card.name,
      brand: mapCardNetwork(card.card_network),
      limit: (card.limit_cents || 0) / 100,
      closingDay: card.closing_day,
      dueDay: card.due_day,
      color: getCardColor(card.card_network),
      isActive: !card.archived,
      _organizzeId: card.id,
    }))

  // Converter transações
  const myPayTransactions = transactions
    .filter(t => !t.credit_card_id) // Transações normais (não de cartão)
    .map(t => {
      const isIncome = t.amount_cents > 0
      const category = categoryMap[t.category_id]

      return {
        description: t.description,
        amount: Math.abs(t.amount_cents) / 100,
        type: isIncome ? 'income' : 'expense',
        category: category ? category.name.toLowerCase().replace(/[^a-z0-9]/g, '_') : 'other',
        date: t.date,
        isPending: !t.paid,
        notes: t.notes || '',
        tags: t.tags || [],
        accountId: t.account_id?.toString(),
        _organizzeId: t.id,
      }
    })

  // Converter despesas de cartão
  const myPayCardExpenses = transactions
    .filter(t => t.credit_card_id)
    .map(t => {
      const category = categoryMap[t.category_id]
      const card = creditCards.find(c => c.id === t.credit_card_id)

      return {
        description: t.description,
        amount: Math.abs(t.amount_cents) / 100,
        type: t.amount_cents > 0 ? 'income' : 'expense',
        category: category ? category.name.toLowerCase().replace(/[^a-z0-9]/g, '_') : 'other',
        date: t.date,
        cardId: t.credit_card_id?.toString(),
        cardName: card?.name || 'Cartão',
        installment: t.installment || 1,
        totalInstallments: t.total_installments || 1,
        tags: t.tags || [],
        _organizzeId: t.id,
      }
    })

  return {
    accounts: myPayAccounts,
    incomeCategories,
    expenseCategories,
    cards: myPayCards,
    transactions: myPayTransactions,
    cardExpenses: myPayCardExpenses,
    stats: {
      totalAccounts: myPayAccounts.length,
      totalCards: myPayCards.length,
      totalTransactions: myPayTransactions.length,
      totalCardExpenses: myPayCardExpenses.length,
      totalIncome: myPayTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0),
      totalExpense: myPayTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0),
    }
  }
}

// Helpers

function mapAccountType(type) {
  const map = {
    'checking': 'checking',
    'savings': 'savings',
    'other': 'wallet',
  }
  return map[type] || 'wallet'
}

function mapCardNetwork(network) {
  const map = {
    'visa': 'Visa',
    'mastercard': 'Mastercard',
    'amex': 'American Express',
    'elo': 'Elo',
    'hipercard': 'Hipercard',
    'diners': 'Diners',
  }
  return map[network?.toLowerCase()] || network || 'Outro'
}

function getCardColor(network) {
  const colors = {
    'visa': 'blue',
    'mastercard': 'red',
    'amex': 'slate',
    'elo': 'orange',
    'hipercard': 'red',
    'nubank': 'purple',
  }
  return colors[network?.toLowerCase()] || 'slate'
}
