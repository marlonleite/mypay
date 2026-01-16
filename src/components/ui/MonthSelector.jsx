import { useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown, Calendar, X } from 'lucide-react'
import { MONTHS } from '../../utils/constants'

export default function MonthSelector({ month, year, onChange, dateRange, onDateRangeChange }) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [showCustomPeriod, setShowCustomPeriod] = useState(false)
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const dropdownRef = useRef(null)

  // Verificar se está usando período customizado
  const isCustomPeriod = dateRange && dateRange.startDate && dateRange.endDate

  const handlePrevious = () => {
    if (isCustomPeriod) {
      // Se está em período custom, volta para mês anterior ao início
      const startDate = new Date(dateRange.startDate)
      const prevMonth = startDate.getMonth() === 0 ? 11 : startDate.getMonth() - 1
      const prevYear = startDate.getMonth() === 0 ? startDate.getFullYear() - 1 : startDate.getFullYear()
      onDateRangeChange?.(null) // Limpa o período custom
      onChange(prevMonth, prevYear)
    } else if (month === 0) {
      onChange(11, year - 1)
    } else {
      onChange(month - 1, year)
    }
  }

  const handleNext = () => {
    if (isCustomPeriod) {
      // Se está em período custom, avança para mês posterior ao fim
      const endDate = new Date(dateRange.endDate)
      const nextMonth = endDate.getMonth() === 11 ? 0 : endDate.getMonth() + 1
      const nextYear = endDate.getMonth() === 11 ? endDate.getFullYear() + 1 : endDate.getFullYear()
      onDateRangeChange?.(null) // Limpa o período custom
      onChange(nextMonth, nextYear)
    } else if (month === 11) {
      onChange(0, year + 1)
    } else {
      onChange(month + 1, year)
    }
  }

  const handleQuickSelect = (option) => {
    const today = new Date()

    switch (option) {
      case 'today': {
        const todayStr = today.toISOString().split('T')[0]
        onDateRangeChange?.({ startDate: todayStr, endDate: todayStr })
        break
      }
      case 'week': {
        const dayOfWeek = today.getDay()
        const startOfWeek = new Date(today)
        startOfWeek.setDate(today.getDate() - dayOfWeek)
        const endOfWeek = new Date(startOfWeek)
        endOfWeek.setDate(startOfWeek.getDate() + 6)
        onDateRangeChange?.({
          startDate: startOfWeek.toISOString().split('T')[0],
          endDate: endOfWeek.toISOString().split('T')[0]
        })
        break
      }
      case 'month':
        onDateRangeChange?.(null) // Limpa o período custom
        onChange(today.getMonth(), today.getFullYear())
        break
      case 'custom':
        // Inicializar com o mês atual se não tiver valores
        if (!customStart) {
          const firstDay = new Date(year, month, 1)
          setCustomStart(firstDay.toISOString().split('T')[0])
        }
        if (!customEnd) {
          const lastDay = new Date(year, month + 1, 0)
          setCustomEnd(lastDay.toISOString().split('T')[0])
        }
        setShowCustomPeriod(true)
        setShowDropdown(false)
        return
      default:
        break
    }
    setShowDropdown(false)
  }

  const handleApplyCustomPeriod = () => {
    if (customStart && customEnd) {
      onDateRangeChange?.({ startDate: customStart, endDate: customEnd })
      setShowCustomPeriod(false)
    }
  }

  const handleBackFromCustom = () => {
    setShowCustomPeriod(false)
    setShowDropdown(true)
  }

  // Formatar exibição do período
  const getDisplayText = () => {
    if (isCustomPeriod) {
      const start = new Date(dateRange.startDate + 'T12:00:00')
      const end = new Date(dateRange.endDate + 'T12:00:00')
      const formatDate = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

      // Se for o mesmo dia, mostrar só uma data
      if (dateRange.startDate === dateRange.endDate) {
        return formatDate(start)
      }
      return `${formatDate(start)} - ${formatDate(end)}`
    }
    return `${MONTHS[month]} ${year}`
  }

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false)
        setShowCustomPeriod(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="flex items-center justify-center gap-4 relative z-50">
      <button
        onClick={handlePrevious}
        className="p-2 text-dark-400 hover:text-white transition-colors"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      <div className="relative flex items-center gap-1" ref={dropdownRef}>
        <button
          onClick={() => {
            setShowDropdown(!showDropdown)
            setShowCustomPeriod(false)
          }}
          className="flex items-center gap-2 px-4 py-2 text-white font-semibold hover:bg-dark-900 rounded-xl transition-colors"
        >
          {isCustomPeriod && <Calendar className="w-4 h-4 text-violet-400" />}
          {getDisplayText()}
          <ChevronDown className={`w-4 h-4 text-dark-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
        </button>

        {/* Botão para limpar filtro de período */}
        {isCustomPeriod && (
          <button
            onClick={() => {
              onDateRangeChange?.(null)
              setCustomStart('')
              setCustomEnd('')
            }}
            className="p-1.5 text-dark-400 hover:text-white hover:bg-dark-800 rounded-full transition-colors"
            title="Limpar filtro"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Dropdown de opções rápidas */}
        {showDropdown && !showCustomPeriod && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-dark-900 rounded-[20px] shadow-lg py-2 min-w-[160px] z-[100]">
            <button
              onClick={() => handleQuickSelect('today')}
              className="w-full px-4 py-2.5 text-sm text-dark-300 hover:bg-dark-800 hover:text-white text-left transition-colors"
            >
              Hoje
            </button>
            <button
              onClick={() => handleQuickSelect('week')}
              className="w-full px-4 py-2.5 text-sm text-dark-300 hover:bg-dark-800 hover:text-white text-left transition-colors"
            >
              Esta semana
            </button>
            <button
              onClick={() => handleQuickSelect('month')}
              className="w-full px-4 py-2.5 text-sm text-dark-300 hover:bg-dark-800 hover:text-white text-left transition-colors"
            >
              Este mês
            </button>
            <div className="border-t border-dark-700 my-1" />
            <button
              onClick={() => handleQuickSelect('custom')}
              className="w-full px-4 py-2.5 text-sm text-violet-400 hover:bg-dark-800 text-left transition-colors font-medium"
            >
              Escolher período
            </button>
          </div>
        )}

        {/* Seletor de período customizado */}
        {showCustomPeriod && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-dark-900 rounded-[20px] shadow-lg p-4 min-w-[220px] z-[100]">
            <div className="space-y-3">
              <div>
                <label className="text-xs text-dark-400 mb-1 block">Início</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="w-full px-3 py-2.5 bg-dark-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                />
              </div>
              <div>
                <label className="text-xs text-dark-400 mb-1 block">Fim</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  min={customStart}
                  className="w-full px-3 py-2.5 bg-dark-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                />
              </div>
              <button
                onClick={handleApplyCustomPeriod}
                disabled={!customStart || !customEnd}
                className="w-full btn-primary disabled:opacity-50"
              >
                Aplicar
              </button>
              <button
                onClick={handleBackFromCustom}
                className="w-full py-1.5 text-sm text-dark-400 hover:text-white transition-colors"
              >
                Voltar
              </button>
            </div>
          </div>
        )}
      </div>

      <button
        onClick={handleNext}
        className="p-2 text-dark-400 hover:text-white transition-colors"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  )
}
