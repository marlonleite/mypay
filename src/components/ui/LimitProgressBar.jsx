import { usePrivacy } from '../../contexts/PrivacyContext'

export default function LimitProgressBar({ used, limit, showLabel = true, size = 'md' }) {
  const { formatCurrency } = usePrivacy()

  if (!limit || limit <= 0) {
    return null
  }

  const percentage = (used / limit) * 100
  const available = limit - used

  // Determine color based on usage
  const getColorClasses = () => {
    if (percentage >= 90) {
      return {
        bg: 'bg-red-500',
        text: 'text-red-400',
        label: 'text-red-400'
      }
    } else if (percentage >= 70) {
      return {
        bg: 'bg-yellow-500',
        text: 'text-yellow-400',
        label: 'text-yellow-400'
      }
    } else {
      return {
        bg: 'bg-emerald-500',
        text: 'text-emerald-400',
        label: 'text-emerald-400'
      }
    }
  }

  const colors = getColorClasses()

  // Size variants
  const heightClass = size === 'sm' ? 'h-1.5' : size === 'lg' ? 'h-3' : 'h-2'
  const textSizeClass = size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-sm' : 'text-xs'

  return (
    <div className="w-full">
      {/* Progress bar */}
      <div className={`w-full ${heightClass} bg-dark-700 rounded-full overflow-hidden`}>
        <div
          className={`${heightClass} ${colors.bg} transition-all duration-500 ease-out`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>

      {/* Label */}
      {showLabel && (
        <div className={`flex items-center justify-between mt-1.5 ${textSizeClass}`}>
          <span className="text-dark-400">
            {percentage >= 100 ? (
              <>Limite excedido: <span className={colors.label}>{percentage.toFixed(0)}%</span></>
            ) : (
              <>{percentage.toFixed(0)}% usado</>
            )}
          </span>
          <span className={colors.label}>
            Disponível: {formatCurrency(Math.max(available, 0))}
          </span>
        </div>
      )}
    </div>
  )
}
