import { useState } from 'react'
import {
  Sparkles,
  Loader2,
  CheckCircle,
  AlertCircle,
  RotateCcw
} from 'lucide-react'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Select from '../components/ui/Select'
import FileUpload from '../components/documents/FileUpload'
import FilePreview from '../components/documents/FilePreview'
import ProcessingResult from '../components/documents/ProcessingResult'
import ImportHistory from '../components/documents/ImportHistory'
import { useCards, useTransactions } from '../hooks/useFirestore'
import { useImportHistory } from '../hooks/useDocumentImport'
import { processDocument } from '../services/ai/gemini'
import { fileToBase64 } from '../utils/fileProcessing'
import { DOCUMENT_TYPES } from '../utils/constants'

export default function Documents({ month, year }) {
  // Estados
  const [file, setFile] = useState(null)
  const [documentType, setDocumentType] = useState('auto')
  const [status, setStatus] = useState('idle') // idle, preview, processing, result, success, error
  const [extractedData, setExtractedData] = useState(null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  // Hooks
  const { cards } = useCards()
  const { addTransaction } = useTransactions(month, year)
  const { imports, addImport, addCardExpense } = useImportHistory()

  // Handlers
  const handleFileSelect = (selectedFile) => {
    setFile(selectedFile)
    setStatus('preview')
    setError(null)
    setExtractedData(null)
  }

  const handleRemoveFile = () => {
    setFile(null)
    setStatus('idle')
    setError(null)
    setExtractedData(null)
  }

  const handleProcess = async () => {
    if (!file) return

    setStatus('processing')
    setError(null)

    try {
      const base64 = await fileToBase64(file)
      const result = await processDocument(base64, file.type, documentType)

      setExtractedData(result)
      setStatus('result')

    } catch (err) {
      console.error('Erro ao processar documento:', err)
      setError(err.message || 'Erro ao processar documento. Tente novamente.')
      setStatus('error')
    }
  }

  const handleCreateTransaction = async (transactionData) => {
    setSaving(true)

    try {
      await addTransaction(transactionData)

      // Salvar no histórico de importações
      await addImport({
        fileName: file.name,
        fileType: file.type,
        documentType: extractedData.tipo_documento,
        extractedData: extractedData.dados_completos,
        status: 'completed',
        confidence: extractedData.confianca,
        action: 'transaction'
      })

      setStatus('success')

      // Reset após 2 segundos
      setTimeout(() => {
        handleReset()
      }, 2000)

    } catch (err) {
      console.error('Erro ao criar transação:', err)
      setError('Erro ao salvar transação. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateCardExpense = async (expenseData) => {
    setSaving(true)

    try {
      await addCardExpense(expenseData)

      // Salvar no histórico de importações
      await addImport({
        fileName: file.name,
        fileType: file.type,
        documentType: extractedData.tipo_documento,
        extractedData: extractedData.dados_completos,
        status: 'completed',
        confidence: extractedData.confianca,
        action: 'cardExpense'
      })

      setStatus('success')

      // Reset após 2 segundos
      setTimeout(() => {
        handleReset()
      }, 2000)

    } catch (err) {
      console.error('Erro ao criar despesa do cartão:', err)
      setError('Erro ao salvar despesa do cartão. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = () => {
    handleReset()
  }

  const handleReset = () => {
    setFile(null)
    setDocumentType('auto')
    setStatus('idle')
    setExtractedData(null)
    setError(null)
    setSaving(false)
  }

  const handleRetry = () => {
    setStatus('preview')
    setError(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Importar Documento</h2>
          <p className="text-sm text-dark-400">Extraia dados automaticamente com IA</p>
        </div>
        <div className="p-2 bg-violet-500/20 rounded-xl">
          <Sparkles className="w-6 h-6 text-violet-400" />
        </div>
      </div>

      {/* Seletor de tipo de documento */}
      {(status === 'idle' || status === 'preview') && (
        <Select
          label="Tipo de documento"
          value={documentType}
          onChange={(e) => setDocumentType(e.target.value)}
          options={DOCUMENT_TYPES.map(t => ({ value: t.id, label: t.name }))}
        />
      )}

      {/* Upload / Preview */}
      {status === 'idle' && (
        <FileUpload onFileSelect={handleFileSelect} />
      )}

      {status === 'preview' && file && (
        <div className="space-y-4">
          <FilePreview file={file} onRemove={handleRemoveFile} />

          <Button
            onClick={handleProcess}
            icon={Sparkles}
            fullWidth
          >
            Processar com IA
          </Button>
        </div>
      )}

      {/* Processing */}
      {status === 'processing' && (
        <Card className="py-12">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-violet-500/20 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
              </div>
              <div className="absolute inset-0 rounded-full border-2 border-violet-500/30 animate-ping" />
            </div>
            <p className="text-white font-medium mt-4">Analisando documento...</p>
            <p className="text-sm text-dark-400 mt-1">Isso pode levar alguns segundos</p>
          </div>
        </Card>
      )}

      {/* Result */}
      {status === 'result' && extractedData && (
        <ProcessingResult
          data={extractedData}
          onCreateTransaction={handleCreateTransaction}
          onCreateCardExpense={handleCreateCardExpense}
          onDiscard={handleDiscard}
          cards={cards}
          saving={saving}
        />
      )}

      {/* Success */}
      {status === 'success' && (
        <Card className="py-12">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <p className="text-white font-medium mt-4">Salvo com sucesso!</p>
            <p className="text-sm text-dark-400 mt-1">O lançamento foi criado</p>
          </div>
        </Card>
      )}

      {/* Error */}
      {status === 'error' && (
        <Card className="py-8">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
            <p className="text-white font-medium mt-4">Erro ao processar</p>
            <p className="text-sm text-red-400 mt-1 max-w-xs">{error}</p>

            <div className="flex gap-3 mt-6">
              <Button onClick={handleRetry} icon={RotateCcw} variant="secondary">
                Tentar novamente
              </Button>
              <Button onClick={handleReset} variant="ghost">
                Cancelar
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Histórico de importações */}
      {status === 'idle' && imports.length > 0 && (
        <ImportHistory imports={imports} />
      )}
    </div>
  )
}
