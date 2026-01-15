export default function Input({
  label,
  error,
  icon: Icon,
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
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400">
            <Icon className="w-5 h-5" />
          </div>
        )}
        <input
          className={`
            w-full px-4 py-3 bg-dark-800 border border-dark-600
            rounded-xl text-white placeholder-dark-500
            focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent
            transition-all duration-200
            ${Icon ? 'pl-11' : ''}
            ${error ? 'border-red-500 focus:ring-red-500' : ''}
            ${className}
          `}
          {...props}
        />
      </div>
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  )
}
