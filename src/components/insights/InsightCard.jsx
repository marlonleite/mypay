import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  AlertCircle,
  AlertOctagon,
  Target,
  Wallet,
  Lightbulb
} from 'lucide-react'

const ICONS = {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  AlertCircle,
  AlertOctagon,
  Target,
  Wallet,
  Lightbulb
}

const SEVERITY_STYLES = {
  info: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    icon: 'text-blue-400',
    iconBg: 'bg-blue-500/20'
  },
  success: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    icon: 'text-emerald-400',
    iconBg: 'bg-emerald-500/20'
  },
  warning: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    icon: 'text-amber-400',
    iconBg: 'bg-amber-500/20'
  },
  alert: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    icon: 'text-red-400',
    iconBg: 'bg-red-500/20'
  }
}

export default function InsightCard({ insight, formatCurrency, onClick }) {
  const Icon = ICONS[insight.icon] || Lightbulb
  const styles = SEVERITY_STYLES[insight.severity] || SEVERITY_STYLES.info

  return (
    <button
      onClick={() => onClick?.(insight)}
      className={`w-full p-4 rounded-xl border transition-all hover:scale-[1.01] active:scale-[0.99] text-left ${styles.bg} ${styles.border}`}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${styles.iconBg}`}>
          <Icon className={`w-5 h-5 ${styles.icon}`} />
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-white mb-0.5">
            {insight.title}
          </h4>
          <p className="text-xs text-dark-400">
            {insight.message}
          </p>

          {insight.value !== undefined && insight.value !== null && (
            <p className={`text-sm font-bold mt-2 ${
              insight.severity === 'success' ? 'text-emerald-400' :
              insight.severity === 'alert' ? 'text-red-400' :
              insight.severity === 'warning' ? 'text-amber-400' :
              'text-white'
            }`}>
              {insight.value > 0 ? '+' : ''}{formatCurrency(insight.value)}
            </p>
          )}
        </div>
      </div>
    </button>
  )
}
