import { useMemo } from 'react'
import { Lightbulb, ChevronRight } from 'lucide-react'
import InsightCard from './InsightCard'
import { generateInsights } from '../../services/insightService'
import { useTransactions, useAllCardExpenses, useCategories, useBudgets } from '../../hooks/useFirestore'
import { useGoals } from '../../contexts/GoalsContext'
import { usePrivacy } from '../../contexts/PrivacyContext'
import { isDateInMonth } from '../../utils/helpers'

/**
 * Widget de insights para o Dashboard
 * Mostra até 3 insights mais relevantes
 */
export default function InsightsWidget({ month, year, onViewAll }) {
  const { formatCurrency } = usePrivacy()

  // Dados do mês atual
  const { transactions: currentTransactions } = useTransactions(month, year)
  const { expenses: allCardExpenses } = useAllCardExpenses()
  const { categories } = useCategories()
  const { budgets } = useBudgets(month, year)
  const { goals } = useGoals()

  // Calcular mês anterior
  const prevMonth = month === 0 ? 11 : month - 1
  const prevYear = month === 0 ? year - 1 : year

  // Dados do mês anterior
  const { transactions: previousTransactions } = useTransactions(prevMonth, prevYear)

  // Filtrar despesas de cartão por mês
  const currentCardExpenses = useMemo(() =>
    allCardExpenses.filter(e => isDateInMonth(e.date, month, year)),
    [allCardExpenses, month, year]
  )

  const previousCardExpenses = useMemo(() =>
    allCardExpenses.filter(e => isDateInMonth(e.date, prevMonth, prevYear)),
    [allCardExpenses, prevMonth, prevYear]
  )

  // Gerar insights
  const insights = useMemo(() => {
    return generateInsights({
      currentTransactions,
      previousTransactions,
      currentCardExpenses,
      previousCardExpenses,
      categories,
      budgets,
      goals,
      month,
      year
    })
  }, [
    currentTransactions,
    previousTransactions,
    currentCardExpenses,
    previousCardExpenses,
    categories,
    budgets,
    goals,
    month,
    year
  ])

  // Pegar os 2 insights mais importantes
  const topInsights = insights.slice(0, 2)

  if (topInsights.length === 0) {
    return null // Não mostrar widget se não houver insights
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-amber-500" />
          <h3 className="font-medium text-white">Insights</h3>
        </div>
        {insights.length > 2 && (
          <button
            onClick={onViewAll}
            className="flex items-center gap-1 text-sm text-violet-400 hover:text-violet-300 transition-colors"
          >
            Ver todos ({insights.length})
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Lista de insights */}
      <div className="space-y-2">
        {topInsights.map((insight) => (
          <InsightCard
            key={insight.id}
            insight={insight}
            formatCurrency={formatCurrency}
          />
        ))}
      </div>
    </div>
  )
}
