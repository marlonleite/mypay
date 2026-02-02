import { Target, TrendingDown, CreditCard, PiggyBank, Calendar, MoreHorizontal, Edit, Trash2, Archive } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { usePrivacy } from '../../contexts/PrivacyContext'

const GOAL_ICONS = {
  Target,
  TrendingDown,
  CreditCard,
  PiggyBank
}

const GOAL_TYPE_LABELS = {
  saving: 'Economia',
  reduction: 'Redução',
  payment: 'Pagamento',
  investment: 'Investimento'
}

const GOAL_COLORS = {
  violet: 'bg-violet-500',
  emerald: 'bg-emerald-500',
  blue: 'bg-blue-500',
  orange: 'bg-orange-500',
  red: 'bg-red-500',
  pink: 'bg-pink-500'
}

export default function GoalCard({
  goal,
  progress,
  daysRemaining,
  onEdit,
  onDelete,
  onArchive,
  onUpdateProgress
}) {
  const { formatCurrencyPrivate } = usePrivacy()
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef(null)

  const Icon = GOAL_ICONS[goal.icon] || Target
  const colorClass = GOAL_COLORS[goal.color] || GOAL_COLORS.violet
  const remaining = goal.targetAmount - goal.currentAmount

  // Fechar menu ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Status visual baseado no progresso
  const getProgressColor = () => {
    if (progress >= 100) return 'bg-emerald-500'
    if (progress >= 80) return 'bg-emerald-500'
    if (progress >= 50) return 'bg-yellow-500'
    return 'bg-violet-500'
  }

  // Texto de status
  const getStatusText = () => {
    if (progress >= 100) return 'Concluída!'
    if (daysRemaining !== null) {
      if (daysRemaining < 0) return `${Math.abs(daysRemaining)} dias atrasada`
      if (daysRemaining === 0) return 'Vence hoje!'
      if (daysRemaining <= 7) return `${daysRemaining} dias restantes`
    }
    return `Falta ${formatCurrencyPrivate(remaining)}`
  }

  return (
    <div className="bg-dark-800 rounded-xl p-4 border border-dark-700">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full ${colorClass} flex items-center justify-center`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-medium text-white">{goal.name}</h3>
            <span className="text-xs text-dark-400">
              {GOAL_TYPE_LABELS[goal.type]}
            </span>
          </div>
        </div>

        {/* Menu de ações */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 text-dark-400 hover:text-white rounded-lg hover:bg-dark-700 transition-colors"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-full mt-1 bg-dark-900 rounded-xl shadow-lg py-1 min-w-[140px] border border-dark-700 z-10">
              <button
                onClick={() => {
                  onEdit?.(goal)
                  setShowMenu(false)
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-dark-300 hover:bg-dark-800 hover:text-white transition-colors"
              >
                <Edit className="w-4 h-4" />
                Editar
              </button>
              <button
                onClick={() => {
                  onArchive?.(goal.id)
                  setShowMenu(false)
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-dark-300 hover:bg-dark-800 hover:text-white transition-colors"
              >
                <Archive className="w-4 h-4" />
                Arquivar
              </button>
              <button
                onClick={() => {
                  onDelete?.(goal.id)
                  setShowMenu(false)
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-dark-800 hover:text-red-300 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Excluir
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-dark-400">
            {formatCurrencyPrivate(goal.currentAmount)}
          </span>
          <span className="text-dark-400">
            {formatCurrencyPrivate(goal.targetAmount)}
          </span>
        </div>
        <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${getProgressColor()} transition-all duration-500`}
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${
            progress >= 100 ? 'text-emerald-500' :
            daysRemaining !== null && daysRemaining < 0 ? 'text-red-500' :
            'text-dark-300'
          }`}>
            {getStatusText()}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-dark-500">
          <span className="font-medium text-white">{progress}%</span>
          {goal.deadline && (
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>
                {new Date(goal.deadline).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'short'
                })}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Botão para atualizar progresso (se não estiver concluída) */}
      {progress < 100 && onUpdateProgress && (
        <button
          onClick={() => onUpdateProgress(goal)}
          className="w-full mt-3 py-2 text-sm text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 rounded-lg transition-colors"
        >
          Atualizar progresso
        </button>
      )}
    </div>
  )
}
