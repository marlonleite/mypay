import { useState, useMemo } from 'react'
import {
  Plus,
  CreditCard,
  Trash2,
  Edit2,
  ChevronRight,
  Calendar,
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
import { useCards, useAllCardExpenses } from '../hooks/useFirestore'
import { formatCurrency, isDateInMonth } from '../utils/helpers'
import { CARD_COLORS, EXPENSE_CATEGORIES } from '../utils/constants'

export default function Cards({ month, year, onMonthChange }) {
  const {
    cards,
    loading: loadingCards,
    addCard,
    updateCard,
    deleteCard
  } = useCards()

  const { expenses: allExpenses, loading: loadingExpenses } = useAllCardExpenses()

  const [modalType, setModalType] = useState(null) // 'card', 'expense', 'details'
  const [selectedCard, setSelectedCard] = useState(null)
  const [editingItem, setEditingItem] = useState(null)
  const [saving, setSaving] = useState(false)

  const [cardForm, setCardForm] = useState({
    name: '',
    closingDay: '10',
    dueDay: '20',
    color: CARD_COLORS[0].id
  })

  const [expenseForm, setExpenseForm] = useState({
    description: '',
    amount: '',
    category: EXPENSE_CATEGORIES[0].id,
    date: new Date().toISOString().split('T')[0],
    installments: '1'
  })

  // Calcular totais por cartão
  const cardTotals = useMemo(() => {
    const totals = {}
    cards.forEach(card => {
      const cardExpenses = allExpenses.filter(e =>
        e.cardId === card.id && isDateInMonth(e.date, month, year)
      )
      totals[card.id] = cardExpenses.reduce((sum, e) => sum + (e.amount || 0), 0)
    })
    return totals
  }, [cards, allExpenses, month, year])

  // Despesas do cartão selecionado
  const selectedCardExpenses = useMemo(() => {
    if (!selectedCard) return []
    return allExpenses
      .filter(e => e.cardId === selectedCard.id && isDateInMonth(e.date, month, year))
      .sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [allExpenses, selectedCard, month, year])

  const loading = loadingCards || loadingExpenses

  const openNewCardModal = () => {
    setEditingItem(null)
    setCardForm({
      name: '',
      closingDay: '10',
      dueDay: '20',
      color: CARD_COLORS[0].id
    })
    setModalType('card')
  }

  const openEditCardModal = (card, e) => {
    e.stopPropagation()
    setEditingItem(card)
    setCardForm({
      name: card.name,
      closingDay: card.closingDay.toString(),
      dueDay: card.dueDay.toString(),
      color: card.color
    })
    setModalType('card')
  }

  const openCardDetails = (card) => {
    setSelectedCard(card)
    setModalType('details')
  }

  const openNewExpenseModal = () => {
    setEditingItem(null)
    setExpenseForm({
      description: '',
      amount: '',
      category: EXPENSE_CATEGORIES[0].id,
      date: new Date().toISOString().split('T')[0],
      installments: '1'
    })
    setModalType('expense')
  }

  const handleSaveCard = async (e) => {
    e.preventDefault()
    if (!cardForm.name) return

    try {
      setSaving(true)
      const data = {
        name: cardForm.name,
        closingDay: parseInt(cardForm.closingDay),
        dueDay: parseInt(cardForm.dueDay),
        color: cardForm.color
      }

      if (editingItem) {
        await updateCard(editingItem.id, data)
      } else {
        await addCard(data)
      }

      setModalType(null)
    } catch (error) {
      console.error('Error saving card:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteCard = async (cardId, e) => {
    e.stopPropagation()
    if (!confirm('Excluir este cartão? As despesas vinculadas permanecerão.')) return

    try {
      await deleteCard(cardId)
    } catch (error) {
      console.error('Error deleting card:', error)
    }
  }

  // Hook para despesas do cartão
  const { addCardExpense, deleteCardExpense } = useCardExpenseActions()

  const handleSaveExpense = async (e) => {
    e.preventDefault()
    if (!expenseForm.description || !expenseForm.amount || !selectedCard) return

    try {
      setSaving(true)
      await addCardExpense({
        cardId: selectedCard.id,
        description: expenseForm.description,
        amount: parseFloat(expenseForm.amount),
        category: expenseForm.category,
        date: expenseForm.date,
        installments: parseInt(expenseForm.installments) || 1
      })

      setModalType('details')
    } catch (error) {
      console.error('Error saving expense:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteExpense = async (expenseId) => {
    try {
      await deleteCardExpense(expenseId)
    } catch (error) {
      console.error('Error deleting expense:', error)
    }
  }

  const getColorClass = (colorId) => {
    return CARD_COLORS.find(c => c.id === colorId)?.class || 'bg-slate-600'
  }

  const getCategoryName = (categoryId) => {
    return EXPENSE_CATEGORIES.find(c => c.id === categoryId)?.name || categoryId
  }

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('pt-BR')
  }

  return (
    <div className="space-y-6">
      {/* Month Selector */}
      <MonthSelector
        month={month}
        year={year}
        onChange={onMonthChange}
      />

      {/* Add Card Button */}
      <Button onClick={openNewCardModal} icon={Plus} fullWidth>
        Novo Cartão
      </Button>

      {/* Cards List */}
      {loading ? (
        <Loading />
      ) : cards.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="Nenhum cartão"
          description="Cadastre seus cartões de crédito para controlar suas faturas"
          action={
            <Button onClick={openNewCardModal} icon={Plus}>
              Adicionar Cartão
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {cards.map((card) => (
            <Card
              key={card.id}
              onClick={() => openCardDetails(card)}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-4">
                {/* Card Color Indicator */}
                <div className={`w-12 h-12 rounded-xl ${getColorClass(card.color)} flex items-center justify-center flex-shrink-0`}>
                  <CreditCard className="w-6 h-6 text-white" />
                </div>

                {/* Card Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-medium truncate">{card.name}</h3>
                  <p className="text-xs text-dark-400">
                    Fecha dia {card.closingDay} • Vence dia {card.dueDay}
                  </p>
                </div>

                {/* Total & Actions */}
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-orange-400">
                      {formatCurrency(cardTotals[card.id] || 0)}
                    </p>
                    <p className="text-xs text-dark-500">Fatura</p>
                  </div>

                  <div className="flex gap-1">
                    <button
                      onClick={(e) => openEditCardModal(card, e)}
                      className="p-1.5 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteCard(card.id, e)}
                      className="p-1.5 text-dark-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <ChevronRight className="w-5 h-5 text-dark-500" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Card Modal */}
      <Modal
        isOpen={modalType === 'card'}
        onClose={() => setModalType(null)}
        title={editingItem ? 'Editar Cartão' : 'Novo Cartão'}
      >
        <form onSubmit={handleSaveCard} className="space-y-4">
          <Input
            label="Nome do Cartão"
            type="text"
            placeholder="Ex: Nubank, Inter..."
            value={cardForm.name}
            onChange={(e) => setCardForm({ ...cardForm, name: e.target.value })}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Dia de Fechamento"
              value={cardForm.closingDay}
              onChange={(e) => setCardForm({ ...cardForm, closingDay: e.target.value })}
              options={Array.from({ length: 28 }, (_, i) => ({
                value: (i + 1).toString(),
                label: `Dia ${i + 1}`
              }))}
            />

            <Select
              label="Dia de Vencimento"
              value={cardForm.dueDay}
              onChange={(e) => setCardForm({ ...cardForm, dueDay: e.target.value })}
              options={Array.from({ length: 28 }, (_, i) => ({
                value: (i + 1).toString(),
                label: `Dia ${i + 1}`
              }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">
              Cor do Cartão
            </label>
            <div className="flex gap-2 flex-wrap">
              {CARD_COLORS.map((color) => (
                <button
                  key={color.id}
                  type="button"
                  onClick={() => setCardForm({ ...cardForm, color: color.id })}
                  className={`w-10 h-10 rounded-xl ${color.class} transition-all ${
                    cardForm.color === color.id
                      ? 'ring-2 ring-white ring-offset-2 ring-offset-dark-900'
                      : 'opacity-60 hover:opacity-100'
                  }`}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setModalType(null)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              loading={saving}
              className="flex-1"
            >
              {editingItem ? 'Salvar' : 'Adicionar'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Card Details Modal */}
      <Modal
        isOpen={modalType === 'details'}
        onClose={() => setModalType(null)}
        title={selectedCard?.name || 'Detalhes do Cartão'}
      >
        <div className="space-y-4">
          {/* Card Summary */}
          <div className={`p-4 rounded-xl ${getColorClass(selectedCard?.color)}`}>
            <div className="flex items-center justify-between mb-4">
              <CreditCard className="w-8 h-8 text-white/80" />
              <div className="text-right">
                <p className="text-xs text-white/60">Fatura do mês</p>
                <p className="text-2xl font-bold text-white">
                  {formatCurrency(cardTotals[selectedCard?.id] || 0)}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm text-white/80">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Fecha dia {selectedCard?.closingDay}
              </span>
              <span>Vence dia {selectedCard?.dueDay}</span>
            </div>
          </div>

          {/* Add Expense Button */}
          <Button onClick={openNewExpenseModal} icon={Plus} fullWidth variant="secondary">
            Nova Despesa
          </Button>

          {/* Expenses List */}
          {selectedCardExpenses.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="Sem despesas"
              description="Adicione despesas para este cartão"
            />
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-dark-400 font-medium">Despesas do mês</p>
              {selectedCardExpenses.map((expense) => (
                <div
                  key={expense.id}
                  className="flex items-center justify-between p-3 bg-dark-800 rounded-xl"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">
                      {expense.description}
                    </p>
                    <p className="text-xs text-dark-400">
                      {getCategoryName(expense.category)} • {formatDate(expense.date)}
                      {expense.totalInstallments > 1 && (
                        <span className="text-orange-400 ml-1">
                          ({expense.installment}/{expense.totalInstallments})
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-orange-400">
                      {formatCurrency(expense.amount)}
                    </p>
                    <button
                      onClick={() => handleDeleteExpense(expense.id)}
                      className="p-1.5 text-dark-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* New Expense Modal */}
      <Modal
        isOpen={modalType === 'expense'}
        onClose={() => setModalType('details')}
        title="Nova Despesa no Cartão"
      >
        <form onSubmit={handleSaveExpense} className="space-y-4">
          <Input
            label="Descrição"
            type="text"
            placeholder="Ex: Supermercado, Netflix..."
            value={expenseForm.description}
            onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Valor Total"
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              value={expenseForm.amount}
              onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
              required
            />

            <Select
              label="Parcelas"
              value={expenseForm.installments}
              onChange={(e) => setExpenseForm({ ...expenseForm, installments: e.target.value })}
              options={Array.from({ length: 24 }, (_, i) => ({
                value: (i + 1).toString(),
                label: i === 0 ? 'À vista' : `${i + 1}x`
              }))}
            />
          </div>

          <Select
            label="Categoria"
            value={expenseForm.category}
            onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
            options={EXPENSE_CATEGORIES.map(c => ({ value: c.id, label: c.name }))}
          />

          <Input
            label="Data da Compra"
            type="date"
            value={expenseForm.date}
            onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
            required
          />

          {parseInt(expenseForm.installments) > 1 && expenseForm.amount && (
            <p className="text-sm text-dark-400 text-center p-2 bg-dark-800 rounded-xl">
              {expenseForm.installments}x de{' '}
              <span className="text-orange-400 font-medium">
                {formatCurrency(parseFloat(expenseForm.amount) / parseInt(expenseForm.installments))}
              </span>
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setModalType('details')}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={saving}
              className="flex-1"
            >
              Adicionar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

// Hook auxiliar para ações de despesas do cartão
function useCardExpenseActions() {
  const { addCardExpense, deleteCardExpense } = useAllCardExpenses()

  // Re-export the functions from useCardExpenses hook
  const {
    addCardExpense: addExpense,
    deleteCardExpense: deleteExpense
  } = useCardExpensesActions()

  return { addCardExpense: addExpense, deleteCardExpense: deleteExpense }
}

// Precisamos importar e usar o hook corretamente
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../contexts/AuthContext'

function useCardExpensesActions() {
  const { user } = useAuth()

  const addCardExpense = async (data) => {
    if (!user) throw new Error('Usuário não autenticado')

    // Se tem parcelamento, criar múltiplas despesas
    if (data.installments && data.installments > 1) {
      const expenses = []
      const baseDate = new Date(data.date)
      const installmentValue = data.amount / data.installments

      for (let i = 0; i < data.installments; i++) {
        const installmentDate = new Date(baseDate)
        installmentDate.setMonth(installmentDate.getMonth() + i)

        expenses.push(
          addDoc(collection(db, `users/${user.uid}/cardExpenses`), {
            ...data,
            amount: installmentValue,
            date: installmentDate,
            installment: i + 1,
            totalInstallments: data.installments,
            createdAt: serverTimestamp()
          })
        )
      }

      return await Promise.all(expenses)
    }

    return await addDoc(collection(db, `users/${user.uid}/cardExpenses`), {
      ...data,
      date: new Date(data.date),
      installment: 1,
      totalInstallments: 1,
      createdAt: serverTimestamp()
    })
  }

  const deleteCardExpense = async (id) => {
    if (!user) throw new Error('Usuário não autenticado')
    const docRef = doc(db, `users/${user.uid}/cardExpenses`, id)
    return await deleteDoc(docRef)
  }

  return { addCardExpense, deleteCardExpense }
}
