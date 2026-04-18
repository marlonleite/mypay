import { useState, useMemo, useRef } from 'react'
import {
  Plus,
  CreditCard,
  Trash2,
  Edit2,
  ChevronRight,
  Calendar,
  Receipt,
  Check,
  Wallet,
  Paperclip,
  Tag,
  X,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  File,
  Search,
  Filter,
  AlertTriangle,
  Lock,
  Scan
} from 'lucide-react'
// useAuth removido após F8 — Cards.jsx não acessa mais user.uid pra Firestore.
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Input from '../components/ui/Input'
import CurrencyInput from '../components/ui/CurrencyInput'
import Select from '../components/ui/Select'
import MonthSelector from '../components/ui/MonthSelector'
import Loading from '../components/ui/Loading'
import EmptyState from '../components/ui/EmptyState'
import LimitProgressBar from '../components/ui/LimitProgressBar'
import BankIcon from '../components/ui/BankIcon'
import BankSelector from '../components/ui/BankSelector'
import SearchableSelect from '../components/ui/SearchableSelect'
import { useCards, useAllCardExpenses, useCardExpenses, useAccounts, useBillPayments, useCreditCardInvoices, useTags, useCategories } from '../hooks/useFirestore'
import { usePrivacy } from '../contexts/PrivacyContext'
import { isDateInMonth, formatDateForInput } from '../utils/helpers'
import { CARD_COLORS, MONTHS, TRANSACTION_TYPES } from '../utils/constants'
// uploadComprovante removido pós F-Cards-attachments — comprovantes vão via
// attachmentService.uploadAttachment (em handlePayBill) após backend retornar
// o id da transaction.

export default function Cards({ month, year, onMonthChange, onNavigate }) {
  const { formatCurrency } = usePrivacy()
  const {
    cards,
    loading: loadingCards,
    addCard,
    updateCard,
    deleteCard
  } = useCards()

  const { expenses: allExpenses, loading: loadingExpenses } = useAllCardExpenses()
  const { accounts, loading: loadingAccounts } = useAccounts()
  const {
    isBillPaid,
    isBillFullyPaid,
    getTotalPaid,
    getBillPayment,
    getBillPayments,
    getPreviousBalance,
    addBillPayment,
    deleteBillPayment
  } = useBillPayments(month, year)
  const { tags: existingTags } = useTags()
  const {
    categories: allCategories,
    loading: loadingCategories,
    addCategory,
    getMainCategories,
    getSubcategories
  } = useCategories()

  const activeAccounts = useMemo(() => {
    return accounts.filter(a => !a.archived)
  }, [accounts])

  const [modalType, setModalType] = useState(null) // 'card', 'expense', 'details', 'pay_bill'
  const [selectedCard, setSelectedCard] = useState(null)
  const [editingItem, setEditingItem] = useState(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [bankSelectorOpen, setBankSelectorOpen] = useState(false)

  // Faturas do cartão selecionado (Onda 2 — entidade própria) + helpers.
  // refresh é invocado após pagar/estornar pra recomputar amount/balance/payment_amount.
  const {
    findInvoiceByDueMonth,
    refresh: refreshInvoices,
  } = useCreditCardInvoices(selectedCard?.id)

  // Toggles para seções do formulário
  const [showTags, setShowTags] = useState(false)

  // Tags
  const [tagInput, setTagInput] = useState('')
  const [showTagSuggestions, setShowTagSuggestions] = useState(false)

  // Filtros de lançamentos
  const [expenseSearch, setExpenseSearch] = useState('')
  const [showExpenseFilters, setShowExpenseFilters] = useState(false)
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState([])

  // Nova categoria
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [savingCategory, setSavingCategory] = useState(false)

  const [cardForm, setCardForm] = useState({
    name: '',
    closingDay: '10',
    dueDay: '20',
    color: CARD_COLORS[0].id,
    limit: null,
    bankId: 'generic'
  })

  const [expenseForm, setExpenseForm] = useState({
    type: TRANSACTION_TYPES.EXPENSE,
    description: '',
    amount: null,
    category: '',
    date: new Date().toISOString().split('T')[0],
    installments: '1',
    tags: [],
  })

  // Categorias do Firestore agrupadas (principais + subcategorias como optgroup)
  const categoryOptions = useMemo(() => {
    const mainCats = getMainCategories(expenseForm.type)
    return mainCats.map(cat => {
      const subs = getSubcategories(cat.id)
      if (subs.length === 0) {
        return { value: cat.id, label: cat.name }
      }
      return {
        label: cat.name,
        options: [
          { value: cat.id, label: cat.name },
          ...subs.map(sub => ({ value: sub.id, label: sub.name }))
        ]
      }
    })
  }, [allCategories, expenseForm.type])

  const [paymentForm, setPaymentForm] = useState({
    accountId: '',
    date: new Date().toISOString().split('T')[0],
    amount: null, // Para pagamento parcial
    isPartial: false,
    attachments: []
  })
  const paymentFileInputRef = useRef(null)

  // Tags filtradas para autocomplete
  const filteredTagSuggestions = useMemo(() => {
    if (!tagInput.trim()) return existingTags.filter(t => !expenseForm.tags.includes(t))
    const term = tagInput.toLowerCase()
    return existingTags.filter(t =>
      t.toLowerCase().includes(term) && !expenseForm.tags.includes(t)
    )
  }, [tagInput, existingTags, expenseForm.tags])

  // Verificar se despesa pertence à fatura (billMonth/billYear com fallback para data)
  const isExpenseInBill = (expense, billMonth, billYear) => {
    if (expense.billMonth != null && expense.billYear != null) {
      return expense.billMonth === billMonth && expense.billYear === billYear
    }
    return isDateInMonth(expense.date, billMonth, billYear)
  }

  // Calcular totais por cartão (despesas - receitas/estornos)
  const cardTotals = useMemo(() => {
    const totals = {}
    cards.forEach(card => {
      const cardItems = allExpenses.filter(e =>
        e.cardId === card.id && isExpenseInBill(e, month, year)
      )
      // Despesas somam, receitas (estornos) subtraem
      totals[card.id] = cardItems.reduce((sum, e) => {
        const amount = e.amount || 0
        return e.type === TRANSACTION_TYPES.INCOME ? sum - amount : sum + amount
      }, 0)
    })
    return totals
  }, [cards, allExpenses, month, year])

  // Despesas do cartão selecionado — vêm do hook invoice-based quando há invoice.
  const selectedCardExpenses = useMemo(() => {
    if (!selectedCard) return []
    if (currentInvoice) return [...invoiceExpenses].sort((a, b) => new Date(b.date) - new Date(a.date))
    return allExpenses
      .filter(e => e.cardId === selectedCard.id && isExpenseInBill(e, month, year))
      .sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [invoiceExpenses, allExpenses, selectedCard, currentInvoice, month, year])

  // Categorias para filtro de lançamentos (expense + income)
  const expenseFilterCategories = useMemo(() => {
    const result = []
    for (const type of ['expense', 'income']) {
      const mainCats = getMainCategories(type)
      for (const cat of mainCats) {
        result.push({ value: cat.id, label: cat.name })
        const subs = getSubcategories(cat.id)
        for (const sub of subs) {
          result.push({ value: sub.id, label: `  ${sub.name}` })
        }
      }
    }
    return result
  }, [allCategories])

  // Lançamentos filtrados por busca e categoria
  const filteredCardExpenses = useMemo(() => {
    let result = selectedCardExpenses

    if (expenseSearch) {
      const term = expenseSearch.toLowerCase()
      result = result.filter(e =>
        e.description?.toLowerCase().includes(term) ||
        allCategories.find(c => c.id === e.category)?.name?.toLowerCase().includes(term)
      )
    }

    if (expenseCategoryFilter.length > 0) {
      result = result.filter(e =>
        expenseCategoryFilter.includes(e.category)
      )
    }

    return result
  }, [selectedCardExpenses, expenseSearch, expenseCategoryFilter, allCategories])

  // Fatura paga = lançamentos bloqueados (read-only)
  const isBillLocked = selectedCard && isBillPaid(selectedCard.id) && cardTotals[selectedCard.id] > 0

  const loading = loadingCards || loadingExpenses || loadingAccounts || loadingCategories

  const openNewCardModal = () => {
    setEditingItem(null)
    setCardForm({
      name: '',
      closingDay: '10',
      dueDay: '20',
      color: CARD_COLORS[0].id,
      limit: null,
      bankId: 'generic'
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
      color: card.color,
      limit: card.limit || null,
      bankId: card.bankId || 'generic'
    })
    setModalType('card')
  }

  const openCardDetails = (card) => {
    setSelectedCard(card)
    setExpenseSearch('')
    setExpenseCategoryFilter([])
    setShowExpenseFilters(false)
    setModalType('details')
  }

  const openNewExpenseModal = () => {
    setEditingItem(null)
    const expenseCats = getMainCategories(TRANSACTION_TYPES.EXPENSE)
    setExpenseForm({
      type: TRANSACTION_TYPES.EXPENSE,
      description: '',
      amount: null,
      category: expenseCats[0]?.id || '',
      date: new Date().toISOString().split('T')[0],
      installments: '1',
      tags: [],
    })
    setShowTags(false)
    setTagInput('')
    setUploadError(null)
    setModalType('expense')
  }

  const openEditExpenseModal = (expense) => {
    setEditingItem(expense)
    // Converter data para formato de input
    const expenseDate = expense.date instanceof Date
      ? expense.date
      : expense.date?.toDate?.() || new Date(expense.date)

    setExpenseForm({
      type: expense.type || TRANSACTION_TYPES.EXPENSE,
      description: expense.description || '',
      amount: expense.amount || null,
      category: expense.category || '',
      date: formatDateForInput(expenseDate),
      installments: '1',
      tags: expense.tags || [],
      billMonth: expense.billMonth ?? month,
      billYear: expense.billYear ?? year,
    })
    setShowTags(expense.tags?.length > 0)
    setTagInput('')
    setUploadError(null)
    setModalType('expense')
  }

  const openPayBillModal = () => {
    const billAmount = cardTotals[selectedCard?.id] || 0
    const previousBalance = getPreviousBalance(selectedCard?.id)
    const totalDue = billAmount + previousBalance

    const dueDate = new Date(year, month, selectedCard?.dueDay || 1)

    setPaymentForm({
      accountId: activeAccounts[0]?.id || '',
      date: formatDateForInput(dueDate),
      amount: totalDue,
      isPartial: false,
      attachments: []
    })
    setModalType('pay_bill')
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
        color: cardForm.color,
        limit: cardForm.limit || null,
        bankId: cardForm.bankId || 'generic'
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

  // Hook para despesas do cartão selecionado — filtra por invoice quando disponível.
  const currentInvoice = findInvoiceByDueMonth(month, year)
  const {
    expenses: invoiceExpenses = [],
    addCardExpense,
    updateCardExpense,
    deleteCardExpense,
  } = useCardExpenses(selectedCard?.id, month, year, currentInvoice?.id)

  // Selecionar arquivos de comprovante de pagamento (DEFERRED upload).
  // Pós F-Cards-attachments: arquivos ficam locais como `File` objects;
  // upload real acontece em `handlePayBill` via `attachmentService.uploadAttachment`
  // depois que o backend retorna o id da transaction (substituiu o upload
  // direto ao R2 via uploadComprovante — credenciais R2 saem do bundle).
  const handlePaymentFileSelect = (e) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploadError(null)
    const pending = Array.from(files).map(file => ({
      file,
      fileName: file.name,
      fileType: file.type,
      // URL preview local pra exibir na lista (revogada após upload).
      url: URL.createObjectURL(file),
    }))

    setPaymentForm(prev => ({
      ...prev,
      attachments: [...prev.attachments, ...pending]
    }))

    if (paymentFileInputRef.current) {
      paymentFileInputRef.current.value = ''
    }
  }

  const removePaymentAttachment = (index) => {
    setPaymentForm(prev => {
      const removed = prev.attachments[index]
      // Revoga blob URL pra não vazar memória
      if (removed?.url?.startsWith('blob:')) URL.revokeObjectURL(removed.url)
      return {
        ...prev,
        attachments: prev.attachments.filter((_, i) => i !== index)
      }
    })
  }

  // Tags
  const addTag = (tag = tagInput.trim()) => {
    if (tag && !expenseForm.tags.includes(tag)) {
      setExpenseForm(prev => ({
        ...prev,
        tags: [...prev.tags, tag]
      }))
    }
    setTagInput('')
    setShowTagSuggestions(false)
  }

  const removeTag = (tagToRemove) => {
    setExpenseForm(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tagToRemove)
    }))
  }

  const selectTagSuggestion = (tag) => {
    addTag(tag)
  }

  // Ícones de arquivo
  const getFileIcon = (attachment) => {
    const type = attachment.type || ''
    if (type.startsWith('image/')) return ImageIcon
    if (type === 'application/pdf') return FileText
    if (type.includes('spreadsheet') || type.includes('excel') || attachment.fileName?.match(/\.(xls|xlsx|csv)$/i)) return FileSpreadsheet
    return File
  }

  const getFileIconColor = (attachment) => {
    const type = attachment.type || ''
    if (type.startsWith('image/')) return 'text-blue-400'
    if (type === 'application/pdf') return 'text-red-400'
    if (type.includes('spreadsheet') || type.includes('excel')) return 'text-emerald-400'
    return 'text-dark-400'
  }

  const handleSaveExpense = async (e) => {
    e.preventDefault()
    if (!expenseForm.description || !expenseForm.amount || !selectedCard) return

    try {
      setSaving(true)

      if (editingItem) {
        // Atualizar lançamento existente — usa billMonth/billYear do form (editável)
        await updateCardExpense(editingItem.id, {
          type: expenseForm.type,
          description: expenseForm.description,
          amount: expenseForm.amount,
          category: expenseForm.category,
          date: expenseForm.date,
          tags: expenseForm.tags.length > 0 ? expenseForm.tags : [],
          billMonth: expenseForm.billMonth,
          billYear: expenseForm.billYear
        })
      } else {
        // Criar novo lançamento — vincula à fatura sendo visualizada.
        // Backend gera N parcelas server-side via total_installments.
        await addCardExpense({
          cardId: selectedCard.id,
          type: expenseForm.type,
          description: expenseForm.description,
          amount: expenseForm.amount,
          category: expenseForm.category,
          date: expenseForm.date,
          installments: parseInt(expenseForm.installments) || 1,
          tags: expenseForm.tags.length > 0 ? expenseForm.tags : [],
          billMonth: month,
          billYear: year
        })
      }

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

  const handlePayBill = async (e) => {
    e.preventDefault()
    if (!selectedCard || !paymentForm.accountId || !paymentForm.amount) return

    // Resolve a fatura cujo vencimento cai no mês/ano selecionados.
    // Pós Onda 2: invoice.amount/previousBalance vêm computados pelo backend (mais
    // confiável que cálculo client-side baseado em cardTotals + getPreviousBalance).
    const invoice = findInvoiceByDueMonth(month, year)
    if (!invoice) {
      console.error(`Nenhuma fatura encontrada pra ${MONTHS[month]}/${year} no cartão ${selectedCard.name}`)
      return
    }

    const billAmount = invoice.amount
    const previousBalance = invoice.previousBalance
    const totalDue = billAmount + previousBalance
    const paymentAmount = paymentForm.amount || 0

    if (paymentAmount <= 0) return

    try {
      setSaving(true)

      const isPartialPayment = paymentAmount < totalDue
      const description = `Fatura ${selectedCard.name} - ${MONTHS[month]}/${year}${isPartialPayment ? ' (parcial)' : ''}`

      // Backend cria a transaction (com paid_credit_card_id + paid_credit_card_invoice_id)
      // atomicamente. Não precisamos mais criar a transação separadamente.
      const created = await addBillPayment({
        cardId: selectedCard.id,
        paidCreditCardInvoiceId: invoice.id,
        accountId: paymentForm.accountId,
        amount: paymentAmount,
        description,
        paidAt: new Date(paymentForm.date + 'T12:00:00'),
      })

      // Upload deferido dos comprovantes — backend retornou created.id (a transaction
      // que representa o pagamento no novo modelo). attachmentService faz POST
      // multipart pra cada arquivo. Revoga blob URL pra não vazar memória.
      if (paymentForm.attachments.length > 0 && created?.id) {
        setUploading(true)
        try {
          const { uploadAttachment } = await import('../services/attachmentService')
          for (const att of paymentForm.attachments) {
            if (att?.file) {
              try {
                await uploadAttachment(created.id, att.file)
              } catch (err) {
                console.warn('Erro ao anexar comprovante:', err)
              } finally {
                if (att.url?.startsWith('blob:')) URL.revokeObjectURL(att.url)
              }
            }
          }
        } finally {
          setUploading(false)
        }
      }

      // Recompute invoice (balance/payment_amount mudaram)
      await refreshInvoices()

      setModalType('details')
    } catch (error) {
      console.error('Error paying bill:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleCancelPayment = async () => {
    if (!selectedCard) return

    const payment = getBillPayment(selectedCard.id)
    if (!payment) return

    if (!confirm('Deseja estornar este pagamento? A transação vinculada também será excluída.')) return

    try {
      setSaving(true)

      // No novo modelo, payment.id == transaction.id (são a mesma row).
      // deleteBillPayment já faz soft delete da transaction.
      await deleteBillPayment(payment.id)
      await refreshInvoices()

    } catch (error) {
      console.error('Error canceling payment:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return
    try {
      setSavingCategory(true)
      const newCat = await addCategory({
        name: newCategoryName.trim(),
        type: expenseForm.type
      })
      // Selecionar a nova categoria automaticamente
      if (newCat?.id) {
        setExpenseForm(prev => ({ ...prev, category: newCat.id }))
      }
      setNewCategoryName('')
      setCategoryModalOpen(false)
    } catch (error) {
      console.error('Error adding category:', error)
    } finally {
      setSavingCategory(false)
    }
  }

  const getColorClass = (colorId) => {
    return CARD_COLORS.find(c => c.id === colorId)?.class || 'bg-slate-600'
  }

  const getCategoryName = (categoryId) => {
    // Se categoryId é um objeto (migração antiga), extrair o nome
    if (categoryId && typeof categoryId === 'object') {
      return categoryId.name || 'Sem categoria'
    }

    const cat = allCategories.find(c => c.id === categoryId)
    if (cat) {
      if (cat.parentId) {
        const parent = allCategories.find(c => c.id === cat.parentId)
        return parent ? `${parent.name} > ${cat.name}` : cat.name
      }
      return cat.name
    }
    return categoryId || 'Sem categoria'
  }

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('pt-BR')
  }

  const getAccountName = (accountId) => {
    return accounts.find(a => a.id === accountId)?.name || 'Conta'
  }

  // Helper para normalizar tags (pode ser string ou objeto)
  const normalizeTag = (tag) => {
    if (!tag) return ''
    if (typeof tag === 'object') return tag.name || ''
    return String(tag)
  }

  const normalizeTags = (tags) => {
    if (!Array.isArray(tags)) return []
    return tags.map(normalizeTag).filter(Boolean)
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
          {cards.map((card) => {
            const isPaid = isBillPaid(card.id)
            const billTotal = cardTotals[card.id] || 0

            return (
              <Card
                key={card.id}
                onClick={() => openCardDetails(card)}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-3">
                  {/* Bank Icon or Card Color Indicator */}
                  {card.bankId && card.bankId !== 'generic' ? (
                    <div className="flex-shrink-0">
                      <BankIcon bankId={card.bankId} size="md" />
                    </div>
                  ) : (
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl ${getColorClass(card.color)} flex items-center justify-center flex-shrink-0`}>
                      <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                  )}

                  {/* Card Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-white font-medium truncate max-w-[120px] sm:max-w-none">{card.name}</h3>
                      {isPaid && billTotal > 0 && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-emerald-500/20 text-emerald-400 rounded flex-shrink-0">
                          PAGA
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-dark-400 whitespace-nowrap">
                      <span className="hidden sm:inline">Fecha dia {card.closingDay} • Vence dia {card.dueDay}</span>
                      <span className="sm:hidden">F:{card.closingDay} • V:{card.dueDay}</span>
                    </p>

                    {/* Limit Progress Bar */}
                    {card.limit > 0 && (
                      <div className="mt-2">
                        <LimitProgressBar
                          used={billTotal}
                          limit={card.limit}
                          size="sm"
                          showLabel={false}
                        />
                      </div>
                    )}
                  </div>

                  {/* Total & Actions */}
                  <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${isPaid ? 'text-emerald-400' : 'text-orange-400'}`}>
                        {formatCurrency(billTotal)}
                      </p>
                      <p className="text-xs text-dark-500">Fatura</p>
                    </div>

                    <div className="hidden sm:flex gap-1">
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
            )
          })}
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

          <CurrencyInput
            label="Limite do Cartão (opcional)"
            value={cardForm.limit}
            onChange={(val) => setCardForm({ ...cardForm, limit: val })}
          />

          {/* Bank Selector */}
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">
              Banco
            </label>
            <button
              type="button"
              onClick={() => setBankSelectorOpen(true)}
              className="w-full flex items-center justify-between p-3 bg-dark-800 border border-dark-700 rounded-xl hover:border-dark-600 transition-colors"
            >
              <BankIcon bankId={cardForm.bankId} size="sm" showName />
              <span className="text-dark-400 text-sm">Alterar</span>
            </button>
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
              <div className="flex items-center gap-2">
                <CreditCard className="w-8 h-8 text-white/80" />
                {selectedCard && isBillPaid(selectedCard.id) && cardTotals[selectedCard.id] > 0 && (
                  <span className="px-2 py-1 text-xs font-medium bg-white/20 text-white rounded-lg flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    PAGA
                  </span>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs text-white/60">Fatura {MONTHS[month]}</p>
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

            {/* Limit Progress Bar */}
            {selectedCard?.limit > 0 && (
              <div className="mt-3 pt-3 border-t border-white/20">
                <LimitProgressBar
                  used={cardTotals[selectedCard?.id] || 0}
                  limit={selectedCard.limit}
                  size="md"
                  showLabel={true}
                />
              </div>
            )}

            {/* Payment Info */}
            {selectedCard && isBillPaid(selectedCard.id) && (
              <div className="mt-3 pt-3 border-t border-white/20 text-sm text-white/80">
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-1">
                    <Wallet className="w-4 h-4" />
                    Pago via {getAccountName(getBillPayment(selectedCard.id)?.accountId)} em{' '}
                    {(() => {
                      const paidAt = getBillPayment(selectedCard.id)?.paidAt
                      if (!paidAt) return '--'
                      const date = paidAt.toDate ? paidAt.toDate() : new Date(paidAt)
                      return date.toLocaleDateString('pt-BR')
                    })()}
                  </p>
                  <button
                    onClick={handleCancelPayment}
                    disabled={saving}
                    className="text-xs text-red-400 hover:text-red-300 underline disabled:opacity-50"
                  >
                    Estornar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          {isBillLocked ? (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-dark-800/50 rounded-xl border border-dark-700/30">
              <Lock className="w-4 h-4 text-dark-500" />
              <span className="text-xs text-dark-400">Fatura paga — lançamentos bloqueados. Estorne para editar.</span>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <Button onClick={openNewExpenseModal} icon={Plus} className="flex-1" variant="secondary">
                  Novo Lançamento
                </Button>
                <Button onClick={() => onNavigate?.('documents')} icon={Scan} className="flex-1" variant="secondary">
                  Importar Fatura
                </Button>
              </div>
              {selectedCard && !isBillPaid(selectedCard.id) && cardTotals[selectedCard.id] > 0 && (
                <Button onClick={openPayBillModal} icon={Check} variant="success" fullWidth>
                  Pagar Fatura
                </Button>
              )}
            </>
          )}

          {/* Search and Filter */}
          {selectedCardExpenses.length > 0 && (
            <>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    type="text"
                    placeholder="Buscar lançamentos..."
                    value={expenseSearch}
                    onChange={(e) => setExpenseSearch(e.target.value)}
                    icon={Search}
                  />
                </div>
                <button
                  onClick={() => setShowExpenseFilters(!showExpenseFilters)}
                  className={`p-3.5 rounded-2xl transition-all active:scale-95 ${
                    showExpenseFilters || expenseCategoryFilter.length > 0
                      ? 'bg-violet-600 text-white'
                      : 'bg-dark-900 text-dark-400 hover:text-white'
                  }`}
                >
                  <Filter className="w-5 h-5" />
                </button>
              </div>

              {showExpenseFilters && (
                <div className="flex flex-wrap gap-2 p-3 bg-dark-900 rounded-2xl">
                  {expenseCategoryFilter.length > 0 && (
                    <button
                      onClick={() => setExpenseCategoryFilter([])}
                      className="p-2 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  <SearchableSelect
                    options={expenseFilterCategories}
                    value={expenseCategoryFilter}
                    onChange={setExpenseCategoryFilter}
                    placeholder="Categoria"
                    allLabel="Todas as categorias"
                    searchPlaceholder="Buscar categoria..."
                    multiple
                  />
                </div>
              )}
            </>
          )}

          {/* Expenses List */}
          {selectedCardExpenses.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="Sem lançamentos"
              description="Adicione despesas ou receitas neste cartão"
            />
          ) : filteredCardExpenses.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Nenhum resultado"
              description="Nenhum lançamento encontrado com os filtros aplicados"
            />
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-dark-400 font-medium">Lançamentos do mês</p>
              {filteredCardExpenses.map((expense) => {
                const isIncome = expense.type === TRANSACTION_TYPES.INCOME
                return (
                  <div
                    key={expense.id}
                    className="flex items-center gap-3 p-3 bg-dark-800/30 rounded-xl border border-dark-700/30"
                  >
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="flex items-center gap-1.5 overflow-hidden">
                        <span
                          className="flex-1 min-w-0 text-sm text-white font-medium"
                          style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                          {expense.description}
                        </span>
                      </div>
                      <p
                        className="text-xs text-dark-400"
                        style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      >
                        {getCategoryName(expense.category)} • {formatDate(expense.date)}
                        {expense.totalInstallments > 1 && (
                          <span className={`ml-1 ${isIncome ? 'text-emerald-400' : 'text-orange-400'}`}>
                            ({expense.installment}/{expense.totalInstallments})
                          </span>
                        )}
                      </p>
                      {normalizeTags(expense.tags).length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {normalizeTags(expense.tags).slice(0, 2).map(tag => (
                            <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-violet-500/20 text-violet-300 rounded">
                              {tag}
                            </span>
                          ))}
                          {normalizeTags(expense.tags).length > 2 && (
                            <span className="text-[10px] text-dark-500">+{normalizeTags(expense.tags).length - 2}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <p className={`text-sm font-semibold flex-shrink-0 whitespace-nowrap ${isIncome ? 'text-emerald-400' : 'text-orange-400'}`}>
                      {isIncome ? '+' : '-'}{formatCurrency(expense.amount)}
                    </p>
                    {!isBillLocked && (
                      <>
                        <button
                          onClick={() => openEditExpenseModal(expense)}
                          className="p-1.5 text-dark-400 hover:text-violet-500 hover:bg-violet-500/10 rounded-lg transition-colors flex-shrink-0"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteExpense(expense.id)}
                          className="p-1.5 text-dark-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors flex-shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Modal>

      {/* New Expense Modal */}
      <Modal
        isOpen={modalType === 'expense'}
        onClose={() => setModalType('details')}
        title={editingItem ? "Editar Lançamento" : "Novo Lançamento no Cartão"}
        headerVariant={expenseForm.type === TRANSACTION_TYPES.INCOME ? 'income' : 'expense'}
      >
        <form onSubmit={handleSaveExpense} className="space-y-4">
          {/* Seletor de fatura vinculada */}
          {editingItem && (
            <Select
              label="Fatura"
              value={`${expenseForm.billMonth}-${expenseForm.billYear}`}
              onChange={(e) => {
                const [m, y] = e.target.value.split('-').map(Number)
                setExpenseForm(prev => ({ ...prev, billMonth: m, billYear: y }))
              }}
              options={(() => {
                const opts = []
                const baseMonth = expenseForm.billMonth ?? month
                const baseYear = expenseForm.billYear ?? year
                for (let offset = -6; offset <= 6; offset++) {
                  let m = baseMonth + offset
                  let y = baseYear
                  while (m < 0) { m += 12; y-- }
                  while (m > 11) { m -= 12; y++ }
                  opts.push({ value: `${m}-${y}`, label: `${MONTHS[m]} de ${y}` })
                }
                return opts
              })()}
            />
          )}

          {/* Type Toggle */}
          <div className="flex gap-2 p-1.5 bg-dark-800 rounded-2xl">
            <button
              type="button"
              onClick={() => {
                const newCats = getMainCategories(TRANSACTION_TYPES.EXPENSE)
                setExpenseForm(prev => ({
                  ...prev,
                  type: TRANSACTION_TYPES.EXPENSE,
                  category: newCats[0]?.id || ''
                }))
              }}
              className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all ${
                expenseForm.type === TRANSACTION_TYPES.EXPENSE
                  ? 'bg-red-500/20 text-red-400'
                  : 'text-dark-400 hover:text-white hover:bg-dark-700'
              }`}
            >
              Despesa
            </button>
            <button
              type="button"
              onClick={() => {
                const newCats = getMainCategories(TRANSACTION_TYPES.INCOME)
                setExpenseForm(prev => ({
                  ...prev,
                  type: TRANSACTION_TYPES.INCOME,
                  category: newCats[0]?.id || ''
                }))
              }}
              className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all ${
                expenseForm.type === TRANSACTION_TYPES.INCOME
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'text-dark-400 hover:text-white hover:bg-dark-700'
              }`}
            >
              Receita
            </button>
          </div>

          <Input
            label="Descrição"
            type="text"
            placeholder={expenseForm.type === TRANSACTION_TYPES.EXPENSE ? "Ex: Supermercado, Netflix..." : "Ex: Estorno, Reembolso..."}
            value={expenseForm.description}
            onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
            required
          />

          <div className={`grid gap-3 ${editingItem ? 'grid-cols-1' : 'grid-cols-2'}`}>
            <CurrencyInput
              label="Valor"
              value={expenseForm.amount}
              onChange={(val) => setExpenseForm({ ...expenseForm, amount: val })}
              required
            />

            {!editingItem && (
              <Select
                label="Parcelas"
                value={expenseForm.installments}
                onChange={(e) => setExpenseForm({ ...expenseForm, installments: e.target.value })}
                options={Array.from({ length: 24 }, (_, i) => ({
                  value: (i + 1).toString(),
                  label: i === 0 ? 'À vista' : `${i + 1}x`
                }))}
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">
              Categoria
            </label>
            <div className="flex gap-2">
              <Select
                value={expenseForm.category}
                onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                options={categoryOptions}
                className="flex-1"
              />
              <button
                type="button"
                onClick={() => setCategoryModalOpen(true)}
                className="p-2.5 bg-dark-700 hover:bg-dark-600 text-dark-300 hover:text-white rounded-xl transition-colors"
                title="Nova categoria"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          <Input
            label="Data da Compra"
            type="date"
            value={expenseForm.date}
            onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
            required
          />

          {!editingItem && parseInt(expenseForm.installments) > 1 && expenseForm.amount && (
            <p className="text-sm text-dark-400 text-center p-2 bg-dark-800 rounded-xl">
              {expenseForm.installments}x de{' '}
              <span className="text-orange-400 font-medium">
                {formatCurrency((expenseForm.amount || 0) / parseInt(expenseForm.installments))}
              </span>
            </p>
          )}

          {/* Tags */}
          {showTags && (
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">
                Tags
              </label>
              <div className="relative">
                <div className="flex gap-2 mb-2">
                  <Input
                    type="text"
                    placeholder="Digite uma tag..."
                    value={tagInput}
                    onChange={(e) => {
                      setTagInput(e.target.value)
                      setShowTagSuggestions(true)
                    }}
                    onFocus={() => setShowTagSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowTagSuggestions(false), 200)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addTag()
                      }
                    }}
                    className="flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => addTag()}
                    className="p-2.5 bg-dark-700 hover:bg-dark-600 text-dark-300 hover:text-white rounded-xl transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>

                {/* Sugestões de tags */}
                {showTagSuggestions && filteredTagSuggestions.length > 0 && (
                  <div className="absolute z-50 left-0 right-12 bg-dark-800 border border-dark-600 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                    {filteredTagSuggestions.slice(0, 8).map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => selectTagSuggestion(tag)}
                        className="w-full px-3 py-2 text-left text-sm text-dark-300 hover:bg-dark-700 hover:text-white transition-colors first:rounded-t-xl last:rounded-b-xl"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {expenseForm.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {expenseForm.tags.map(tag => (
                    <span
                      key={tag}
                      className="flex items-center gap-1 px-2 py-1 bg-violet-500/20 text-violet-300 rounded-lg text-sm"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="hover:text-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Erro de upload */}
          {uploadError && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
              <X className="w-4 h-4 flex-shrink-0" />
              <span>{uploadError}</span>
              <button
                type="button"
                onClick={() => setUploadError(null)}
                className="ml-auto p-1 hover:text-red-300"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Botões de ação rápida — só Tags sobrou após decisão de drop em 2026-04-15 */}
          <div className="flex justify-center gap-6 py-2 border-t border-dark-700">
            <button
              type="button"
              onClick={() => setShowTags(!showTags)}
              className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
                showTags ? 'text-violet-400' : 'text-dark-400 hover:text-white'
              }`}
            >
              <Tag className="w-5 h-5" />
              <span className="text-xs">Tags</span>
            </button>
          </div>

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
              {editingItem ? 'Salvar' : 'Adicionar'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Pay Bill Modal */}
      <Modal
        isOpen={modalType === 'pay_bill'}
        onClose={() => setModalType('details')}
        title="Pagar Fatura"
      >
        <form onSubmit={handlePayBill} className="space-y-4">
          {/* Bill Summary */}
          <div className="p-4 bg-dark-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm text-dark-400">Fatura {selectedCard?.name}</p>
              <p className="text-xs text-dark-500">{MONTHS[month]} de {year}</p>
            </div>

            {/* Detalhamento */}
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-dark-400">Gastos do mês</span>
                <span className="text-white">{formatCurrency(cardTotals[selectedCard?.id] || 0)}</span>
              </div>

              {selectedCard && getPreviousBalance(selectedCard.id) > 0 && (
                <div className="flex justify-between text-amber-400">
                  <span>Saldo anterior</span>
                  <span>{formatCurrency(getPreviousBalance(selectedCard.id))}</span>
                </div>
              )}

              <div className="flex justify-between pt-2 border-t border-dark-700 font-bold">
                <span className="text-white">Total a pagar</span>
                <span className="text-orange-400">
                  {formatCurrency((cardTotals[selectedCard?.id] || 0) + (selectedCard ? getPreviousBalance(selectedCard.id) : 0))}
                </span>
              </div>
            </div>
          </div>

          {activeAccounts.length === 0 ? (
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
              <p className="text-sm text-yellow-400">
                Você precisa cadastrar uma conta primeiro para pagar faturas.
              </p>
            </div>
          ) : (
            <>
              <Select
                label="Pagar com"
                value={paymentForm.accountId}
                onChange={(e) => setPaymentForm({ ...paymentForm, accountId: e.target.value })}
                options={activeAccounts.map(a => ({ value: a.id, label: a.name }))}
              />

              <CurrencyInput
                label="Valor do Pagamento"
                value={paymentForm.amount}
                onChange={(val) => setPaymentForm({ ...paymentForm, amount: val })}
                required
              />

              {paymentForm.amount && paymentForm.amount < ((cardTotals[selectedCard?.id] || 0) + (selectedCard ? getPreviousBalance(selectedCard.id) : 0)) && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                  <p className="text-xs text-amber-400">
                    Pagamento parcial. O saldo restante de{' '}
                    <span className="font-bold">
                      {formatCurrency(((cardTotals[selectedCard?.id] || 0) + (selectedCard ? getPreviousBalance(selectedCard.id) : 0)) - (paymentForm.amount || 0))}
                    </span>
                    {' '}será transferido para a próxima fatura.
                  </p>
                </div>
              )}

              <Input
                label="Data do Pagamento"
                type="date"
                value={paymentForm.date}
                onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })}
                required
              />

              {/* Comprovante de Pagamento */}
              {uploadError && modalType === 'pay_bill' && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1">{uploadError}</span>
                  <button
                    type="button"
                    onClick={() => setUploadError(null)}
                    className="ml-auto p-1 hover:text-red-300"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {paymentForm.attachments.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-1.5">
                    Comprovante
                  </label>
                  <div className="space-y-2">
                    {paymentForm.attachments.map((attachment, index) => {
                      const FileIcon = getFileIcon(attachment)
                      return (
                        <div key={index} className="flex items-center gap-3 p-3 bg-dark-800 rounded-xl">
                          <FileIcon className={`w-5 h-5 ${getFileIconColor(attachment)}`} />
                          <a
                            href={attachment.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={attachment.fileName}
                            className="text-sm text-dark-300 flex-1 truncate hover:text-white transition-colors"
                          >
                            {attachment.fileName}
                          </a>
                          <button
                            type="button"
                            onClick={() => removePaymentAttachment(index)}
                            className="p-1 text-dark-400 hover:text-red-400"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => paymentFileInputRef.current?.click()}
                disabled={uploading}
                className={`flex items-center gap-2 w-full p-3 rounded-xl border border-dashed transition-colors ${
                  paymentForm.attachments.length > 0
                    ? 'border-violet-500/30 text-violet-400'
                    : 'border-dark-600 text-dark-400 hover:border-dark-500 hover:text-white'
                } ${uploading ? 'opacity-50' : ''}`}
              >
                <Paperclip className="w-4 h-4" />
                <span className="text-sm">
                  {uploading ? 'Enviando...' : 'Anexar comprovante'}
                </span>
              </button>
              <input
                ref={paymentFileInputRef}
                type="file"
                accept="image/*,.pdf,.xls,.xlsx,.csv,.doc,.docx"
                onChange={handlePaymentFileSelect}
                multiple
                className="hidden"
              />
            </>
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
              variant="success"
              loading={saving}
              disabled={activeAccounts.length === 0}
              className="flex-1"
            >
              Confirmar Pagamento
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Nova Categoria */}
      <Modal
        isOpen={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        title="Nova Categoria"
      >
        <div className="space-y-4">
          <Input
            label="Nome da Categoria"
            type="text"
            placeholder={expenseForm.type === TRANSACTION_TYPES.EXPENSE ? "Ex: Streaming, Academia..." : "Ex: Estorno, Reembolso..."}
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAddCategory()
              }
            }}
          />

          <p className="text-xs text-dark-400">
            A categoria será criada como categoria de{' '}
            <span className={expenseForm.type === TRANSACTION_TYPES.EXPENSE ? 'text-red-400' : 'text-emerald-400'}>
              {expenseForm.type === TRANSACTION_TYPES.EXPENSE ? 'despesa' : 'receita'}
            </span>.
          </p>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCategoryModalOpen(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAddCategory}
              variant="primary"
              loading={savingCategory}
              disabled={!newCategoryName.trim()}
              className="flex-1"
            >
              Criar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Bank Selector Modal */}
      <BankSelector
        isOpen={bankSelectorOpen}
        onClose={() => setBankSelectorOpen(false)}
        onSelect={(bankId) => setCardForm({ ...cardForm, bankId })}
        selectedBankId={cardForm.bankId}
      />
    </div>
  )
}

