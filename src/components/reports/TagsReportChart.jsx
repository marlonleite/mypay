import { useMemo } from 'react'
import { Hash } from 'lucide-react'

/**
 * Componente que mostra gastos agrupados por tags
 */
export default function TagsReportChart({ transactions, cardExpenses, formatCurrency }) {
  // Agrupar por tags
  const tagData = useMemo(() => {
    const data = {}

    // Processar transações (apenas despesas)
    transactions
      .filter(t => t.type === 'expense' && t.tags && t.tags.length > 0)
      .forEach(t => {
        t.tags.forEach(tag => {
          if (!data[tag]) {
            data[tag] = { name: tag, value: 0, count: 0 }
          }
          data[tag].value += t.amount || 0
          data[tag].count += 1
        })
      })

    // Processar despesas de cartão
    cardExpenses
      .filter(e => e.tags && e.tags.length > 0)
      .forEach(e => {
        e.tags.forEach(tag => {
          if (!data[tag]) {
            data[tag] = { name: tag, value: 0, count: 0 }
          }
          data[tag].value += e.amount || 0
          data[tag].count += 1
        })
      })

    // Converter para array e ordenar por valor
    return Object.values(data).sort((a, b) => b.value - a.value)
  }, [transactions, cardExpenses])

  // Calcular total para percentuais
  const total = tagData.reduce((sum, t) => sum + t.value, 0)

  // Cores para as barras
  const colors = [
    'bg-violet-500',
    'bg-blue-500',
    'bg-emerald-500',
    'bg-orange-500',
    'bg-pink-500',
    'bg-yellow-500',
    'bg-red-500',
    'bg-cyan-500'
  ]

  if (tagData.length === 0) {
    return (
      <div className="text-center py-8">
        <Hash className="w-10 h-10 text-dark-600 mx-auto mb-2" />
        <p className="text-sm text-dark-400">Nenhuma tag encontrada</p>
        <p className="text-xs text-dark-500 mt-1">
          Adicione tags às suas transações para ver este relatório
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {tagData.slice(0, 10).map((tag, index) => {
        const percentage = total > 0 ? Math.round((tag.value / total) * 100) : 0
        const colorClass = colors[index % colors.length]

        return (
          <div key={tag.name} className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${colorClass}`} />
                <span className="text-sm text-white">#{tag.name}</span>
                <span className="text-xs text-dark-500">({tag.count})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-dark-400">{percentage}%</span>
                <span className="text-sm text-white font-medium">
                  {formatCurrency(tag.value)}
                </span>
              </div>
            </div>
            <div className="h-1.5 bg-dark-700 rounded-full overflow-hidden">
              <div
                className={`h-full ${colorClass} transition-all duration-500`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        )
      })}

      {tagData.length > 10 && (
        <p className="text-xs text-dark-500 text-center pt-2">
          +{tagData.length - 10} outras tags
        </p>
      )}

      {/* Total */}
      <div className="pt-3 mt-3 border-t border-dark-700 flex items-center justify-between">
        <span className="text-sm text-dark-400">Total com tags</span>
        <span className="text-sm text-white font-bold">{formatCurrency(total)}</span>
      </div>
    </div>
  )
}
