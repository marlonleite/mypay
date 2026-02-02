import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Search, X, Receipt, CreditCard, Wallet, Tag, Clock, ArrowRight } from 'lucide-react'
import { useSearch } from '../../contexts/SearchContext'
import { useTransactions } from '../../hooks/useFirestore'
import { useCards } from '../../hooks/useFirestore'
import { useAccounts } from '../../hooks/useFirestore'
import { useCategories } from '../../hooks/useFirestore'

const DEBOUNCE_DELAY_MS = 300
const MIN_SEARCH_LENGTH = 2
const MAX_RESULTS_PER_CATEGORY = 5

// Função de debounce
function debounce(fn, delay) {
  let timeoutId
  return (...args) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}

export default function SearchModal({ onNavigate }) {
  const { isOpen, query, setQuery, closeSearch, recentSearches, addRecentSearch } = useSearch()
  const inputRef = useRef(null)
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Hooks de dados - buscar do mês atual e alguns meses anteriores
  const now = new Date()
  const { transactions } = useTransactions(now.getMonth(), now.getFullYear())
  const { cards } = useCards()
  const { accounts } = useAccounts()
  const { categories } = useCategories()

  // Debounce da query
  const debouncedSetQuery = useMemo(
    () => debounce((q) => setDebouncedQuery(q), DEBOUNCE_DELAY_MS),
    []
  )

  useEffect(() => {
    debouncedSetQuery(query)
  }, [query, debouncedSetQuery])

  // Focar no input quando abrir
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Resetar seleção quando query mudar
  useEffect(() => {
    setSelectedIndex(0)
  }, [debouncedQuery])

  // Resultados da busca
  const results = useMemo(() => {
    if (debouncedQuery.length < MIN_SEARCH_LENGTH) {
      return { transactions: [], cards: [], accounts: [], categories: [], total: 0 }
    }

    const searchLower = debouncedQuery.toLowerCase()

    // Buscar em transações
    const matchedTransactions = transactions
      .filter(t =>
        t.description?.toLowerCase().includes(searchLower) ||
        t.notes?.toLowerCase().includes(searchLower) ||
        t.tags?.some(tag => tag.toLowerCase().includes(searchLower))
      )
      .slice(0, MAX_RESULTS_PER_CATEGORY)

    // Buscar em cartões
    const matchedCards = cards
      .filter(c => c.name?.toLowerCase().includes(searchLower))
      .slice(0, MAX_RESULTS_PER_CATEGORY)

    // Buscar em contas
    const matchedAccounts = accounts
      .filter(a => a.name?.toLowerCase().includes(searchLower))
      .slice(0, MAX_RESULTS_PER_CATEGORY)

    // Buscar em categorias
    const matchedCategories = categories
      .filter(c =>
        !c.archived &&
        c.name?.toLowerCase().includes(searchLower)
      )
      .slice(0, MAX_RESULTS_PER_CATEGORY)

    return {
      transactions: matchedTransactions,
      cards: matchedCards,
      accounts: matchedAccounts,
      categories: matchedCategories,
      total: matchedTransactions.length + matchedCards.length +
             matchedAccounts.length + matchedCategories.length
    }
  }, [debouncedQuery, transactions, cards, accounts, categories])

  // Lista flat de todos os resultados para navegação por teclado
  const flatResults = useMemo(() => {
    const items = []

    results.transactions.forEach(t => items.push({ type: 'transaction', data: t }))
    results.cards.forEach(c => items.push({ type: 'card', data: c }))
    results.accounts.forEach(a => items.push({ type: 'account', data: a }))
    results.categories.forEach(c => items.push({ type: 'category', data: c }))

    return items
  }, [results])

  // Handler para selecionar um resultado
  const handleSelect = useCallback((item) => {
    addRecentSearch(query)

    switch (item.type) {
      case 'transaction':
        onNavigate?.('transactions', { transactionId: item.data.id })
        break
      case 'card':
        onNavigate?.('cards', { cardId: item.data.id })
        break
      case 'account':
        onNavigate?.('accounts', { accountId: item.data.id })
        break
      case 'category':
        onNavigate?.('categories', { categoryId: item.data.id })
        break
    }

    closeSearch()
  }, [query, addRecentSearch, onNavigate, closeSearch])

  // Navegação por teclado
  const handleKeyDown = useCallback((e) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev =>
          prev < flatResults.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev =>
          prev > 0 ? prev - 1 : flatResults.length - 1
        )
        break
      case 'Enter':
        e.preventDefault()
        if (flatResults[selectedIndex]) {
          handleSelect(flatResults[selectedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        closeSearch()
        break
    }
  }, [flatResults, selectedIndex, handleSelect, closeSearch])

  // Formatar valor monetário
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  // Formatar data
  const formatDate = (date) => {
    if (!date) return ''
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short'
    }).format(date)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={closeSearch}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-dark-900 rounded-2xl shadow-2xl border border-dark-700 overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-dark-700">
          <Search className="w-5 h-5 text-dark-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar transações, cartões, contas..."
            className="flex-1 bg-transparent text-white placeholder-dark-500 outline-none text-base"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-dark-400 hover:text-white rounded-full hover:bg-dark-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:flex items-center gap-1 px-2 py-1 text-xs text-dark-500 bg-dark-800 rounded border border-dark-600">
            ESC
          </kbd>
        </div>

        {/* Content */}
        <div className="max-h-96 overflow-y-auto">
          {/* Estado inicial - buscas recentes */}
          {!query && recentSearches.length > 0 && (
            <div className="p-2">
              <div className="px-3 py-2 text-xs font-medium text-dark-500 uppercase tracking-wider">
                Buscas recentes
              </div>
              {recentSearches.map((search, index) => (
                <button
                  key={index}
                  onClick={() => setQuery(search)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left text-dark-300 hover:bg-dark-800 rounded-lg transition-colors"
                >
                  <Clock className="w-4 h-4 text-dark-500" />
                  <span>{search}</span>
                </button>
              ))}
            </div>
          )}

          {/* Placeholder quando não há query */}
          {!query && recentSearches.length === 0 && (
            <div className="p-8 text-center text-dark-500">
              <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Digite para buscar em transações, cartões, contas e categorias</p>
            </div>
          )}

          {/* Query muito curta */}
          {query && query.length < MIN_SEARCH_LENGTH && (
            <div className="p-8 text-center text-dark-500">
              <p>Digite pelo menos {MIN_SEARCH_LENGTH} caracteres para buscar</p>
            </div>
          )}

          {/* Resultados */}
          {debouncedQuery.length >= MIN_SEARCH_LENGTH && (
            <>
              {/* Sem resultados */}
              {results.total === 0 && (
                <div className="p-8 text-center text-dark-500">
                  <p>Nenhum resultado encontrado para &ldquo;{debouncedQuery}&rdquo;</p>
                </div>
              )}

              {/* Transações */}
              {results.transactions.length > 0 && (
                <div className="p-2">
                  <div className="px-3 py-2 text-xs font-medium text-dark-500 uppercase tracking-wider flex items-center gap-2">
                    <Receipt className="w-3.5 h-3.5" />
                    Transações
                  </div>
                  {results.transactions.map((transaction, index) => {
                    const globalIndex = index
                    const isSelected = selectedIndex === globalIndex

                    return (
                      <button
                        key={transaction.id}
                        onClick={() => handleSelect({ type: 'transaction', data: transaction })}
                        className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg transition-colors ${
                          isSelected ? 'bg-violet-500/20 text-white' : 'text-dark-300 hover:bg-dark-800'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            transaction.type === 'income' ? 'bg-emerald-500' : 'bg-red-500'
                          }`} />
                          <div className="min-w-0">
                            <div className="truncate">{transaction.description}</div>
                            <div className="text-xs text-dark-500">
                              {formatDate(transaction.date)}
                            </div>
                          </div>
                        </div>
                        <div className={`flex-shrink-0 font-medium ${
                          transaction.type === 'income' ? 'text-emerald-500' : 'text-red-500'
                        }`}>
                          {transaction.type === 'income' ? '+' : '-'} {formatCurrency(transaction.amount)}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Cartões */}
              {results.cards.length > 0 && (
                <div className="p-2">
                  <div className="px-3 py-2 text-xs font-medium text-dark-500 uppercase tracking-wider flex items-center gap-2">
                    <CreditCard className="w-3.5 h-3.5" />
                    Cartões
                  </div>
                  {results.cards.map((card, index) => {
                    const globalIndex = results.transactions.length + index
                    const isSelected = selectedIndex === globalIndex

                    return (
                      <button
                        key={card.id}
                        onClick={() => handleSelect({ type: 'card', data: card })}
                        className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg transition-colors ${
                          isSelected ? 'bg-violet-500/20 text-white' : 'text-dark-300 hover:bg-dark-800'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <CreditCard className="w-4 h-4 text-orange-500" />
                          <span>{card.name}</span>
                        </div>
                        <ArrowRight className="w-4 h-4 text-dark-500" />
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Contas */}
              {results.accounts.length > 0 && (
                <div className="p-2">
                  <div className="px-3 py-2 text-xs font-medium text-dark-500 uppercase tracking-wider flex items-center gap-2">
                    <Wallet className="w-3.5 h-3.5" />
                    Contas
                  </div>
                  {results.accounts.map((account, index) => {
                    const globalIndex = results.transactions.length + results.cards.length + index
                    const isSelected = selectedIndex === globalIndex

                    return (
                      <button
                        key={account.id}
                        onClick={() => handleSelect({ type: 'account', data: account })}
                        className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg transition-colors ${
                          isSelected ? 'bg-violet-500/20 text-white' : 'text-dark-300 hover:bg-dark-800'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Wallet className="w-4 h-4 text-emerald-500" />
                          <span>{account.name}</span>
                        </div>
                        <ArrowRight className="w-4 h-4 text-dark-500" />
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Categorias */}
              {results.categories.length > 0 && (
                <div className="p-2">
                  <div className="px-3 py-2 text-xs font-medium text-dark-500 uppercase tracking-wider flex items-center gap-2">
                    <Tag className="w-3.5 h-3.5" />
                    Categorias
                  </div>
                  {results.categories.map((category, index) => {
                    const globalIndex = results.transactions.length + results.cards.length +
                                       results.accounts.length + index
                    const isSelected = selectedIndex === globalIndex

                    return (
                      <button
                        key={category.id}
                        onClick={() => handleSelect({ type: 'category', data: category })}
                        className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg transition-colors ${
                          isSelected ? 'bg-violet-500/20 text-white' : 'text-dark-300 hover:bg-dark-800'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: `var(--color-${category.color}-500, #8b5cf6)` }}
                          />
                          <span>{category.name}</span>
                          <span className="text-xs text-dark-500">
                            {category.type === 'income' ? 'Receita' : 'Despesa'}
                          </span>
                        </div>
                        <ArrowRight className="w-4 h-4 text-dark-500" />
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer com atalhos */}
        <div className="px-4 py-2 border-t border-dark-700 flex items-center justify-between text-xs text-dark-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-dark-800 rounded border border-dark-600">↑↓</kbd>
              navegar
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-dark-800 rounded border border-dark-600">↵</kbd>
              selecionar
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-dark-800 rounded border border-dark-600">⌘</kbd>
            <kbd className="px-1.5 py-0.5 bg-dark-800 rounded border border-dark-600">K</kbd>
            buscar
          </span>
        </div>
      </div>
    </div>
  )
}
