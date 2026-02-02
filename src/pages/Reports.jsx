import { useState, useMemo } from 'react'
import { BarChart3, PieChart as PieChartIcon, TrendingUp, GitCompare, Hash, LineChart } from 'lucide-react'
import Card from '../components/ui/Card'
import MonthSelector from '../components/ui/MonthSelector'
import Loading from '../components/ui/Loading'
import EmptyState from '../components/ui/EmptyState'
import CategoryPieChart from '../components/reports/CategoryPieChart'
import IncomeExpenseBarChart from '../components/reports/IncomeExpenseBarChart'
import MonthlyTrendChart from '../components/reports/MonthlyTrendChart'
import MonthComparisonChart from '../components/reports/MonthComparisonChart'
import TagsReportChart from '../components/reports/TagsReportChart'
import BalanceEvolutionChart from '../components/reports/BalanceEvolutionChart'
import { useTransactions, useAllCardExpenses, useCategories } from '../hooks/useFirestore'
import { usePrivacy } from '../contexts/PrivacyContext'
import { isDateInMonth } from '../utils/helpers'
import { TRANSACTION_TYPES } from '../utils/constants'

export default function Reports({ month, year, onMonthChange }) {
  const { formatCurrency } = usePrivacy()
  const [dateRange, setDateRange] = useState(null)
  const [includePending, setIncludePending] = useState(false)

  const { transactions, loading: loadingTransactions } = useTransactions(month, year)
  const { expenses: allCardExpenses, loading: loadingExpenses } = useAllCardExpenses()
  const { categories, loading: loadingCategories } = useCategories()

  // Filter by date range
  const filterByDateRange = (items) => {
    if (!dateRange || !dateRange.startDate || !dateRange.endDate) {
      return items
    }
    const startDate = new Date(dateRange.startDate + 'T00:00:00')
    const endDate = new Date(dateRange.endDate + 'T23:59:59')
    return items.filter(item => {
      const itemDate = item.date instanceof Date ? item.date : new Date(item.date + 'T12:00:00')
      return itemDate >= startDate && itemDate <= endDate
    })
  }

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    let result = filterByDateRange(transactions)
    if (!includePending) {
      result = result.filter(t => t.paid !== false)
    }
    return result
  }, [transactions, dateRange, includePending])

  // Card expenses for the period
  const filteredCardExpenses = useMemo(() => {
    if (dateRange) {
      return filterByDateRange(allCardExpenses)
    }
    return allCardExpenses.filter(e => isDateInMonth(e.date, month, year))
  }, [allCardExpenses, month, year, dateRange])

  // Calculate summary
  const summary = useMemo(() => {
    const income = filteredTransactions
      .filter(t => t.type === TRANSACTION_TYPES.INCOME)
      .reduce((sum, t) => sum + (t.amount || 0), 0)

    const expenses = filteredTransactions
      .filter(t => t.type === TRANSACTION_TYPES.EXPENSE)
      .reduce((sum, t) => sum + (t.amount || 0), 0)

    const cardTotal = filteredCardExpenses.reduce((sum, e) => sum + (e.amount || 0), 0)

    const balance = income - expenses

    return { income, expenses, cardTotal, balance, totalExpenses: expenses + cardTotal }
  }, [filteredTransactions, filteredCardExpenses])

  // Data by category
  const categoryData = useMemo(() => {
    const data = {}

    // Add transactions
    filteredTransactions
      .filter(t => t.type === TRANSACTION_TYPES.EXPENSE)
      .forEach(t => {
        const catId = t.category
        if (!data[catId]) {
          const cat = categories.find(c => c.id === catId)
          data[catId] = {
            id: catId,
            name: cat?.name || 'Sem categoria',
            color: cat?.color || 'slate',
            value: 0
          }
        }
        data[catId].value += t.amount || 0
      })

    // Add card expenses
    filteredCardExpenses.forEach(e => {
      const catId = e.category
      if (!data[catId]) {
        const cat = categories.find(c => c.id === catId)
        data[catId] = {
          id: catId,
          name: cat?.name || 'Sem categoria',
          color: cat?.color || 'slate',
          value: 0
        }
      }
      data[catId].value += e.amount || 0
    })

    return Object.values(data).sort((a, b) => b.value - a.value)
  }, [filteredTransactions, filteredCardExpenses, categories])

  const loading = loadingTransactions || loadingExpenses || loadingCategories

  const hasData = filteredTransactions.length > 0 || filteredCardExpenses.length > 0

  return (
    <div className="space-y-6">
      {/* Month Selector */}
      <MonthSelector
        month={month}
        year={year}
        onChange={(m, y) => {
          setDateRange(null)
          onMonthChange(m, y)
        }}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
      />

      {/* Options */}
      <Card className="!p-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={includePending}
            onChange={(e) => setIncludePending(e.target.checked)}
            className="w-4 h-4 text-violet-500 bg-dark-700 border-dark-600 rounded focus:ring-violet-500"
          />
          <span className="text-sm text-white">Incluir lançamentos pendentes</span>
        </label>
      </Card>

      {loading ? (
        <Loading />
      ) : !hasData ? (
        <EmptyState
          icon={BarChart3}
          title="Sem dados para exibir"
          description="Adicione transações para visualizar os relatórios"
        />
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="!p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                </div>
                <span className="text-xs text-dark-400">Receitas</span>
              </div>
              <p className="text-xl font-bold text-emerald-400">
                {formatCurrency(summary.income)}
              </p>
            </Card>

            <Card className="!p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-red-400 rotate-180" />
                </div>
                <span className="text-xs text-dark-400">Despesas</span>
              </div>
              <p className="text-xl font-bold text-red-400">
                {formatCurrency(summary.totalExpenses)}
              </p>
            </Card>
          </div>

          {/* Income vs Expense Bar Chart */}
          <Card>
            <h3 className="text-sm font-medium text-dark-300 mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Receitas vs Despesas
            </h3>
            <IncomeExpenseBarChart
              income={summary.income}
              expenses={summary.totalExpenses}
              formatCurrency={formatCurrency}
            />
          </Card>

          {/* Category Pie Chart */}
          {categoryData.length > 0 && (
            <Card>
              <h3 className="text-sm font-medium text-dark-300 mb-4 flex items-center gap-2">
                <PieChartIcon className="w-4 h-4" />
                Despesas por Categoria
              </h3>
              <CategoryPieChart
                data={categoryData}
                formatCurrency={formatCurrency}
              />
            </Card>
          )}

          {/* Month Comparison */}
          <Card>
            <h3 className="text-sm font-medium text-dark-300 mb-4 flex items-center gap-2">
              <GitCompare className="w-4 h-4" />
              Comparativo com Mês Anterior
            </h3>
            <MonthComparisonChart
              month={month}
              year={year}
              formatCurrency={formatCurrency}
            />
          </Card>

          {/* Balance Evolution */}
          <Card>
            <h3 className="text-sm font-medium text-dark-300 mb-4 flex items-center gap-2">
              <LineChart className="w-4 h-4" />
              Evolução do Saldo
            </h3>
            <BalanceEvolutionChart
              transactions={filteredTransactions}
              month={month}
              year={year}
              formatCurrency={formatCurrency}
            />
          </Card>

          {/* Tags Report */}
          <Card>
            <h3 className="text-sm font-medium text-dark-300 mb-4 flex items-center gap-2">
              <Hash className="w-4 h-4" />
              Despesas por Tags
            </h3>
            <TagsReportChart
              transactions={filteredTransactions}
              cardExpenses={filteredCardExpenses}
              formatCurrency={formatCurrency}
            />
          </Card>

          {/* Monthly Trend Chart */}
          <Card>
            <h3 className="text-sm font-medium text-dark-300 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Evolução Mensal
            </h3>
            <MonthlyTrendChart
              month={month}
              year={year}
              formatCurrency={formatCurrency}
            />
          </Card>
        </>
      )}
    </div>
  )
}
