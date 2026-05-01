import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  CreditCard,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
} from 'lucide-react'
import Button from '../ui/Button'
import CurrencyInput from '../ui/CurrencyInput'
import Select from '../ui/Select'
import CategorySelector from '../transactions/CategorySelector'
import { usePrivacy } from '../../contexts/PrivacyContext'
import { findBestCategory } from '../../utils/categoryMapping'
import { MONTHS } from '../../utils/constants'
import { getCurrentMonthYear, parseLocalDate } from '../../utils/helpers'
import { guessCardIdFromFileName } from '../../utils/guessCardFromFileName'
import { useCreditCardInvoices } from '../../hooks/useFirestore'

const VALIDATION_TOLERANCE = 0.02

/**
 * Período da fatura alinhado às linhas extraídas: usa o mês/ano da compra mais recente.
 * Evita confiar em mes_referencia/ano_referencia da IA quando estão incoerentes com as datas.
 */
function inferBillPeriodFromTransactions(transacoes) {
  if (!Array.isArray(transacoes) || transacoes.length === 0) return null
  let latest = null
  for (const t of transacoes) {
    if (!t?.data || typeof t.data !== 'string') continue
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t.data.trim())) continue
    const d = parseLocalDate(t.data.trim())
    if (Number.isNaN(d.getTime())) continue
    if (!latest || d > latest) latest = d
  }
  if (!latest) return null
  return { billMonth: latest.getMonth(), billYear: latest.getFullYear() }
}

function resolveInitialBillPeriod(data, month, year) {
  const fromLines = inferBillPeriodFromTransactions(data?.transacoes)
  if (fromLines) return fromLines

  if (data?.mes_referencia >= 1 && data?.mes_referencia <= 12 && data?.ano_referencia) {
    return { billMonth: data.mes_referencia - 1, billYear: data.ano_referencia }
  }

  if (
    typeof month === 'number' && month >= 0 && month <= 11 &&
    typeof year === 'number' && year >= 2000
  ) {
    return { billMonth: month, billYear: year }
  }

  const now = getCurrentMonthYear()
  return { billMonth: now.month, billYear: now.year }
}

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
  /** Nome do ficheiro enviado (ex. fatura_c6_2026-04.pdf) — heurística de cartão. */
  fileName = null,
  /** Após apply 207: remove line ids da seleção (token muda a cada prune). */
  selectionPruneRequest = null,
  /** Resumo de falhas parciais + retry. */
  applyWarningBanner = null,
  /** Mensagem de progresso durante importação em lote (controlada pelo parent). */
  importProgress = null,
}) {
  const { formatCurrency } = usePrivacy()

  const expenseCategories = useMemo(() => {
    if (getMainCategories) return getMainCategories('expense')
    return firestoreCategories.filter(c => c.type === 'expense' && !c.parentId)
  }, [firestoreCategories, getMainCategories])

  // Mapeia categorias da IA para categorias Firestore
  // Se a IA retornou um ID de categoria Firestore válido, usa direto; senão, fallback para findBestCategory
  const mapInitialTransactions = useCallback(() => {
    if (!data?.transacoes?.length) return []
    return data.transacoes.map((t) => {
      const isFirestoreId = t.categoria && expenseCategories.some(c => c.id === t.categoria)
      const categoryId = isFirestoreId
        ? t.categoria
        : findBestCategory(t.categoria, firestoreCategories, 'expense') || expenseCategories[0]?.id || ''
      return { ...t, categoryId }
    })
  }, [data, firestoreCategories, expenseCategories])

  const [selectedCard, setSelectedCard] = useState('')

  // Pré-seleciona: 1 cartão ativo, ou match do nome do ficheiro (ex. c6, bradesco) com nome/descrição do cartão.
  useEffect(() => {
    const active = cards.filter((c) => c && !c.archived)
    if (active.length === 0) return

    setSelectedCard((prev) => {
      if (prev) return prev
      if (active.length === 1) return active[0].id
      const guessed = fileName ? guessCardIdFromFileName(fileName, active) : null
      return guessed || ''
    })
  }, [cards, fileName])

  const { invoices, loading: invoicesLoading } = useCreditCardInvoices(selectedCard || null)

  const [{ billMonth, billYear }, setBillPeriod] = useState(() =>
    resolveInitialBillPeriod(data, month, year)
  )

  /**
   * Fatura alvo = a escolhida em "Fatura de referência" (billMonth/billYear), não o mês global do app.
   * 1) Ciclo: data no meio do mês de referência entre starting_date e closing_date (ex.: fatura que fecha em março).
   * 2) Fallback: due_date no mês/ano escolhido (quem trata o seletor como mês de vencimento).
   * Sem id, o backend infere invoice pela data de cada linha → itens espalhados em várias faturas.
   */
  const targetCreditCardInvoiceId = useMemo(() => {
    if (!selectedCard || typeof billMonth !== 'number' || typeof billYear !== 'number') return null
    if (!invoices?.length) return null
    const midCycle = new Date(billYear, billMonth, 15, 12, 0, 0)
    const byCycle = invoices.find(
      (inv) =>
        inv.startingDate &&
        inv.closingDate &&
        midCycle >= inv.startingDate &&
        midCycle <= inv.closingDate
    )
    if (byCycle) return byCycle.id
    return (
      invoices.find(
        (inv) =>
          inv.dueDate &&
          inv.dueDate.getMonth() === billMonth &&
          inv.dueDate.getFullYear() === billYear
      )?.id ?? null
    )
  }, [selectedCard, billMonth, billYear, invoices])

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

  const totalFatura = data?.valor_total_fatura ?? data?.valor_total ?? 0
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

  useEffect(() => {
    if (!selectionPruneRequest?.lineIds?.length) return
    setSelectedIds((prev) => {
      const next = new Set(prev)
      selectionPruneRequest.lineIds.forEach((id) => next.delete(id))
      return next
    })
  }, [selectionPruneRequest?.token])

  const handleSave = useCallback(() => {
    if (!selectedCard || selectedCount === 0) return

    const faturaDate = new Date(billYear, billMonth, 1)
    const expenses = editedTransactions
      .filter(t => selectedIds.has(t.id))
      .map(t => ({
        lineId: t.id,
        cardId: selectedCard,
        description: t.descricao,
        amount: t.valor || 0,
        date: faturaDate,
        originalDate: t.data,
        category: t.categoryId,
        categoria_sugerida: t.categoria_sugerida ?? null,
        type: t.transaction_type === 'income' ? 'income' : 'expense',
        billMonth,
        billYear,
        creditCardInvoiceId: targetCreditCardInvoiceId,
      }))

    onSave(expenses)
  }, [selectedCard, selectedCount, editedTransactions, selectedIds, billYear, billMonth, onSave, targetCreditCardInvoiceId])

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
            options={[
              { value: '', label: 'Selecione o cartão...' },
              ...cards.map(c => ({ value: c.id, label: c.name }))
            ]}
          />
        )}
      </div>

      {/* Seletor de mês/ano da fatura */}
      <div className="px-4 py-3 border-b border-dark-700">
        <label className="block text-sm font-medium text-dark-300 mb-2">Fatura de referência</label>
        <div className="flex gap-2">
          <Select
            value={billMonth}
            onChange={(e) =>
              setBillPeriod((p) => ({ ...p, billMonth: Number(e.target.value) }))
            }
            options={MONTHS.map((name, i) => ({ value: i, label: name }))}
            className="flex-1"
          />
          <Select
            value={billYear}
            onChange={(e) =>
              setBillPeriod((p) => ({ ...p, billYear: Number(e.target.value) }))
            }
            options={Array.from({ length: 5 }, (_, i) => {
              const y = new Date().getFullYear() - 2 + i
              return { value: y, label: String(y) }
            })}
            className="w-28"
          />
        </div>
        {selectedCard && !invoicesLoading && invoices.length > 0 && !targetCreditCardInvoiceId && (
          <p className="mt-2 text-xs text-amber-200/90 leading-snug">
            Não há fatura neste cartão para o período selecionado (ciclo ou vencimento). Ajuste o mês/ano ou abra
            Cartões e confira as faturas — sem vínculo, o servidor pode lançar cada compra na fatura pela data da
            linha.
          </p>
        )}
        {selectedCard && targetCreditCardInvoiceId && (
          <p className="mt-2 text-xs text-blue-200/90 leading-snug">
            Todas as linhas selecionadas serão lançadas nesta fatura — inclusive as com data fora do mês de
            fechamento (parcelas atrasadas, IOF, conversão de câmbio). É o comportamento correto: a fatura
            agrupa as compras pelo ciclo, não pela data de cada linha.
          </p>
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

      {applyWarningBanner && (
        <div className="px-4 pt-3 border-t border-dark-800">
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
            <p className="text-amber-200 font-medium">
              {applyWarningBanner.succeeded} linha(s) salvas; {applyWarningBanner.failed} falhou(aram).
              Corrija as categorias ou dados e use o botão abaixo para reenviar só o que falhou (nova tentativa).
            </p>
            <ul className="mt-2 max-h-36 overflow-y-auto text-dark-300 space-y-1 text-xs">
              {applyWarningBanner.failedLines.map((l) => (
                <li key={`${l.lineId}-${l.description}`}>
                  • {l.description}: {l.message}
                </li>
              ))}
            </ul>
            <div className="mt-3">
              <Button
                type="button"
                onClick={applyWarningBanner.onRetry}
                variant="secondary"
                size="sm"
                disabled={saving}
              >
                Tentar só as linhas com erro
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Ações */}
      <div className="p-4 border-t border-dark-700 space-y-3">
        {selectedCount >= 50 && (
          <p className="text-xs text-amber-200/90 -mt-1">
            São muitas linhas: não feche o aplicativo até o envio terminar.
          </p>
        )}
        {saving && importProgress && (
          <div
            role="status"
            aria-live="polite"
            aria-busy="true"
            className="flex items-center gap-2 rounded-xl border border-violet-500/25 bg-violet-500/10 px-3 py-2.5 text-sm text-violet-200"
          >
            <Loader2 className="w-4 h-4 shrink-0 animate-spin text-violet-400" aria-hidden />
            <span>{importProgress}</span>
          </div>
        )}
        <Button
          onClick={handleSave}
          icon={CreditCard}
          fullWidth
          loading={saving}
          disabled={
            saving ||
            hasNoCards ||
            selectedCount === 0 ||
            !selectedCard ||
            (Boolean(selectedCard) &&
              !invoicesLoading &&
              invoices.length > 0 &&
              !targetCreditCardInvoiceId)
          }
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
