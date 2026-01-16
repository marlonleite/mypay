import { Loader2 } from 'lucide-react'

const variants = {
  primary: 'btn-primary',
  secondary: 'bg-dark-800 hover:bg-dark-700 text-white',
  success: 'bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25',
  danger: 'bg-red-500/15 text-red-500 hover:bg-red-500/25',
  ghost: 'bg-transparent hover:bg-dark-800 text-dark-300 hover:text-white',
  outline: 'bg-transparent border border-dark-700 hover:border-dark-600 hover:bg-dark-800 text-white'
}

const sizes = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-5 py-3',
  lg: 'px-6 py-4 text-lg'
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  icon: Icon,
  className = '',
  ...props
}) {
  return (
    <button
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center gap-2
        font-semibold rounded-2xl transition-all duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        active:scale-[0.98]
        ${variants[variant]}
        ${sizes[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : Icon ? (
        <Icon className="w-5 h-5" />
      ) : null}
      {children}
    </button>
  )
}
