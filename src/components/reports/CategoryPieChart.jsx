import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { CATEGORY_COLORS } from '../../utils/constants'

export default function CategoryPieChart({ data, formatCurrency }) {
  const getCategoryColor = (colorId) => {
    const color = CATEGORY_COLORS.find(c => c.id === colorId)
    return color?.hex || '#8b5cf6'
  }

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    const RADIAN = Math.PI / 180
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)

    if (percent < 0.05) return null

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        className="text-[10px] sm:text-xs font-medium"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    )
  }

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload
      return (
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-3 shadow-lg">
          <p className="text-white font-medium mb-1">{item.name}</p>
          <p className="text-violet-400 font-bold">{formatCurrency(item.value)}</p>
        </div>
      )
    }
    return null
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-dark-400">
        Sem dados para exibir
      </div>
    )
  }

  return (
    <div className="w-full min-w-0 flex flex-col gap-4">
      {/* Pie only — category list stays below so it never stacks over SVG / neighbouring cards */}
      <div className="w-full max-w-[min(100%,340px)] mx-auto h-[200px] sm:h-[240px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderCustomLabel}
              outerRadius="76%"
              fill="#8884d8"
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getCategoryColor(entry.color)} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl bg-dark-800/40 border border-dark-700/50 p-3 min-w-0 max-h-[min(45vh,320px)] overflow-y-auto overscroll-contain touch-pan-y">
        <ul className="flex flex-col gap-2">
          {data.map((entry) => (
            <li key={entry.id} className="flex items-start justify-between gap-3 text-sm min-w-0">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span
                  className="w-3 h-3 rounded-full shrink-0 mt-0.5"
                  style={{ backgroundColor: getCategoryColor(entry.color) }}
                  aria-hidden
                />
                <span className="text-dark-200 break-words">{entry.name}</span>
              </div>
              <span className="text-white font-medium shrink-0 text-right tabular-nums whitespace-nowrap">
                {formatCurrency(entry.value)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
