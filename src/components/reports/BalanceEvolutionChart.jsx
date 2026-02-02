import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { useAccounts } from '../../hooks/useFirestore'

/**
 * Gráfico de evolução do saldo ao longo do mês
 */
export default function BalanceEvolutionChart({ transactions, month, year, formatCurrency }) {
  const { accounts, getActiveAccounts } = useAccounts()

  // Calcular saldo inicial (soma dos saldos das contas)
  const initialBalance = useMemo(() => {
    const activeAccounts = getActiveAccounts()
    return activeAccounts.reduce((sum, a) => sum + (a.balance || 0), 0)
  }, [accounts])

  // Calcular evolução do saldo dia a dia
  const chartData = useMemo(() => {
    // Agrupar transações por dia
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const data = []

    let runningBalance = initialBalance

    for (let day = 1; day <= daysInMonth; day++) {
      const dayDate = new Date(year, month, day)

      // Transações deste dia
      const dayTransactions = transactions.filter(t => {
        const tDate = t.date instanceof Date ? t.date : new Date(t.date)
        return tDate.getDate() === day &&
               tDate.getMonth() === month &&
               tDate.getFullYear() === year &&
               t.paid !== false
      })

      // Calcular variação do dia
      const dayIncome = dayTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + (t.amount || 0), 0)

      const dayExpenses = dayTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + (t.amount || 0), 0)

      runningBalance += dayIncome - dayExpenses

      // Só adicionar dias até hoje se for o mês atual
      const today = new Date()
      const isCurrentMonth = month === today.getMonth() && year === today.getFullYear()

      if (!isCurrentMonth || day <= today.getDate()) {
        data.push({
          day,
          date: dayDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
          balance: runningBalance,
          income: dayIncome,
          expenses: dayExpenses
        })
      }
    }

    return data
  }, [transactions, month, year, initialBalance])

  // Calcular min e max para o eixo Y
  const minBalance = Math.min(...chartData.map(d => d.balance), 0)
  const maxBalance = Math.max(...chartData.map(d => d.balance), 0)

  // Tooltip customizado
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-dark-800 border border-dark-700 rounded-lg p-3 shadow-lg">
          <p className="text-xs text-dark-400 mb-2">{data.date}</p>
          <p className={`text-sm font-bold ${data.balance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            Saldo: {formatCurrency(data.balance)}
          </p>
          {data.income > 0 && (
            <p className="text-xs text-emerald-400 mt-1">
              +{formatCurrency(data.income)}
            </p>
          )}
          {data.expenses > 0 && (
            <p className="text-xs text-red-400">
              -{formatCurrency(data.expenses)}
            </p>
          )}
        </div>
      )
    }
    return null
  }

  if (chartData.length === 0) {
    return (
      <div className="text-center py-8 text-dark-400">
        Sem dados para exibir
      </div>
    )
  }

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
        >
          <XAxis
            dataKey="day"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#6b7280', fontSize: 10 }}
            interval="preserveStartEnd"
          />
          <YAxis
            hide
            domain={[minBalance * 1.1, maxBalance * 1.1]}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3" />
          <Line
            type="monotone"
            dataKey="balance"
            stroke="#8b5cf6"
            strokeWidth={2}
            dot={false}
            activeDot={{
              r: 4,
              fill: '#8b5cf6',
              stroke: '#1f2937',
              strokeWidth: 2
            }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Legenda */}
      <div className="flex items-center justify-between mt-2 text-xs">
        <div className="flex items-center gap-4">
          <span className="text-dark-500">
            Início: {formatCurrency(initialBalance)}
          </span>
        </div>
        <span className={`font-medium ${
          chartData[chartData.length - 1]?.balance >= 0
            ? 'text-emerald-400'
            : 'text-red-400'
        }`}>
          Atual: {formatCurrency(chartData[chartData.length - 1]?.balance || 0)}
        </span>
      </div>
    </div>
  )
}
