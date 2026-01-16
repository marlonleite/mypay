
import { useState, useMemo } from 'react'
import {
  TrendingUp,
  TrendingDown,
  CreditCard,
  Wallet,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react'
import Card from '../components/ui/Card'
import MonthSelector from '../components/ui/MonthSelector'
import Loading from '../components/ui/Loading'
import EmptyState from '../components/ui/EmptyState'
import { useTransactions, useAllCardExpenses, useCards } from '../hooks/useFirestore'
import { formatCurrency, formatDate, isDateInMonth } from '../utils/helpers'
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, TRANSACTION_TYPES } from '../utils/constants'

export default function Dashboard({ month, year, onMonthChange }) {
  const [dateRange, setDateRange] = useState(null)

  const { transactions, loading: loadingTransactions } = useTransactions(month, year)
  const { expenses: allCardExpenses, loading: loadingCardExpenses } = useAllCardExpenses()
  const { cards } = useCards()

  // Helper para filtrar por período
  const filterByDateRange = (items) => {
    if (!dateRange || !dateRange.startDate || !dateRange.endDate) {
      return items
    }
    const startDate = new Date(dateRange.startDate + 'T00:00:00')
    const endDate = new Date(dateRange.endDate + 'T23:59:59')
    return items.filter(item => {
      // item.date pode ser um Date object (do Firestore) ou string
      const itemDate = item.date instanceof Date ? item.date : new Date(item.date + 'T12:00:00')
      return itemDate >= startDate && itemDate <= endDate
    })
  }

  // Calcular resumo
  const summary = useMemo(() => {
    const filteredTransactions = filterByDateRange(transactions)
    const filteredCardExpenses = dateRange
      ? filterByDateRange(allCardExpenses)
      : allCardExpenses.filter(e => isDateInMonth(e.date, month, year))

    const income = filteredTransactions
      .filter(t => t.type === TRANSACTION_TYPES.INCOME)
      .reduce((sum, t) => sum + (t.amount || 0), 0)

    const expenses = filteredTransactions
      .filter(t => t.type === TRANSACTION_TYPES.EXPENSE)
      .reduce((sum, t) => sum + (t.amount || 0), 0)

    const cardTotal = filteredCardExpenses.reduce((sum, e) => sum + (e.amount || 0), 0)

    // Saldo = Receitas - Despesas (não subtrai cartões, pois só afetam quando pagos)
    const balance = income - expenses

    return { income, expenses, cardTotal, balance }
  }, [transactions, allCardExpenses, month, year, dateRange])

  // Últimos lançamentos (transações + cartão)
  const recentItems = useMemo(() => {
    const filteredTransactions = filterByDateRange(transactions)
    const filteredCardExpenses = dateRange
      ? filterByDateRange(allCardExpenses)
      : allCardExpenses.filter(e => isDateInMonth(e.date, month, year))

    const cardExpensesWithType = filteredCardExpenses.map(e => ({
      ...e,
      type: 'card',
      cardName: cards.find(c => c.id === e.cardId)?.name || 'Cartão'
    }))

    const allItems = [...filteredTransactions, ...cardExpensesWithType]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5)

    return allItems
  }, [transactions, allCardExpenses, cards, month, year, dateRange])

  const loading = loadingTransactions || loadingCardExpenses

  const getCategoryName = (categoryId, type) => {
    const categories = type === TRANSACTION_TYPES.INCOME ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
    return categories.find(c => c.id === categoryId)?.name || categoryId
  }

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

      {loading ? (
        <Loading />
      ) : (
        <>
          {/* Summary Cards - Task App Style */}
          <div className="grid grid-cols-2 gap-3">
            {/* Receitas */}
            <Card className="!p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 icon-green rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <span className="text-xs text-dark-400">Receitas</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {formatCurrency(summary.income)}
              </p>
            </Card>

            {/* Despesas */}
            <Card className="!p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 icon-red rounded-xl flex items-center justify-center">
                  <TrendingDown className="w-4 h-4" />
                </div>
                <span className="text-xs text-dark-400">Despesas</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {formatCurrency(summary.expenses)}
              </p>
            </Card>

            {/* Fatura a Pagar */}
            <Card className="!p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 icon-orange rounded-xl flex items-center justify-center">
                  <CreditCard className="w-4 h-4" />
                </div>
                <span className="text-xs text-dark-400">Fatura</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {formatCurrency(summary.cardTotal)}
              </p>
            </Card>

            {/* Saldo */}
            <Card className="!p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  summary.balance >= 0 ? 'icon-purple' : 'icon-red'
                }`}>
                  <Wallet className="w-4 h-4" />
                </div>
                <span className="text-xs text-dark-400">Saldo</span>
              </div>
              <p className={`text-2xl font-bold ${
                summary.balance >= 0 ? 'text-white' : 'text-red-400'
              }`}>
                {formatCurrency(summary.balance)}
              </p>
            </Card>
          </div>

          {/* Recent Transactions */}
          <Card>
            <h3 className="text-sm font-medium text-dark-300 mb-4">
              Últimos Lançamentos
            </h3>

            {recentItems.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="Nenhum lançamento"
                description="Adicione receitas, despesas ou gastos no cartão"
              />
            ) : (
              <div className="space-y-3">
                {recentItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 bg-dark-800/30 rounded-xl border border-dark-700/30"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        item.type === TRANSACTION_TYPES.INCOME
                          ? 'bg-emerald-500/20'
                          : item.type === 'card'
                          ? 'bg-orange-500/20'
                          : 'bg-red-500/20'
                      }`}>
                        {item.type === TRANSACTION_TYPES.INCOME ? (
                          <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                        ) : item.type === 'card' ? (
                          <CreditCard className="w-4 h-4 text-orange-500" />
                        ) : (
                          <ArrowDownRight className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-white font-medium">
                          {item.description}
                        </p>
                        <p className="text-xs text-dark-400">
                          {item.type === 'card'
                            ? item.cardName
                            : getCategoryName(item.category, item.type)}
                          {' • '}
                          {formatDate(item.date)}
                          {item.totalInstallments > 1 && (
                            <span className="text-orange-400">
                              {' '}({item.installment}/{item.totalInstallments})
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <p className={`text-sm font-semibold ${
                      item.type === TRANSACTION_TYPES.INCOME
                        ? 'text-emerald-400'
                        : item.type === 'card'
                        ? 'text-orange-400'
                        : 'text-red-400'
                    }`}>
                      {item.type === TRANSACTION_TYPES.INCOME ? '+' : '-'}
                      {formatCurrency(item.amount)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
