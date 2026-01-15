export default function Card({
  children,
  className = '',
  onClick,
  ...props
}) {
  return (
    <div
      onClick={onClick}
      className={`
        bg-dark-900/80 backdrop-blur-sm border border-dark-700
        rounded-2xl p-4 transition-all duration-200
        ${onClick ? 'cursor-pointer hover:border-dark-600 hover:bg-dark-800/80' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  )
}
