import { useState } from 'react'
import {
  Plus,
  Minus,
  ChevronRight,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Wallet,
  Target,
  Tag,
  ArrowLeftRight
} from 'lucide-react'
import {
  formatActivityDescription,
  getDataDiff,
  ACTIVITY_ACTIONS,
  ACTIVITY_ENTITIES
} from '../../services/activityService'
import { useAuth } from '../../contexts/AuthContext'
import { formatCurrency } from '../../utils/helpers'

// Ícones por tipo de entidade
const ENTITY_ICONS = {
  [ACTIVITY_ENTITIES.TRANSACTION]: {
    income: TrendingUp,
    expense: TrendingDown,
    default: Wallet
  },
  [ACTIVITY_ENTITIES.CARD_EXPENSE]: CreditCard,
  [ACTIVITY_ENTITIES.ACCOUNT]: Wallet,
  [ACTIVITY_ENTITIES.CARD]: CreditCard,
  [ACTIVITY_ENTITIES.CATEGORY]: Tag,
  [ACTIVITY_ENTITIES.GOAL]: Target,
  [ACTIVITY_ENTITIES.TRANSFER]: ArrowLeftRight
}

// Cores por tipo de ação
const ACTION_COLORS = {
  [ACTIVITY_ACTIONS.CREATE]: 'text-emerald-400',
  [ACTIVITY_ACTIONS.UPDATE]: 'text-orange-400',
  [ACTIVITY_ACTIONS.DELETE]: 'text-red-400'
}

export default function ActivityItem({ activity, accounts = [], categories = [] }) {
  const { user } = useAuth()
  const [expanded, setExpanded] = useState(false)

  const description = formatActivityDescription(activity)
  const actionColor = ACTION_COLORS[activity.action] || 'text-violet-400'

  // Determinar ícone
  let IconComponent = Wallet
  if (activity.entityType === ACTIVITY_ENTITIES.TRANSACTION && activity.entitySubtype) {
    IconComponent = ENTITY_ICONS[ACTIVITY_ENTITIES.TRANSACTION][activity.entitySubtype]
      || ENTITY_ICONS[ACTIVITY_ENTITIES.TRANSACTION].default
  } else {
    IconComponent = ENTITY_ICONS[activity.entityType] || Wallet
  }

  // Formatar hora
  const time = activity.createdAt.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  })

  // Obter diferenças para updates
  const diff = activity.action === ACTIVITY_ACTIONS.UPDATE
    ? getDataDiff(activity.previousData, activity.data)
    : null

  // Função para formatar valores
  const formatValue = (field, value) => {
    if (value === undefined || value === null) return '-'

    switch (field) {
      case 'amount':
        return formatCurrency(value)
      case 'paid':
        return value ? 'Sim' : 'Não'
      case 'date':
        if (value instanceof Date) {
          return value.toLocaleDateString('pt-BR')
        }
        return new Date(value).toLocaleDateString('pt-BR')
      case 'accountId': {
        const account = accounts.find(a => a.id === value)
        return account?.name || value
      }
      case 'category': {
        const category = categories.find(c => c.id === value)
        return category?.name || value
      }
      default:
        return String(value)
    }
  }

  const hasDetails = activity.data || diff

  return (
    <div className="bg-dark-800/50 rounded-xl border border-dark-700/50 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => hasDetails && setExpanded(!expanded)}
        disabled={!hasDetails}
        className={`w-full p-4 flex items-center gap-3 text-left ${
          hasDetails ? 'cursor-pointer hover:bg-dark-800/80' : 'cursor-default'
        } transition-colors`}
      >
        {/* Avatar/Icon */}
        <div className="flex-shrink-0">
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName}
              className="w-10 h-10 rounded-full"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center">
              <IconComponent className="w-5 h-5 text-violet-400" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white">
            <span className="font-medium">{user?.displayName || 'Você'}</span>
            {' '}
            <span className={actionColor}>{description}</span>
            {' '}
            <span className="text-dark-400">{time}</span>
          </p>
          <p className="text-sm text-dark-400 truncate">
            {activity.entityName}
          </p>
        </div>

        {/* Expand button */}
        {hasDetails && (
          <div className="flex-shrink-0">
            {expanded ? (
              <Minus className="w-5 h-5 text-dark-400" />
            ) : (
              <Plus className="w-5 h-5 text-dark-400" />
            )}
          </div>
        )}
      </button>

      {/* Expanded details */}
      {expanded && hasDetails && (
        <div className="px-4 pb-4">
          {/* Update: Before/After comparison */}
          {activity.action === ACTIVITY_ACTIONS.UPDATE && diff && (
            <div className="grid grid-cols-2 gap-3">
              {/* Before */}
              <div className="bg-dark-900 rounded-lg overflow-hidden">
                <div className="px-3 py-1.5 bg-red-500/20 text-red-400 text-xs font-medium text-center">
                  ANTES DA ALTERAÇÃO
                </div>
                <div className="p-3 space-y-1.5">
                  {diff.map(change => (
                    <div key={change.field} className="flex justify-between text-sm">
                      <span className="text-dark-400">{change.label}:</span>
                      <span className="text-red-400 truncate ml-2">
                        {formatValue(change.field, change.before)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* After */}
              <div className="bg-dark-900 rounded-lg overflow-hidden">
                <div className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 text-xs font-medium text-center">
                  DEPOIS DA ALTERAÇÃO
                </div>
                <div className="p-3 space-y-1.5">
                  {diff.map(change => (
                    <div key={change.field} className="flex justify-between text-sm">
                      <span className="text-dark-400">{change.label}:</span>
                      <span className="text-emerald-400 truncate ml-2">
                        {formatValue(change.field, change.after)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Create/Delete: Show data */}
          {(activity.action === ACTIVITY_ACTIONS.CREATE || activity.action === ACTIVITY_ACTIONS.DELETE) && activity.data && (
            <div className="bg-dark-900 rounded-lg overflow-hidden">
              <div className={`px-3 py-1.5 text-xs font-medium text-center ${
                activity.action === ACTIVITY_ACTIONS.CREATE
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-red-500/20 text-red-400'
              }`}>
                INFORMAÇÕES
              </div>
              <div className="p-3 space-y-1.5">
                {activity.data.description && (
                  <div className="flex justify-between text-sm">
                    <span className="text-dark-400">Descrição:</span>
                    <span className="text-white truncate ml-2">{activity.data.description}</span>
                  </div>
                )}
                {activity.data.date && (
                  <div className="flex justify-between text-sm">
                    <span className="text-dark-400">Data:</span>
                    <span className="text-white">
                      {new Date(activity.data.date).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                )}
                {activity.data.amount !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span className="text-dark-400">Valor:</span>
                    <span className={activity.entitySubtype === 'income' ? 'text-emerald-400' : 'text-red-400'}>
                      {formatCurrency(activity.data.amount)}
                    </span>
                  </div>
                )}
                {activity.data.paid !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span className="text-dark-400">Pago:</span>
                    <span className="text-white">{activity.data.paid ? 'Sim' : 'Não'}</span>
                  </div>
                )}
                {activity.data.accountId && (
                  <div className="flex justify-between text-sm">
                    <span className="text-dark-400">Conta:</span>
                    <span className="text-white">
                      {accounts.find(a => a.id === activity.data.accountId)?.name || activity.data.accountId}
                    </span>
                  </div>
                )}
                {activity.data.category && (
                  <div className="flex justify-between text-sm">
                    <span className="text-dark-400">Categoria:</span>
                    <span className="text-white">
                      {categories.find(c => c.id === activity.data.category)?.name || activity.data.category}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
