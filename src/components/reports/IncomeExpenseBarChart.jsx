import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

export default function IncomeExpenseBarChart({ income, expenses, formatCurrency }) {
  const data = [
    { name: 'Receitas', value: income, color: '#10b981' },
    { name: 'Despesas', value: expenses, color: '#ef4444' }
  ]

  // Custom tooltip
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0]
      return (
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-3 shadow-lg">
          <p className="text-white font-medium mb-1">{data.payload.name}</p>
          <p className="text-violet-400 font-bold">{formatCurrency(data.value)}</p>
        </div>
      )
    }
    return null
  }

  // Custom label on top of bar
  const renderCustomLabel = (props) => {
    const { x, y, width, value } = props
    return (
      <text
        x={x + width / 2}
        y={y - 10}
        fill="#fff"
        textAnchor="middle"
        className="text-xs font-medium"
      >
        {formatCurrency(value)}
      </text>
    )
  }

  const maxValue = Math.max(income, expenses)
  const yAxisMax = maxValue * 1.2 // Add 20% padding

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ top: 20, right: 0, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
        <XAxis
          dataKey="name"
          stroke="#9ca3af"
          tick={{ fill: '#9ca3af', fontSize: 12 }}
        />
        <YAxis
          stroke="#9ca3af"
          tick={{ fill: '#9ca3af', fontSize: 12 }}
          domain={[0, yAxisMax]}
          tickFormatter={(value) => {
            if (value >= 1000000) {
              return `${(value / 1000000).toFixed(1)}M`
            }
            if (value >= 1000) {
              return `${(value / 1000).toFixed(0)}k`
            }
            return value.toFixed(0)
          }}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(139, 92, 246, 0.1)' }} />
        <Bar
          dataKey="value"
          radius={[8, 8, 0, 0]}
          label={renderCustomLabel}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
