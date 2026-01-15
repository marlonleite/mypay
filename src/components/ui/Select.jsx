import { ChevronDown } from 'lucide-react'

export default function Select({
  label,
  options = [],
  error,
  className = '',
  ...props
}) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-dark-300">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          className={`
            w-full px-4 py-3 bg-dark-800 border border-dark-600
            rounded-xl text-white appearance-none cursor-pointer
            focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent
            transition-all duration-200
            ${error ? 'border-red-500 focus:ring-red-500' : ''}
            ${className}
          `}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-dark-400">
          <ChevronDown className="w-5 h-5" />
        </div>
      </div>
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  )
}
