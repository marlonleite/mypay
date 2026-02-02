import { useMemo } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useTransactions, useAllCardExpenses } from '../../hooks/useFirestore'
import { isDateInMonth } from '../../utils/helpers'
import { TRANSACTION_TYPES } from '../../utils/constants'

/**
 * Componente que compara receitas e despesas do mês atual com o mês anterior
 */
export default function MonthComparisonChart({ month, year, formatCurrency }) {
  // Calcular mês anterior
  const prevMonth = month === 0 ? 11 : month - 1
  const prevYear = month === 0 ? year - 1 : year

  // Dados do mês atual
  const { transactions: currentTransactions } = useTransactions(month, year)
  const { expenses: allCardExpenses } = useAllCardExpenses()

  // Dados do mês anterior
  const { transactions: prevTransactions } = useTransactions(prevMonth, prevYear)

  // Calcular totais do mês atual
  const currentSummary = useMemo(() => {
    const currentCardExpenses = allCardExpenses.filter(e => isDateInMonth(e.date, month, year))

    const income = currentTransactions
      .filter(t => t.type === TRANSACTION_TYPES.INCOME && t.paid !== false)
      .reduce((sum, t) => sum + (t.amount || 0), 0)

    const expenses = currentTransactions
      .filter(t => t.type === TRANSACTION_TYPES.EXPENSE && t.paid !== false)
      .reduce((sum, t) => sum + (t.amount || 0), 0)

    const cardTotal = currentCardExpenses.reduce((sum, e) => sum + (e.amount || 0), 0)

    return { income, expenses: expenses + cardTotal }
  }, [currentTransactions, allCardExpenses, month, year])

  // Calcular totais do mês anterior
  const prevSummary = useMemo(() => {
    const prevCardExpenses = allCardExpenses.filter(e => isDateInMonth(e.date, prevMonth, prevYear))

    const income = prevTransactions
      .filter(t => t.type === TRANSACTION_TYPES.INCOME && t.paid !== false)
      .reduce((sum, t) => sum + (t.amount || 0), 0)

    const expenses = prevTransactions
      .filter(t => t.type === TRANSACTION_TYPES.EXPENSE && t.paid !== false)
      .reduce((sum, t) => sum + (t.amount || 0), 0)

    const cardTotal = prevCardExpenses.reduce((sum, e) => sum + (e.amount || 0), 0)

    return { income, expenses: expenses + cardTotal }
  }, [prevTransactions, allCardExpenses, prevMonth, prevYear])

  // Calcular variações percentuais
  const calculateVariation = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0
    return Math.round(((current - previous) / previous) * 100)
  }

  const incomeVariation = calculateVariation(currentSummary.income, prevSummary.income)
  const expenseVariation = calculateVariation(currentSummary.expenses, prevSummary.expenses)

  // Nomes dos meses
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ]

  const VariationBadge = ({ value, inverted = false }) => {
    // Para despesas, inversão: aumento é ruim, diminuição é bom
    const isPositive = inverted ? value < 0 : value > 0
    const isNeutral = value === 0

    return (
      <div className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
        isNeutral
          ? 'bg-dark-700 text-dark-400'
          : isPositive
            ? 'bg-emerald-500/20 text-emerald-400'
            : 'bg-red-500/20 text-red-400'
      }`}>
        {isNeutral ? (
          <Minus className="w-3 h-3" />
        ) : value > 0 ? (
          <TrendingUp className="w-3 h-3" />
        ) : (
          <TrendingDown className="w-3 h-3" />
        )}
        {value > 0 ? '+' : ''}{value}%
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between text-xs text-dark-500">
        <span>{monthNames[prevMonth]} {prevYear}</span>
        <span className="text-dark-400">vs</span>
        <span className="text-white font-medium">{monthNames[month]} {year}</span>
      </div>

      {/* Receitas */}
      <div className="p-3 bg-dark-800/50 rounded-xl">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-dark-400">Receitas</span>
          <VariationBadge value={incomeVariation} />
        </div>
        <div className="flex items-center justify-between">
          <div className="text-center">
            <p className="text-xs text-dark-500 mb-1">Anterior</p>
            <p className="text-sm text-dark-300">{formatCurrency(prevSummary.income)}</p>
          </div>
          <div className="flex-1 mx-4 h-1 bg-dark-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{
                width: `${Math.min(100, prevSummary.income > 0
                  ? (currentSummary.income / prevSummary.income) * 50
                  : currentSummary.income > 0 ? 100 : 0
                )}%`
              }}
            />
          </div>
          <div className="text-center">
            <p className="text-xs text-dark-500 mb-1">Atual</p>
            <p className="text-sm text-emerald-400 font-medium">{formatCurrency(currentSummary.income)}</p>
          </div>
        </div>
      </div>

      {/* Despesas */}
      <div className="p-3 bg-dark-800/50 rounded-xl">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-dark-400">Despesas</span>
          <VariationBadge value={expenseVariation} inverted />
        </div>
        <div className="flex items-center justify-between">
          <div className="text-center">
            <p className="text-xs text-dark-500 mb-1">Anterior</p>
            <p className="text-sm text-dark-300">{formatCurrency(prevSummary.expenses)}</p>
          </div>
          <div className="flex-1 mx-4 h-1 bg-dark-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-500 transition-all"
              style={{
                width: `${Math.min(100, prevSummary.expenses > 0
                  ? (currentSummary.expenses / prevSummary.expenses) * 50
                  : currentSummary.expenses > 0 ? 100 : 0
                )}%`
              }}
            />
          </div>
          <div className="text-center">
            <p className="text-xs text-dark-500 mb-1">Atual</p>
            <p className="text-sm text-red-400 font-medium">{formatCurrency(currentSummary.expenses)}</p>
          </div>
        </div>
      </div>

      {/* Resumo */}
      <div className="p-3 bg-violet-500/10 rounded-xl border border-violet-500/20">
        <div className="flex items-center justify-between">
          <span className="text-sm text-dark-300">Economia do mês</span>
          <span className={`text-sm font-bold ${
            (currentSummary.income - currentSummary.expenses) >= 0
              ? 'text-emerald-400'
              : 'text-red-400'
          }`}>
            {formatCurrency(currentSummary.income - currentSummary.expenses)}
          </span>
        </div>
        {prevSummary.income - prevSummary.expenses !== 0 && (
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-dark-500">Mês anterior</span>
            <span className="text-xs text-dark-400">
              {formatCurrency(prevSummary.income - prevSummary.expenses)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
