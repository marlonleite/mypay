import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

export default function IncomeExpenseBarChart({ income, expenses, formatCurrency }) {
  const data = [
    { name: 'Receitas', value: income, color: 'var(--semantic-success)' },
    { name: 'Despesas', value: expenses, color: 'var(--semantic-error)' }
  ]

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const row = payload[0]
      return (
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-3 shadow-lg pointer-events-none z-50">
          <p className="text-white font-medium mb-1">{row.payload.name}</p>
          <p className="text-violet-400 font-bold">{formatCurrency(row.value)}</p>
        </div>
      )
    }
    return null
  }

  const maxValue = Math.max(income, expenses, 0)
  const yAxisMax = maxValue * 1.15

  return (
    <div className="w-full min-w-0 h-[200px] sm:h-[240px] relative overflow-hidden">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 12, right: 2, left: 0, bottom: 4 }}
          barCategoryGap="22%"
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.35} vertical={false} />
          <XAxis
            dataKey="name"
            stroke="var(--text-muted)"
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            tickMargin={8}
            axisLine={false}
          />
          <YAxis
            width={42}
            stroke="var(--text-muted)"
            tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
            domain={[0, yAxisMax || 1]}
            tickFormatter={(value) => {
              if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
              if (value >= 1000) return `${(value / 1000).toFixed(0)}k`
              return value.toFixed(0)
            }}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(139, 92, 246, 0.08)' }} />
          <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={56}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="sr-only" aria-live="polite">
        Receitas {formatCurrency(income)}, Despesas {formatCurrency(expenses)}
      </div>
    </div>
  )
}
