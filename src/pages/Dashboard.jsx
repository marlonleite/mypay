
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
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3">
            {/* Receitas */}
            <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-emerald-500/20 rounded-lg">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                </div>
                <span className="text-xs text-dark-400">Receitas</span>
              </div>
              <p className="text-lg font-bold text-emerald-400">
                {formatCurrency(summary.income)}
              </p>
            </Card>

            {/* Despesas */}
            <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-red-500/20 rounded-lg">
                  <TrendingDown className="w-4 h-4 text-red-500" />
                </div>
                <span className="text-xs text-dark-400">Despesas</span>
              </div>
              <p className="text-lg font-bold text-red-400">
                {formatCurrency(summary.expenses)}
              </p>
            </Card>

            {/* Fatura a Pagar */}
            <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-orange-500/20 rounded-lg">
                  <CreditCard className="w-4 h-4 text-orange-500" />
                </div>
                <span className="text-xs text-dark-400">Fatura a Pagar</span>
              </div>
              <p className="text-lg font-bold text-orange-400">
                {formatCurrency(summary.cardTotal)}
              </p>
            </Card>

            {/* Saldo */}
            <Card className={`bg-gradient-to-br ${
              summary.balance >= 0
                ? 'from-violet-500/10 to-violet-600/5 border-violet-500/20'
                : 'from-red-500/10 to-red-600/5 border-red-500/20'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-1.5 rounded-lg ${
                  summary.balance >= 0 ? 'bg-violet-500/20' : 'bg-red-500/20'
                }`}>
                  <Wallet className={`w-4 h-4 ${
                    summary.balance >= 0 ? 'text-violet-500' : 'text-red-500'
                  }`} />
                </div>
                <span className="text-xs text-dark-400">Saldo</span>
              </div>
              <p className={`text-lg font-bold ${
                summary.balance >= 0 ? 'text-violet-400' : 'text-red-400'
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
                    className="flex items-center justify-between p-3 bg-dark-800/50 rounded-xl"
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
