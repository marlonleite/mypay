import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { CATEGORY_COLORS } from '../../utils/constants'

export default function CategoryPieChart({ data, formatCurrency }) {
  // Get color for category
  const getCategoryColor = (colorId) => {
    const color = CATEGORY_COLORS.find(c => c.id === colorId)
    return color?.hex || '#8b5cf6'
  }

  // Custom label to show percentage
  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    const RADIAN = Math.PI / 180
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)

    if (percent < 0.05) return null // Don't show label for very small slices

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        className="text-xs font-medium"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    )
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-3 shadow-lg">
          <p className="text-white font-medium mb-1">{data.name}</p>
          <p className="text-violet-400 font-bold">{formatCurrency(data.value)}</p>
        </div>
      )
    }
    return null
  }

  // Custom legend
  const renderLegend = (props) => {
    const { payload } = props
    return (
      <div className="flex flex-col gap-2 mt-4">
        {payload.map((entry, index) => (
          <div key={`legend-${index}`} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-dark-300">{entry.value}</span>
            </div>
            <span className="text-white font-medium">{formatCurrency(entry.payload.value)}</span>
          </div>
        ))}
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-dark-400">
        Sem dados para exibir
      </div>
    )
  }

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomLabel}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getCategoryColor(entry.color)} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend content={renderLegend} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
