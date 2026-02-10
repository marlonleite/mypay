import { useState, useMemo, useCallback } from 'react'
import {
  CreditCard,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
} from 'lucide-react'
import Button from '../ui/Button'
import CurrencyInput from '../ui/CurrencyInput'
import Select from '../ui/Select'
import CategorySelector from '../transactions/CategorySelector'
import { usePrivacy } from '../../contexts/PrivacyContext'
import { findBestCategory } from '../../utils/categoryMapping'

const VALIDATION_TOLERANCE = 0.02

function formatBRL(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export default function FaturaResult({
  data,
  onSave,
  onDiscard,
  cards = [],
  categories: firestoreCategories = [],
  getMainCategories,
  saving = false,
  month,
  year,
}) {
  const { formatCurrency } = usePrivacy()

  const expenseCategories = useMemo(() => {
    if (getMainCategories) return getMainCategories('expense')
    return firestoreCategories.filter(c => c.type === 'expense' && !c.parentId)
  }, [firestoreCategories, getMainCategories])

  // Mapeia categorias da IA para categorias Firestore
  const mapInitialTransactions = useCallback(() => {
    if (!data?.transacoes?.length) return []
    return data.transacoes.map((t) => ({
      ...t,
      categoryId: findBestCategory(t.categoria, firestoreCategories, 'expense') || expenseCategories[0]?.id || '',
    }))
  }, [data, firestoreCategories, expenseCategories])

  const [selectedCard, setSelectedCard] = useState(cards[0]?.id || '')
  const [selectedIds, setSelectedIds] = useState(() => {
    if (!data?.transacoes?.length) return new Set()
    return new Set(data.transacoes.map(t => t.id))
  })
  const [editedTransactions, setEditedTransactions] = useState(mapInitialTransactions)
  const [expandedId, setExpandedId] = useState(null)

  // Totais
  const selectedTotal = useMemo(() => {
    return editedTransactions
      .filter(t => selectedIds.has(t.id))
      .reduce((sum, t) => sum + (t.valor || 0), 0)
  }, [editedTransactions, selectedIds])

  const totalFatura = data?.valor_total_fatura || 0
  const diff = Math.abs(totalFatura - selectedTotal)
  const isBalanced = diff <= VALIDATION_TOLERANCE

  const selectedCount = selectedIds.size
  const totalCount = editedTransactions.length

  // Handlers
  const toggleSelect = useCallback((id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === editedTransactions.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(editedTransactions.map(t => t.id)))
    }
  }, [selectedIds.size, editedTransactions])

  const toggleExpand = useCallback((id) => {
    setExpandedId(prev => prev === id ? null : id)
  }, [])

  const updateTransaction = useCallback((id, field, value) => {
    setEditedTransactions(prev =>
      prev.map(t => t.id === id ? { ...t, [field]: value } : t)
    )
  }, [])

  const handleSave = useCallback(() => {
    if (!selectedCard || selectedCount === 0) return

    const faturaDate = new Date(year, month, 1)
    const expenses = editedTransactions
      .filter(t => selectedIds.has(t.id))
      .map(t => ({
        cardId: selectedCard,
        description: t.descricao,
        amount: t.valor || 0,
        date: faturaDate,
        originalDate: t.data,
        category: t.categoryId,
      }))

    onSave(expenses)
  }, [selectedCard, selectedCount, editedTransactions, selectedIds, year, month, onSave])

  // Empty state
  if (!data?.transacoes?.length) {
    return (
      <div className="bg-dark-900 border border-dark-700 rounded-2xl p-8">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-yellow-400" />
          </div>
          <p className="text-white font-medium mt-4">Nenhuma transação encontrada</p>
          <p className="text-sm text-dark-400 mt-1">A IA não conseguiu extrair transações desta fatura.</p>
          <Button onClick={onDiscard} variant="ghost" className="mt-4">
            Voltar
          </Button>
        </div>
      </div>
    )
  }

  const hasNoCards = cards.length === 0

  return (
    <div className="bg-dark-900 border border-dark-700 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-dark-700">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-violet-500/20 rounded-xl">
            <FileSpreadsheet className="w-5 h-5 text-violet-400" />
          </div>
          <h3 className="font-medium text-white">Fatura de Cartão</h3>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-dark-800 rounded-xl p-3">
            <p className="text-xs text-dark-400">Total da Fatura</p>
            <p className="text-lg font-bold text-white">{formatCurrency(totalFatura)}</p>
          </div>
          <div className="bg-dark-800 rounded-xl p-3">
            <p className="text-xs text-dark-400">Selecionados ({selectedCount})</p>
            <p className="text-lg font-bold text-white">{formatCurrency(selectedTotal)}</p>
          </div>
        </div>

        {/* Badge de validação */}
        <div className={`mt-3 flex items-center gap-2 px-3 py-2 rounded-xl ${
          isBalanced ? 'bg-emerald-500/10' : 'bg-yellow-500/10'
        }`}>
          {isBalanced ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
          )}
          <span className={`text-sm ${isBalanced ? 'text-emerald-400' : 'text-yellow-400'}`}>
            {isBalanced
              ? 'Total confere com a fatura'
              : `Diferença de ${formatBRL(diff)} entre fatura e selecionados`
            }
          </span>
        </div>
      </div>

      {/* Seletor de cartão */}
      <div className="p-4 border-b border-dark-700">
        {hasNoCards ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span className="text-sm text-red-400">
              Nenhum cartão cadastrado. Cadastre um cartão antes de importar.
            </span>
          </div>
        ) : (
          <Select
            label="Cartão"
            value={selectedCard}
            onChange={(e) => setSelectedCard(e.target.value)}
            options={cards.map(c => ({ value: c.id, label: c.name }))}
          />
        )}
      </div>

      {/* Toolbar select all */}
      <div className="px-4 py-3 border-b border-dark-700 flex items-center justify-between">
        <button
          type="button"
          onClick={toggleSelectAll}
          className="flex items-center gap-2 text-sm text-dark-300 hover:text-white transition-colors"
        >
          {selectedIds.size === editedTransactions.length ? (
            <CheckSquare className="w-4 h-4 text-violet-400" />
          ) : (
            <Square className="w-4 h-4" />
          )}
          Selecionar todos
        </button>
        <span className="text-xs text-dark-500">
          {selectedCount}/{totalCount}
        </span>
      </div>

      {/* Lista de transações */}
      <div className="max-h-96 overflow-y-auto">
        {editedTransactions.map((t) => {
          const isSelected = selectedIds.has(t.id)
          const isExpanded = expandedId === t.id
          const categoryObj = expenseCategories.find(c => c.id === t.categoryId)

          return (
            <div
              key={t.id}
              className={`border-b border-dark-800 last:border-b-0 ${
                isSelected ? 'bg-dark-900' : 'bg-dark-900/50 opacity-60'
              }`}
            >
              {/* Linha compacta */}
              <div className="flex items-center gap-3 px-4 py-3">
                <button
                  type="button"
                  onClick={() => toggleSelect(t.id)}
                  className="flex-shrink-0"
                >
                  {isSelected ? (
                    <CheckSquare className="w-5 h-5 text-violet-400" />
                  ) : (
                    <Square className="w-5 h-5 text-dark-500" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => toggleExpand(t.id)}
                  className="flex-1 flex items-center gap-3 min-w-0 text-left"
                >
                  <span className="text-xs text-dark-500 flex-shrink-0 w-12">{t.data}</span>
                  <span className="text-sm text-white truncate flex-1">{t.descricao}</span>
                  <span className="text-sm font-medium text-red-400 flex-shrink-0">
                    {formatCurrency(t.valor)}
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-dark-500 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-dark-500 flex-shrink-0" />
                  )}
                </button>
              </div>

              {/* Badge de categoria (modo compacto) */}
              {!isExpanded && categoryObj && (
                <div className="px-4 pb-2 pl-16">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-dark-700 text-dark-300">
                    {categoryObj.name}
                  </span>
                </div>
              )}

              {/* Modo expandido: edição inline */}
              {isExpanded && (
                <div className="px-4 pb-4 pl-12 space-y-3">
                  <div>
                    <label className="block text-xs text-dark-400 mb-1">Descrição</label>
                    <input
                      type="text"
                      value={t.descricao}
                      onChange={(e) => updateTransaction(t.id, 'descricao', e.target.value)}
                      className="w-full px-3 py-2 bg-dark-800 rounded-xl text-sm text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <CurrencyInput
                      label="Valor"
                      value={t.valor}
                      onChange={(val) => updateTransaction(t.id, 'valor', val || 0)}
                    />
                    <div>
                      <label className="block text-xs text-dark-400 mb-1">Categoria</label>
                      <CategorySelector
                        value={t.categoryId}
                        onChange={(id) => updateTransaction(t.id, 'categoryId', id)}
                        categories={expenseCategories}
                        type="expense"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Ações */}
      <div className="p-4 border-t border-dark-700 space-y-3">
        <Button
          onClick={handleSave}
          icon={CreditCard}
          fullWidth
          loading={saving}
          disabled={hasNoCards || selectedCount === 0 || !selectedCard}
        >
          Importar {selectedCount} {selectedCount === 1 ? 'despesa' : 'despesas'}
        </Button>
        <Button
          onClick={onDiscard}
          variant="ghost"
          fullWidth
          disabled={saving}
        >
          Descartar
        </Button>
      </div>
    </div>
  )
}
