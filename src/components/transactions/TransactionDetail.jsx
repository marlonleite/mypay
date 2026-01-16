import {
  ThumbsUp,
  ThumbsDown,
  Edit2,
  Copy,
  Trash2,
  DollarSign,
  Repeat,
  Calendar,
  X
} from 'lucide-react'
import Modal from '../ui/Modal'
import { formatCurrency } from '../../utils/helpers'
import { CATEGORY_COLORS, TRANSACTION_TYPES, MONTHS } from '../../utils/constants'

export default function TransactionDetail({
  transaction,
  isOpen,
  onClose,
  onEdit,
  onCopy,
  onDelete,
  onTogglePaid,
  getCategoryName,
  getAccountName,
  getCategoryColor,
  deleting = false
}) {
  if (!transaction) return null

  const isIncome = transaction.type === TRANSACTION_TYPES.INCOME
  const isPaid = transaction.paid !== false

  // Formatar data
  const formatDate = (date) => {
    if (!date) return '--'
    const d = date instanceof Date ? date : new Date(date)
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" hideHeader>
      <div className="flex flex-col md:flex-row gap-6">
        {/* Lado esquerdo - Info principal */}
        <div className="flex-1 flex flex-col items-center text-center">
          {/* Ícone da categoria */}
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mb-3"
            style={{ backgroundColor: isIncome ? '#10b98120' : `${getCategoryColor(transaction.category)}20` }}
          >
            <DollarSign
              className="w-8 h-8"
              style={{ color: isIncome ? '#10b981' : getCategoryColor(transaction.category) }}
            />
          </div>

          {/* Descrição */}
          <h3 className="text-lg font-semibold text-white mb-1">
            {transaction.description}
          </h3>

          {/* Valor */}
          <p className={`text-xl font-bold ${isIncome ? 'text-emerald-400' : 'text-red-400'}`}>
            {isIncome ? '+' : '-'} {formatCurrency(transaction.amount)}
          </p>

          {/* Badge de recorrência */}
          {transaction.isFixed && (
            <span className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 bg-dark-700 rounded-full text-sm text-dark-300">
              <Repeat className="w-3.5 h-3.5" />
              fixa mensal
            </span>
          )}
          {transaction.isInstallment && (
            <span className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 bg-dark-700 rounded-full text-sm text-dark-300">
              <Calendar className="w-3.5 h-3.5" />
              {transaction.recurrenceIndex}/{transaction.recurrenceTotal}x
            </span>
          )}

          {/* Ações */}
          <div className="flex items-center gap-2 mt-6">
            <button
              onClick={() => onTogglePaid(transaction)}
              className={`p-3 rounded-xl transition-colors group relative ${
                isPaid
                  ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                  : 'bg-dark-700 text-dark-400 hover:bg-dark-600 hover:text-white'
              }`}
              title={isPaid ? 'Marcar como não pago' : 'Marcar como pago'}
            >
              {isPaid ? <ThumbsUp className="w-5 h-5" /> : <ThumbsDown className="w-5 h-5" />}
              <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs text-dark-400 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                {isPaid ? 'Marcar como não pago' : 'Marcar como pago'}
              </span>
            </button>

            <button
              onClick={() => onEdit(transaction)}
              className="p-3 rounded-xl bg-dark-700 text-dark-400 hover:bg-dark-600 hover:text-white transition-colors group relative"
              title="Editar informações"
            >
              <Edit2 className="w-5 h-5" />
              <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs text-dark-400 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                Editar informações
              </span>
            </button>

            <button
              onClick={() => onCopy(transaction)}
              className="p-3 rounded-xl bg-dark-700 text-dark-400 hover:bg-dark-600 hover:text-white transition-colors group relative"
              title="Copiar lançamento"
            >
              <Copy className="w-5 h-5" />
              <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs text-dark-400 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                Copiar lançamento
              </span>
            </button>

            <button
              onClick={() => onDelete(transaction)}
              disabled={deleting}
              className="p-3 rounded-xl bg-dark-700 text-dark-400 hover:bg-red-500/20 hover:text-red-400 transition-colors group relative disabled:opacity-50"
              title="Excluir lançamento"
            >
              <Trash2 className="w-5 h-5" />
              <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs text-dark-400 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                Excluir lançamento
              </span>
            </button>
          </div>
        </div>

        {/* Lado direito - Detalhes */}
        <div className="flex-1 grid grid-cols-2 gap-4 content-start">
          <div>
            <p className="text-xs text-dark-500 mb-1">Categoria</p>
            <p className="text-sm text-white">{getCategoryName(transaction.category)}</p>
          </div>

          <div>
            <p className="text-xs text-dark-500 mb-1">Conta</p>
            <p className="text-sm text-white">{getAccountName(transaction.accountId)}</p>
          </div>

          <div>
            <p className="text-xs text-dark-500 mb-1">Data</p>
            <p className="text-sm text-white">{formatDate(transaction.date)}</p>
          </div>

          <div>
            <p className="text-xs text-dark-500 mb-1">Tags</p>
            <p className="text-sm text-white">
              {transaction.tags?.length > 0
                ? transaction.tags.map(t => typeof t === 'object' ? t.name : t).filter(Boolean).join(', ')
                : '--'}
            </p>
          </div>

          <div>
            <p className="text-xs text-dark-500 mb-1">Anexo</p>
            {transaction.attachments?.length > 0 || transaction.attachment ? (
              <a
                href={(transaction.attachments?.[0] || transaction.attachment)?.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-violet-400 hover:text-violet-300"
              >
                {transaction.attachments?.length || 1} arquivo(s)
              </a>
            ) : (
              <p className="text-sm text-white">--</p>
            )}
          </div>

          <div>
            <p className="text-xs text-dark-500 mb-1">Observação</p>
            <p className="text-sm text-white">{transaction.notes || '--'}</p>
          </div>

          {/* Status de pagamento */}
          <div className="col-span-2">
            <p className="text-xs text-dark-500 mb-1">Status</p>
            <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-sm ${
              isPaid
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-amber-500/20 text-amber-400'
            }`}>
              {isPaid ? (
                <>
                  <ThumbsUp className="w-3.5 h-3.5" />
                  {isIncome ? 'Recebido' : 'Pago'}
                </>
              ) : (
                <>
                  <ThumbsDown className="w-3.5 h-3.5" />
                  Pendente
                </>
              )}
            </span>
          </div>
        </div>
      </div>
    </Modal>
  )
}
