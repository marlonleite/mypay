import { useEffect, useState } from 'react'
import { X, FileText, ZoomIn } from 'lucide-react'
import { getFileType, formatFileSize, getFilePreviewUrl, revokeFilePreviewUrl } from '../../utils/fileProcessing'

export default function FilePreview({ file, onRemove }) {
  const [previewUrl, setPreviewUrl] = useState(null)
  const [showZoom, setShowZoom] = useState(false)

  const fileType = getFileType(file)

  useEffect(() => {
    if (fileType === 'image') {
      const url = getFilePreviewUrl(file)
      setPreviewUrl(url)

      return () => {
        revokeFilePreviewUrl(url)
      }
    }
  }, [file, fileType])

  return (
    <>
      <div className="relative bg-dark-800 rounded-2xl overflow-hidden border border-dark-700">
        {/* Preview de imagem */}
        {fileType === 'image' && previewUrl && (
          <div
            className="relative cursor-pointer group"
            onClick={() => setShowZoom(true)}
          >
            <img
              src={previewUrl}
              alt={file.name}
              className="w-full h-48 object-contain bg-dark-900"
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <ZoomIn className="w-8 h-8 text-white" />
            </div>
          </div>
        )}

        {/* Preview de PDF */}
        {fileType === 'pdf' && (
          <div className="h-48 flex flex-col items-center justify-center bg-dark-900">
            <FileText className="w-16 h-16 text-red-400 mb-2" />
            <p className="text-sm text-dark-400">Documento PDF</p>
          </div>
        )}

        {/* Info do arquivo */}
        <div className="p-4 flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white font-medium truncate">{file.name}</p>
            <p className="text-xs text-dark-400">{formatFileSize(file.size)}</p>
          </div>

          {/* Botão remover */}
          <button
            onClick={onRemove}
            className="p-2 text-dark-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Modal de zoom */}
      {showZoom && previewUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setShowZoom(false)}
        >
          <button
            onClick={() => setShowZoom(false)}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={previewUrl}
            alt={file.name}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}
