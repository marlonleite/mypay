// Formatar valor em Real brasileiro
export const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value || 0)
}

// Formatar data para exibição
export const formatDate = (date) => {
  if (!date) return ''
  const d = date instanceof Date ? date : new Date(date)
  return d.toLocaleDateString('pt-BR')
}

// Formatar data para input date
export const formatDateForInput = (date) => {
  if (!date) return ''
  const d = date instanceof Date ? date : new Date(date)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// Converter string de data para Date em timezone local
// new Date("YYYY-MM-DD") usa UTC midnight, causando shift de dia em timezones negativos
// Esta função garante que a data fique no dia correto em qualquer timezone
export const parseLocalDate = (date) => {
  if (!date) return new Date()
  if (date instanceof Date) return date
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Date(date + 'T12:00:00')
  }
  return new Date(date)
}

// Obter mês e ano atual
export const getCurrentMonthYear = () => {
  const now = new Date()
  return {
    month: now.getMonth(),
    year: now.getFullYear()
  }
}

// Criar chave do mês (para filtros)
export const getMonthKey = (month, year) => {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

// Extrair mês e ano de uma data
export const getMonthYearFromDate = (date) => {
  const d = date instanceof Date ? date : new Date(date)
  return {
    month: d.getMonth(),
    year: d.getFullYear()
  }
}

// Verificar se uma data pertence a um mês específico
export const isDateInMonth = (date, month, year) => {
  const d = date instanceof Date ? date : new Date(date)
  return d.getMonth() === month && d.getFullYear() === year
}

// Calcular data de vencimento da fatura do cartão
export const getCardBillDate = (month, year, closingDay, dueDay) => {
  // Se o dia de vencimento é menor que o dia de fechamento,
  // a fatura vence no mês seguinte
  if (dueDay <= closingDay) {
    if (month === 11) {
      return new Date(year + 1, 0, dueDay)
    }
    return new Date(year, month + 1, dueDay)
  }
  return new Date(year, month, dueDay)
}

// Verificar se uma despesa do cartão pertence a uma fatura específica
export const isExpenseInCardBill = (expenseDate, billMonth, billYear, closingDay) => {
  const expense = new Date(expenseDate)
  const expenseDay = expense.getDate()
  const expenseMonth = expense.getMonth()
  const expenseYear = expense.getFullYear()

  // Cálculo do período da fatura
  let startMonth, startYear, endMonth, endYear

  // O período de fechamento vai do dia seguinte ao fechamento do mês anterior
  // até o dia de fechamento do mês atual
  if (closingDay >= 28) {
    startMonth = billMonth - 1
    startYear = billYear
    if (startMonth < 0) {
      startMonth = 11
      startYear = billYear - 1
    }
    endMonth = billMonth
    endYear = billYear
  } else {
    startMonth = billMonth - 1
    startYear = billYear
    if (startMonth < 0) {
      startMonth = 11
      startYear = billYear - 1
    }
    endMonth = billMonth
    endYear = billYear
  }

  const startDate = new Date(startYear, startMonth, closingDay + 1)
  const endDate = new Date(endYear, endMonth, closingDay)

  return expense >= startDate && expense <= endDate
}

// Converter string monetária (BR ou US) para number
export const parseCurrencyInput = (value) => {
  if (value == null || value === '') return null
  if (typeof value === 'number') return value

  const cleaned = String(value).replace(/[R$\s]/g, '').trim()

  // Formato BR: 1.234,56
  if (/^\d{1,3}(\.\d{3})*,\d{1,2}$/.test(cleaned)) {
    return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'))
  }

  // Formato BR simples: 123,45
  if (/^\d+,\d{1,2}$/.test(cleaned)) {
    return parseFloat(cleaned.replace(',', '.'))
  }

  // Formato US ou number puro
  const num = parseFloat(cleaned.replace(/,/g, ''))
  return isNaN(num) ? null : num
}

// Gerar ID único
export const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

// Truncar texto
export const truncateText = (text, maxLength = 20) => {
  if (!text || text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

// Ordenar por data (mais recente primeiro)
export const sortByDateDesc = (a, b) => {
  const dateA = a.date instanceof Date ? a.date : new Date(a.date)
  const dateB = b.date instanceof Date ? b.date : new Date(b.date)
  return dateB - dateA
}

// Agrupar transações por data
export const groupByDate = (transactions) => {
  const groups = {}

  transactions.forEach(transaction => {
    const dateKey = formatDate(transaction.date)
    if (!groups[dateKey]) {
      groups[dateKey] = []
    }
    groups[dateKey].push(transaction)
  })

  return groups
}
