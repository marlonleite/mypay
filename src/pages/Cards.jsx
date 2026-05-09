import { useState, useMemo, useEffect } from 'react'
import {
  Plus,
  CreditCard,
  Trash2,
  Edit2,
  CheckSquare,
  Square,
  ChevronRight,
  Calendar,
  Receipt,
  Check,
  Wallet,
  Tag,
  X,
  Search,
  Filter,
  Lock,
  Scan,
  Loader2
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
import { useCards, useAllCardExpenses, useCardExpenses, useAccounts, useBillPayments, useCreditCardInvoices, useAllCreditCardInvoices, useTags, useCategories } from '../hooks/useFirestore'
import InvoiceAttachmentList from '../components/cards/InvoiceAttachmentList'
import { describeApiError } from '../utils/apiErrors'
import { usePrivacy } from '../contexts/PrivacyContext'
import { useToast } from '../contexts/ToastContext'
import { isDateInMonth, formatDateForInput } from '../utils/helpers'
import { coerceFormTagList, normalizeTagForForm } from '../utils/formTags'
import { CARD_COLORS, MONTHS, TRANSACTION_TYPES } from '../utils/constants'
// uploadComprovante removido pós F-Cards-attachments — comprovantes vão via
// attachmentService.uploadAttachment (em handlePayBill) após backend retornar
// o id da transaction.

// Mirrors credit_card_invoice aggregate: expense -> +amount, income -> -amount
// (same as SqlAlchemyCreditCardInvoiceRepository signed_expense case).
function ledgerOwedDeltaForCardExpense(e) {
  const raw = Number(e.amount) || 0
  return e.type === TRANSACTION_TYPES.INCOME ? -raw : raw
}

function sumCardBillLedger(expensesList) {
  return expensesList.reduce((sum, e) => sum + ledgerOwedDeltaForCardExpense(e), 0)
}

/** `payment_amount` da invoice já reflete pagamento alocado — evita segundo POST /pay (um lançamento por fatura). */
const INVOICE_REGISTERED_PAYMENT_EPSILON = 0.01

function hasRegisteredBillPayment(invoice) {
  if (!invoice) return false
  if (invoice.status === 'paid') return true
  return (invoice.paymentAmount ?? 0) > INVOICE_REGISTERED_PAYMENT_EPSILON
}

const DUPLICATE_INVOICE_PAY_MESSAGE =
  'Esta fatura já tem pagamento registrado (um por fatura). Reabra a fatura para desfazer e poder pagar de novo.'

export default function Cards({
  month, year, onMonthChange, onNavigate,
  openCardId, openInvoiceId, onConsumeOpenCard, onConsumeOpenInvoice,
}) {
  const { formatCurrency } = usePrivacy()
  const { toast } = useToast()
  const {
    cards,
    loading: loadingCards,
    addCard,
    updateCard,
    deleteCard
  } = useCards()

  const cardIds = useMemo(() => cards.map(c => c.id), [cards])
  const { invoicesByCard } = useAllCreditCardInvoices(cardIds)

  const { expenses: allExpenses, loading: loadingExpenses, refresh: refreshAllCardExpenses } = useAllCardExpenses()
  const { accounts, loading: loadingAccounts } = useAccounts()
  const {
    isBillPaid,
    isBillFullyPaid,
    getTotalPaid,
    getBillPaymentForInvoice,
    getPreviousBalance,
    addBillPayment,
    reopenBillPayment,
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
  const [bankSelectorOpen, setBankSelectorOpen] = useState(false)

  // Faturas do cartão selecionado (Onda 2 — entidade própria) + helpers.
  // refresh é invocado após pagar/estornar pra recomputar amount/balance/payment_amount.
  const {
    invoices: cardInvoices,
    loading: loadingCardInvoices,
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

  const [bulkExpenseSelectMode, setBulkExpenseSelectMode] = useState(false)
  const [bulkSelectedExpenseIds, setBulkSelectedExpenseIds] = useState([])
  /** null | { kind: 'delete', chunk, chunkTotal } | { kind: 'refresh' } — bloqueia fechar o modal e mostra progresso */
  const [bulkDeleteStatus, setBulkDeleteStatus] = useState(null)

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
      const subs = getSubcategories(cat.id, expenseForm.type)
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
  })

  // Tags filtradas para autocomplete
  const filteredTagSuggestions = useMemo(() => {
    const current = coerceFormTagList(expenseForm.tags)
    if (!tagInput.trim()) return existingTags.filter(t => !current.includes(t))
    const term = tagInput.toLowerCase()
    return existingTags.filter(t =>
      t.toLowerCase().includes(term) && !current.includes(t)
    )
  }, [tagInput, existingTags, expenseForm.tags])

  // Verificar se despesa pertence à fatura (billMonth/billYear com fallback para data)
  const isExpenseInBill = (expense, billMonth, billYear) => {
    if (expense.billMonth != null && expense.billYear != null) {
      return expense.billMonth === billMonth && expense.billYear === billYear
    }
    return isDateInMonth(expense.date, billMonth, billYear)
  }

  // Item está fora do ciclo da fatura quando a data da compra cai antes do
  // starting_date ou depois do closing_date da invoice atual. Usado pra sinalizar
  // visualmente que o lançamento foi vinculado à fatura por outro critério (ex.:
  // edição manual de billMonth/billYear ou parcela com data deslocada).
  const getInvoicePeriodFlag = (expense) => {
    if (!currentInvoice?.startingDate || !currentInvoice?.closingDate) return null
    if (!expense?.date) return null
    const d = expense.date instanceof Date ? expense.date : new Date(expense.date)
    if (Number.isNaN(d.getTime())) return null
    if (d < currentInvoice.startingDate) return 'before'
    if (d > currentInvoice.closingDate) return 'after'
    return null
  }

  const formatInvoicePeriodLabel = () => {
    if (!currentInvoice?.startingDate || !currentInvoice?.closingDate) return ''
    return `${formatDate(currentInvoice.startingDate)} → ${formatDate(currentInvoice.closingDate)}`
  }

  // Totais na lista: mesma regra da fatura em detalhe — se existe invoice no
  // mês/ano (vencimento), soma só lançamentos com creditCardInvoiceId dessa
  // invoice; senão fallback billMonth/data (legado / sem invoice materializada).
  const cardTotals = useMemo(() => {
    const totals = {}
    cards.forEach(card => {
      const invoices = invoicesByCard[card.id] || []
      const inv = invoices.find(i =>
        i.dueDate &&
        i.dueDate.getMonth() === month &&
        i.dueDate.getFullYear() === year
      )
      const cardItems = inv
        ? allExpenses.filter(e => e.cardId === card.id && e.creditCardInvoiceId === inv.id)
        : allExpenses.filter(e => e.cardId === card.id && isExpenseInBill(e, month, year))
      totals[card.id] = sumCardBillLedger(cardItems)
    })
    return totals
  }, [cards, allExpenses, month, year, invoicesByCard])

  // Status "fatura paga" na lista de cartões: backend (credit_card_invoices.status)
  // é fonte de verdade. Cai em isBillPaid (transação de pagamento) só quando não
  // há invoice materializada pra aquele mês/ano (legado / cartões sem invoice).
  // Sem isso, divergência entre status da invoice e existência da transação no
  // mês visualizado pode mostrar fatura como aberta mesmo já estando paga.
  const isCardInvoicePaid = (cardId) => {
    const invs = invoicesByCard[cardId] || []
    const inv = invs.find(i =>
      i.dueDate &&
      i.dueDate.getMonth() === month &&
      i.dueDate.getFullYear() === year
    )
    if (inv) return inv.status === 'paid'
    return isBillPaid(cardId)
  }

  // Hook para despesas do cartão selecionado — filtra por invoice quando disponível.
  const currentInvoice = findInvoiceByDueMonth(month, year)
  const {
    expenses: invoiceExpenses = [],
    loading: loadingInvoiceExpenses,
    addCardExpense,
    updateCardExpense,
    deleteCardExpense,
    deleteCardExpensesBatch,
    refresh: refreshInvoiceExpenses,
  } = useCardExpenses(selectedCard?.id, month, year, currentInvoice?.id)

  useEffect(() => {
    if (modalType !== 'details') {
      setBulkExpenseSelectMode(false)
      setBulkSelectedExpenseIds([])
    }
  }, [modalType])

  useEffect(() => {
    setBulkExpenseSelectMode(false)
    setBulkSelectedExpenseIds([])
  }, [selectedCard?.id])

  const setBulkSelectionMode = (on) => {
    setBulkExpenseSelectMode(on)
    if (!on) setBulkSelectedExpenseIds([])
  }

  const toggleBulkExpenseSelect = (id) => {
    setBulkSelectedExpenseIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  // Despesas do cartão selecionado — vêm do hook invoice-based quando há invoice.
  const selectedCardExpenses = useMemo(() => {
    if (!selectedCard) return []
    if (currentInvoice) return [...invoiceExpenses].sort((a, b) => new Date(b.date) - new Date(a.date))
    return allExpenses
      .filter(e => e.cardId === selectedCard.id && isExpenseInBill(e, month, year))
      .sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [invoiceExpenses, allExpenses, selectedCard, currentInvoice, month, year])

  // Full invoice / period total for logic (pagamento, limite, saldo bloqueado).
  const selectedCardExpenseTotal = useMemo(
    () => sumCardBillLedger(selectedCardExpenses),
    [selectedCardExpenses]
  )

  // Total da fatura em exibição: mesmas linhas que `selectedCardExpenses` (filtro
  // por credit_card_invoice_id quando há invoice). Campo `invoice.amount` na API
  // pode ficar defasado após DELETE/PUT até recomputar — somar o ledger evita
  // total "travado" enquanto a lista já decrementou.
  const invoiceFullChargeTotal = useMemo(() => {
    if (currentInvoice != null) {
      if (loadingInvoiceExpenses) return Number(currentInvoice.amount) || 0
      return selectedCardExpenseTotal
    }
    return selectedCardExpenseTotal
  }, [currentInvoice, selectedCardExpenseTotal, loadingInvoiceExpenses])

  // Categorias para filtro de lançamentos (expense + income)
  const expenseFilterCategories = useMemo(() => {
    const result = []
    for (const type of ['expense', 'income']) {
      const mainCats = getMainCategories(type)
      for (const cat of mainCats) {
        result.push({ value: cat.id, label: cat.name })
        const subs = getSubcategories(cat.id, type)
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

  const selectAllFilteredExpenses = () => {
    setBulkSelectedExpenseIds(filteredCardExpenses.map((e) => e.id))
  }

  const filteredCardExpenseTotal = useMemo(
    () => sumCardBillLedger(filteredCardExpenses),
    [filteredCardExpenses]
  )

  const invoiceListFilterActive = Boolean(
    (typeof expenseSearch === 'string' && expenseSearch.trim().length > 0)
    || expenseCategoryFilter.length > 0
  )

  // Summary hero: quando usuário filtra lista, topo reflete só o que vê (+ total completo auxiliar).
  const modalHeroBillTotal = invoiceListFilterActive
    ? filteredCardExpenseTotal
    : invoiceFullChargeTotal

  // Fatura paga = lançamentos bloqueados (read-only). Backend
  // (credit_card_invoices.status) é fonte de verdade quando há invoice
  // materializada — usar OR com `isBillPaid` causava falso positivo: pagamento
  // de outra invoice do mesmo card disparava "Reabrir fatura" e o backend
  // respondia 409 "Invoice is not paid". `isBillPaid` permanece só como
  // fallback pra cartões/meses sem invoice materializada.
  const billConsideredPaid = currentInvoice
    ? currentInvoice.status === 'paid'
    : (selectedCard != null && isBillPaid(selectedCard.id))
  const isBillLocked = selectedCard && billConsideredPaid && invoiceFullChargeTotal > 0

  const bulkDeleteBusy = bulkDeleteStatus != null

  const handleDetailsModalClose = () => {
    if (bulkDeleteBusy) return
    setModalType(null)
  }

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

  // Auto-abre modal de detalhes quando App passa `openCardId` via URL
  // (?card=<id>). Usado pelo redirect de Lançamentos quando DELETE de
  // pagamento de fatura retorna 409 — guia o usuário até "Reabrir fatura".
  useEffect(() => {
    if (!openCardId || cards.length === 0) return
    const card = cards.find((c) => c.id === openCardId)
    if (!card) return
    openCardDetails(card)
    onConsumeOpenCard?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openCardId, cards])

  // ?invoice=<uuid> alinha mês/ano ao vencimento da fatura do pagamento (Lançamentos
  // usa data do lançamento; em Cartões o seletor é o mês do due_date da invoice).
  useEffect(() => {
    if (!openInvoiceId || !selectedCard || loadingCardInvoices) return
    const inv = cardInvoices.find((i) => i.id === openInvoiceId)
    if (inv?.dueDate) {
      onMonthChange(inv.dueDate.getMonth(), inv.dueDate.getFullYear())
    }
    onConsumeOpenInvoice?.()
  }, [
    openInvoiceId,
    selectedCard,
    cardInvoices,
    loadingCardInvoices,
    onMonthChange,
    onConsumeOpenInvoice,
  ])

  const openNewExpenseModal = () => {
    setBulkSelectionMode(false)
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
    setModalType('expense')
  }

  const openEditExpenseModal = (expense) => {
    setBulkSelectionMode(false)
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
      tags: coerceFormTagList(expense.tags),
      billMonth: expense.billMonth ?? month,
      billYear: expense.billYear ?? year,
    })
    setShowTags(coerceFormTagList(expense.tags).length > 0)
    setTagInput('')
    setModalType('expense')
  }

  const openPayBillModal = () => {
    const invoice = findInvoiceByDueMonth(month, year)
    if (!invoice) return
    if (hasRegisteredBillPayment(invoice)) {
      toast.error(DUPLICATE_INVOICE_PAY_MESSAGE)
      return
    }

    const billAmount = invoiceFullChargeTotal
    const previousBalance = getPreviousBalance(selectedCard?.id)
    const totalDue = billAmount + previousBalance

    const dueDate = new Date(year, month, selectedCard?.dueDay || 1)

    setPaymentForm({
      accountId: activeAccounts[0]?.id || '',
      date: formatDateForInput(dueDate),
      amount: totalDue,
      isPartial: false,
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
      toast.success('Cartão excluído.')
    } catch (error) {
      console.error('Error deleting card:', error)
      toast.error(`Não foi possível excluir o cartão: ${error?.message || 'erro desconhecido'}`)
    }
  }

  // Tags
  const addTag = (rawTag = tagInput.trim()) => {
    const tag = String(rawTag ?? '').trim()
    if (!tag) return
    setExpenseForm(prev => {
      const list = coerceFormTagList(prev.tags)
      if (list.includes(tag)) return prev
      return { ...prev, tags: [...list, tag] }
    })
    setTagInput('')
    setShowTagSuggestions(false)
  }

  const removeTag = (tagToRemove) => {
    setExpenseForm(prev => ({
      ...prev,
      tags: coerceFormTagList(prev.tags).filter(t => t !== tagToRemove)
    }))
  }

  const selectTagSuggestion = (tag) => {
    addTag(tag)
  }

  const handleSaveExpense = async (e) => {
    e.preventDefault()
    if (!expenseForm.description || !expenseForm.amount || !selectedCard) return

    try {
      setSaving(true)

      let categoryForSave = expenseForm.category || null
      if (!editingItem && !categoryForSave) {
        const { fetchSettings } = await import('../services/settingsService')
        const s = await fetchSettings()
        if (expenseForm.type === TRANSACTION_TYPES.EXPENSE && s?.defaultCategoryIdExpense) {
          categoryForSave = s.defaultCategoryIdExpense
        } else if (expenseForm.type === TRANSACTION_TYPES.INCOME && s?.defaultCategoryIdIncome) {
          categoryForSave = s.defaultCategoryIdIncome
        }
      }

      if (editingItem) {
        // Atualizar lançamento existente — usa billMonth/billYear do form (editável)
        await updateCardExpense(editingItem.id, {
          type: expenseForm.type,
          description: expenseForm.description,
          amount: expenseForm.amount,
          category: categoryForSave,
          date: expenseForm.date,
          tags: expenseForm.tags.length > 0 ? expenseForm.tags : [],
          billMonth: expenseForm.billMonth,
          billYear: expenseForm.billYear,
          creditCardInvoiceId: currentInvoice?.id ?? editingItem.creditCardInvoiceId,
        })
      } else {
        // Criar novo lançamento — vincula à fatura sendo visualizada.
        // Quando há `currentInvoice`, força `credit_card_invoice_id` no payload
        // pra que o backend NÃO faça auto-resolve via `date` (evita item sumir
        // pra fatura adjacente quando a data cai fora do ciclo do cartão).
        // Sem `currentInvoice` (fatura ainda não materializada), deixamos o
        // backend resolver via `ensure_invoice_for_period`.
        await addCardExpense({
          cardId: selectedCard.id,
          creditCardInvoiceId: currentInvoice?.id,
          type: expenseForm.type,
          description: expenseForm.description,
          amount: expenseForm.amount,
          category: categoryForSave,
          date: expenseForm.date,
          installments: parseInt(expenseForm.installments) || 1,
          tags: expenseForm.tags.length > 0 ? expenseForm.tags : [],
          billMonth: month,
          billYear: year
        })
      }

      setModalType('details')
      await refreshAllCardExpenses()
      await refreshInvoices()
    } catch (error) {
      console.error('Error saving expense:', error)
      toast.error(describeApiError(error, 'Não foi possível salvar o lançamento.'))
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteExpense = async (expenseId) => {
    try {
      await deleteCardExpense(expenseId)
      await refreshAllCardExpenses()
      await refreshInvoices()
      setBulkSelectedExpenseIds((prev) => prev.filter((id) => id !== expenseId))
    } catch (error) {
      console.error('Error deleting expense:', error)
      toast.error(describeApiError(error, 'Não foi possível excluir o lançamento.'))
    }
  }

  const handleBulkDeleteExpenses = async () => {
    const ids = [...new Set(bulkSelectedExpenseIds.filter(Boolean))]
    if (ids.length === 0) return
    const n = ids.length
    if (
      !confirm(
        `Excluir ${n} lançamento${n !== 1 ? 's' : ''}? Isso remove cada item da fatura (não dá para desfazer daqui).`
      )
    ) {
      return
    }
    try {
      const { results, failed_count: failedCount } = await deleteCardExpensesBatch(ids, {
        skipRefetch: true,
        onChunk: ({ chunk, chunkTotal }) => {
          setBulkDeleteStatus({ kind: 'delete', chunk, chunkTotal })
        },
      })
      setBulkDeleteStatus({ kind: 'refresh' })
      await refreshInvoiceExpenses()
      await refreshAllCardExpenses()
      await refreshInvoices()

      const failedIds = new Set(
        (results || [])
          .filter((r) => r?.error != null || r?.deleted === false)
          .map((r) => r.id)
          .filter(Boolean)
      )
      if (failedCount > 0) {
        setBulkSelectedExpenseIds((prev) => prev.filter((id) => failedIds.has(id)))
        const msgs = (results || [])
          .filter((r) => !r.deleted)
          .map((r) => r.error?.message || r.id)
        const preview = msgs.slice(0, 5).join('; ')
        const more = msgs.length > 5 ? ` (+${msgs.length - 5})` : ''
        alert(
          `${failedCount} de ${n} não ${failedCount === 1 ? 'pôde ser excluído' : 'puderam ser excluídos'}.${preview ? `\n${preview}${more}` : ''}`
        )
      } else {
        setBulkSelectionMode(false)
      }
    } catch (error) {
      console.error('Bulk delete failed:', error)
      const msg = error?.message || 'Erro ao excluir em lote'
      alert(msg)
    } finally {
      setBulkDeleteStatus(null)
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
    if (hasRegisteredBillPayment(invoice)) {
      toast.error(DUPLICATE_INVOICE_PAY_MESSAGE)
      return
    }

    const billAmount = invoiceFullChargeTotal
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
      await addBillPayment({
        cardId: selectedCard.id,
        paidCreditCardInvoiceId: invoice.id,
        accountId: paymentForm.accountId,
        amount: paymentAmount,
        description,
        paidAt: new Date(paymentForm.date + 'T12:00:00'),
      })

      // Wave9: anexos da fatura são gerenciados ao vivo pelo
      // <InvoiceAttachmentList /> dentro do modal — uploads acontecem
      // imediatamente, então não há mais staging pra processar aqui.

      // Recompute invoice (balance/payment_amount mudaram)
      await refreshInvoices()

      setModalType('details')
    } catch (error) {
      console.error('Error paying bill:', error)
      toast.error(describeApiError(error, 'Não foi possível pagar a fatura.'))
    } finally {
      setSaving(false)
    }
  }

  const handleCancelPayment = async () => {
    if (!selectedCard) return

    // Wave9: reopen desfaz o pagamento vinculado à fatura (um lançamento por fatura no fluxo /pay).
    const invoice = findInvoiceByDueMonth(month, year)
    if (!invoice) return

    if (!confirm('Deseja reabrir esta fatura? O pagamento registrado será desfeito (anexos serão preservados).')) return

    try {
      setSaving(true)
      await reopenBillPayment(invoice.id)
      await refreshInvoices()
    } catch (error) {
      console.error('Error reopening invoice:', error)
      toast.error(describeApiError(error, 'Não foi possível reabrir a fatura.'))
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
  const normalizeTag = normalizeTagForForm

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
            const isPaid = isCardInvoicePaid(card.id)
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
        onClose={handleDetailsModalClose}
        title={selectedCard?.name || 'Detalhes do Cartão'}
        closeOnBackdropClick={!bulkDeleteBusy}
        closeOnEscape={!bulkDeleteBusy}
        disableHeaderClose={bulkDeleteBusy}
      >
        <div className="space-y-4">
          {/* Card Summary */}
          <div className={`p-4 rounded-xl ${getColorClass(selectedCard?.color)}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CreditCard className="w-8 h-8 text-white/80" />
                {selectedCard && billConsideredPaid && invoiceFullChargeTotal > 0 && (
                  <span className="px-2 py-1 text-xs font-medium bg-white/20 text-white rounded-lg flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    PAGA
                  </span>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs text-white/60">
                  {invoiceListFilterActive
                    ? `Filtrado (${filteredCardExpenses.length}/${selectedCardExpenses.length}) · ${MONTHS[month]}`
                    : `Fatura ${MONTHS[month]}`}
                </p>
                <p className="text-2xl font-bold text-white">
                  {formatCurrency(modalHeroBillTotal)}
                </p>
                {currentInvoice?.startingDate && currentInvoice?.closingDate && (
                  <p className="text-[11px] text-white/55 mt-0.5">
                    Ciclo {formatInvoicePeriodLabel()}
                  </p>
                )}
                {invoiceListFilterActive && selectedCardExpenses.length > 0 && (
                  <p className="text-xs text-white/50 mt-0.5">
                    Total da fatura: {formatCurrency(invoiceFullChargeTotal)}
                  </p>
                )}
                {!invoiceListFilterActive && selectedCardExpenses.length > 0 && (
                  <p className="text-xs text-white/45 mt-0.5">
                    {selectedCardExpenses.length}{' '}
                    lançamento{selectedCardExpenses.length !== 1 ? 's' : ''}
                  </p>
                )}
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
                  used={invoiceFullChargeTotal}
                  limit={selectedCard.limit}
                  size="md"
                  showLabel={true}
                />
              </div>
            )}

            {/* Payment Info */}
            {selectedCard && billConsideredPaid && (() => {
              // billPayment pode ser null no estado órfão (invoice.status='paid'
              // sem transação correspondente no mês visualizado). Cai em
              // currentInvoice.paidAt e omite o nome da conta nesse caso.
              const billPayment = currentInvoice
                ? getBillPaymentForInvoice(currentInvoice.id)
                : undefined
              const accountName = billPayment ? getAccountName(billPayment.accountId) : null
              const paidAtRaw = billPayment?.paidAt ?? currentInvoice?.paidAt ?? null
              const paidAtStr = paidAtRaw
                ? (paidAtRaw.toDate ? paidAtRaw.toDate() : new Date(paidAtRaw)).toLocaleDateString('pt-BR')
                : '--'
              return (
                <div className="mt-3 pt-3 border-t border-white/20 text-sm text-white/80">
                  <div className="flex items-center justify-between">
                    <p className="flex items-center gap-1">
                      <Wallet className="w-4 h-4" />
                      {accountName
                        ? `Pago via ${accountName} em ${paidAtStr}`
                        : `Fatura paga em ${paidAtStr}`}
                    </p>
                    <button
                      onClick={handleCancelPayment}
                      disabled={saving}
                      className="text-xs text-red-400 hover:text-red-300 underline disabled:opacity-50"
                    >
                      Reabrir fatura
                    </button>
                  </div>
                </div>
              )
            })()}
          </div>

          {/* Comprovantes da fatura (Wave9) — sobrevivem ao ciclo pagar/reabrir. */}
          {currentInvoice?.id && (
            <div className="px-1">
              <InvoiceAttachmentList invoiceId={currentInvoice.id} />
            </div>
          )}

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
              {selectedCard && !billConsideredPaid && invoiceFullChargeTotal > 0 && (
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

          {!isBillLocked && selectedCardExpenses.length > 0 && filteredCardExpenses.length > 0 && (
            <>
              <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={bulkDeleteBusy}
                onClick={() =>
                  bulkExpenseSelectMode ? setBulkSelectionMode(false) : setBulkSelectionMode(true)
                }
                className={`text-xs font-medium px-3 py-2 rounded-xl border transition-colors disabled:opacity-40 disabled:pointer-events-none ${
                  bulkExpenseSelectMode
                    ? 'border-violet-500/50 bg-violet-500/10 text-violet-300'
                    : 'border-dark-600 text-dark-300 hover:text-white hover:bg-dark-800'
                }`}
              >
                {bulkExpenseSelectMode ? 'Cancelar seleção' : 'Selecionar vários'}
              </button>
              {bulkExpenseSelectMode && (
                <>
                  <button
                    type="button"
                    disabled={bulkDeleteBusy}
                    onClick={selectAllFilteredExpenses}
                    className="text-xs font-medium px-3 py-2 rounded-xl border border-dark-600 text-dark-300 hover:text-white hover:bg-dark-800 disabled:opacity-40 disabled:pointer-events-none"
                  >
                    Todos na lista
                  </button>
                  <button
                    type="button"
                    disabled={bulkSelectedExpenseIds.length === 0 || bulkDeleteBusy}
                    onClick={handleBulkDeleteExpenses}
                    className="inline-flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border border-red-500/40 text-red-400 hover:bg-red-500/15 disabled:opacity-40 disabled:pointer-events-none"
                  >
                    {bulkDeleteBusy ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden />
                        <span>Excluindo...</span>
                      </>
                    ) : (
                      `Excluir (${bulkSelectedExpenseIds.length})`
                    )}
                  </button>
                </>
              )}
            </div>
            {bulkDeleteBusy && bulkDeleteStatus && (
              <div
                role="status"
                aria-live="polite"
                aria-busy="true"
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-violet-500/10 border border-violet-500/25 text-sm text-violet-200"
              >
                <Loader2 className="w-4 h-4 shrink-0 animate-spin text-violet-400" aria-hidden />
                <span>
                  {bulkDeleteStatus.kind === 'delete'
                    ? bulkDeleteStatus.chunkTotal > 1
                      ? `Excluindo lote ${bulkDeleteStatus.chunk} de ${bulkDeleteStatus.chunkTotal}...`
                      : 'Excluindo lançamentos...'
                    : 'Atualizando a lista...'}
                </span>
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
                const bulkSelected = bulkSelectedExpenseIds.includes(expense.id)
                const periodFlag = getInvoicePeriodFlag(expense)
                const periodBadgeLabel =
                  periodFlag === 'before' ? 'antes do ciclo'
                  : periodFlag === 'after' ? 'após o ciclo'
                  : null
                const periodBadgeTitle = periodFlag
                  ? `Vinculado a esta fatura — ciclo ${formatInvoicePeriodLabel()}`
                  : ''
                return (
                  <div
                    key={expense.id}
                    className={`flex items-center gap-3 p-3 bg-dark-800/30 rounded-xl border border-dark-700/30 ${
                      bulkSelected ? 'ring-1 ring-violet-500/35' : ''
                    }`}
                  >
                    {bulkExpenseSelectMode && !isBillLocked && (
                      <button
                        type="button"
                        disabled={bulkDeleteBusy}
                        onClick={() => toggleBulkExpenseSelect(expense.id)}
                        className="flex-shrink-0 p-0.5 text-violet-400 rounded-lg hover:bg-violet-500/10 disabled:opacity-40 disabled:pointer-events-none"
                        aria-label={bulkSelected ? 'Desmarcar lançamento' : 'Selecionar lançamento'}
                      >
                        {bulkSelected ? (
                          <CheckSquare className="w-5 h-5" />
                        ) : (
                          <Square className="w-5 h-5 text-dark-500" />
                        )}
                      </button>
                    )}
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
                        {periodBadgeLabel && (
                          <span
                            className="ml-1.5 inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/15 text-amber-300 rounded align-middle"
                            title={periodBadgeTitle}
                          >
                            {periodBadgeLabel}
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
                      {isIncome ? '+' : '-'}{formatCurrency(Math.abs(Number(expense.amount) || 0))}
                    </p>
                    {!isBillLocked && !bulkExpenseSelectMode && (
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
                <span className="text-white">{formatCurrency(invoiceFullChargeTotal)}</span>
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
                  {formatCurrency(invoiceFullChargeTotal + (selectedCard ? getPreviousBalance(selectedCard.id) : 0))}
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

              {paymentForm.amount && paymentForm.amount < (invoiceFullChargeTotal + (selectedCard ? getPreviousBalance(selectedCard.id) : 0)) && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                  <p className="text-xs text-amber-400">
                    Pagamento parcial. O saldo restante de{' '}
                    <span className="font-bold">
                      {formatCurrency(invoiceFullChargeTotal + (selectedCard ? getPreviousBalance(selectedCard.id) : 0) - (paymentForm.amount || 0))}
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

              {/* Comprovantes da fatura — uploads imediatos. Os mesmos anexos
                  aparecem no modal de detalhes (sobrevivem ao ciclo
                  pagar/reabrir). */}
              {currentInvoice?.id && (
                <div className="px-1">
                  <InvoiceAttachmentList invoiceId={currentInvoice.id} />
                </div>
              )}
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

