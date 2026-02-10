import { useState } from 'react'
import { Plus, Target, Archive, CheckCircle } from 'lucide-react'
import { useGoals } from '../contexts/GoalsContext'
import GoalCard from '../components/goals/GoalCard'
import Loading from '../components/ui/Loading'
import CurrencyInput from '../components/ui/CurrencyInput'

const GOAL_TYPES = [
  { value: 'saving', label: 'Economia', description: 'Juntar um valor específico' },
  { value: 'reduction', label: 'Redução', description: 'Reduzir gastos em uma área' },
  { value: 'payment', label: 'Pagamento', description: 'Quitar uma dívida ou conta' },
  { value: 'investment', label: 'Investimento', description: 'Investir um valor por mês' }
]

const GOAL_COLORS = [
  { value: 'violet', label: 'Roxo', class: 'bg-violet-500' },
  { value: 'emerald', label: 'Verde', class: 'bg-emerald-500' },
  { value: 'blue', label: 'Azul', class: 'bg-blue-500' },
  { value: 'orange', label: 'Laranja', class: 'bg-orange-500' },
  { value: 'red', label: 'Vermelho', class: 'bg-red-500' },
  { value: 'pink', label: 'Rosa', class: 'bg-pink-500' }
]

export default function Goals() {
  const {
    activeGoals,
    completedGoals,
    archivedGoals,
    loading,
    error,
    addGoal,
    updateGoal,
    updateGoalProgress,
    deleteGoal,
    archiveGoal,
    getProgress,
    getDaysRemaining
  } = useGoals()

  const [showModal, setShowModal] = useState(false)
  const [editingGoal, setEditingGoal] = useState(null)
  const [showProgressModal, setShowProgressModal] = useState(false)
  const [progressGoal, setProgressGoal] = useState(null)
  const [activeTab, setActiveTab] = useState('active')
  const [saving, setSaving] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    type: 'saving',
    targetAmount: null,
    currentAmount: null,
    deadline: '',
    color: 'violet'
  })
  const [progressAmount, setProgressAmount] = useState(null)

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      type: 'saving',
      targetAmount: null,
      currentAmount: null,
      deadline: '',
      color: 'violet'
    })
    setEditingGoal(null)
  }

  // Abrir modal para nova meta
  const handleAddNew = () => {
    resetForm()
    setShowModal(true)
  }

  // Abrir modal para editar
  const handleEdit = (goal) => {
    setFormData({
      name: goal.name,
      type: goal.type,
      targetAmount: goal.targetAmount,
      currentAmount: goal.currentAmount,
      deadline: goal.deadline ? new Date(goal.deadline).toISOString().split('T')[0] : '',
      color: goal.color
    })
    setEditingGoal(goal)
    setShowModal(true)
  }

  // Salvar meta
  const handleSave = async (e) => {
    e.preventDefault()
    if (!formData.name.trim() || !formData.targetAmount) return

    setSaving(true)
    try {
      const data = {
        name: formData.name.trim(),
        type: formData.type,
        targetAmount: formData.targetAmount,
        currentAmount: formData.currentAmount || 0,
        deadline: formData.deadline ? new Date(formData.deadline) : null,
        color: formData.color
      }

      if (editingGoal) {
        await updateGoal(editingGoal.id, data)
      } else {
        await addGoal(data)
      }

      setShowModal(false)
      resetForm()
    } catch (err) {
      console.error('Erro ao salvar meta:', err)
    } finally {
      setSaving(false)
    }
  }

  // Abrir modal de progresso
  const handleUpdateProgress = (goal) => {
    setProgressGoal(goal)
    setProgressAmount(goal.currentAmount)
    setShowProgressModal(true)
  }

  // Salvar progresso
  const handleSaveProgress = async (e) => {
    e.preventDefault()
    if (!progressGoal) return

    const newAmount = progressAmount || 0

    setSaving(true)
    try {
      await updateGoalProgress(progressGoal.id, newAmount)
      setShowProgressModal(false)
      setProgressGoal(null)
    } catch (err) {
      console.error('Erro ao atualizar progresso:', err)
    } finally {
      setSaving(false)
    }
  }

  // Confirmar exclusão
  const handleDelete = async (id) => {
    if (window.confirm('Tem certeza que deseja excluir esta meta?')) {
      try {
        await deleteGoal(id)
      } catch (err) {
        console.error('Erro ao excluir meta:', err)
      }
    }
  }

  // Arquivar meta
  const handleArchive = async (id) => {
    try {
      await archiveGoal(id)
    } catch (err) {
      console.error('Erro ao arquivar meta:', err)
    }
  }

  // Obter metas baseado na tab ativa
  const getCurrentGoals = () => {
    switch (activeTab) {
      case 'completed':
        return completedGoals
      case 'archived':
        return archivedGoals
      default:
        return activeGoals
    }
  }

  if (loading) {
    return <Loading text="Carregando metas..." />
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-400">{error}</p>
      </div>
    )
  }

  const currentGoals = getCurrentGoals()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Metas</h1>
          <p className="text-sm text-dark-400">
            {activeGoals.length} ativa{activeGoals.length !== 1 ? 's' : ''}
            {completedGoals.length > 0 && ` • ${completedGoals.length} concluída${completedGoals.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={handleAddNew}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-medium transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nova meta
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-dark-800 p-1 rounded-xl">
        <button
          onClick={() => setActiveTab('active')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'active'
              ? 'bg-violet-600 text-white'
              : 'text-dark-400 hover:text-white'
          }`}
        >
          <Target className="w-4 h-4" />
          Ativas ({activeGoals.length})
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'completed'
              ? 'bg-emerald-600 text-white'
              : 'text-dark-400 hover:text-white'
          }`}
        >
          <CheckCircle className="w-4 h-4" />
          Concluídas ({completedGoals.length})
        </button>
        <button
          onClick={() => setActiveTab('archived')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'archived'
              ? 'bg-dark-600 text-white'
              : 'text-dark-400 hover:text-white'
          }`}
        >
          <Archive className="w-4 h-4" />
          ({archivedGoals.length})
        </button>
      </div>

      {/* Lista de metas */}
      {currentGoals.length === 0 ? (
        <div className="text-center py-12">
          <Target className="w-16 h-16 text-dark-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">
            {activeTab === 'active' && 'Nenhuma meta ativa'}
            {activeTab === 'completed' && 'Nenhuma meta concluída'}
            {activeTab === 'archived' && 'Nenhuma meta arquivada'}
          </h3>
          <p className="text-dark-400 mb-4">
            {activeTab === 'active' && 'Crie sua primeira meta financeira'}
          </p>
          {activeTab === 'active' && (
            <button
              onClick={handleAddNew}
              className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-medium transition-colors"
            >
              <Plus className="w-5 h-5" />
              Criar meta
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {currentGoals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              progress={getProgress(goal)}
              daysRemaining={getDaysRemaining(goal)}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onArchive={handleArchive}
              onUpdateProgress={activeTab === 'active' ? handleUpdateProgress : undefined}
            />
          ))}
        </div>
      )}

      {/* Modal de criar/editar meta */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-md bg-dark-900 rounded-2xl shadow-xl">
            <div className="p-4 border-b border-dark-700">
              <h2 className="text-lg font-semibold text-white">
                {editingGoal ? 'Editar meta' : 'Nova meta'}
              </h2>
            </div>

            <form onSubmit={handleSave} className="p-4 space-y-4">
              {/* Nome */}
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1">
                  Nome da meta
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Reserva de emergência"
                  className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:border-violet-500"
                  required
                />
              </div>

              {/* Tipo */}
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1">
                  Tipo de meta
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-xl text-white focus:outline-none focus:border-violet-500"
                >
                  {GOAL_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label} - {type.description}
                    </option>
                  ))}
                </select>
              </div>

              {/* Valores */}
              <div className="grid grid-cols-2 gap-4">
                <CurrencyInput
                  label="Valor alvo"
                  value={formData.targetAmount}
                  onChange={(val) => setFormData({ ...formData, targetAmount: val })}
                  required
                />
                <CurrencyInput
                  label="Valor atual"
                  value={formData.currentAmount}
                  onChange={(val) => setFormData({ ...formData, currentAmount: val })}
                />
              </div>

              {/* Deadline */}
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1">
                  Data limite (opcional)
                </label>
                <input
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                  className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-xl text-white focus:outline-none focus:border-violet-500"
                />
              </div>

              {/* Cor */}
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  Cor
                </label>
                <div className="flex gap-2">
                  {GOAL_COLORS.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, color: color.value })}
                      className={`w-8 h-8 rounded-full ${color.class} transition-transform ${
                        formData.color === color.value
                          ? 'ring-2 ring-white ring-offset-2 ring-offset-dark-900 scale-110'
                          : 'hover:scale-110'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Botões */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    resetForm()
                  }}
                  className="flex-1 py-2 text-dark-300 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : editingGoal ? 'Salvar' : 'Criar meta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de atualizar progresso */}
      {showProgressModal && progressGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowProgressModal(false)} />
          <div className="relative w-full max-w-sm bg-dark-900 rounded-2xl shadow-xl">
            <div className="p-4 border-b border-dark-700">
              <h2 className="text-lg font-semibold text-white">
                Atualizar progresso
              </h2>
              <p className="text-sm text-dark-400">{progressGoal.name}</p>
            </div>

            <form onSubmit={handleSaveProgress} className="p-4 space-y-4">
              <div>
                <CurrencyInput
                  label="Valor atual"
                  value={progressAmount}
                  onChange={setProgressAmount}
                  required
                  autoFocus
                />
                <p className="text-xs text-dark-500 mt-1">
                  Meta: R$ {progressGoal.targetAmount.toLocaleString('pt-BR')}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowProgressModal(false)}
                  className="flex-1 py-2 text-dark-300 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : 'Atualizar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
