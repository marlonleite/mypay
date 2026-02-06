import { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronDown, Search } from 'lucide-react'

export default function SearchableSelect({
  options = [],
  value = 'all',
  onChange,
  placeholder = 'Selecione',
  allLabel = 'Todos',
  searchPlaceholder = 'Buscar...'
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef(null)
  const searchInputRef = useRef(null)

  const selectedOption = options.find(opt => opt.value === value)
  const displayLabel = value === 'all' ? placeholder : (selectedOption?.label || placeholder)
  const isActive = value !== 'all'

  const filteredOptions = search
    ? options.filter(opt => opt.label.toLowerCase().includes(search.toLowerCase()))
    : options

  const handleSelect = useCallback((val) => {
    onChange(val)
    setIsOpen(false)
    setSearch('')
  }, [onChange])

  const handleToggle = useCallback(() => {
    setIsOpen(prev => !prev)
    setSearch('')
  }, [])

  // Foco no input ao abrir
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      // Timeout para garantir que o dropdown já renderizou
      const timer = setTimeout(() => searchInputRef.current?.focus(), 50)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // Fechar ao clicar fora
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
        setSearch('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={handleToggle}
        className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm transition-colors ${
          isActive
            ? 'bg-violet-600 text-white'
            : 'bg-dark-700 text-dark-300 hover:text-white'
        }`}
      >
        <span className="truncate max-w-[140px]">{displayLabel}</span>
        <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-dark-900 border border-dark-600 rounded-xl shadow-lg min-w-[200px] z-50 overflow-hidden">
          {/* Campo de busca */}
          <div className="p-2 border-b border-dark-700">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-white placeholder-dark-500 focus:outline-none focus:border-violet-500"
              />
            </div>
          </div>

          {/* Lista de opções */}
          <div className="max-h-60 overflow-y-auto py-1">
            {/* Opção "Todos" */}
            {!search && (
              <button
                type="button"
                onClick={() => handleSelect('all')}
                className={`w-full px-4 py-2 text-sm text-left transition-colors ${
                  value === 'all'
                    ? 'text-violet-400 bg-violet-500/10'
                    : 'text-dark-300 hover:bg-dark-700 hover:text-white'
                }`}
              >
                {allLabel}
              </button>
            )}

            {filteredOptions.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelect(opt.value)}
                className={`w-full px-4 py-2 text-sm text-left transition-colors ${
                  value === opt.value
                    ? 'text-violet-400 bg-violet-500/10'
                    : 'text-dark-300 hover:bg-dark-700 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}

            {filteredOptions.length === 0 && (
              <p className="px-4 py-3 text-sm text-dark-500 text-center">
                Nenhum resultado
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
