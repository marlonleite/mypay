import { ChevronDown } from 'lucide-react'

export default function Select({
  label,
  options = [],
  error,
  className = '',
  ...props
}) {
  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-dark-300">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          className={`
            w-full px-4 py-3.5 pr-12 bg-dark-800
            rounded-[16px] text-white appearance-none cursor-pointer
            focus:outline-none focus:ring-2 focus:ring-violet-500/30
            transition-all duration-200
            ${error ? 'ring-2 ring-red-500/50' : ''}
            ${className}
          `}
          {...props}
        >
          {options.map((option, index) => {
            if (option.options) {
              return (
                <optgroup key={`group-${index}`} label={option.label}>
                  {option.options.map((sub) => (
                    <option key={sub.value} value={sub.value}>
                      {sub.label}
                    </option>
                  ))}
                </optgroup>
              )
            }
            return (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            )
          })}
        </select>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-dark-400">
          <ChevronDown className="w-5 h-5" />
        </div>
      </div>
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  )
}
