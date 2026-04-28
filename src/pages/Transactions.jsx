import { useState, useMemo, useRef, useEffect, useLayoutEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Receipt,
  MessageSquare,
  Paperclip,
  Tag,
  Repeat,
  X,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  File,
  Check,
  Clock,
  ThumbsUp,
  ThumbsDown,
  Filter,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Layers2
} from 'lucide-react'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Input from '../components/ui/Input'
import CurrencyInput from '../components/ui/CurrencyInput'
import Select from '../components/ui/Select'
import SearchableSelect from '../components/ui/SearchableSelect'
import MonthSelector from '../components/ui/MonthSelector'
import Loading from '../components/ui/Loading'
import EmptyState from '../components/ui/EmptyState'
import TransactionDetail from '../components/transactions/TransactionDetail'
import CategorySelector from '../components/transactions/CategorySelector'
import {
  useTransactions,
  useCategories,
  useAccounts,
  useTags,
  useCards,
  useRecurrences,
} from '../hooks/useFirestore'
import { useAuth } from '../contexts/AuthContext'
import { useActivityLogger } from '../hooks/useActivities'
import { usePrivacy } from '../contexts/PrivacyContext'
import { formatDate, formatDateForInput, groupByDate } from '../utils/helpers'
import { TRANSACTION_TYPES, CATEGORY_COLORS, FIXED_FREQUENCIES, INSTALLMENT_PERIODS } from '../utils/constants'
import { listAttachments, uploadAttachment, deleteAttachment } from '../services/attachmentService'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { matchTransaction } from '../utils/searchTransactions'
import {
  matchesTransactionSourceFilter,
  isRecurrenceLinkedTransaction,
  isInstallmentPlanTransaction,
  formatInstallmentFraction
} from '../utils/transactionSemantics'

const TX_FILTER_TYPES = new Set([
  'all', 'income', 'income_paid', 'income_pending', 'expense', 'expense_paid', 'expense_pending', 'fixed', 'installment',
])

const TX_FILTER_SOURCES = new Set(['all', 'account', 'card', 'bill_payment'])
/** Padrão em Lançamentos: só movimentos de conta (exclui credit_card_id; inclui paid_credit_card_id). */
const DEFAULT_TX_SOURCE = 'account'

/** Frequências onde o backend usa `day_of_period` (dia do mês). */
const RECURRENCE_MONTHLY_LIKE_FREQUENCIES = new Set([
  'monthly',
  'bimonthly',
  'quarterly',
  'semiannual',
  'annual',
])

/** Dia civil local para cortes "desta data em diante" em exclusões em série. */
function transactionDayStamp(d) {
  const x = d instanceof Date ? d : new Date(d)
  return new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
}

export default function Transactions({
  month, year, onMonthChange, showAddModal, onCloseAddModal,
  filters, onFiltersChange, searchTerm, onSearchTermChange,
  showFilters, onShowFiltersChange, dateRange, onDateRangeChange
}) {
  const { formatCurrency } = usePrivacy()
  const { user } = useAuth()
  const setDateRange = onDateRangeChange
  const setFilters = onFiltersChange
  const setSearchTerm = onSearchTermChange
  const setShowFilters = onShowFiltersChange

  // API: exclude_card_expenses=true remove compras (credit_card_id). Pagamentos de fatura (paid_*) seguem.
  // Só traz faturas de cartão no JSON quando a origem pede: "Todas" ou "Despesas na fatura do cartão" (aba Cartão é outra tela).
  const needCardPurchaseRows =
    (filters.source ?? DEFAULT_TX_SOURCE) === 'all' ||
    (filters.source ?? DEFAULT_TX_SOURCE) === 'card'

  const {
    transactions,
    loading,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    refreshTransactions,
  } = useTransactions({
    month,
    year,
    dateRange,
    excludeCardExpenses: !needCardPurchaseRows
  })

  const {
    logTransactionCreate,
    logTransactionUpdate,
    logTransactionDelete
  } = useActivityLogger()

  const {
    categories: allCategories,
    addCategory,
    getMainCategories,
    getSubcategories
  } = useCategories()

  const {
    accounts,
    loading: loadingAccounts,
    needsInitialization: needsAccountInit,
    initializeDefaultAccounts,
    getActiveAccounts
  } = useAccounts()

  const { tags: existingTags } = useTags()
  const { cards } = useCards()
  const { addRecurrence, updateRecurrence } = useRecurrences()

  const fileInputRef = useRef(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const didHydrateTxUrl = useRef(false)
  const debouncedSearch = useDebouncedValue(searchTerm, 300)

  const [modalOpen, setModalOpen] = useState(false)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [transactionToDelete, setTransactionToDelete] = useState(null)
  const [editModeModalOpen, setEditModeModalOpen] = useState(false)
  const [editMode, setEditMode] = useState('single') // 'single' | 'all' | 'from_forward'
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState(null)
  const [transactionType, setTransactionType] = useState(TRANSACTION_TYPES.EXPENSE)
  const [activeFilterDropdown, setActiveFilterDropdown] = useState(null)
  const [showOverduePanel, setShowOverduePanel] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingCategory, setSavingCategory] = useState(false)
  /** Durante DELETE: qual transação e qual modo — evita spinner nos 3 botões ao mesmo tempo. */
  const [deleteProgress, setDeleteProgress] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)

  // Abas do formulário avançado
  const [showNotes, setShowNotes] = useState(false)
  const [showTags, setShowTags] = useState(false)
  const [showRecurrence, setShowRecurrence] = useState(false)

  const [formData, setFormData] = useState({
    description: '',
    amount: null,
    category: '',
    accountId: '',
    date: formatDateForInput(new Date()),
    notes: '',
    tags: [],
    attachments: [],
    recurrenceType: '', // 'fixed' ou 'installment'
    fixedFrequency: 'monthly', // frequência para despesa fixa
    installments: '',
    installmentPeriod: 'months', // período para parcelamento
    paid: true // true = pago, false = pendente
  })

  const [tagInput, setTagInput] = useState('')
  const [showTagSuggestions, setShowTagSuggestions] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryType, setNewCategoryType] = useState(TRANSACTION_TYPES.EXPENSE)

  // Inicializar contas se necessário
  useEffect(() => {
    if (needsAccountInit) {
      initializeDefaultAccounts()
    }
  }, [needsAccountInit])

  // Abrir modal quando vem do FAB
  useEffect(() => {
    if (showAddModal) {
      openNewModal(TRANSACTION_TYPES.EXPENSE)
      onCloseAddModal?.()
    }
  }, [showAddModal])

  // Contas ativas
  const activeAccounts = useMemo(() => getActiveAccounts(), [accounts])

  const getCardName = (cardId) => {
    if (!cardId) return ''
    return cards.find(c => c.id === cardId)?.name || 'Cartão'
  }

  // Tags filtradas para autocomplete
  const filteredTagSuggestions = useMemo(() => {
    if (!tagInput.trim()) return existingTags.filter(t => !formData.tags.includes(t))
    const term = tagInput.toLowerCase()
    return existingTags.filter(t =>
      t.toLowerCase().includes(term) && !formData.tags.includes(t)
    )
  }, [tagInput, existingTags, formData.tags])

  // Hidrata filtros/busca/datas a partir de query (ex.: ?txq=&txtype=… &tab=transactions)
  useLayoutEffect(() => {
    if (didHydrateTxUrl.current) return
    const has =
      (searchParams.get('txq') && searchParams.get('txq').length > 0) ||
      (searchParams.get('txtype') && searchParams.get('txtype') !== 'all') ||
      searchParams.has('txsrc') ||
      (searchParams.get('txacc') && searchParams.get('txacc') !== 'all') ||
      (searchParams.get('txcat') && searchParams.get('txcat').length > 0) ||
      (searchParams.get('txtag') && searchParams.get('txtag').length > 0) ||
      (searchParams.get('txfrom') && searchParams.get('txto')) ||
      searchParams.get('txopen') === '1'
    if (!has) {
      didHydrateTxUrl.current = true
      return
    }
    const q = searchParams.get('txq') || ''
    if (q) onSearchTermChange(q)
    const ty = searchParams.get('txtype')
    const src = searchParams.get('txsrc')
    const acc = searchParams.get('txacc') || 'all'
    onFiltersChange({
      type: ty && TX_FILTER_TYPES.has(ty) ? ty : 'all',
      source: src && TX_FILTER_SOURCES.has(src) ? src : DEFAULT_TX_SOURCE,
      account: acc !== 'all' && acc ? acc : 'all',
      category: searchParams.get('txcat') ? searchParams.get('txcat').split(',').filter(Boolean) : [],
      tag: searchParams.get('txtag') ? searchParams.get('txtag').split(',').filter(Boolean) : [],
    })
    const f = searchParams.get('txfrom')
    const t0 = searchParams.get('txto')
    if (f && t0) setDateRange({ startDate: f, endDate: t0 })
    if (searchParams.get('txopen') === '1') onShowFiltersChange(true)
    didHydrateTxUrl.current = true
  }, [searchParams, onSearchTermChange, onFiltersChange, onShowFiltersChange, setDateRange])

  // Sincroniza busca e filtros na URL (refresh permanecem)
  useEffect(() => {
    if (!didHydrateTxUrl.current) return
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        if (searchTerm?.trim()) p.set('txq', searchTerm.trim())
        else p.delete('txq')
        if (filters.type && filters.type !== 'all') p.set('txtype', filters.type)
        else p.delete('txtype')
        p.set('txsrc', (filters.source ?? DEFAULT_TX_SOURCE) || DEFAULT_TX_SOURCE)
        if (filters.account && filters.account !== 'all') p.set('txacc', filters.account)
        else p.delete('txacc')
        if (filters.category.length > 0) p.set('txcat', filters.category.join(','))
        else p.delete('txcat')
        if (filters.tag.length > 0) p.set('txtag', filters.tag.join(','))
        else p.delete('txtag')
        if (dateRange?.startDate && dateRange?.endDate) {
          p.set('txfrom', dateRange.startDate)
          p.set('txto', dateRange.endDate)
        } else {
          p.delete('txfrom')
          p.delete('txto')
        }
        if (showFilters) p.set('txopen', '1')
        else p.delete('txopen')
        return p
      },
      { replace: true }
    )
  }, [searchTerm, filters, dateRange, showFilters, setSearchParams])

  // Filtrar transações (período vem de useTransactions; busca: debouncada, acentos/valor/data vê matchTransaction)
  const filteredTransactions = useMemo(() => {
    let result = transactions

    // Filtro por tipo
    if (filters.type !== 'all') {
      result = result.filter(t => {
        switch (filters.type) {
          case 'income': return t.type === TRANSACTION_TYPES.INCOME
          case 'income_paid': return t.type === TRANSACTION_TYPES.INCOME && t.paid !== false
          case 'income_pending': return t.type === TRANSACTION_TYPES.INCOME && t.paid === false
          case 'expense': return t.type === TRANSACTION_TYPES.EXPENSE
          case 'expense_paid': return t.type === TRANSACTION_TYPES.EXPENSE && t.paid !== false
          case 'expense_pending': return t.type === TRANSACTION_TYPES.EXPENSE && t.paid === false
          case 'fixed': return isRecurrenceLinkedTransaction(t)
          case 'installment': return isInstallmentPlanTransaction(t)
          default: return true
        }
      })
    }

    // Origem: conta vs compra na fatura vs pagamento de fatura (FKs; ver transactionSemantics)
    const sourceFilter = filters.source ?? DEFAULT_TX_SOURCE
    if (sourceFilter !== 'all') {
      result = result.filter(t => matchesTransactionSourceFilter(t, sourceFilter))
    }

    // Filtro por conta
    if (filters.account !== 'all') {
      result = result.filter(t => t.accountId === filters.account)
    }

    // Filtro por categoria (IDs; GET não embute nome)
    if (filters.category.length > 0) {
      result = result.filter(t => t.categoryId && filters.category.includes(t.categoryId))
    }

    // Filtro por tag (multi-select)
    if (filters.tag.length > 0) {
      result = result.filter(t =>
        filters.tag.some(tag => t.tags?.includes(tag))
      )
    }

    if (debouncedSearch?.trim()) {
      result = result.filter((t) =>
        matchTransaction(t, debouncedSearch, { categories: allCategories, accounts })
      )
    }

    return result
  }, [transactions, debouncedSearch, filters, allCategories, accounts])

  const sortedForGroup = useMemo(() => {
    return [...filteredTransactions].sort((a, b) => {
      const da = a.date instanceof Date ? a.date : new Date(a.date)
      const db = b.date instanceof Date ? b.date : new Date(b.date)
      return db - da
    })
  }, [filteredTransactions])

  // Verificar se há filtros ativos
  const hasActiveFilters =
    filters.type !== 'all' ||
    (filters.source ?? DEFAULT_TX_SOURCE) !== DEFAULT_TX_SOURCE ||
    filters.account !== 'all' ||
    filters.category.length > 0 ||
    filters.tag.length > 0 ||
    Boolean(searchTerm?.trim()) ||
    Boolean(dateRange?.startDate && dateRange?.endDate)

  // Calcular lançamentos pendentes passados (vencidos)
  const overdueTransactions = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const sourceFilter = filters.source ?? DEFAULT_TX_SOURCE

    return transactions
      .filter(t => {
        if (t.paid !== false) return false // Só não pagos
        const transactionDate = t.date instanceof Date ? t.date : new Date(t.date)
        transactionDate.setHours(0, 0, 0, 0)
        return transactionDate < today // Data no passado
      })
      .filter(t => (sourceFilter === 'all' ? true : matchesTransactionSourceFilter(t, sourceFilter)))
      .sort((a, b) => {
        const dateA = a.date instanceof Date ? a.date : new Date(a.date)
        const dateB = b.date instanceof Date ? b.date : new Date(b.date)
        return dateA - dateB // Mais antigos primeiro
      })
  }, [transactions, filters.source])

  // Labels dos filtros
  const clearAllListFilters = () => {
    onFiltersChange({ type: 'all', source: DEFAULT_TX_SOURCE, account: 'all', category: [], tag: [] })
    onSearchTermChange('')
    setDateRange(null)
    setShowFilters(false)
  }

  const removeTypeFilter = () => onFiltersChange({ ...filters, type: 'all' })
  const removeSourceFilter = () => onFiltersChange({ ...filters, source: DEFAULT_TX_SOURCE })
  const removeAccountFilter = () => onFiltersChange({ ...filters, account: 'all' })
  const removeCategoryFilter = (id) =>
    onFiltersChange({ ...filters, category: filters.category.filter((c) => c !== id) })
  const removeTagFilter = (tag) =>
    onFiltersChange({ ...filters, tag: filters.tag.filter((x) => x !== tag) })

  const getTypeLabel = () => {
    const labels = {
      all: 'Tipo',
      income: 'Receitas',
      income_paid: 'Receitas recebidas',
      income_pending: 'Receitas pendentes',
      expense: 'Despesas',
      expense_paid: 'Despesas pagas',
      expense_pending: 'Despesas pendentes',
      fixed: 'Recorrentes',
      installment: 'Parcelados'
    }
    return labels[filters.type] || 'Tipo'
  }

  const getSourceLabel = () => {
    const labels = {
      all: 'Todas as origens',
      account: 'Conta (sem compra fatura)',
      card: 'Despesas na fatura do cartão',
      bill_payment: 'Pagamentos de fatura'
    }
    return labels[filters.source ?? DEFAULT_TX_SOURCE] || 'Origem'
  }

  // Agrupar por data (ordenado do mais recente ao mais antigo)
  const groupedTransactions = useMemo(() => {
    return groupByDate(sortedForGroup)
  }, [sortedForGroup])

  // Calcular saldos (realizado vs previsto) - usa transações filtradas
  const balanceSummary = useMemo(() => {
    let incomeRealized = 0
    let incomePending = 0
    let expenseRealized = 0
    let expensePending = 0

    filteredTransactions.forEach(t => {
      const isPaid = t.paid !== false
      if (t.type === TRANSACTION_TYPES.INCOME) {
        if (isPaid) incomeRealized += t.amount
        else incomePending += t.amount
      } else {
        if (isPaid) expenseRealized += t.amount
        else expensePending += t.amount
      }
    })

    return {
      incomeRealized,
      incomePending,
      incomeTotal: incomeRealized + incomePending,
      expenseRealized,
      expensePending,
      expenseTotal: expenseRealized + expensePending,
      balanceRealized: incomeRealized - expenseRealized,
      balancePredicted: (incomeRealized + incomePending) - (expenseRealized + expensePending)
    }
  }, [filteredTransactions])

  // Categorias do Firestore (principais + subcategorias)
  const categories = useMemo(() => {
    const mainCats = getMainCategories(transactionType)
    const result = []

    for (const cat of mainCats) {
      result.push({ id: cat.id, name: cat.name, isMain: true })
      const subs = getSubcategories(cat.id)
      for (const sub of subs) {
        result.push({ id: sub.id, name: `  ${sub.name}`, isMain: false, parentName: cat.name })
      }
    }
    return result
  }, [transactionType, allCategories])

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

  const getAccountName = (accountId) => {
    const account = accounts.find(a => a.id === accountId)
    return account?.name || 'Sem conta'
  }

  /** Categoria + origem (FKs: fatura, pag. fatura, conta) — não inferir por texto. */
  const getTransactionContextSubtitle = (transaction) => {
    const base = getCategoryName(transaction.categoryId)
    if (transaction.creditCardId) {
      return `${base} • Fatura: ${getCardName(transaction.creditCardId)}`
    }
    if (transaction.paidCreditCardId) {
      const bank = transaction.accountId ? getAccountName(transaction.accountId) : null
      return `${base} • Pag. fatura: ${getCardName(transaction.paidCreditCardId)}${
        bank ? ` • ${bank}` : ''
      }`
    }
    if (transaction.accountId) {
      return `${base} • ${getAccountName(transaction.accountId)}`
    }
    return base
  }

  const getCategoryColor = (categoryId) => {
    // Se categoryId é um objeto (migração antiga), usar cor padrão
    if (categoryId && typeof categoryId === 'object') {
      return '#8b5cf6'
    }

    const cat = allCategories.find(c => c.id === categoryId)
    if (cat?.color) {
      const colorObj = CATEGORY_COLORS.find(c => c.id === cat.color)
      return colorObj?.hex || '#8b5cf6'
    }
    return '#8b5cf6'
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

  // Helper para ícone do arquivo
  const getFileIcon = (attachment) => {
    if (!attachment) return File
    const fileName = attachment.fileName?.toLowerCase() || ''
    const fileType = attachment.type?.toLowerCase() || ''

    // Imagens
    if (fileType.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/.test(fileName)) {
      return ImageIcon
    }
    // Excel/Spreadsheets
    if (fileType.includes('spreadsheet') || fileType.includes('excel') || /\.(xls|xlsx|csv)$/.test(fileName)) {
      return FileSpreadsheet
    }
    // PDF
    if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
      return FileText
    }
    return File
  }

  const getFileIconColor = (attachment) => {
    if (!attachment) return 'text-dark-400'
    const fileName = attachment.fileName?.toLowerCase() || ''
    const fileType = attachment.type?.toLowerCase() || ''

    if (fileType.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/.test(fileName)) {
      return 'text-blue-400'
    }
    if (fileType.includes('spreadsheet') || fileType.includes('excel') || /\.(xls|xlsx|csv)$/.test(fileName)) {
      return 'text-emerald-400'
    }
    if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
      return 'text-red-400'
    }
    return 'text-dark-400'
  }

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return
    try {
      setSavingCategory(true)
      await addCategory({
        name: newCategoryName.trim(),
        type: newCategoryType
      })
      setNewCategoryName('')
      setCategoryModalOpen(false)
    } catch (error) {
      console.error('Error adding category:', error)
    } finally {
      setSavingCategory(false)
    }
  }

  const resetForm = () => {
    setFormData({
      description: '',
      amount: null,
      category: categories[0]?.id || '',
      accountId: activeAccounts[0]?.id || '',
      date: formatDateForInput(new Date()),
      notes: '',
      tags: [],
      attachments: [],
      recurrenceType: '',
      fixedFrequency: 'monthly',
      installments: '',
      installmentPeriod: 'months',
      paid: true
    })
    setTagInput('')
    setShowNotes(false)
    setShowTags(false)
    setShowRecurrence(false)
  }

  const openNewModal = (type) => {
    setTransactionType(type)
    setEditingTransaction(null)
    resetForm()
    setFormData(prev => ({
      ...prev,
      category: categories[0]?.id || '',
      accountId: activeAccounts[0]?.id || ''
    }))
    setModalOpen(true)
  }

  const openDetailModal = async (transaction) => {
    setSelectedTransaction(transaction)
    setDetailModalOpen(true)

    // Backend retorna transaction sem attachments embutidos — busca sob demanda.
    // Back-compat: se a transação já tiver attachments (legado Firestore embutido), preserva até a busca concluir.
    try {
      const remoteAttachments = await listAttachments(transaction.id)
      setSelectedTransaction(prev => {
        if (!prev || prev.id !== transaction.id) return prev
        return { ...prev, attachments: remoteAttachments }
      })
    } catch (error) {
      console.error('Error loading attachments:', error)
    }
  }

  const openEditModal = (transaction) => {
    setDetailModalOpen(false)

    // Se faz parte de um grupo (parcelamento ou ocorrência de template),
    // pergunta qual modo de edição. installmentGroupId / recurrenceId substituem
    // o antigo recurrenceGroup string (Ondas 1+7 do refactor).
    if (transaction.installmentGroupId || transaction.recurrenceId) {
      setEditingTransaction(transaction)
      setTransactionType(transaction.type)
      setEditModeModalOpen(true)
      return
    }

    // Se não tem grupo, edita normalmente
    proceedToEdit(transaction)
  }

  const proceedToEdit = async (transaction, mode = 'single') => {
    setEditMode(mode)
    setEditModeModalOpen(false)
    setTransactionType(transaction.type)
    setEditingTransaction(transaction)

    // Anexos vivem em endpoint dedicado (`GET /transactions/{id}/attachments`) e NÃO
    // são embutidos no response da transação. Se o openDetailModal já pré-carregou,
    // reaproveita; caso contrário (edit direto ou race com o fetch do detalhe),
    // busca aqui para que o formulário reflita o estado real.
    let attachments = transaction.attachments
    if (!Array.isArray(attachments)) {
      try {
        attachments = await listAttachments(transaction.id)
      } catch (error) {
        console.error('Error loading attachments for edit:', error)
        attachments = []
      }
    }

    setFormData({
      description: transaction.description,
      amount: transaction.amount,
      category: transaction.categoryId || transaction.category || '',
      accountId: transaction.accountId || activeAccounts[0]?.id || '',
      date: formatDateForInput(transaction.date),
      notes: transaction.notes || '',
      tags: transaction.tags || [],
      attachments,
      recurrenceType: '',
      fixedFrequency: 'monthly',
      installments: '',
      installmentPeriod: 'months',
      paid: transaction.paid !== false // default to true for old transactions
    })
    setShowNotes(!!transaction.notes)
    setShowTags(transaction.tags?.length > 0)
    setShowRecurrence(false)
    setModalOpen(true)
  }

  const copyTransaction = (transaction) => {
    setDetailModalOpen(false)
    setTransactionType(transaction.type)
    setEditingTransaction(null) // É uma nova transação (cópia)
    setFormData({
      description: transaction.description,
      amount: transaction.amount,
      category: transaction.categoryId || transaction.category || '',
      accountId: transaction.accountId || activeAccounts[0]?.id || '',
      date: formatDateForInput(transaction.date), // Preserva data original
      notes: transaction.notes || '',
      tags: transaction.tags || [],
      attachments: [], // Não copia anexos
      recurrenceType: '',
      installments: '',
      paid: true
    })
    setShowNotes(!!transaction.notes)
    setShowTags(transaction.tags?.length > 0)
    setShowRecurrence(false)
    setModalOpen(true)
  }

  const handleFileSelect = async (e) => {
    const fileList = e.target.files
    if (!fileList || fileList.length === 0) return
    const files = Array.from(fileList)

    try {
      setUploading(true)
      setUploadError(null)

      if (editingTransaction?.id) {
        // Edição de transação existente: upload imediato (temos o id).
        const uploaded = []
        for (const file of files) {
          uploaded.push(await uploadAttachment(editingTransaction.id, file))
        }
        setFormData(prev => ({
          ...prev,
          attachments: [...prev.attachments, ...uploaded]
        }))
      } else {
        // Nova transação: só temos o id após o POST /transactions.
        // Armazena Files localmente com preview blob URL; upload real ocorre no handleSubmit.
        const pending = files.map(file => ({
          _pending: true,
          file,
          url: URL.createObjectURL(file),
          fileName: file.name,
          type: file.type,
          size: file.size,
        }))
        setFormData(prev => ({
          ...prev,
          attachments: [...prev.attachments, ...pending]
        }))
      }
    } catch (error) {
      console.error('Error uploading file:', error)
      setUploadError(error.message || 'Erro ao enviar arquivo')
    } finally {
      setUploading(false)
      // Limpa o input para permitir selecionar o mesmo arquivo novamente
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const removeAttachment = async (index) => {
    const attachment = formData.attachments[index]

    // Anexo já persistido no backend → DELETE via API.
    if (attachment?.id && editingTransaction?.id) {
      try {
        await deleteAttachment(editingTransaction.id, attachment.id)
      } catch (error) {
        console.error('Error deleting attachment:', error)
        setUploadError(error.message || 'Erro ao remover anexo')
        return
      }
    } else if (attachment?._pending && attachment.url) {
      // Libera a blob URL do preview local.
      URL.revokeObjectURL(attachment.url)
    }

    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }))
  }

  const addTag = (tag = tagInput.trim()) => {
    if (tag && !formData.tags.includes(tag)) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tag]
      }))
    }
    setTagInput('')
    setShowTagSuggestions(false)
  }

  const removeTag = (tagToRemove) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tagToRemove)
    }))
  }

  const selectTagSuggestion = (tag) => {
    addTag(tag)
  }

  /** Feedback opcional após PUT /recurrences/{id} em massa (applied.warnings, transactions_updated). */
  const notifyRecurrenceApplied = (applied) => {
    if (!applied) return
    const lines = []
    if (applied.transactionsUpdated > 0) {
      lines.push(`${applied.transactionsUpdated} lançamento(s) atualizado(s).`)
    }
    if (applied.warnings?.length) lines.push(...applied.warnings)
    if (lines.length > 0) window.alert(lines.join('\n\n'))
  }

  /** Backend só materializa recorrências ao listar com month+year; precisamos disparar após criar template. */
  const primeMaterializationForCalendarMonth = async (isoDateStr) => {
    const [y, mo] = isoDateStr.split('-').map(Number)
    const { apiClient } = await import('../services/apiClient')
    const ex = needCardPurchaseRows ? 'false' : 'true'
    await apiClient.get(`/api/v1/transactions?month=${mo}&year=${y}&exclude_card_expenses=${ex}`)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.description || !formData.amount || !formData.date) return

    try {
      setSaving(true)
      const data = {
        description: formData.description,
        amount: formData.amount,
        category: formData.category || null,
        accountId: formData.accountId,
        date: formData.date,
        type: transactionType,
        notes: formData.notes || null,
        tags: formData.tags.length > 0 ? formData.tags : null,
        attachments: formData.attachments.length > 0 ? formData.attachments : null,
        paid: formData.paid
      }

      if (editingTransaction) {
        const recurrenceBulk =
          editingTransaction.recurrenceId &&
          (editMode === 'all' || editMode === 'from_forward')

        if (recurrenceBulk) {
          const scope = editMode === 'all' ? 'all' : 'from_date'
          const payload = {
            scope,
            fields: {
              description: data.description,
              amount: data.amount,
              category_id: data.category || null,
              account_id: data.accountId || null,
              type: transactionType,
              ...(data.notes ? { notes: data.notes } : {}),
              ...(data.tags?.length ? { tags: data.tags } : {}),
            },
          }
          if (scope === 'from_date') {
            payload.fromDate = formatDateForInput(editingTransaction.date)
          }
          const { applied } = await updateRecurrence(editingTransaction.recurrenceId, payload)
          await refreshTransactions()
          notifyRecurrenceApplied(applied)
        } else if (editMode === 'all' && editingTransaction.installmentGroupId) {
          const commonUpdates = {
            description: data.description,
            category: data.category,
            accountId: data.accountId,
            notes: data.notes,
            tags: data.tags
          }
          const groupTransactions = transactions.filter(
            t => t.installmentGroupId === editingTransaction.installmentGroupId
          )
          for (const txn of groupTransactions) {
            await updateTransaction(txn.id, commonUpdates)
          }
        } else {
          // Editar apenas este (ou parcela única sem modo em massa)
          await updateTransaction(editingTransaction.id, data)
          // Registrar atividade de atualização
          logTransactionUpdate(
            { id: editingTransaction.id, ...data },
            {
              description: editingTransaction.description,
              amount: editingTransaction.amount,
              date: editingTransaction.date,
              paid: editingTransaction.paid,
              accountId: editingTransaction.accountId,
              category: editingTransaction.category
            }
          )
        }
        setEditMode('single') // Reset para próxima edição
      } else {
        // Helper para calcular próxima data
        const addDateInterval = (date, frequency, multiplier = 1) => {
          const newDate = new Date(date)
          const freq = FIXED_FREQUENCIES.find(f => f.id === frequency) ||
                      INSTALLMENT_PERIODS.find(p => p.id === frequency)

          if (freq?.months) {
            newDate.setMonth(newDate.getMonth() + (freq.months * multiplier))
          } else if (freq?.days) {
            newDate.setDate(newDate.getDate() + (freq.days * multiplier))
          }
          return newDate
        }

        // Helper para verificar se data é futura
        const isFutureDate = (date) => {
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          const checkDate = new Date(date)
          checkDate.setHours(0, 0, 0, 0)
          return checkDate > today
        }

        // Upload dos anexos pendentes (Files locais capturados antes do POST).
        // Vincula ao primeiro lançamento criado: em grupos (fixa/parcelada) os
        // anexos pertencem ao grupo logicamente, mas a API os associa a uma única
        // transaction; anexar à primeira mantém consistência com a UX de "comprovante".
        const uploadPendingAttachmentsTo = async (transactionId) => {
          if (!transactionId) return
          const pending = formData.attachments.filter(a => a?._pending && a.file)
          for (const att of pending) {
            try {
              await uploadAttachment(transactionId, att.file)
            } catch (err) {
              console.error('Error uploading attachment after save:', err)
              setUploadError(err.message || 'Erro ao enviar anexo')
            } finally {
              if (att.url) URL.revokeObjectURL(att.url)
            }
          }
        }

        // Recorrência fixa: template em POST /api/v1/recurrences; ocorrências são materializadas
        // pelo backend ao listar transações por mês/ano (ver TransactionUseCase.list_transactions).
        if (formData.recurrenceType === 'fixed') {
          const isoDate = typeof formData.date === 'string'
            ? formData.date
            : formatDateForInput(formData.date)
          const freq = formData.fixedFrequency
          const dayPart = parseInt(isoDate.slice(8, 10), 10)
          const created = await addRecurrence({
            description: data.description,
            amount: Number(data.amount),
            type: transactionType === TRANSACTION_TYPES.INCOME ? 'income' : 'expense',
            accountId: data.accountId || null,
            categoryId: data.category || null,
            frequency: freq,
            dayOfPeriod: RECURRENCE_MONTHLY_LIKE_FREQUENCIES.has(freq) ? dayPart : undefined,
            startDate: isoDate,
            endDate: null,
          })

          await primeMaterializationForCalendarMonth(isoDate)
          const txs = await refreshTransactions()

          const sameSeries = txs.filter(t => t.recurrenceId === created.id)
          const firstOccurrence = sameSeries.find(t => formatDateForInput(t.date) === isoDate)
            ?? [...sameSeries].sort((a, b) => a.date - b.date)[0]

          if (firstOccurrence?.id && (data.notes || (data.tags && data.tags.length > 0))) {
            await updateTransaction(firstOccurrence.id, {
              description: firstOccurrence.description,
              amount: firstOccurrence.amount,
              categoryId: firstOccurrence.categoryId,
              accountId: firstOccurrence.accountId,
              date: formatDateForInput(firstOccurrence.date),
              type: firstOccurrence.type,
              notes: data.notes ?? null,
              tags: data.tags?.length ? data.tags : null,
              paid: firstOccurrence.paid,
              isTransfer: firstOccurrence.isTransfer,
              oppositeTransactionId: firstOccurrence.oppositeTransactionId,
              recurrenceId: firstOccurrence.recurrenceId,
              installment: firstOccurrence.installment,
              totalInstallments: firstOccurrence.totalInstallments,
              installmentGroupId: firstOccurrence.installmentGroupId,
              creditCardId: firstOccurrence.creditCardId,
              creditCardInvoiceId: firstOccurrence.creditCardInvoiceId,
              paidCreditCardId: firstOccurrence.paidCreditCardId,
              paidCreditCardInvoiceId: firstOccurrence.paidCreditCardInvoiceId,
            })
          }

          await uploadPendingAttachmentsTo(firstOccurrence?.id)
        } else if (formData.recurrenceType === 'installment' && formData.installments) {
          // Parcelado com período selecionado
          const numInstallments = parseInt(formData.installments) || 1
          const total = formData.amount || 0
          const baseInstallmentAmount = Math.floor((total / numInstallments) * 100) / 100
          const remainder = Math.round((total - (baseInstallmentAmount * numInstallments)) * 100) / 100
          const baseDate = new Date(formData.date)
          const installmentGroupId = crypto.randomUUID()
          let firstResult = null

          for (let i = 0; i < numInstallments; i++) {
            const transactionDate = addDateInterval(baseDate, formData.installmentPeriod, i)
            // Primeira parcela recebe a sobra da divisão
            const installmentAmount = i === 0 ? baseInstallmentAmount + remainder : baseInstallmentAmount
            // Lançamentos futuros ficam como pendente
            const isPaid = !isFutureDate(transactionDate) && formData.paid

            const result = await addTransaction({
              ...data,
              amount: installmentAmount,
              date: formatDateForInput(transactionDate),
              paid: isPaid,
              installmentGroupId,
              installment: i + 1,
              totalInstallments: numInstallments,
            })
            if (i === 0) firstResult = result
          }

          await uploadPendingAttachmentsTo(firstResult?.id)
        } else {
          const result = await addTransaction(data)
          // Registrar atividade
          if (result?.id) {
            logTransactionCreate({ id: result.id, ...data })
            await uploadPendingAttachmentsTo(result.id)
          }
        }
      }

      setModalOpen(false)
    } catch (error) {
      console.error('Error saving transaction:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (transaction) => {
    // Se é parte de um grupo (parcelamento ou recorrência materializada), mostra modal
    // de confirmação. installment_group_id agrupa parcelas; recurrence_id agrupa
    // ocorrências geradas por template (Onda 3 do refactor backend).
    if (transaction.installmentGroupId || transaction.recurrenceId) {
      setTransactionToDelete(transaction)
      setDeleteModalOpen(true)
    } else {
      // Se não tem grupo, exclui direto
      confirmDelete(transaction.id, 'single')
    }
  }

  /**
   * @param {'single'|'all'|'from_forward'} deleteMode
   */
  const confirmDelete = async (id, deleteMode = 'single') => {
    try {
      setDeleteProgress({ id, mode: deleteMode })

      // Encontrar transação para log
      const transactionToLog = transactionToDelete || transactions.find(t => t.id === id)

      if (deleteMode === 'all' && transactionToDelete?.recurrenceId) {
        await deleteTransaction(transactionToDelete.id, { scope: 'all' })
      } else if (deleteMode === 'from_forward' && transactionToDelete?.recurrenceId) {
        // Sem `from_date` no body: backend usa txn.date no Postgres (evita mismatch TZ/format).
        await deleteTransaction(transactionToDelete.id, { scope: 'from_date' })
      } else if (deleteMode === 'all' && transactionToDelete?.installmentGroupId) {
        const groupTransactions = transactions.filter(
          t => t.installmentGroupId === transactionToDelete.installmentGroupId
        )
        for (const txn of groupTransactions) {
          await deleteTransaction(txn.id)
        }
      } else if (deleteMode === 'from_forward' && transactionToDelete?.installmentGroupId) {
        const anchor = transactionDayStamp(transactionToDelete.date)
        const forwardTransactions = transactions.filter(
          t =>
            t.installmentGroupId === transactionToDelete.installmentGroupId &&
            transactionDayStamp(t.date) >= anchor
        )
        for (const txn of forwardTransactions) {
          await deleteTransaction(txn.id)
        }
      } else {
        await deleteTransaction(id)
        // Registrar atividade de exclusão
        if (transactionToLog) {
          logTransactionDelete(transactionToLog)
        }
      }

      setDetailModalOpen(false)
      setSelectedTransaction(null)
      setDeleteModalOpen(false)
      setTransactionToDelete(null)
    } catch (error) {
      console.error('Error deleting transaction:', error)
    } finally {
      setDeleteProgress(null)
    }
  }

  const handleAddAttachmentsToDetail = async (files) => {
    if (!selectedTransaction || !user) return
    const txId = selectedTransaction.id
    const uploaded = []
    for (const file of Array.from(files)) {
      uploaded.push(await uploadAttachment(txId, file))
    }
    // POST já persistiu no backend; apenas atualiza estado local com o retorno.
    setSelectedTransaction(prev => {
      if (!prev || prev.id !== txId) return prev
      return {
        ...prev,
        attachments: [...(prev.attachments || []), ...uploaded]
      }
    })
  }

  const togglePaidStatus = async (transaction) => {
    try {
      const newPaidStatus = transaction.paid === false ? true : false
      await updateTransaction(transaction.id, {
        ...transaction,
        paid: newPaidStatus
      })
      // Atualiza o selectedTransaction se for o mesmo
      if (selectedTransaction?.id === transaction.id) {
        setSelectedTransaction({ ...transaction, paid: newPaidStatus })
      }
    } catch (error) {
      console.error('Error toggling paid status:', error)
    }
  }

  if (loading || loadingAccounts) {
    return <Loading />
  }

  return (
    <div className="space-y-6">
      {/* Month Selector */}
      <MonthSelector
        month={month}
        year={year}
        onChange={(m, y) => {
          setDateRange(null) // Limpa dateRange ao mudar mês
          onMonthChange(m, y)
        }}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
      />

      {/* Banner de Lançamentos Pendentes/Vencidos */}
      {overdueTransactions.length > 0 && (
        <div className="bg-red-500/15 border border-red-500/40 rounded-xl overflow-hidden shadow-lg shadow-red-500/10">
          <button
            onClick={() => setShowOverduePanel(!showOverduePanel)}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-red-500/10 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-6 h-6 text-red-400" />
              </div>
              <span className="text-sm font-semibold text-red-800 dark:text-red-100">
                {overdueTransactions.length === 1
                  ? 'Há 1 lançamento passado que ainda não foi pago'
                  : `Há ${overdueTransactions.length} lançamentos passados que ainda não foram pagos`}
              </span>
            </div>
            {showOverduePanel ? (
              <ChevronUp className="w-5 h-5 text-red-400 flex-shrink-0" />
            ) : (
              <ChevronDown className="w-5 h-5 text-red-400 flex-shrink-0" />
            )}
          </button>

          {showOverduePanel && (
            <div className="border-t border-red-500/30 divide-y divide-red-500/20">
              {overdueTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  onClick={() => openDetailModal(transaction)}
                  className="flex items-center gap-2 py-2.5 px-3 hover:bg-red-500/10 cursor-pointer transition-colors"
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${getCategoryColor(transaction.categoryId)}20` }}
                  >
                    {transaction.type === TRANSACTION_TYPES.INCOME ? (
                      <ArrowUpRight className="w-3.5 h-3.5" style={{ color: getCategoryColor(transaction.categoryId) }} />
                    ) : (
                      <ArrowDownRight className="w-3.5 h-3.5" style={{ color: getCategoryColor(transaction.categoryId) }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <p
                      className="text-sm font-medium text-red-900 dark:text-red-50"
                      style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {transaction.description}
                    </p>
                    <p
                      className="text-xs text-red-700 dark:text-red-200/80"
                      style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {formatDate(transaction.date)} • {getTransactionContextSubtitle(transaction)}
                    </p>
                  </div>
                  <p className={`text-sm font-semibold flex-shrink-0 whitespace-nowrap ${
                    transaction.type === TRANSACTION_TYPES.INCOME
                      ? 'text-emerald-400'
                      : 'text-red-400'
                  }`}>
                    {transaction.type === TRANSACTION_TYPES.INCOME ? '+' : '-'}
                    {formatCurrency(transaction.amount)}
                  </p>
                  <button
                    onClick={(e) => { e.stopPropagation(); togglePaidStatus(transaction) }}
                    className="p-1 text-dark-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors flex-shrink-0"
                    title="Marcar como pago"
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Search and Filter Toggle */}
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            type="text"
            placeholder="Buscar lançamentos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            icon={Search}
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`p-3.5 rounded-2xl transition-all active:scale-95 ${
            showFilters || hasActiveFilters
              ? 'bg-violet-600 text-white'
              : 'bg-dark-900 text-dark-400 hover:text-white'
          }`}
        >
          <Filter className="w-5 h-5" />
        </button>
      </div>

      {/* Chips de filtros ativos */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 items-center">
          {searchTerm?.trim() && (
            <button
              type="button"
              onClick={() => onSearchTermChange('')}
              className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg text-xs font-medium bg-violet-500/20 text-violet-200 border border-violet-500/30"
            >
              <Search className="w-3 h-3" />
              &quot;{searchTerm.trim()}&quot;
              <X className="w-3.5 h-3.5 opacity-80" />
            </button>
          )}
          {dateRange?.startDate && dateRange?.endDate && (
            <button
              type="button"
              onClick={() => setDateRange(null)}
              className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg text-xs font-medium bg-dark-700 text-dark-200"
            >
              {dateRange.startDate} → {dateRange.endDate}
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          {filters.type !== 'all' && (
            <button
              type="button"
              onClick={removeTypeFilter}
              className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg text-xs font-medium bg-dark-700 text-dark-200"
            >
              {getTypeLabel()}
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          {(filters.source ?? DEFAULT_TX_SOURCE) !== DEFAULT_TX_SOURCE && (
            <button
              type="button"
              onClick={removeSourceFilter}
              className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg text-xs font-medium bg-dark-700 text-dark-200"
            >
              {getSourceLabel()}
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          {filters.account !== 'all' && (
            <button
              type="button"
              onClick={removeAccountFilter}
              className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg text-xs font-medium bg-dark-700 text-dark-200"
            >
              {getAccountName(filters.account)}
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          {filters.category.map((cid) => {
            const cat = allCategories.find((c) => c.id === cid)
            return (
              <button
                key={cid}
                type="button"
                onClick={() => removeCategoryFilter(cid)}
                className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg text-xs font-medium bg-dark-700 text-dark-200"
              >
                {cat ? cat.name : 'Categoria'}
                <X className="w-3.5 h-3.5" />
              </button>
            )
          })}
          {filters.tag.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => removeTagFilter(tag)}
              className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg text-xs font-medium bg-dark-700 text-dark-200"
            >
              {tag}
              <X className="w-3.5 h-3.5" />
            </button>
          ))}
          <button
            type="button"
            onClick={clearAllListFilters}
            className="text-xs font-medium text-violet-400 hover:text-violet-300"
          >
            Limpar tudo
          </button>
        </div>
      )}

      {/* Filter Bar */}
      {showFilters && (
        <div className="flex flex-wrap gap-2 p-3 bg-dark-900 rounded-2xl">
          {/* Limpar filtros */}
          {hasActiveFilters && (
            <button
              onClick={clearAllListFilters}
              className="p-2 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* Filtro Tipo */}
          <div className="relative">
            <button
              onClick={() => setActiveFilterDropdown(activeFilterDropdown === 'type' ? null : 'type')}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm transition-colors ${
                filters.type !== 'all'
                  ? 'bg-violet-600 text-white'
                  : 'bg-dark-700 text-dark-300 hover:text-white'
              }`}
            >
              {getTypeLabel()}
              <ChevronDown className="w-4 h-4" />
            </button>
            {activeFilterDropdown === 'type' && (
              <div className="absolute top-full left-0 mt-1 bg-dark-900 border border-dark-600 rounded-xl shadow-lg py-1 min-w-[180px] z-50 max-h-60 overflow-y-auto">
                {[
                  { value: 'all', label: 'Todos os lançamentos' },
                  { value: 'income', label: 'Receitas' },
                  { value: 'income_paid', label: 'Receitas recebidas' },
                  { value: 'income_pending', label: 'Receitas pendentes' },
                  { value: 'expense', label: 'Despesas' },
                  { value: 'expense_paid', label: 'Despesas pagas' },
                  { value: 'expense_pending', label: 'Despesas pendentes' },
                  { value: 'fixed', label: 'Recorrentes' },
                  { value: 'installment', label: 'Parcelados' }
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setFilters({ ...filters, type: opt.value })
                      setActiveFilterDropdown(null)
                    }}
                    className={`w-full px-4 py-2 text-sm text-left transition-colors ${
                      filters.type === opt.value
                        ? 'text-violet-400 bg-violet-500/10'
                        : 'text-dark-300 hover:bg-dark-700 hover:text-white'
                    }`}
                  >
                    {opt.label}
                    {filters.type === opt.value && <Check className="w-4 h-4 inline ml-2" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Filtro Origem (FKs cartão / pagamento fatura) */}
          <div className="relative">
            <button
              onClick={() => setActiveFilterDropdown(activeFilterDropdown === 'source' ? null : 'source')}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm transition-colors ${
                (filters.source ?? DEFAULT_TX_SOURCE) !== DEFAULT_TX_SOURCE
                  ? 'bg-violet-600 text-white'
                  : 'bg-dark-700 text-dark-300 hover:text-white'
              }`}
            >
              {getSourceLabel()}
              <ChevronDown className="w-4 h-4" />
            </button>
            {activeFilterDropdown === 'source' && (
              <div className="absolute top-full left-0 mt-1 bg-dark-900 border border-dark-600 rounded-xl shadow-lg py-1 min-w-[220px] z-50 max-h-60 overflow-y-auto">
                {[
                  { value: 'all', label: 'Todas as origens' },
                  { value: 'account', label: 'Conta (sem compra na fatura)' },
                  { value: 'card', label: 'Despesas na fatura do cartão' },
                  { value: 'bill_payment', label: 'Pagamentos de fatura' }
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setFilters({ ...filters, source: opt.value })
                      setActiveFilterDropdown(null)
                    }}
                    className={`w-full px-4 py-2 text-sm text-left transition-colors ${
                      (filters.source ?? DEFAULT_TX_SOURCE) === opt.value
                        ? 'text-violet-400 bg-violet-500/10'
                        : 'text-dark-300 hover:bg-dark-700 hover:text-white'
                    }`}
                  >
                    {opt.label}
                    {(filters.source ?? DEFAULT_TX_SOURCE) === opt.value && <Check className="w-4 h-4 inline ml-2" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Filtro Conta */}
          <div className="relative">
            <button
              onClick={() => setActiveFilterDropdown(activeFilterDropdown === 'account' ? null : 'account')}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm transition-colors ${
                filters.account !== 'all'
                  ? 'bg-violet-600 text-white'
                  : 'bg-dark-700 text-dark-300 hover:text-white'
              }`}
            >
              {filters.account === 'all' ? 'Conta' : getAccountName(filters.account)}
              <ChevronDown className="w-4 h-4" />
            </button>
            {activeFilterDropdown === 'account' && (
              <div className="absolute top-full left-0 mt-1 bg-dark-900 border border-dark-600 rounded-xl shadow-lg py-1 min-w-[150px] z-50 max-h-60 overflow-y-auto">
                <button
                  onClick={() => {
                    setFilters({ ...filters, account: 'all' })
                    setActiveFilterDropdown(null)
                  }}
                  className={`w-full px-4 py-2 text-sm text-left transition-colors ${
                    filters.account === 'all'
                      ? 'text-violet-400 bg-violet-500/10'
                      : 'text-dark-300 hover:bg-dark-700 hover:text-white'
                  }`}
                >
                  Todas as contas
                </button>
                {activeAccounts.map(acc => (
                  <button
                    key={acc.id}
                    onClick={() => {
                      setFilters({ ...filters, account: acc.id })
                      setActiveFilterDropdown(null)
                    }}
                    className={`w-full px-4 py-2 text-sm text-left transition-colors ${
                      filters.account === acc.id
                        ? 'text-violet-400 bg-violet-500/10'
                        : 'text-dark-300 hover:bg-dark-700 hover:text-white'
                    }`}
                  >
                    {acc.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Filtro Categoria */}
          <SearchableSelect
            options={allCategories.filter(c => !c.archived).map(cat => ({
              value: cat.id,
              label: cat.parentId ? `  ${cat.name}` : cat.name
            }))}
            value={filters.category}
            onChange={(val) => setFilters({ ...filters, category: val })}
            placeholder="Categoria"
            allLabel="Todas as categorias"
            searchPlaceholder="Buscar categoria..."
            multiple
          />

          {/* Filtro Tag */}
          {existingTags.length > 0 && (
            <SearchableSelect
              options={existingTags.map(tag => ({ value: tag, label: tag }))}
              value={filters.tag}
              onChange={(val) => setFilters({ ...filters, tag: val })}
              placeholder="Tags"
              allLabel="Todas as tags"
              searchPlaceholder="Buscar tag..."
              multiple
            />
          )}
        </div>
      )}

      {/* Transactions List */}
      {Object.keys(groupedTransactions).length === 0 ? (
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
              <p className="text-xs text-dark-500 font-semibold uppercase tracking-wider mb-3 px-1">
                {date}
              </p>
              <Card className="divide-y divide-dark-700/50 overflow-hidden shadow-lg !p-0">
                {items.map((transaction) => (
                  <div
                    key={transaction.id}
                    onClick={() => openDetailModal(transaction)}
                    className={`flex items-center gap-2 py-3 px-3 cursor-pointer transition-all relative ${
                      transaction.paid === false
                        ? 'bg-amber-500/5 hover:bg-amber-500/10 border-l-[3px] border-amber-500/40'
                        : 'hover:bg-dark-700/50 border-l-[3px] border-transparent'
                    }`}
                  >
                    {/* Indicador de pendente */}
                    {transaction.paid === false && (
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400/80 flex-shrink-0 animate-pulse" />
                    )}

                    {/* Ícone da categoria com cor */}
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${getCategoryColor(transaction.categoryId)}20` }}
                    >
                      {transaction.type === TRANSACTION_TYPES.INCOME ? (
                        <ArrowUpRight className="w-3.5 h-3.5" style={{ color: getCategoryColor(transaction.categoryId) }} />
                      ) : (
                        <ArrowDownRight className="w-3.5 h-3.5" style={{ color: getCategoryColor(transaction.categoryId) }} />
                      )}
                    </div>

                    {/* Conteúdo principal - título e categoria */}
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="flex items-center gap-1 overflow-hidden">
                        <span
                          className={`flex-1 min-w-0 text-sm font-semibold ${
                            transaction.paid === false
                              ? 'text-amber-900 dark:text-amber-50'
                              : 'text-white'
                          }`}
                          style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                          {transaction.description}
                        </span>
                        {isInstallmentPlanTransaction(transaction) && (
                          <span
                            className="text-[9px] text-dark-500 bg-dark-800 px-1 rounded flex-shrink-0 inline-flex items-center gap-0.5"
                            title="Parcela (installment / total_installments)"
                          >
                            <Layers2 className="w-2 h-2 opacity-80" />
                            {formatInstallmentFraction(transaction)}
                          </span>
                        )}
                        {isRecurrenceLinkedTransaction(transaction) && (
                          <Repeat className="w-2.5 h-2.5 text-violet-400 flex-shrink-0" title="Recorrente (recurrence_id)" />
                        )}
                        {(transaction.attachments?.length > 0 || transaction.attachment) && (
                          <Paperclip className="w-2.5 h-2.5 text-dark-400 flex-shrink-0" />
                        )}
                      </div>
                      <p
                        className={`text-xs ${
                          transaction.paid === false
                            ? 'text-gray-600 dark:text-dark-400'
                            : 'text-dark-400'
                        }`}
                        style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      >
                        {getTransactionContextSubtitle(transaction)}
                      </p>
                      {normalizeTags(transaction.tags).length > 0 && (
                        <div className="flex gap-1 mt-0.5 flex-wrap">
                          {normalizeTags(transaction.tags).slice(0, 2).map(tag => (
                            <span key={tag} className="text-[9px] bg-dark-700 text-dark-300 px-1 py-0.5 rounded">
                              {tag}
                            </span>
                          ))}
                          {normalizeTags(transaction.tags).length > 2 && (
                            <span className="text-[9px] text-dark-500">+{normalizeTags(transaction.tags).length - 2}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Valor e botão */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <p className={`text-sm font-bold tabular-nums whitespace-nowrap ${
                        transaction.type === TRANSACTION_TYPES.INCOME
                          ? 'text-emerald-400'
                          : 'text-red-400'
                      } ${transaction.paid === false ? 'opacity-70' : ''}`}>
                        {transaction.type === TRANSACTION_TYPES.INCOME ? '+' : '-'}
                        {formatCurrency(transaction.amount)}
                      </p>

                      {/* Botão pago/pendente */}
                      <button
                        onClick={(e) => { e.stopPropagation(); togglePaidStatus(transaction) }}
                        className={`p-1.5 rounded-lg transition-all ${
                          transaction.paid === false
                            ? 'bg-dark-800/50 text-amber-400/70 hover:bg-emerald-500/10 hover:text-emerald-400 border border-dark-700'
                            : 'bg-emerald-500/10 text-emerald-400/80 hover:bg-dark-800 hover:text-dark-400 border border-emerald-500/20'
                        }`}
                        title={transaction.paid === false ? 'Marcar como pago' : 'Marcar como não pago'}
                      >
                        {transaction.paid === false ? (
                          <Clock className="w-3.5 h-3.5" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </Card>
            </div>
          ))}

          {/* Resumo do mês */}
          <Card className="mt-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-dark-400">Receitas</span>
                <div className="text-right">
                  <p className="text-emerald-400 font-medium">+{formatCurrency(balanceSummary.incomeRealized)}</p>
                  {balanceSummary.incomePending > 0 && (
                    <p className="text-dark-500 text-xs">previsto: +{formatCurrency(balanceSummary.incomeTotal)}</p>
                  )}
                </div>
              </div>

              <div className="flex justify-between items-center text-sm">
                <span className="text-dark-400">Despesas</span>
                <div className="text-right">
                  <p className="text-red-400 font-medium">-{formatCurrency(balanceSummary.expenseRealized)}</p>
                  {balanceSummary.expensePending > 0 && (
                    <p className="text-dark-500 text-xs">previsto: -{formatCurrency(balanceSummary.expenseTotal)}</p>
                  )}
                </div>
              </div>

              <div className="border-t border-dark-700 pt-3 flex justify-between items-center">
                <span className="text-dark-300 font-medium">Saldo</span>
                <div className="text-right">
                  <p className={`font-semibold ${balanceSummary.balanceRealized >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatCurrency(balanceSummary.balanceRealized)}
                  </p>
                  {(balanceSummary.incomePending > 0 || balanceSummary.expensePending > 0) && (
                    <p className={`text-xs ${balanceSummary.balancePredicted >= 0 ? 'text-dark-400' : 'text-red-400/70'}`}>
                      previsto: {formatCurrency(balanceSummary.balancePredicted)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </Card>
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
        headerVariant={transactionType === TRANSACTION_TYPES.INCOME ? 'income' : 'expense'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type Toggle */}
          {!editingTransaction && (
            <div className="flex gap-2 p-1.5 bg-dark-800 rounded-2xl">
              <button
                type="button"
                onClick={() => setTransactionType(TRANSACTION_TYPES.INCOME)}
                className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all ${
                  transactionType === TRANSACTION_TYPES.INCOME
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'text-dark-400 hover:text-white hover:bg-dark-700'
                }`}
              >
                Receita
              </button>
              <button
                type="button"
                onClick={() => setTransactionType(TRANSACTION_TYPES.EXPENSE)}
                className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all ${
                  transactionType === TRANSACTION_TYPES.EXPENSE
                    ? 'bg-red-500/20 text-red-400'
                    : 'text-dark-400 hover:text-white hover:bg-dark-700'
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

          <div className="grid grid-cols-2 gap-3">
            <CurrencyInput
              label="Valor"
              value={formData.amount}
              onChange={(val) => setFormData({ ...formData, amount: val })}
              required
            />

            <Input
              label="Data"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Conta */}
            <Select
              label="Conta"
              value={formData.accountId}
              onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
              options={activeAccounts.map(a => ({ value: a.id, label: a.name }))}
            />

            {/* Categoria */}
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">
                Categoria
              </label>
              <CategorySelector
                value={formData.category}
                onChange={(categoryId) => setFormData({ ...formData, category: categoryId })}
                categories={categories}
                type={transactionType}
                onCreateCategory={async (data) => {
                  const result = await addCategory(data)
                  if (result?.id) {
                    setFormData({ ...formData, category: result.id })
                  }
                }}
                placeholder="Selecione uma categoria"
              />
            </div>
          </div>

          {/* Observação */}
          {showNotes && (
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">
                Observação
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Adicione uma observação..."
                className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:border-violet-500 resize-none"
                rows={3}
              />
            </div>
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

              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map(tag => (
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

          {/* Anexos */}
          {formData.attachments.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">
                Anexos
              </label>
              <div className="space-y-2">
                {formData.attachments.map((attachment, index) => {
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
                        onClick={() => removeAttachment(index)}
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

          {/* Recorrência */}
          {showRecurrence && !editingTransaction && (
            <div className="space-y-4 p-3 bg-dark-800 rounded-xl">
              <p className="text-sm font-medium text-dark-300">Repetir</p>

              {/* Opção: Receita/Despesa Fixa */}
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="recurrenceType"
                    value="fixed"
                    checked={formData.recurrenceType === 'fixed'}
                    onChange={(e) => setFormData({ ...formData, recurrenceType: e.target.value, installments: '' })}
                    className="w-4 h-4 text-violet-500 bg-dark-700 border-dark-600 focus:ring-violet-500"
                  />
                  <span className="text-sm text-white">
                    é {transactionType === TRANSACTION_TYPES.INCOME ? 'uma receita fixa' : 'uma despesa fixa'}
                  </span>
                </label>

                {formData.recurrenceType === 'fixed' && (
                  <div className="ml-7">
                    <select
                      value={formData.fixedFrequency}
                      onChange={(e) => setFormData({ ...formData, fixedFrequency: e.target.value })}
                      className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white text-sm focus:outline-none focus:border-violet-500"
                    >
                      {FIXED_FREQUENCIES.map(freq => (
                        <option key={freq.id} value={freq.id}>{freq.name}</option>
                      ))}
                    </select>
                    <p className="text-xs text-dark-400 mt-2">
                      É criado um modelo de recorrência no servidor; as ocorrências entram nos lançamentos
                      quando você abre cada mês no calendário (sem limite fixo de parcelas na criação).
                    </p>
                  </div>
                )}
              </div>

              {/* Opção: Parcelado */}
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="recurrenceType"
                    value="installment"
                    checked={formData.recurrenceType === 'installment'}
                    onChange={(e) => setFormData({ ...formData, recurrenceType: e.target.value })}
                    className="w-4 h-4 text-violet-500 bg-dark-700 border-dark-600 focus:ring-violet-500"
                  />
                  <span className="text-sm text-white">é um lançamento parcelado em</span>
                </label>

                {formData.recurrenceType === 'installment' && (
                  <div className="ml-7 space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="2"
                        max="120"
                        value={formData.installments}
                        onChange={(e) => setFormData({ ...formData, installments: e.target.value })}
                        placeholder="Qtd"
                        className="w-20 px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white text-sm text-center focus:outline-none focus:border-violet-500"
                      />
                      <select
                        value={formData.installmentPeriod}
                        onChange={(e) => setFormData({ ...formData, installmentPeriod: e.target.value })}
                        className="flex-1 px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white text-sm focus:outline-none focus:border-violet-500"
                      >
                        {INSTALLMENT_PERIODS.map(period => (
                          <option key={period.id} value={period.id}>{period.name}</option>
                        ))}
                      </select>
                    </div>
                    {formData.installments && parseInt(formData.installments) >= 2 && (
                      <div className="text-xs text-dark-400 space-y-1">
                        {(() => {
                          const total = formData.amount || 0
                          const numInstallments = parseInt(formData.installments)
                          const installmentValue = Math.floor((total / numInstallments) * 100) / 100
                          const remainder = Math.round((total - (installmentValue * numInstallments)) * 100) / 100
                          const firstInstallment = installmentValue + remainder

                          return (
                            <>
                              <p>
                                Serão lançadas {numInstallments} parcelas de <span className="text-violet-400">{formatCurrency(installmentValue)}</span>
                              </p>
                              {remainder > 0 && (
                                <p className="text-dark-500">
                                  Em caso de divisão não exata, a sobra será somada à primeira parcela ({formatCurrency(firstInstallment)}).
                                </p>
                              )}
                            </>
                          )
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Status pago/pendente */}
          <label className="flex items-center justify-between p-3 bg-dark-800 rounded-xl cursor-pointer">
            <div className="flex items-center gap-2">
              {formData.paid ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Clock className="w-4 h-4 text-amber-400" />
              )}
              <span className="text-sm text-dark-300">
                {formData.paid ? 'Pago/Recebido' : 'Pendente'}
              </span>
            </div>
            <div
              onClick={() => setFormData({ ...formData, paid: !formData.paid })}
              className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${
                formData.paid ? 'bg-emerald-500' : 'bg-dark-600'
              }`}
            >
              <div
                className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-all duration-200 ${
                  formData.paid ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </div>
          </label>

          {/* Botões de ação rápida */}
          <div className="flex justify-center gap-6 py-2 border-t border-dark-700">
            {!editingTransaction && (
              <button
                type="button"
                onClick={() => setShowRecurrence(!showRecurrence)}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
                  showRecurrence ? 'text-violet-400' : 'text-dark-400 hover:text-white'
                }`}
              >
                <Repeat className="w-5 h-5" />
                <span className="text-xs">Repetir</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowNotes(!showNotes)}
              className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
                showNotes ? 'text-violet-400' : 'text-dark-400 hover:text-white'
              }`}
            >
              <MessageSquare className="w-5 h-5" />
              <span className="text-xs">Observação</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
                formData.attachments.length > 0 ? 'text-violet-400' : 'text-dark-400 hover:text-white'
              } ${uploading ? 'opacity-50' : ''}`}
            >
              <div className="relative">
                <Paperclip className="w-5 h-5" />
                {formData.attachments.length > 0 && (
                  <span className="absolute -top-1 -right-2 text-[10px] bg-violet-500 text-white rounded-full w-4 h-4 flex items-center justify-center">
                    {formData.attachments.length}
                  </span>
                )}
              </div>
              <span className="text-xs">{uploading ? 'Enviando...' : 'Anexo'}</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              onChange={handleFileSelect}
              multiple
              className="hidden"
            />

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

      {/* Modal Nova Categoria */}
      <Modal
        isOpen={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        title="Nova Categoria"
      >
        <div className="space-y-4">
          <div className="flex gap-2 p-1.5 bg-dark-800 rounded-2xl">
            <button
              type="button"
              onClick={() => setNewCategoryType(TRANSACTION_TYPES.INCOME)}
              className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all ${
                newCategoryType === TRANSACTION_TYPES.INCOME
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'text-dark-400 hover:text-white hover:bg-dark-700'
              }`}
            >
              Receita
            </button>
            <button
              type="button"
              onClick={() => setNewCategoryType(TRANSACTION_TYPES.EXPENSE)}
              className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all ${
                newCategoryType === TRANSACTION_TYPES.EXPENSE
                  ? 'bg-red-500/20 text-red-400'
                  : 'text-dark-400 hover:text-white hover:bg-dark-700'
              }`}
            >
              Despesa
            </button>
          </div>

          <Input
            label="Nome da categoria"
            type="text"
            placeholder="Ex: Academia, Streaming..."
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
          />

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

      {/* Modal de Detalhes */}
      <TransactionDetail
        transaction={selectedTransaction}
        isOpen={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false)
          setSelectedTransaction(null)
        }}
        onEdit={openEditModal}
        onCopy={copyTransaction}
        onDelete={(t) => handleDelete(t)}
        onTogglePaid={togglePaidStatus}
        onAddAttachments={handleAddAttachmentsToDetail}
        getCategoryName={getCategoryName}
        getAccountName={getAccountName}
        getCategoryColor={getCategoryColor}
        getCardName={getCardName}
        deleting={deleteProgress?.id === selectedTransaction?.id}
      />

      {/* Modal de Modo de Edição */}
      <Modal
        isOpen={editModeModalOpen}
        onClose={() => {
          setEditModeModalOpen(false)
        }}
        title="Editar lançamento"
      >
        <div className="space-y-4">
          <p className="text-dark-300">
            Este lançamento faz parte de um grupo de {editingTransaction?.recurrenceId
              ? 'recorrência (recurrence_id)'
              : 'parcelas (installment_group_id)'}.
            O que deseja editar?
          </p>

          <div className="space-y-2">
            <Button
              onClick={() => proceedToEdit(editingTransaction, 'single')}
              variant="secondary"
              fullWidth
            >
              Editar apenas este lançamento
            </Button>

            {editingTransaction?.recurrenceId && (
              <Button
                onClick={() => proceedToEdit(editingTransaction, 'from_forward')}
                variant="secondary"
                fullWidth
              >
                Desta data em diante (template + lançamentos com data ≥ esta)
              </Button>
            )}

            <Button
              onClick={() => proceedToEdit(editingTransaction, 'all')}
              variant="primary"
              fullWidth
            >
              Editar todos do grupo ({transactions.filter(t =>
                (editingTransaction?.installmentGroupId && t.installmentGroupId === editingTransaction.installmentGroupId) ||
                (editingTransaction?.recurrenceId && t.recurrenceId === editingTransaction.recurrenceId)
              ).length} lançamentos visíveis)
            </Button>

            <Button
              onClick={() => setEditModeModalOpen(false)}
              variant="ghost"
              fullWidth
            >
              Cancelar
            </Button>
          </div>

          <p className="text-xs text-dark-500">
            Recorrência: alterações em série usam{' '}
            <code className="text-dark-400">PUT /recurrences</code> com escopo (todos ou desta data em diante).
            Parcelas: continua atualização por lançamento no período visível.
          </p>
        </div>
      </Modal>

      {/* Modal de Confirmação de Exclusão */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false)
          setTransactionToDelete(null)
        }}
        title="Excluir lançamento"
      >
        <div className="space-y-4">
          <p className="text-dark-300">
            Este lançamento faz parte de um grupo de {transactionToDelete?.recurrenceId
              ? 'recorrência (recurrence_id)'
              : 'parcelas (installment_group_id)'}.
            O que deseja fazer?
          </p>

          <div className="space-y-2">
            <Button
              onClick={() => confirmDelete(transactionToDelete?.id, 'single')}
              variant="secondary"
              fullWidth
              loading={deleteProgress?.mode === 'single'}
            >
              Excluir apenas este lançamento
            </Button>

            {(transactionToDelete?.recurrenceId || transactionToDelete?.installmentGroupId) && (
              <Button
                onClick={() => confirmDelete(transactionToDelete?.id, 'from_forward')}
                variant="secondary"
                fullWidth
                loading={deleteProgress?.mode === 'from_forward'}
              >
                {transactionToDelete?.recurrenceId
                  ? 'Excluir desta data em diante (na base)'
                  : `Excluir desta data em diante (${transactions.filter(t => {
                    const sameGroup =
                      transactionToDelete?.installmentGroupId &&
                      t.installmentGroupId === transactionToDelete.installmentGroupId
                    if (!sameGroup) return false
                    return transactionDayStamp(t.date) >= transactionDayStamp(transactionToDelete.date)
                  }).length} no período visível)`}
              </Button>
            )}

            <Button
              onClick={() => confirmDelete(transactionToDelete?.id, 'all')}
              variant="danger"
              fullWidth
              loading={deleteProgress?.mode === 'all'}
            >
              {transactionToDelete?.recurrenceId
                ? 'Excluir toda a série de recorrência'
                : `Excluir todos do grupo (${transactions.filter(t =>
                  transactionToDelete?.installmentGroupId &&
                  t.installmentGroupId === transactionToDelete.installmentGroupId
                ).length} lançamentos visíveis)`}
            </Button>

            <Button
              onClick={() => {
                setDeleteModalOpen(false)
                setTransactionToDelete(null)
              }}
              variant="ghost"
              fullWidth
            >
              Cancelar
            </Button>
          </div>

          <p className="text-xs text-dark-500">
            {transactionToDelete?.recurrenceId
              ? 'Recorrência: exclusão em série usa DELETE no servidor e afeta todas as ocorrências correspondentes na base.'
              : 'Parcelas: exclusão em série remove apenas lançamentos já carregados neste período.'}
          </p>
        </div>
      </Modal>
    </div>
  )
}
