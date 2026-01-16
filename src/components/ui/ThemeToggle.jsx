import { useState, useRef, useEffect } from 'react'
import { Sun, Moon, ChevronDown } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef(null)

  const options = [
    { id: 'light', label: 'Claro', icon: Sun },
    { id: 'dark', label: 'Escuro', icon: Moon }
  ]

  const currentOption = options.find(o => o.id === theme) || options[1]
  const CurrentIcon = currentOption.icon

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
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-2 px-3 py-2 bg-dark-800 hover:bg-dark-700 border border-dark-700 rounded-xl text-dark-300 hover:text-white transition-colors"
      >
        <CurrentIcon className="w-4 h-4" />
        <span className="text-sm">{currentOption.label}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
      </button>

      {showDropdown && (
        <div className="absolute top-full right-0 mt-2 bg-dark-800 border border-dark-600 rounded-xl shadow-lg py-1 min-w-[140px] z-50">
          {options.map((option) => {
            const Icon = option.icon
            return (
              <button
                key={option.id}
                onClick={() => {
                  setTheme(option.id)
                  setShowDropdown(false)
                }}
                className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left transition-colors ${
                  theme === option.id
                    ? 'text-violet-400 bg-violet-500/10'
                    : 'text-dark-300 hover:bg-dark-700 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                {option.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Versão compacta (só ícone) - alterna entre claro e escuro
export function ThemeToggleCompact() {
  const { theme, setTheme } = useTheme()

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  const Icon = theme === 'dark' ? Moon : Sun
  const title = theme === 'dark' ? 'Tema: Escuro' : 'Tema: Claro'

  return (
    <button
      onClick={toggleTheme}
      className="p-2 text-dark-400 hover:text-white hover:bg-dark-800 rounded-full transition-colors"
      title={title}
    >
      <Icon className="w-5 h-5" />
    </button>
  )
}
