import { ChevronLeft, ChevronRight } from 'lucide-react'
import { MONTHS } from '../../utils/constants'

export default function MonthSelector({ month, year, onChange }) {
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

  return (
    <div className="flex items-center justify-between bg-dark-900/80 backdrop-blur-sm border border-dark-700 rounded-xl p-2">
      <button
        onClick={handlePrevious}
        className="p-2 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      <span className="text-white font-medium">
        {MONTHS[month]} {year}
      </span>

      <button
        onClick={handleNext}
        className="p-2 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  )
}
