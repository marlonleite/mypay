import * as React from 'react'

const CENTS_DIVISOR = 100

function centsToDisplay(cents) {
  if (cents === 0) return '0,00'
  const sign = cents < 0 ? '-' : ''
  const absCents = Math.abs(cents)
  const reais = Math.floor(absCents / CENTS_DIVISOR)
  const centavos = String(absCents % CENTS_DIVISOR).padStart(2, '0')

  if (reais >= 1000) {
    const formatted = reais.toLocaleString('pt-BR')
    return `${sign}${formatted},${centavos}`
  }
  return `${sign}${reais},${centavos}`
}

function valueToCents(value) {
  if (value == null || value === '') return 0
  return Math.round(Number(value) * CENTS_DIVISOR)
}

function parsePastedValue(text) {
  const cleaned = text.replace(/[R$\s]/g, '').trim()

  // Formato BR: 1.234,56
  if (/^\d{1,3}(\.\d{3})*,\d{1,2}$/.test(cleaned)) {
    const normalized = cleaned.replace(/\./g, '').replace(',', '.')
    return Math.round(parseFloat(normalized) * CENTS_DIVISOR)
  }

  // Formato BR simples: 123,45
  if (/^\d+,\d{1,2}$/.test(cleaned)) {
    const normalized = cleaned.replace(',', '.')
    return Math.round(parseFloat(normalized) * CENTS_DIVISOR)
  }

  // Formato US: 1,234.56
  if (/^\d{1,3}(,\d{3})*\.\d{1,2}$/.test(cleaned)) {
    const normalized = cleaned.replace(/,/g, '')
    return Math.round(parseFloat(normalized) * CENTS_DIVISOR)
  }

  // Formato US simples: 123.45
  if (/^\d+\.\d{1,2}$/.test(cleaned)) {
    return Math.round(parseFloat(cleaned) * CENTS_DIVISOR)
  }

  // Apenas dígitos (inteiro)
  if (/^\d+$/.test(cleaned)) {
    return parseInt(cleaned, 10) * CENTS_DIVISOR
  }

  return null
}

export default function CurrencyInput({
  value,
  onChange,
  label,
  error,
  required,
  placeholder = '0,00',
  disabled,
  className = '',
  autoFocus,
}) {
  const inputRef = React.useRef(null)
  const cents = valueToCents(value)
  const displayValue = value != null && value !== '' ? centsToDisplay(cents) : ''

  const handleKeyDown = React.useCallback((e) => {
    // Permite: Backspace, Delete, Tab, Escape, Enter, setas
    const allowedKeys = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']
    if (allowedKeys.includes(e.key)) {
      if (e.key === 'Backspace') {
        e.preventDefault()
        const newCents = Math.floor(Math.abs(cents) / 10)
        onChange(newCents === 0 ? null : newCents / CENTS_DIVISOR)
      }
      return
    }

    // Permite Ctrl/Cmd+A, C, V, X
    if ((e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase())) {
      return
    }

    // Apenas dígitos
    if (!/^\d$/.test(e.key)) {
      e.preventDefault()
      return
    }

    e.preventDefault()
    const digit = parseInt(e.key, 10)
    const newCents = Math.abs(cents) * 10 + digit

    // Limita a 999.999.999,99
    const MAX_CENTS = 99999999999
    if (newCents > MAX_CENTS) return

    onChange(newCents / CENTS_DIVISOR)
  }, [cents, onChange])

  const handlePaste = React.useCallback((e) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text')
    const pastedCents = parsePastedValue(text)
    if (pastedCents !== null) {
      onChange(pastedCents === 0 ? null : pastedCents / CENTS_DIVISOR)
    }
  }, [onChange])

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-dark-300">
          {label}
          {required && <span className="text-red-400 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-400 text-sm font-medium select-none">
          R$
        </span>
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={displayValue}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          autoFocus={autoFocus}
          className={`
            w-full pl-11 pr-4 py-3.5 bg-dark-800
            rounded-[16px] text-white placeholder-dark-500
            focus:outline-none focus:ring-2 focus:ring-violet-500/30
            transition-all duration-200 cursor-text
            ${error ? 'ring-2 ring-red-500/50' : ''}
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            ${className}
          `}
          onChange={() => {}}
        />
      </div>
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  )
}
