import { Target, ChevronRight, Plus } from 'lucide-react'
import { useGoals } from '../../contexts/GoalsContext'
import { usePrivacy } from '../../contexts/PrivacyContext'

/**
 * Widget compacto de metas para o Dashboard
 * Mostra até 3 metas ativas com progresso
 */
export default function GoalTracker({ onViewAll, onAddGoal }) {
  const { activeGoals, getProgress, loading } = useGoals()
  const { formatCurrencyPrivate } = usePrivacy()

  // Pegar as 3 metas mais próximas de conclusão ou com deadline mais próximo
  const topGoals = activeGoals
    .sort((a, b) => {
      // Priorizar metas com maior progresso
      const progressA = getProgress(a)
      const progressB = getProgress(b)
      return progressB - progressA
    })
    .slice(0, 3)

  if (loading) {
    return (
      <div className="bg-dark-800 rounded-xl p-4 border border-dark-700">
        <div className="animate-pulse">
          <div className="h-5 bg-dark-700 rounded w-1/3 mb-4" />
          <div className="space-y-3">
            <div className="h-12 bg-dark-700 rounded" />
            <div className="h-12 bg-dark-700 rounded" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-dark-800 rounded-xl p-4 border border-dark-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-violet-500" />
          <h3 className="font-medium text-white">Metas</h3>
        </div>
        {activeGoals.length > 0 && (
          <button
            onClick={onViewAll}
            className="flex items-center gap-1 text-sm text-violet-400 hover:text-violet-300 transition-colors"
          >
            Ver todas
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Lista de metas ou estado vazio */}
      {topGoals.length === 0 ? (
        <div className="text-center py-4">
          <Target className="w-10 h-10 text-dark-600 mx-auto mb-2" />
          <p className="text-sm text-dark-400 mb-3">
            Nenhuma meta definida
          </p>
          <button
            onClick={onAddGoal}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Criar primeira meta
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {topGoals.map((goal) => {
            const progress = getProgress(goal)
            const remaining = goal.targetAmount - goal.currentAmount

            return (
              <div key={goal.id} className="group">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-white truncate flex-1 mr-2">
                    {goal.name}
                  </span>
                  <span className="text-xs text-dark-400 flex-shrink-0">
                    {progress}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 bg-dark-700 rounded-full overflow-hidden mb-1">
                  <div
                    className={`h-full transition-all duration-500 ${
                      progress >= 100 ? 'bg-emerald-500' :
                      progress >= 80 ? 'bg-emerald-500' :
                      progress >= 50 ? 'bg-yellow-500' :
                      'bg-violet-500'
                    }`}
                    style={{ width: `${Math.min(100, progress)}%` }}
                  />
                </div>

                {/* Info */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-dark-500">
                    {formatCurrencyPrivate(goal.currentAmount)} / {formatCurrencyPrivate(goal.targetAmount)}
                  </span>
                  {progress < 100 && (
                    <span className="text-dark-500">
                      Falta {formatCurrencyPrivate(remaining)}
                    </span>
                  )}
                  {progress >= 100 && (
                    <span className="text-emerald-500">Concluída!</span>
                  )}
                </div>
              </div>
            )
          })}

          {/* Botão para adicionar mais */}
          {activeGoals.length < 5 && (
            <button
              onClick={onAddGoal}
              className="w-full flex items-center justify-center gap-2 py-2 text-sm text-dark-400 hover:text-violet-400 hover:bg-dark-700 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nova meta
            </button>
          )}
        </div>
      )}
    </div>
  )
}
