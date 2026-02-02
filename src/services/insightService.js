/**
 * Serviço para geração de insights financeiros automáticos
 */

const INSIGHT_TYPES = {
  SPENDING_INCREASE: 'spending_increase',
  SPENDING_DECREASE: 'spending_decrease',
  CATEGORY_SPIKE: 'category_spike',
  GOAL_PROGRESS: 'goal_progress',
  BUDGET_WARNING: 'budget_warning',
  SAVING_OPPORTUNITY: 'saving_opportunity',
  RECURRING_DETECTED: 'recurring_detected',
  POSITIVE_BALANCE: 'positive_balance',
  NEGATIVE_BALANCE: 'negative_balance'
}

const INSIGHT_SEVERITY = {
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  ALERT: 'alert'
}

/**
 * Analisa transações e gera insights
 * @param {Object} params - Parâmetros para análise
 * @returns {Array} Lista de insights
 */
export function generateInsights({
  currentTransactions = [],
  previousTransactions = [],
  currentCardExpenses = [],
  previousCardExpenses = [],
  categories = [],
  budgets = [],
  goals = [],
  month,
  year
}) {
  const insights = []

  // 1. Comparar gastos totais com mês anterior
  const currentExpenses = calculateTotalExpenses(currentTransactions, currentCardExpenses)
  const previousExpenses = calculateTotalExpenses(previousTransactions, previousCardExpenses)

  if (previousExpenses > 0) {
    const variation = ((currentExpenses - previousExpenses) / previousExpenses) * 100

    if (variation > 20) {
      insights.push({
        id: 'spending_increase',
        type: INSIGHT_TYPES.SPENDING_INCREASE,
        severity: INSIGHT_SEVERITY.WARNING,
        title: 'Gastos aumentaram',
        message: `Você gastou ${Math.round(variation)}% a mais que no mês passado`,
        value: currentExpenses - previousExpenses,
        icon: 'TrendingUp'
      })
    } else if (variation < -10) {
      insights.push({
        id: 'spending_decrease',
        type: INSIGHT_TYPES.SPENDING_DECREASE,
        severity: INSIGHT_SEVERITY.SUCCESS,
        title: 'Economia detectada',
        message: `Você economizou ${Math.round(Math.abs(variation))}% em relação ao mês passado`,
        value: previousExpenses - currentExpenses,
        icon: 'TrendingDown'
      })
    }
  }

  // 2. Identificar categoria com maior aumento
  const categoryComparison = compareCategories(
    currentTransactions,
    previousTransactions,
    currentCardExpenses,
    previousCardExpenses,
    categories
  )

  const spikeCategory = categoryComparison.find(c => c.variation > 50 && c.currentValue > 100)
  if (spikeCategory) {
    insights.push({
      id: `category_spike_${spikeCategory.id}`,
      type: INSIGHT_TYPES.CATEGORY_SPIKE,
      severity: INSIGHT_SEVERITY.WARNING,
      title: `Alta em ${spikeCategory.name}`,
      message: `Gastos em ${spikeCategory.name} aumentaram ${Math.round(spikeCategory.variation)}%`,
      value: spikeCategory.currentValue - spikeCategory.previousValue,
      categoryId: spikeCategory.id,
      icon: 'AlertTriangle'
    })
  }

  // 3. Verificar progresso das metas
  const activeGoals = goals.filter(g => g.status === 'active')
  activeGoals.forEach(goal => {
    const progress = goal.targetAmount > 0
      ? Math.round((goal.currentAmount / goal.targetAmount) * 100)
      : 0

    if (progress >= 90 && progress < 100) {
      insights.push({
        id: `goal_almost_${goal.id}`,
        type: INSIGHT_TYPES.GOAL_PROGRESS,
        severity: INSIGHT_SEVERITY.SUCCESS,
        title: 'Meta quase concluída!',
        message: `"${goal.name}" está ${progress}% completa`,
        value: goal.targetAmount - goal.currentAmount,
        goalId: goal.id,
        icon: 'Target'
      })
    }
  })

  // 4. Verificar orçamentos estourados
  budgets.forEach(budget => {
    const category = categories.find(c => c.id === budget.categoryId)
    if (!category) return

    const spent = calculateCategorySpent(
      currentTransactions,
      currentCardExpenses,
      budget.categoryId
    )

    const percentage = budget.amount > 0
      ? Math.round((spent / budget.amount) * 100)
      : 0

    if (percentage >= 100) {
      insights.push({
        id: `budget_exceeded_${budget.id}`,
        type: INSIGHT_TYPES.BUDGET_WARNING,
        severity: INSIGHT_SEVERITY.ALERT,
        title: 'Orçamento estourado',
        message: `${category.name}: ${percentage}% do limite`,
        value: spent - budget.amount,
        budgetId: budget.id,
        icon: 'AlertCircle'
      })
    } else if (percentage >= 80) {
      insights.push({
        id: `budget_warning_${budget.id}`,
        type: INSIGHT_TYPES.BUDGET_WARNING,
        severity: INSIGHT_SEVERITY.WARNING,
        title: 'Orçamento quase no limite',
        message: `${category.name}: ${percentage}% usado`,
        value: budget.amount - spent,
        budgetId: budget.id,
        icon: 'AlertTriangle'
      })
    }
  })

  // 5. Verificar saldo do mês
  const income = currentTransactions
    .filter(t => t.type === 'income' && t.paid !== false)
    .reduce((sum, t) => sum + (t.amount || 0), 0)

  const balance = income - currentExpenses

  if (balance > 0 && balance > income * 0.2) {
    insights.push({
      id: 'positive_balance',
      type: INSIGHT_TYPES.POSITIVE_BALANCE,
      severity: INSIGHT_SEVERITY.SUCCESS,
      title: 'Saldo positivo',
      message: `Você está guardando ${Math.round((balance / income) * 100)}% da renda`,
      value: balance,
      icon: 'Wallet'
    })
  } else if (balance < 0) {
    insights.push({
      id: 'negative_balance',
      type: INSIGHT_TYPES.NEGATIVE_BALANCE,
      severity: INSIGHT_SEVERITY.ALERT,
      title: 'Gastando mais que ganha',
      message: `Déficit de ${formatCurrency(Math.abs(balance))} este mês`,
      value: balance,
      icon: 'AlertOctagon'
    })
  }

  // Ordenar por severidade (alertas primeiro)
  const severityOrder = {
    [INSIGHT_SEVERITY.ALERT]: 0,
    [INSIGHT_SEVERITY.WARNING]: 1,
    [INSIGHT_SEVERITY.SUCCESS]: 2,
    [INSIGHT_SEVERITY.INFO]: 3
  }

  return insights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
}

// Helpers
function calculateTotalExpenses(transactions, cardExpenses) {
  const txExpenses = transactions
    .filter(t => t.type === 'expense' && t.paid !== false)
    .reduce((sum, t) => sum + (t.amount || 0), 0)

  const cardTotal = cardExpenses.reduce((sum, e) => sum + (e.amount || 0), 0)

  return txExpenses + cardTotal
}

function compareCategories(currentTx, previousTx, currentCard, previousCard, categories) {
  const current = {}
  const previous = {}

  // Agregar atual
  currentTx.filter(t => t.type === 'expense').forEach(t => {
    if (!current[t.category]) current[t.category] = 0
    current[t.category] += t.amount || 0
  })
  currentCard.forEach(e => {
    if (!current[e.category]) current[e.category] = 0
    current[e.category] += e.amount || 0
  })

  // Agregar anterior
  previousTx.filter(t => t.type === 'expense').forEach(t => {
    if (!previous[t.category]) previous[t.category] = 0
    previous[t.category] += t.amount || 0
  })
  previousCard.forEach(e => {
    if (!previous[e.category]) previous[e.category] = 0
    previous[e.category] += e.amount || 0
  })

  // Comparar
  const allCategories = new Set([...Object.keys(current), ...Object.keys(previous)])
  const result = []

  allCategories.forEach(catId => {
    const cat = categories.find(c => c.id === catId)
    const currentValue = current[catId] || 0
    const previousValue = previous[catId] || 0

    if (previousValue > 0) {
      const variation = ((currentValue - previousValue) / previousValue) * 100
      result.push({
        id: catId,
        name: cat?.name || 'Sem categoria',
        currentValue,
        previousValue,
        variation
      })
    }
  })

  return result.sort((a, b) => b.variation - a.variation)
}

function calculateCategorySpent(transactions, cardExpenses, categoryId) {
  const txSpent = transactions
    .filter(t => t.type === 'expense' && t.category === categoryId && t.paid !== false)
    .reduce((sum, t) => sum + (t.amount || 0), 0)

  const cardSpent = cardExpenses
    .filter(e => e.category === categoryId)
    .reduce((sum, e) => sum + (e.amount || 0), 0)

  return txSpent + cardSpent
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value)
}

export { INSIGHT_TYPES, INSIGHT_SEVERITY }
