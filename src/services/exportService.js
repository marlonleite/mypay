/**
 * Serviço para exportação de dados financeiros
 */

/**
 * Exporta transações para CSV
 * @param {Array} transactions - Lista de transações
 * @param {Array} categories - Lista de categorias
 * @param {Array} accounts - Lista de contas
 * @param {string} filename - Nome do arquivo
 */
export function exportToCSV(transactions, categories, accounts, filename = 'transacoes') {
  // Header do CSV
  const headers = [
    'Data',
    'Descrição',
    'Tipo',
    'Categoria',
    'Conta',
    'Valor',
    'Status',
    'Tags',
    'Notas'
  ]

  // Mapear transações para linhas
  const rows = transactions.map(t => {
    const category = categories.find(c => c.id === t.category)
    const account = accounts.find(a => a.id === t.accountId)

    return [
      formatDateForCSV(t.date),
      escapeCSV(t.description || ''),
      t.type === 'income' ? 'Receita' : 'Despesa',
      escapeCSV(category?.name || 'Sem categoria'),
      escapeCSV(account?.name || 'Sem conta'),
      formatCurrencyForCSV(t.amount),
      t.paid === false ? 'Pendente' : 'Confirmado',
      escapeCSV((t.tags || []).join(', ')),
      escapeCSV(t.notes || '')
    ]
  })

  // Montar CSV
  const csvContent = [
    headers.join(';'),
    ...rows.map(row => row.join(';'))
  ].join('\n')

  // Download
  downloadFile(csvContent, `${filename}.csv`, 'text/csv;charset=utf-8;')
}

/**
 * Exporta despesas de cartão para CSV
 */
export function exportCardExpensesToCSV(expenses, cards, categories, filename = 'despesas-cartao') {
  const headers = [
    'Data',
    'Descrição',
    'Cartão',
    'Categoria',
    'Valor',
    'Parcela',
    'Tags'
  ]

  const rows = expenses.map(e => {
    const card = cards.find(c => c.id === e.cardId)
    const category = categories.find(c => c.id === e.category)

    return [
      formatDateForCSV(e.date),
      escapeCSV(e.description || ''),
      escapeCSV(card?.name || 'Sem cartão'),
      escapeCSV(category?.name || 'Sem categoria'),
      formatCurrencyForCSV(e.amount),
      e.totalInstallments > 1 ? `${e.installment}/${e.totalInstallments}` : '1/1',
      escapeCSV((e.tags || []).join(', '))
    ]
  })

  const csvContent = [
    headers.join(';'),
    ...rows.map(row => row.join(';'))
  ].join('\n')

  downloadFile(csvContent, `${filename}.csv`, 'text/csv;charset=utf-8;')
}

/**
 * Exporta relatório completo para CSV (transações + cartão)
 */
export function exportFullReportCSV({
  transactions,
  cardExpenses,
  categories,
  accounts,
  cards,
  month,
  year
}) {
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ]

  // Calcular totais
  const income = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + (t.amount || 0), 0)

  const expenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + (t.amount || 0), 0)

  const cardTotal = cardExpenses.reduce((sum, e) => sum + (e.amount || 0), 0)

  // Header do relatório
  const reportHeader = [
    `Relatório Financeiro - ${monthNames[month]} ${year}`,
    '',
    'RESUMO',
    `Receitas;${formatCurrencyForCSV(income)}`,
    `Despesas;${formatCurrencyForCSV(expenses)}`,
    `Cartões;${formatCurrencyForCSV(cardTotal)}`,
    `Saldo;${formatCurrencyForCSV(income - expenses)}`,
    '',
    'TRANSAÇÕES',
    'Data;Descrição;Tipo;Categoria;Conta;Valor;Status'
  ]

  // Transações
  const txRows = transactions.map(t => {
    const category = categories.find(c => c.id === t.category)
    const account = accounts.find(a => a.id === t.accountId)

    return [
      formatDateForCSV(t.date),
      escapeCSV(t.description || ''),
      t.type === 'income' ? 'Receita' : 'Despesa',
      escapeCSV(category?.name || ''),
      escapeCSV(account?.name || ''),
      formatCurrencyForCSV(t.amount),
      t.paid === false ? 'Pendente' : 'Confirmado'
    ].join(';')
  })

  // Despesas de cartão
  const cardHeader = [
    '',
    'DESPESAS DE CARTÃO',
    'Data;Descrição;Cartão;Categoria;Valor;Parcela'
  ]

  const cardRows = cardExpenses.map(e => {
    const card = cards.find(c => c.id === e.cardId)
    const category = categories.find(c => c.id === e.category)

    return [
      formatDateForCSV(e.date),
      escapeCSV(e.description || ''),
      escapeCSV(card?.name || ''),
      escapeCSV(category?.name || ''),
      formatCurrencyForCSV(e.amount),
      e.totalInstallments > 1 ? `${e.installment}/${e.totalInstallments}` : '1/1'
    ].join(';')
  })

  // Montar CSV completo
  const csvContent = [
    ...reportHeader,
    ...txRows,
    ...cardHeader,
    ...cardRows
  ].join('\n')

  const filename = `relatorio-${monthNames[month].toLowerCase()}-${year}`
  downloadFile(csvContent, `${filename}.csv`, 'text/csv;charset=utf-8;')
}

/**
 * Exporta dados para JSON (backup)
 */
export function exportToJSON(data, filename = 'backup') {
  const jsonContent = JSON.stringify(data, null, 2)
  downloadFile(jsonContent, `${filename}.json`, 'application/json')
}

// Helpers
function formatDateForCSV(date) {
  if (!date) return ''
  const d = date instanceof Date ? date : new Date(date)
  return d.toLocaleDateString('pt-BR')
}

function formatCurrencyForCSV(value) {
  if (value === undefined || value === null) return ''
  return value.toFixed(2).replace('.', ',')
}

function escapeCSV(str) {
  if (!str) return ''
  // Escapar aspas e envolver em aspas se contiver caracteres especiais
  if (str.includes(';') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function downloadFile(content, filename, mimeType) {
  // Adicionar BOM para UTF-8 (para Excel reconhecer acentos)
  const BOM = '\uFEFF'
  const blob = new Blob([BOM + content], { type: mimeType })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}
