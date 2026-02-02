import { useState, useMemo } from 'react'
import {
  History,
  Filter,
  Loader2,
  AlertCircle,
  Calendar
} from 'lucide-react'
import Card from '../components/ui/Card'
import Loading from '../components/ui/Loading'
import EmptyState from '../components/ui/EmptyState'
import ActivityItem from '../components/activities/ActivityItem'
import { useActivities } from '../hooks/useActivities'
import { useAccounts, useCategories } from '../hooks/useFirestore'

const DAYS_OPTIONS = [
  { value: 30, label: 'Últimos 30 dias' },
  { value: 60, label: 'Últimos 60 dias' },
  { value: 90, label: 'Últimos 90 dias' }
]

export default function Activities() {
  const [filters, setFilters] = useState({
    accountId: null,
    categoryId: null,
    daysBack: 90
  })
  const [showFilters, setShowFilters] = useState(false)

  const { groupedActivities, loading, error, refresh } = useActivities(filters)
  const { accounts } = useAccounts()
  const { categories } = useCategories()

  const dateGroups = useMemo(() => Object.keys(groupedActivities), [groupedActivities])

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value || null
    }))
  }

  const clearFilters = () => {
    setFilters({
      accountId: null,
      categoryId: null,
      daysBack: 90
    })
  }

  const hasActiveFilters = filters.accountId || filters.categoryId || filters.daysBack !== 90

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-dark-800 rounded-xl flex items-center justify-center">
            <History className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Registro de Atividades</h1>
            <p className="text-sm text-dark-400">
              Histórico de ações dos últimos {filters.daysBack} dias
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`p-2.5 rounded-xl transition-colors ${
            showFilters || hasActiveFilters
              ? 'bg-violet-500/20 text-violet-400'
              : 'bg-dark-800 text-dark-400 hover:text-white'
          }`}
        >
          <Filter className="w-5 h-5" />
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-dark-300">Filtros</h3>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-violet-400 hover:text-violet-300"
                >
                  Limpar filtros
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Period */}
              <div>
                <label className="block text-xs text-dark-400 mb-1.5">
                  <Calendar className="w-3.5 h-3.5 inline mr-1" />
                  Período
                </label>
                <select
                  value={filters.daysBack}
                  onChange={(e) => handleFilterChange('daysBack', parseInt(e.target.value))}
                  className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-xl text-white text-sm focus:outline-none focus:border-violet-500"
                >
                  {DAYS_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Account filter */}
              <div>
                <label className="block text-xs text-dark-400 mb-1.5">Conta</label>
                <select
                  value={filters.accountId || ''}
                  onChange={(e) => handleFilterChange('accountId', e.target.value)}
                  className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-xl text-white text-sm focus:outline-none focus:border-violet-500"
                >
                  <option value="">Todas as contas</option>
                  {accounts.map(account => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category filter */}
              <div>
                <label className="block text-xs text-dark-400 mb-1.5">Categoria</label>
                <select
                  value={filters.categoryId || ''}
                  onChange={(e) => handleFilterChange('categoryId', e.target.value)}
                  className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-xl text-white text-sm focus:outline-none focus:border-violet-500"
                >
                  <option value="">Todas as categorias</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Content */}
      {loading ? (
        <Loading />
      ) : error ? (
        <Card>
          <div className="flex items-center gap-3 text-red-400">
            <AlertCircle className="w-5 h-5" />
            <p>Erro ao carregar atividades: {error}</p>
          </div>
        </Card>
      ) : dateGroups.length === 0 ? (
        <EmptyState
          icon={History}
          title="Nenhuma atividade"
          description="Suas ações serão registradas aqui automaticamente"
        />
      ) : (
        <div className="space-y-6">
          {dateGroups.map(dateKey => (
            <div key={dateKey}>
              {/* Date header */}
              <h2 className="text-sm font-medium text-dark-400 mb-3">
                {dateKey}
              </h2>

              {/* Activities for this date */}
              <div className="space-y-2">
                {groupedActivities[dateKey].map(activity => (
                  <ActivityItem
                    key={activity.id}
                    activity={activity}
                    accounts={accounts}
                    categories={categories}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
