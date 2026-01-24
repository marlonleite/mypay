import { useState, useMemo } from 'react'
import {
  Plus,
  Target,
  Trash2,
  Edit2,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Copy,
  ChevronRight
} from 'lucide-react'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import MonthSelector from '../components/ui/MonthSelector'
import Loading from '../components/ui/Loading'
import EmptyState from '../components/ui/EmptyState'
import { useBudgets, useTransactions, useCategories } from '../hooks/useFirestore'
import { usePrivacy } from '../contexts/PrivacyContext'
import { MONTHS } from '../utils/constants'

export default function Budgets({ month, year, onMonthChange }) {
  const { formatCurrency } = usePrivacy()

  const {
    budgets,
    loading: loadingBudgets,
    addBudget,
    updateBudget,
    deleteBudget,
    copyFromPreviousMonth
  } = useBudgets(month, year)

  const { transactions, loading: loadingTransactions } = useTransactions(month, year)
  const { categories, loading: loadingCategories, getMainCategories } = useCategories()

  const [modalOpen, setModalOpen] = useState(false)
  const [editingBudget, setEditingBudget] = useState(null)
  const [saving, setSaving] = useState(false)
  const [copying, setCopying] = useState(false)
  const [error, setError] = useState(null)

  const [form, setForm] = useState({
    categoryId: '',
    amount: ''
  })

  // Categorias de despesa disponíveis (que ainda não têm orçamento)
  const availableCategories = useMemo(() => {
    const expenseCategories = getMainCategories('expense')
    const usedCategoryIds = budgets.map(b => b.categoryId)
    return expenseCategories.filter(c => !usedCategoryIds.includes(c.id))
  }, [categories, budgets])

  // Calcular gastos por categoria
  const spendingByCategory = useMemo(() => {
    const spending = {}
    transactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        const catId = t.category
        spending[catId] = (spending[catId] || 0) + (t.amount || 0)
      })
    return spending
  }, [transactions])

  // Calcular dados dos orçamentos com progresso
  const budgetsWithProgress = useMemo(() => {
    return budgets.map(budget => {
      const spent = spendingByCategory[budget.categoryId] || 0
      const percentage = budget.amount > 0 ? (spent / budget.amount) * 100 : 0
      const remaining = budget.amount - spent
      const category = categories.find(c => c.id === budget.categoryId)

      // Calcular previsão (baseado no dia do mês)
      const today = new Date()
      const currentDay = today.getDate()
      const daysInMonth = new Date(year, month + 1, 0).getDate()
      const dailyAverage = spent / currentDay
      const predicted = dailyAverage * daysInMonth

      return {
        ...budget,
        categoryName: category?.name || 'Categoria',
        categoryColor: category?.color || 'slate',
        spent,
        percentage: Math.min(percentage, 100),
        remaining,
        predicted,
        isOverBudget: spent > budget.amount,
        isNearLimit: percentage >= 80 && percentage < 100,
        predictedOverBudget: predicted > budget.amount
      }
    }).sort((a, b) => b.percentage - a.percentage)
  }, [budgets, spendingByCategory, categories, month, year])

  // Totais
  const totals = useMemo(() => {
    const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0)
    const totalSpent = budgetsWithProgress.reduce((sum, b) => sum + b.spent, 0)
    const totalRemaining = totalBudget - totalSpent
    const percentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0

    return { totalBudget, totalSpent, totalRemaining, percentage }
  }, [budgets, budgetsWithProgress])

  const loading = loadingBudgets || loadingTransactions || loadingCategories

  const openNewModal = () => {
    if (availableCategories.length === 0) {
      setError('Todas as categorias já possuem orçamento definido')
      return
    }
    setEditingBudget(null)
    setForm({
      categoryId: availableCategories[0]?.id || '',
      amount: ''
    })
    setError(null)
    setModalOpen(true)
  }

  const openEditModal = (budget) => {
    setEditingBudget(budget)
    setForm({
      categoryId: budget.categoryId,
      amount: budget.amount.toString()
    })
    setError(null)
    setModalOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.amount || parseFloat(form.amount) <= 0) {
      setError('Informe um valor válido')
      return
    }

    try {
      setSaving(true)
      setError(null)

      if (editingBudget) {
        await updateBudget(editingBudget.id, {
          amount: parseFloat(form.amount)
        })
      } else {
        await addBudget({
          categoryId: form.categoryId,
          amount: parseFloat(form.amount)
        })
      }

      setModalOpen(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Excluir este orçamento?')) return

    try {
      await deleteBudget(id)
    } catch (err) {
      console.error('Error deleting budget:', err)
    }
  }

  const handleCopyFromPrevious = async () => {
    try {
      setCopying(true)
      setError(null)
      const count = await copyFromPreviousMonth()
      alert(`${count} orçamento(s) copiado(s) do mês anterior`)
    } catch (err) {
      setError(err.message)
    } finally {
      setCopying(false)
    }
  }

  const getProgressColor = (budget) => {
    if (budget.isOverBudget) return 'bg-red-500'
    if (budget.isNearLimit) return 'bg-yellow-500'
    return 'bg-emerald-500'
  }

  const getStatusIcon = (budget) => {
    if (budget.isOverBudget) return <AlertTriangle className="w-4 h-4 text-red-400" />
    if (budget.isNearLimit) return <AlertTriangle className="w-4 h-4 text-yellow-400" />
    return <CheckCircle className="w-4 h-4 text-emerald-400" />
  }

  return (
    <div className="space-y-6">
      {/* Month Selector */}
      <MonthSelector
        month={month}
        year={year}
        onChange={onMonthChange}
      />

      {/* Header com total */}
      {budgets.length > 0 && (
        <Card className="!p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
                <Target className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <p className="text-xs text-dark-400">Total Orçado</p>
                <p className="text-lg font-bold text-white">{formatCurrency(totals.totalBudget)}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-dark-400">Gasto</p>
              <p className={`text-lg font-bold ${totals.totalSpent > totals.totalBudget ? 'text-red-400' : 'text-emerald-400'}`}>
                {formatCurrency(totals.totalSpent)}
              </p>
            </div>
          </div>

          {/* Barra de progresso total */}
          <div className="w-full h-2 bg-dark-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                totals.percentage > 100 ? 'bg-red-500' : totals.percentage >= 80 ? 'bg-yellow-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(totals.percentage, 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs">
            <span className="text-dark-400">{totals.percentage.toFixed(0)}% usado</span>
            <span className={totals.totalRemaining >= 0 ? 'text-emerald-400' : 'text-red-400'}>
              {totals.totalRemaining >= 0 ? 'Disponível: ' : 'Excedido: '}
              {formatCurrency(Math.abs(totals.totalRemaining))}
            </span>
          </div>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button onClick={openNewModal} icon={Plus} className="flex-1">
          Novo Orçamento
        </Button>
        {budgets.length === 0 && (
          <Button
            onClick={handleCopyFromPrevious}
            icon={Copy}
            variant="secondary"
            loading={copying}
            className="flex-1"
          >
            Copiar Anterior
          </Button>
        )}
      </div>

      {/* Error message */}
      {error && !modalOpen && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Budgets List */}
      {loading ? (
        <Loading />
      ) : budgets.length === 0 ? (
        <EmptyState
          icon={Target}
          title="Nenhum orçamento"
          description="Defina limites de gastos por categoria para controlar suas finanças"
          action={
            <Button onClick={openNewModal} icon={Plus}>
              Criar Orçamento
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {budgetsWithProgress.map((budget) => (
            <Card key={budget.id} className="!p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  {getStatusIcon(budget)}
                  <div>
                    <p className="text-white font-medium">{budget.categoryName}</p>
                    <p className="text-xs text-dark-400">
                      {formatCurrency(budget.spent)} de {formatCurrency(budget.amount)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(budget)}
                    className="p-1.5 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(budget.id)}
                    className="p-1.5 text-dark-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2 bg-dark-700 rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full transition-all duration-500 ${getProgressColor(budget)}`}
                  style={{ width: `${budget.percentage}%` }}
                />
              </div>

              <div className="flex justify-between text-xs">
                <span className={`${
                  budget.isOverBudget ? 'text-red-400' :
                  budget.isNearLimit ? 'text-yellow-400' :
                  'text-dark-400'
                }`}>
                  {budget.percentage.toFixed(0)}%
                  {budget.isOverBudget && ' - Excedido!'}
                  {budget.isNearLimit && !budget.isOverBudget && ' - Quase no limite'}
                </span>
                <span className={budget.remaining >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                  {budget.remaining >= 0 ? `Restam ${formatCurrency(budget.remaining)}` : `Excedido ${formatCurrency(Math.abs(budget.remaining))}`}
                </span>
              </div>

              {/* Prediction warning */}
              {budget.predictedOverBudget && !budget.isOverBudget && (
                <div className="mt-2 flex items-center gap-2 text-xs text-yellow-400 bg-yellow-500/10 px-2 py-1 rounded-lg">
                  <TrendingUp className="w-3 h-3" />
                  <span>Previsão: {formatCurrency(budget.predicted)} (pode exceder)</span>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingBudget ? 'Editar Orçamento' : 'Novo Orçamento'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          {!editingBudget && (
            <Select
              label="Categoria"
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              options={availableCategories.map(c => ({ value: c.id, label: c.name }))}
            />
          )}

          {editingBudget && (
            <div className="p-3 bg-dark-800 rounded-xl">
              <p className="text-xs text-dark-400">Categoria</p>
              <p className="text-white font-medium">{editingBudget.categoryName}</p>
            </div>
          )}

          <Input
            label="Limite Mensal"
            type="number"
            step="0.01"
            min="0"
            placeholder="0,00"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            required
          />

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setModalOpen(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              loading={saving}
              className="flex-1"
            >
              {editingBudget ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
