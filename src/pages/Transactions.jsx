import { useState, useMemo } from 'react'
import {
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Trash2,
  Edit2,
  Search,
  Receipt
} from 'lucide-react'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import MonthSelector from '../components/ui/MonthSelector'
import Loading from '../components/ui/Loading'
import EmptyState from '../components/ui/EmptyState'
import { useTransactions } from '../hooks/useFirestore'
import { formatCurrency, formatDate, formatDateForInput, groupByDate } from '../utils/helpers'
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, TRANSACTION_TYPES } from '../utils/constants'

export default function Transactions({ month, year, onMonthChange }) {
  const {
    transactions,
    loading,
    addTransaction,
    updateTransaction,
    deleteTransaction
  } = useTransactions(month, year)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState(null)
  const [transactionType, setTransactionType] = useState(TRANSACTION_TYPES.EXPENSE)
  const [searchTerm, setSearchTerm] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(null)

  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: '',
    date: formatDateForInput(new Date())
  })

  // Filtrar transações
  const filteredTransactions = useMemo(() => {
    if (!searchTerm) return transactions
    const term = searchTerm.toLowerCase()
    return transactions.filter(t =>
      t.description?.toLowerCase().includes(term) ||
      t.category?.toLowerCase().includes(term)
    )
  }, [transactions, searchTerm])

  // Agrupar por data
  const groupedTransactions = useMemo(() => {
    return groupByDate(filteredTransactions)
  }, [filteredTransactions])

  const categories = transactionType === TRANSACTION_TYPES.INCOME
    ? INCOME_CATEGORIES
    : EXPENSE_CATEGORIES

  const getCategoryName = (categoryId, type) => {
    const cats = type === TRANSACTION_TYPES.INCOME ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
    return cats.find(c => c.id === categoryId)?.name || categoryId
  }

  const openNewModal = (type) => {
    setTransactionType(type)
    setEditingTransaction(null)
    setFormData({
      description: '',
      amount: '',
      category: categories[0]?.id || '',
      date: formatDateForInput(new Date())
    })
    setModalOpen(true)
  }

  const openEditModal = (transaction) => {
    setTransactionType(transaction.type)
    setEditingTransaction(transaction)
    setFormData({
      description: transaction.description,
      amount: transaction.amount.toString(),
      category: transaction.category,
      date: formatDateForInput(transaction.date)
    })
    setModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.description || !formData.amount || !formData.date) return

    try {
      setSaving(true)
      const data = {
        description: formData.description,
        amount: parseFloat(formData.amount),
        category: formData.category,
        date: formData.date,
        type: transactionType
      }

      if (editingTransaction) {
        await updateTransaction(editingTransaction.id, data)
      } else {
        await addTransaction(data)
      }

      setModalOpen(false)
    } catch (error) {
      console.error('Error saving transaction:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      setDeleting(id)
      await deleteTransaction(id)
    } catch (error) {
      console.error('Error deleting transaction:', error)
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Month Selector */}
      <MonthSelector
        month={month}
        year={year}
        onChange={onMonthChange}
      />

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          onClick={() => openNewModal(TRANSACTION_TYPES.INCOME)}
          variant="success"
          icon={ArrowUpRight}
          className="flex-1"
        >
          Receita
        </Button>
        <Button
          onClick={() => openNewModal(TRANSACTION_TYPES.EXPENSE)}
          variant="danger"
          icon={ArrowDownRight}
          className="flex-1"
        >
          Despesa
        </Button>
      </div>

      {/* Search */}
      <Input
        type="text"
        placeholder="Buscar lançamentos..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        icon={Search}
      />

      {/* Transactions List */}
      {loading ? (
        <Loading />
      ) : Object.keys(groupedTransactions).length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Nenhum lançamento"
          description="Adicione uma receita ou despesa para começar"
          action={
            <Button onClick={() => openNewModal(TRANSACTION_TYPES.EXPENSE)} icon={Plus}>
              Novo Lançamento
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedTransactions).map(([date, items]) => (
            <div key={date}>
              <p className="text-xs text-dark-400 font-medium mb-2 px-1">
                {date}
              </p>
              <Card className="divide-y divide-dark-700/50">
                {items.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`p-2 rounded-lg flex-shrink-0 ${
                        transaction.type === TRANSACTION_TYPES.INCOME
                          ? 'bg-emerald-500/20'
                          : 'bg-red-500/20'
                      }`}>
                        {transaction.type === TRANSACTION_TYPES.INCOME ? (
                          <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <ArrowDownRight className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-white font-medium truncate">
                          {transaction.description}
                        </p>
                        <p className="text-xs text-dark-400">
                          {getCategoryName(transaction.category, transaction.type)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-semibold ${
                        transaction.type === TRANSACTION_TYPES.INCOME
                          ? 'text-emerald-400'
                          : 'text-red-400'
                      }`}>
                        {transaction.type === TRANSACTION_TYPES.INCOME ? '+' : '-'}
                        {formatCurrency(transaction.amount)}
                      </p>

                      <div className="flex gap-1">
                        <button
                          onClick={() => openEditModal(transaction)}
                          className="p-1.5 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(transaction.id)}
                          disabled={deleting === transaction.id}
                          className="p-1.5 text-dark-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </Card>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingTransaction
          ? `Editar ${transactionType === TRANSACTION_TYPES.INCOME ? 'Receita' : 'Despesa'}`
          : `Nova ${transactionType === TRANSACTION_TYPES.INCOME ? 'Receita' : 'Despesa'}`
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type Toggle */}
          {!editingTransaction && (
            <div className="flex gap-2 p-1 bg-dark-800 rounded-xl">
              <button
                type="button"
                onClick={() => setTransactionType(TRANSACTION_TYPES.INCOME)}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                  transactionType === TRANSACTION_TYPES.INCOME
                    ? 'bg-emerald-600 text-white'
                    : 'text-dark-400 hover:text-white'
                }`}
              >
                Receita
              </button>
              <button
                type="button"
                onClick={() => setTransactionType(TRANSACTION_TYPES.EXPENSE)}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                  transactionType === TRANSACTION_TYPES.EXPENSE
                    ? 'bg-red-600 text-white'
                    : 'text-dark-400 hover:text-white'
                }`}
              >
                Despesa
              </button>
            </div>
          )}

          <Input
            label="Descrição"
            type="text"
            placeholder="Ex: Salário, Aluguel..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            required
          />

          <Input
            label="Valor"
            type="number"
            step="0.01"
            min="0"
            placeholder="0,00"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            required
          />

          <Select
            label="Categoria"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            options={categories.map(c => ({ value: c.id, label: c.name }))}
          />

          <Input
            label="Data"
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            required
          />

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
              variant={transactionType === TRANSACTION_TYPES.INCOME ? 'success' : 'danger'}
              loading={saving}
              className="flex-1"
            >
              {editingTransaction ? 'Salvar' : 'Adicionar'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
