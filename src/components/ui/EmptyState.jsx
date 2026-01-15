export default function EmptyState({
  icon: Icon,
  title,
  description,
  action
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {Icon && (
        <div className="w-16 h-16 rounded-full bg-dark-800 flex items-center justify-center mb-4">
          <Icon className="w-8 h-8 text-dark-500" />
        </div>
      )}
      <h3 className="text-lg font-medium text-white mb-1">{title}</h3>
      <p className="text-dark-400 text-sm mb-4 max-w-xs">{description}</p>
      {action}
    </div>
  )
}
