import { useState, useMemo, useRef, useEffect } from 'react'
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
  AlertCircle
} from 'lucide-react'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import SearchableSelect from '../components/ui/SearchableSelect'
import MonthSelector from '../components/ui/MonthSelector'
import Loading from '../components/ui/Loading'
import EmptyState from '../components/ui/EmptyState'
import TransactionDetail from '../components/transactions/TransactionDetail'
import CategorySelector from '../components/transactions/CategorySelector'
import { useTransactions, useCategories, useAccounts, useTags } from '../hooks/useFirestore'
import { useActivityLogger } from '../hooks/useActivities'
import { usePrivacy } from '../contexts/PrivacyContext'
import { formatDate, formatDateForInput, groupByDate } from '../utils/helpers'
import { TRANSACTION_TYPES, CATEGORY_COLORS, FIXED_FREQUENCIES, INSTALLMENT_PERIODS } from '../utils/constants'
import { uploadComprovante } from '../services/storage'

export default function Transactions({
  month, year, onMonthChange, showAddModal, onCloseAddModal,
  filters, onFiltersChange, searchTerm, onSearchTermChange,
  showFilters, onShowFiltersChange, dateRange, onDateRangeChange
}) {
  const { formatCurrency } = usePrivacy()
  const setDateRange = onDateRangeChange
  const setFilters = onFiltersChange
  const setSearchTerm = onSearchTermChange
  const setShowFilters = onShowFiltersChange

  const {
    transactions,
    loading,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    updateRecurrenceGroup,
    deleteRecurrenceGroup
  } = useTransactions(month, year, dateRange)

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

  const fileInputRef = useRef(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [transactionToDelete, setTransactionToDelete] = useState(null)
  const [editModeModalOpen, setEditModeModalOpen] = useState(false)
  const [editMode, setEditMode] = useState('single') // 'single' ou 'all'
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState(null)
  const [transactionType, setTransactionType] = useState(TRANSACTION_TYPES.EXPENSE)
  const [activeFilterDropdown, setActiveFilterDropdown] = useState(null)
  const [showOverduePanel, setShowOverduePanel] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingCategory, setSavingCategory] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)

  // Abas do formulário avançado
  const [showNotes, setShowNotes] = useState(false)
  const [showTags, setShowTags] = useState(false)
  const [showRecurrence, setShowRecurrence] = useState(false)

  const [formData, setFormData] = useState({
    description: '',
    amount: '',
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

  // Tags filtradas para autocomplete
  const filteredTagSuggestions = useMemo(() => {
    if (!tagInput.trim()) return existingTags.filter(t => !formData.tags.includes(t))
    const term = tagInput.toLowerCase()
    return existingTags.filter(t =>
      t.toLowerCase().includes(term) && !formData.tags.includes(t)
    )
  }, [tagInput, existingTags, formData.tags])

  // Filtrar transações
  const filteredTransactions = useMemo(() => {
    let result = transactions

    // Filtro por período customizado
    if (dateRange && dateRange.startDate && dateRange.endDate) {
      const startDate = new Date(dateRange.startDate + 'T00:00:00')
      const endDate = new Date(dateRange.endDate + 'T23:59:59')
      result = result.filter(t => {
        // t.date pode ser um Date object (do Firestore) ou string
        const transactionDate = t.date instanceof Date ? t.date : new Date(t.date + 'T12:00:00')
        return transactionDate >= startDate && transactionDate <= endDate
      })
    }

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
          case 'fixed': return t.isFixed
          case 'installment': return t.isInstallment
          default: return true
        }
      })
    }

    // Filtro por conta
    if (filters.account !== 'all') {
      result = result.filter(t => t.accountId === filters.account)
    }

    // Filtro por categoria (suporta multi-select, IDs do Firestore e slugs Organizze)
    if (filters.category.length > 0) {
      const categoryMatchers = filters.category.map(catId => {
        const cat = allCategories.find(c => c.id === catId)
        const slug = cat ? cat.name.toLowerCase().replace(/ /g, '_') : null
        return { id: catId, slug }
      })
      result = result.filter(t =>
        categoryMatchers.some(m =>
          t.category === m.id || (m.slug && t.category === m.slug)
        )
      )
    }

    // Filtro por tag (multi-select)
    if (filters.tag.length > 0) {
      result = result.filter(t =>
        filters.tag.some(tag => t.tags?.includes(tag))
      )
    }

    // Filtro por busca
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(t =>
        t.description?.toLowerCase().includes(term) ||
        t.category?.toLowerCase().includes(term) ||
        t.tags?.some(tag => tag.toLowerCase().includes(term))
      )
    }

    return result
  }, [transactions, searchTerm, filters, dateRange])

  // Verificar se há filtros ativos
  const hasActiveFilters = filters.type !== 'all' || filters.account !== 'all' || filters.category.length > 0 || filters.tag.length > 0

  // Calcular lançamentos pendentes passados (vencidos)
  const overdueTransactions = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return transactions.filter(t => {
      if (t.paid !== false) return false // Só não pagos
      const transactionDate = t.date instanceof Date ? t.date : new Date(t.date)
      transactionDate.setHours(0, 0, 0, 0)
      return transactionDate < today // Data no passado
    }).sort((a, b) => {
      const dateA = a.date instanceof Date ? a.date : new Date(a.date)
      const dateB = b.date instanceof Date ? b.date : new Date(b.date)
      return dateA - dateB // Mais antigos primeiro
    })
  }, [transactions])

  // Labels dos filtros
  const getTypeLabel = () => {
    const labels = {
      all: 'Tipo',
      income: 'Receitas',
      income_paid: 'Receitas recebidas',
      income_pending: 'Receitas pendentes',
      expense: 'Despesas',
      expense_paid: 'Despesas pagas',
      expense_pending: 'Despesas pendentes',
      fixed: 'Lançamentos fixos',
      installment: 'Parcelados'
    }
    return labels[filters.type] || 'Tipo'
  }

  // Agrupar por data
  const groupedTransactions = useMemo(() => {
    return groupByDate(filteredTransactions)
  }, [filteredTransactions])

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
      amount: '',
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

  const openDetailModal = (transaction) => {
    setSelectedTransaction(transaction)
    setDetailModalOpen(true)
  }

  const openEditModal = (transaction) => {
    setDetailModalOpen(false)

    // Se faz parte de um grupo, pergunta qual modo de edição
    if (transaction.recurrenceGroup) {
      setEditingTransaction(transaction)
      setTransactionType(transaction.type)
      setEditModeModalOpen(true)
      return
    }

    // Se não tem grupo, edita normalmente
    proceedToEdit(transaction)
  }

  const proceedToEdit = (transaction, mode = 'single') => {
    setEditMode(mode)
    setEditModeModalOpen(false)
    setTransactionType(transaction.type)
    setEditingTransaction(transaction)
    setFormData({
      description: transaction.description,
      amount: transaction.amount.toString(),
      category: transaction.category,
      accountId: transaction.accountId || activeAccounts[0]?.id || '',
      date: formatDateForInput(transaction.date),
      notes: transaction.notes || '',
      tags: transaction.tags || [],
      attachments: transaction.attachments || (transaction.attachment ? [transaction.attachment] : []),
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
      amount: transaction.amount.toString(),
      category: transaction.category,
      accountId: transaction.accountId || activeAccounts[0]?.id || '',
      date: formatDateForInput(new Date()), // Data atual para a cópia
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
    const files = e.target.files
    if (!files || files.length === 0) return

    try {
      setUploading(true)
      setUploadError(null)

      // Upload de todos os arquivos selecionados
      const uploadPromises = Array.from(files).map(file => uploadComprovante(file))
      const results = await Promise.all(uploadPromises)

      setFormData(prev => ({
        ...prev,
        attachments: [...prev.attachments, ...results]
      }))
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

  const removeAttachment = (index) => {
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.description || !formData.amount || !formData.date) return

    try {
      setSaving(true)
      const data = {
        description: formData.description,
        amount: parseFloat(formData.amount),
        category: formData.category || 'other', // Categoria padrão se não selecionada
        accountId: formData.accountId,
        date: formData.date,
        type: transactionType,
        notes: formData.notes || null,
        tags: formData.tags.length > 0 ? formData.tags : null,
        attachments: formData.attachments.length > 0 ? formData.attachments : null,
        paid: formData.paid
      }

      if (editingTransaction) {
        if (editMode === 'all' && editingTransaction.recurrenceGroup) {
          // Editar todos do grupo - aplica as alterações comuns (exceto data, amount e paid)
          await updateRecurrenceGroup(editingTransaction.recurrenceGroup, {
            description: data.description,
            category: data.category,
            accountId: data.accountId,
            notes: data.notes,
            tags: data.tags
            // Não altera: date, amount (pode ser diferente em parcelas), paid
          })
        } else {
          // Editar apenas este
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

        // Verificar tipo de recorrência
        if (formData.recurrenceType === 'fixed') {
          // Despesa fixa - criar 12 lançamentos com frequência selecionada
          const baseDate = new Date(formData.date)
          const recurrenceGroup = Date.now().toString()

          for (let i = 0; i < 12; i++) {
            const transactionDate = addDateInterval(baseDate, formData.fixedFrequency, i)
            // Lançamentos futuros ficam como pendente
            const isPaid = !isFutureDate(transactionDate) && formData.paid

            await addTransaction({
              ...data,
              date: formatDateForInput(transactionDate),
              paid: isPaid,
              isFixed: true,
              fixedFrequency: formData.fixedFrequency,
              recurrenceGroup,
              recurrenceIndex: i + 1,
              recurrenceTotal: 12
            })
          }
        } else if (formData.recurrenceType === 'installment' && formData.installments) {
          // Parcelado com período selecionado
          const numInstallments = parseInt(formData.installments) || 1
          const total = parseFloat(formData.amount)
          const baseInstallmentAmount = Math.floor((total / numInstallments) * 100) / 100
          const remainder = Math.round((total - (baseInstallmentAmount * numInstallments)) * 100) / 100
          const baseDate = new Date(formData.date)
          const recurrenceGroup = Date.now().toString()

          for (let i = 0; i < numInstallments; i++) {
            const transactionDate = addDateInterval(baseDate, formData.installmentPeriod, i)
            // Primeira parcela recebe a sobra da divisão
            const installmentAmount = i === 0 ? baseInstallmentAmount + remainder : baseInstallmentAmount
            // Lançamentos futuros ficam como pendente
            const isPaid = !isFutureDate(transactionDate) && formData.paid

            await addTransaction({
              ...data,
              amount: installmentAmount,
              date: formatDateForInput(transactionDate),
              paid: isPaid,
              isInstallment: true,
              installmentPeriod: formData.installmentPeriod,
              recurrenceGroup,
              recurrenceIndex: i + 1,
              recurrenceTotal: numInstallments,
              originalAmount: total
            })
          }
        } else {
          const result = await addTransaction(data)
          // Registrar atividade
          if (result?.id) {
            logTransactionCreate({ id: result.id, ...data })
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
    // Se é parte de um grupo de recorrência, mostra modal de confirmação
    if (transaction.recurrenceGroup) {
      setTransactionToDelete(transaction)
      setDeleteModalOpen(true)
    } else {
      // Se não tem grupo, exclui direto
      confirmDelete(transaction.id, false)
    }
  }

  const confirmDelete = async (id, deleteAll = false) => {
    try {
      setDeleting(id)

      // Encontrar transação para log
      const transactionToLog = transactionToDelete || transactions.find(t => t.id === id)

      if (deleteAll && transactionToDelete?.recurrenceGroup) {
        // Exclui todas do grupo (busca no Firestore)
        await deleteRecurrenceGroup(transactionToDelete.recurrenceGroup)
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
      setDeleting(null)
    }
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
                    style={{ backgroundColor: `${getCategoryColor(transaction.category)}20` }}
                  >
                    {transaction.type === TRANSACTION_TYPES.INCOME ? (
                      <ArrowUpRight className="w-3.5 h-3.5" style={{ color: getCategoryColor(transaction.category) }} />
                    ) : (
                      <ArrowDownRight className="w-3.5 h-3.5" style={{ color: getCategoryColor(transaction.category) }} />
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
                      {formatDate(transaction.date)}
                      {transaction.accountId && ` • ${getAccountName(transaction.accountId)}`}
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

      {/* Filter Bar */}
      {showFilters && (
        <div className="flex flex-wrap gap-2 p-3 bg-dark-900 rounded-2xl">
          {/* Limpar filtros */}
          {hasActiveFilters && (
            <button
              onClick={() => setFilters({ type: 'all', account: 'all', category: [], tag: [] })}
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
                  { value: 'fixed', label: 'Lançamentos fixos' },
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
                      style={{ backgroundColor: `${getCategoryColor(transaction.category)}20` }}
                    >
                      {transaction.type === TRANSACTION_TYPES.INCOME ? (
                        <ArrowUpRight className="w-3.5 h-3.5" style={{ color: getCategoryColor(transaction.category) }} />
                      ) : (
                        <ArrowDownRight className="w-3.5 h-3.5" style={{ color: getCategoryColor(transaction.category) }} />
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
                        {transaction.recurrenceTotal > 1 && (
                          <span className="text-[9px] text-dark-500 bg-dark-800 px-1 rounded flex-shrink-0">
                            {transaction.recurrenceIndex}/{transaction.recurrenceTotal}
                          </span>
                        )}
                        {transaction.isFixed && (
                          <Repeat className="w-2.5 h-2.5 text-violet-400 flex-shrink-0" />
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
                        {getCategoryName(transaction.category)}
                        {transaction.accountId && ` • ${getAccountName(transaction.accountId)}`}
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
                      Serão criadas 12 {transactionType === TRANSACTION_TYPES.INCOME ? 'receitas' : 'despesas'}
                      {formData.fixedFrequency === 'daily' && ' (12 dias).'}
                      {formData.fixedFrequency === 'weekly' && ' (12 semanas).'}
                      {formData.fixedFrequency === 'biweekly' && ' (6 meses).'}
                      {formData.fixedFrequency === 'monthly' && ' (1 ano).'}
                      {formData.fixedFrequency === 'bimonthly' && ' (2 anos).'}
                      {formData.fixedFrequency === 'quarterly' && ' (3 anos).'}
                      {formData.fixedFrequency === 'semiannual' && ' (6 anos).'}
                      {formData.fixedFrequency === 'annual' && ' (12 anos).'}
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
                          const total = parseFloat(formData.amount || 0)
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
              accept="image/*,.pdf,.xls,.xlsx,.csv,.doc,.docx"
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
        getCategoryName={getCategoryName}
        getAccountName={getAccountName}
        getCategoryColor={getCategoryColor}
        deleting={deleting === selectedTransaction?.id}
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
            Este lançamento faz parte de um grupo de {editingTransaction?.isFixed ? 'lançamentos fixos' : 'parcelas'}.
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

            <Button
              onClick={() => proceedToEdit(editingTransaction, 'all')}
              variant="primary"
              fullWidth
            >
              Editar todos do grupo ({transactions.filter(t => t.recurrenceGroup === editingTransaction?.recurrenceGroup).length} lançamentos)
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
            Ao editar todos, serão atualizados: descrição, categoria, conta, observação e tags.
            Data, valor e status de pagamento permanecem individuais.
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
            Este lançamento faz parte de um grupo de {transactionToDelete?.isFixed ? 'despesas fixas' : 'parcelas'}.
            O que deseja fazer?
          </p>

          <div className="space-y-2">
            <Button
              onClick={() => confirmDelete(transactionToDelete?.id, false)}
              variant="secondary"
              fullWidth
              loading={deleting === transactionToDelete?.id}
            >
              Excluir apenas este lançamento
            </Button>

            <Button
              onClick={() => confirmDelete(transactionToDelete?.id, true)}
              variant="danger"
              fullWidth
              loading={deleting === transactionToDelete?.id}
            >
              Excluir todos do grupo ({transactions.filter(t => t.recurrenceGroup === transactionToDelete?.recurrenceGroup).length} lançamentos)
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
        </div>
      </Modal>
    </div>
  )
}
