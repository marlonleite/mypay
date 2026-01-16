export default function Card({
  children,
  className = '',
  onClick,
  selected = false,
  ...props
}) {
  return (
    <div
      onClick={onClick}
      className={`
        bg-dark-900 rounded-[20px] p-5 transition-all duration-200
        ${onClick ? 'cursor-pointer hover:bg-dark-800 active:scale-[0.98]' : ''}
        ${selected ? 'ring-2 ring-violet-500 bg-violet-500/5' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  )
}
