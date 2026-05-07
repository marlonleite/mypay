import { useState } from 'react'
import { FileImage, FileText, CheckCircle, Clock, RotateCcw, Trash2, Loader2 } from 'lucide-react'
import Card from '../ui/Card'
import { formatDate } from '../../utils/helpers'
import { usePrivacy } from '../../contexts/PrivacyContext'

export default function ImportHistory({ imports = [], onReview, onDelete }) {
  const { formatCurrency } = usePrivacy()
  const [deletingId, setDeletingId] = useState(null)

  if (imports.length === 0) return null

  const handleDeleteClick = async (e, item) => {
    e.stopPropagation()
    if (!onDelete) return
    const label = item.fileName || 'esta importação'
    const msg =
      `Excluir "${label}"?\n\n` +
      'Isto também apaga TODAS as transações criadas a partir desta importação. ' +
      'Faturas pagas precisam ser reabertas antes — caso contrário, a operação falha.'
    if (!window.confirm(msg)) return
    try {
      setDeletingId(item.id)
      await onDelete(item)
    } finally {
      setDeletingId(null)
    }
  }

  const getFileIcon = (fileType) => {
    if (fileType?.includes('pdf')) {
      return <FileText className="w-4 h-4 text-red-400" />
    }
    return <FileImage className="w-4 h-4 text-blue-400" />
  }

  const getStatusBadge = (status) => {
    // Backend: `processed` = IA extraiu; `applied` = lançamentos confirmados via apply;
    // `completed` = legado / migração. Antes só `completed` virava Importado — `processed` ficava errado.
    if (status === 'completed' || status === 'applied') {
      return (
        <span className="flex items-center gap-1 text-xs text-emerald-400">
          <CheckCircle className="w-3 h-3" />
          Importado
        </span>
      )
    }
    return (
      <span className="flex items-center gap-1 text-xs text-yellow-400" title="Extraído pela IA — confirme os lançamentos na tela de importação">
        <Clock className="w-3 h-3" />
        Aguardando importar
      </span>
    )
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-dark-300">Importações recentes</h3>

      <Card className="divide-y divide-dark-700/50">
        {imports.slice(0, 5).map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
          >
            <button
              onClick={() => onReview?.(item)}
              className="flex items-center gap-3 flex-1 min-w-0 text-left"
            >
              <div className="p-2 bg-dark-800 rounded-lg">
                {getFileIcon(item.fileType)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white font-medium truncate">
                  {item.fileName}
                </p>
                <p className="text-xs text-dark-400">
                  {item.documentType || 'Documento'} • {formatDate(item.createdAt?.toDate?.() || item.createdAt)}
                </p>
              </div>
            </button>

            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end gap-1">
                {item.extractedData?.valor && (
                  <span className="text-sm font-medium text-white">
                    {formatCurrency(item.extractedData.valor)}
                  </span>
                )}
                {getStatusBadge(item.status)}
              </div>
              {onReview && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onReview(item)
                  }}
                  className="p-1.5 text-dark-500 hover:text-violet-400 hover:bg-dark-700 rounded-lg transition-colors"
                title="Reaproveitar extração (sem chamar IA novamente)"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={(e) => handleDeleteClick(e, item)}
                  disabled={deletingId === item.id}
                  className="p-1.5 text-dark-500 hover:text-red-400 hover:bg-dark-700 rounded-lg transition-colors disabled:opacity-50"
                  title="Excluir importação (cascateia transações criadas)"
                >
                  {deletingId === item.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
            </div>
          </div>
        ))}
      </Card>
    </div>
  )
}
