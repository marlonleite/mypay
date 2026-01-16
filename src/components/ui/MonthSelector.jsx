import { useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { MONTHS } from '../../utils/constants'

export default function MonthSelector({ month, year, onChange }) {
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef(null)

  const handlePrevious = () => {
    if (month === 0) {
      onChange(11, year - 1)
    } else {
      onChange(month - 1, year)
    }
  }

  const handleNext = () => {
    if (month === 11) {
      onChange(0, year + 1)
    } else {
      onChange(month + 1, year)
    }
  }

  const handleQuickSelect = (option) => {
    const today = new Date()
    switch (option) {
      case 'today':
      case 'week':
      case 'month':
        onChange(today.getMonth(), today.getFullYear())
        break
      default:
        break
    }
    setShowDropdown(false)
  }

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="flex items-center justify-between bg-dark-900/80 backdrop-blur-sm border border-dark-700 rounded-xl p-2 relative z-50">
      <button
        onClick={handlePrevious}
        className="p-2 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-1 px-3 py-1 text-white font-medium hover:bg-dark-700 rounded-lg transition-colors"
        >
          {MONTHS[month]} {year}
          <ChevronDown className={`w-4 h-4 text-dark-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
        </button>

        {showDropdown && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-dark-800 border border-dark-600 rounded-xl shadow-lg py-1 min-w-[140px] z-[100]">
            <button
              onClick={() => handleQuickSelect('today')}
              className="w-full px-4 py-2 text-sm text-dark-300 hover:bg-dark-700 hover:text-white text-left transition-colors"
            >
              Hoje
            </button>
            <button
              onClick={() => handleQuickSelect('week')}
              className="w-full px-4 py-2 text-sm text-dark-300 hover:bg-dark-700 hover:text-white text-left transition-colors"
            >
              Esta semana
            </button>
            <button
              onClick={() => handleQuickSelect('month')}
              className="w-full px-4 py-2 text-sm text-dark-300 hover:bg-dark-700 hover:text-white text-left transition-colors"
            >
              Este mês
            </button>
          </div>
        )}
      </div>

      <button
        onClick={handleNext}
        className="p-2 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  )
}
