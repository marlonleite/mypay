import { getBankById } from '../../utils/bankIcons'

export default function BankIcon({ bankId, size = 'md', showName = false }) {
  const bank = getBankById(bankId)

  const sizeClasses = {
    sm: 'w-6 h-6 text-base',
    md: 'w-10 h-10 text-xl',
    lg: 'w-14 h-14 text-3xl'
  }

  return (
    <div className="flex items-center gap-2">
      <div
        className={`${sizeClasses[size]} rounded-xl flex items-center justify-center`}
        style={{ backgroundColor: `${bank.color}20` }}
        title={bank.name}
      >
        <span>{bank.emoji}</span>
      </div>
      {showName && (
        <span className="text-sm text-white font-medium">{bank.name}</span>
      )}
    </div>
  )
}
