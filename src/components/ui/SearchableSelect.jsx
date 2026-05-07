import { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronDown, Search, X, Check } from 'lucide-react'

function foldForSearch(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

export default function SearchableSelect({
  options = [],
  value = 'all',
  onChange,
  placeholder = 'Selecione',
  allLabel = 'Todos',
  searchPlaceholder = 'Buscar...',
  multiple = false,
  /** Single-select “empty” sentinel (default matches legacy filters). */
  emptyValue = 'all',
  /** Single-select: hide top “clear / all” row (e.g. required pick in modals). */
  showResetOption = true,
  /** Match wide modal selects (full trigger + panel width). */
  fullWidth = false
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef(null)
  const searchInputRef = useRef(null)

  const selectedValues = multiple ? (Array.isArray(value) ? value : []) : []

  const singleUnset =
    !multiple &&
    (value === emptyValue || value === undefined || value === null || value === '')

  const isActive = multiple ? selectedValues.length > 0 : !singleUnset

  const displayLabel = multiple
    ? selectedValues.length === 0
      ? placeholder
      : selectedValues.length === 1
        ? (options.find(opt => opt.value === selectedValues[0])?.label || placeholder)
        : `${placeholder} (${selectedValues.length})`
    : singleUnset
      ? placeholder
      : (options.find(opt => opt.value === value)?.label || placeholder)

  const q = search.trim()
  const filteredOptions = q
    ? options.filter(opt => foldForSearch(opt.label).includes(foldForSearch(q)))
    : options

  const handleSingleSelect = useCallback((val) => {
    onChange(val)
    setIsOpen(false)
    setSearch('')
  }, [onChange])

  const handleMultiToggle = useCallback((val) => {
    if (selectedValues.includes(val)) {
      const next = selectedValues.filter(v => v !== val)
      onChange(next.length > 0 ? next : [])
    } else {
      onChange([...selectedValues, val])
    }
  }, [onChange, selectedValues])

  const handleClearAll = useCallback(() => {
    onChange(multiple ? [] : emptyValue)
    setIsOpen(false)
    setSearch('')
  }, [onChange, multiple, emptyValue])

  const handleToggle = useCallback(() => {
    setIsOpen(prev => !prev)
    setSearch('')
  }, [])

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      const timer = setTimeout(() => searchInputRef.current?.focus(), 50)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

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

  const isSelected = (val) => {
    return multiple ? selectedValues.includes(val) : value === val
  }

  const triggerClass = fullWidth
    ? `flex items-center w-full text-sm transition-colors border ${
        isActive
          ? 'justify-between px-4 py-3.5 rounded-[16px] bg-dark-800 text-white border-violet-500/40 ring-2 ring-violet-500/25'
          : 'justify-between px-4 py-3.5 rounded-[16px] bg-dark-800 text-dark-300 border-transparent hover:text-white hover:bg-dark-800/90'
      }`
    : `flex items-center gap-1 px-3 py-2 rounded-lg text-sm transition-colors ${
        isActive
          ? 'bg-violet-600 text-white'
          : 'bg-dark-700 text-dark-300 hover:text-white'
      }`

  const panelClass = fullWidth
    ? 'absolute top-full left-0 right-0 w-full mt-1 bg-dark-900 border border-dark-600 rounded-xl shadow-lg z-[60] overflow-hidden'
    : 'absolute top-full left-0 mt-1 bg-dark-900 border border-dark-600 rounded-xl shadow-lg min-w-[200px] z-[60] overflow-hidden'

  const labelSpanClass = fullWidth
    ? 'truncate flex-1 min-w-0 text-left'
    : 'truncate max-w-[140px]'

  return (
    <div className={`relative ${fullWidth ? 'w-full' : ''}`} ref={containerRef}>
      <button
        type="button"
        onClick={handleToggle}
        className={triggerClass}
      >
        <span className={labelSpanClass}>{displayLabel}</span>
        {isActive && multiple ? (
          <X
            className="w-4 h-4 flex-shrink-0 hover:text-violet-200"
            onClick={(e) => { e.stopPropagation(); handleClearAll() }}
          />
        ) : (
          <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        )}
      </button>

      {isOpen && (
        <div className={panelClass}>
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

          <div className="max-h-60 overflow-y-auto py-1">
            {showResetOption && !multiple && !q && (
              <button
                type="button"
                onClick={() => handleClearAll()}
                className={`w-full px-4 py-2 text-sm text-left transition-colors ${
                  singleUnset
                    ? 'text-violet-400 bg-violet-500/10'
                    : 'text-dark-300 hover:bg-dark-700 hover:text-white'
                }`}
              >
                {allLabel}
              </button>
            )}

            {filteredOptions.map(opt => (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => multiple ? handleMultiToggle(opt.value) : handleSingleSelect(opt.value)}
                className={`w-full px-4 py-2 text-sm text-left transition-colors flex items-center justify-between ${
                  isSelected(opt.value)
                    ? 'text-violet-400 bg-violet-500/10'
                    : 'text-dark-300 hover:bg-dark-700 hover:text-white'
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {multiple && isSelected(opt.value) && (
                  <Check className="w-4 h-4 flex-shrink-0" />
                )}
                {!multiple && isSelected(opt.value) && (
                  <Check className="w-4 h-4 flex-shrink-0 text-violet-400" />
                )}
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
