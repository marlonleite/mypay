import { createContext, useContext, useState, useCallback } from 'react'

const SearchContext = createContext()

export function useSearch() {
  const context = useContext(SearchContext)
  if (!context) {
    throw new Error('useSearch must be used within a SearchProvider')
  }
  return context
}

export function SearchProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [recentSearches, setRecentSearches] = useState(() => {
    try {
      const saved = localStorage.getItem('mypay-recent-searches')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  const openSearch = useCallback(() => {
    setIsOpen(true)
  }, [])

  const closeSearch = useCallback(() => {
    setIsOpen(false)
    setQuery('')
  }, [])

  const toggleSearch = useCallback(() => {
    setIsOpen(prev => !prev)
    if (isOpen) {
      setQuery('')
    }
  }, [isOpen])

  const addRecentSearch = useCallback((search) => {
    if (!search.trim()) return

    setRecentSearches(prev => {
      const filtered = prev.filter(s => s.toLowerCase() !== search.toLowerCase())
      const updated = [search, ...filtered].slice(0, 5)
      try {
        localStorage.setItem('mypay-recent-searches', JSON.stringify(updated))
      } catch {
        // Ignore localStorage errors
      }
      return updated
    })
  }, [])

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([])
    try {
      localStorage.removeItem('mypay-recent-searches')
    } catch {
      // Ignore localStorage errors
    }
  }, [])

  const value = {
    isOpen,
    query,
    setQuery,
    openSearch,
    closeSearch,
    toggleSearch,
    recentSearches,
    addRecentSearch,
    clearRecentSearches
  }

  return (
    <SearchContext.Provider value={value}>
      {children}
    </SearchContext.Provider>
  )
}
