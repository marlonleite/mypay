import * as React from 'react'
import { Paperclip, Trash2, Loader, ExternalLink } from 'lucide-react'
import {
  listInvoiceAttachments,
  uploadInvoiceAttachment,
  deleteInvoiceAttachment,
} from '../../services/invoiceAttachmentService'

const ACCEPT = 'application/pdf,image/jpeg,image/jpg,image/png'

/**
 * Lista de comprovantes de pagamento da FATURA (Wave9). Anexos vivem na
 * fatura, não na transação de pagamento — sobrevivem ao ciclo
 * pagar→reabrir→pagar de novo.
 */
export default function InvoiceAttachmentList({ invoiceId, readOnly = false }) {
  const [items, setItems] = React.useState([])
  const [loading, setLoading] = React.useState(false)
  const [uploading, setUploading] = React.useState(false)
  const [error, setError] = React.useState(null)
  const inputRef = React.useRef(null)

  const reload = React.useCallback(async () => {
    if (!invoiceId) {
      setItems([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const list = await listInvoiceAttachments(invoiceId)
      setItems(list)
    } catch (err) {
      setError(err?.message || 'Erro ao carregar anexos.')
    } finally {
      setLoading(false)
    }
  }, [invoiceId])

  React.useEffect(() => {
    reload()
  }, [reload])

  async function handleUpload(event) {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!files.length) return
    setUploading(true)
    setError(null)
    try {
      for (const file of files) {
        await uploadInvoiceAttachment(invoiceId, file)
      }
      await reload()
    } catch (err) {
      setError(err?.message || 'Erro ao enviar anexo.')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(attachmentId) {
    if (!confirm('Remover este comprovante?')) return
    try {
      await deleteInvoiceAttachment(attachmentId)
      await reload()
    } catch (err) {
      setError(err?.message || 'Erro ao remover anexo.')
    }
  }

  if (!invoiceId) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-dark-400 flex items-center gap-1.5">
          <Paperclip className="w-3.5 h-3.5" />
          Comprovantes
          {items.length > 0 && (
            <span className="text-dark-500 font-normal">({items.length})</span>
          )}
        </p>
        {!readOnly && (
          <>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ACCEPT}
              className="hidden"
              onChange={handleUpload}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50 flex items-center gap-1"
            >
              {uploading ? (
                <>
                  <Loader className="w-3 h-3 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>+ Anexar</>
              )}
            </button>
          </>
        )}
      </div>

      {loading && items.length === 0 && (
        <p className="text-xs text-dark-500">Carregando...</p>
      )}

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      {!loading && items.length === 0 && !error && (
        <p className="text-xs text-dark-500">Nenhum comprovante anexado.</p>
      )}

      {items.length > 0 && (
        <ul className="space-y-1">
          {items.map((att) => (
            <li
              key={att.id}
              className="flex items-center justify-between gap-2 p-2 bg-dark-800/40 rounded-lg border border-dark-700/40"
            >
              <a
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-0 flex items-center gap-2 text-sm text-dark-200 hover:text-white"
              >
                <ExternalLink className="w-3.5 h-3.5 shrink-0 text-dark-400" />
                <span className="truncate">{att.fileName}</span>
              </a>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => handleDelete(att.id)}
                  className="p-1 text-red-400 hover:text-red-300"
                  aria-label="Remover comprovante"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
