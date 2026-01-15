import { useState, useRef } from 'react'
import { Upload, FileImage, FileText, AlertCircle } from 'lucide-react'
import { validateFile, getFileType } from '../../utils/fileProcessing'

export default function FileUpload({ onFileSelect, disabled = false }) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  const handleDragOver = (e) => {
    e.preventDefault()
    if (!disabled) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    setError(null)

    if (disabled) return

    const files = e.dataTransfer.files
    if (files.length > 0) {
      processFile(files[0])
    }
  }

  const handleFileInput = (e) => {
    setError(null)
    const files = e.target.files
    if (files.length > 0) {
      processFile(files[0])
    }
  }

  const processFile = (file) => {
    const validation = validateFile(file)

    if (!validation.valid) {
      setError(validation.error)
      return
    }

    onFileSelect(file)
  }

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click()
    }
  }

  return (
    <div className="w-full">
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-2xl p-8
          flex flex-col items-center justify-center gap-4
          transition-all duration-200 cursor-pointer
          min-h-[200px]
          ${disabled
            ? 'border-dark-700 bg-dark-900/50 cursor-not-allowed opacity-50'
            : isDragging
              ? 'border-violet-500 bg-violet-500/10'
              : 'border-dark-600 bg-dark-900/50 hover:border-violet-500/50 hover:bg-dark-800/50'
          }
        `}
      >
        {/* Ícone */}
        <div className={`
          p-4 rounded-full transition-colors
          ${isDragging ? 'bg-violet-500/20' : 'bg-dark-800'}
        `}>
          <Upload className={`w-8 h-8 ${isDragging ? 'text-violet-400' : 'text-dark-400'}`} />
        </div>

        {/* Texto */}
        <div className="text-center">
          <p className={`font-medium ${isDragging ? 'text-violet-400' : 'text-white'}`}>
            {isDragging ? 'Solte o arquivo aqui' : 'Arraste um arquivo ou clique para selecionar'}
          </p>
          <p className="text-sm text-dark-400 mt-1">
            JPG, PNG, WEBP, HEIC ou PDF (máx. 10MB)
          </p>
        </div>

        {/* Ícones de formatos */}
        <div className="flex gap-4 mt-2">
          <div className="flex items-center gap-1.5 text-dark-500">
            <FileImage className="w-4 h-4" />
            <span className="text-xs">Imagens</span>
          </div>
          <div className="flex items-center gap-1.5 text-dark-500">
            <FileText className="w-4 h-4" />
            <span className="text-xs">PDF</span>
          </div>
        </div>

        {/* Input escondido */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
          onChange={handleFileInput}
          className="hidden"
          disabled={disabled}
        />
      </div>

      {/* Mensagem de erro */}
      {error && (
        <div className="flex items-center gap-2 mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
    </div>
  )
}
