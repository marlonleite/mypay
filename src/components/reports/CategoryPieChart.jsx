import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { CATEGORY_COLORS } from '../../utils/constants'

const PIE_OUTER_RADIUS_PIXELS = 72

export default function CategoryPieChart({ data, formatCurrency }) {
  const getCategoryColor = (colorId) => {
    const color = CATEGORY_COLORS.find(c => c.id === colorId)
    return color?.hex || '#8b5cf6'
  }

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload
      return (
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-3 shadow-lg pointer-events-none z-50">
          <p className="text-white font-medium mb-1">{item.name}</p>
          <p className="text-dark-400 text-xs mb-0.5">{`${(item.percent * 100).toFixed(1)}% do total`}</p>
          <p className="text-violet-400 font-bold">{formatCurrency(item.value)}</p>
        </div>
      )
    }
    return null
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-dark-400">
        Sem dados para exibir
      </div>
    )
  }

  const total = data.reduce((s, d) => s + (d.value || 0), 0)
  const dataWithPercent = total > 0
    ? data.map((d) => ({ ...d, percent: d.value / total }))
    : data.map((d) => ({ ...d, percent: 0 }))

  return (
    // Mobile: avoid min-w-0 + flex-1 on the legend column — WebKit/Capacitor can shrink it to ~0 width.
    <div className="w-full flex flex-col gap-6 md:flex-row md:flex-wrap md:gap-8 md:items-start md:min-w-0">
      {/* Clip SVG overflow (labels used to bleed into the card above on WebKit / Capacitor). */}
      <div
        className="w-full shrink-0 relative overflow-hidden flex justify-center h-[176px] md:h-[220px] md:w-auto md:flex-1 md:min-w-[160px] md:max-w-[280px]"
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <Pie
              data={dataWithPercent}
              cx="50%"
              cy="50%"
              labelLine={false}
              outerRadius={PIE_OUTER_RADIUS_PIXELS}
              innerRadius={0}
              fill="#8884d8"
              dataKey="value"
              stroke="transparent"
              isAnimationActive={false}
            >
              {dataWithPercent.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getCategoryColor(entry.color)} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="w-full max-w-full shrink-0 border-t border-dark-700/80 pt-4 md:flex-1 md:min-w-0 md:border-t-0 md:pt-0 md:max-w-none">
        <p className="text-xs font-medium text-dark-500 uppercase tracking-wide mb-3">
          Valores por categoria
        </p>
        <div className="w-full max-w-full rounded-xl bg-dark-800/60 border border-dark-700/60 p-3 min-h-0 max-h-[55vh] sm:max-h-[360px] overflow-y-auto overscroll-contain touch-pan-y [-webkit-overflow-scrolling:touch] box-border">
          <ul className="flex flex-col divide-y divide-dark-700/50">
            {dataWithPercent.map((entry) => (
              <li
                key={entry.id}
                className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0 text-sm min-w-0"
              >
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 mt-1.5"
                    style={{ backgroundColor: getCategoryColor(entry.color) }}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <span className="text-dark-200 break-words block leading-snug">{entry.name}</span>
                    <span className="text-[11px] text-dark-500 tabular-nums">
                      {(entry.percent * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
                <span className="text-white font-medium shrink-0 text-right tabular-nums whitespace-nowrap self-start pt-0.5">
                  {formatCurrency(entry.value)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
