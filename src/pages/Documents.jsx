import { useState, useRef } from 'react'
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
import PasswordModal from '../components/documents/PasswordModal'
import ProcessingResult from '../components/documents/ProcessingResult'
import FaturaResult from '../components/documents/FaturaResult'
import ImportHistory from '../components/documents/ImportHistory'
import { useCards, useTransactions, useCategories, useAccounts, useTags } from '../hooks/useFirestore'
import { useImportHistory } from '../hooks/useDocumentImport'
import { processDocument } from '../services/documentService'
import { DOCUMENT_TYPES } from '../utils/constants'

const BATCH_CHUNK_SIZE = 20

export default function Documents({ month, year }) {
  // Estados
  const [file, setFile] = useState(null)
  const [documentType, setDocumentType] = useState('auto')
  const [status, setStatus] = useState('idle') // idle, preview, processing, result, success, error
  const [extractedData, setExtractedData] = useState(null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState(null)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordIncorrect, setPasswordIncorrect] = useState(false)
  const [reviewImport, setReviewImport] = useState(null)
  const pendingPasswordRef = useRef(null)

  // Hooks
  const { cards } = useCards()
  const { accounts } = useAccounts()
  const { tags } = useTags()
  const { addTransaction } = useTransactions(month, year)
  const { imports, addCardExpense, refresh: refreshImports } = useImportHistory()
  const { categories: allCategories, getMainCategories } = useCategories()

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
      // Backend faz: extrair texto/PDF, chamar Gemini, upload R2, criar import_record.
      // Frontend só envia o arquivo. Categorias do usuário são lidas server-side
      // (não precisamos mais montar payload de prompt aqui).
      const result = await processDocument(file, documentType)

      setExtractedData(result)
      setStatus('result')
      pendingPasswordRef.current = null

      // Refresh do histórico — backend já criou o import_record.
      refreshImports()

    } catch (err) {
      console.error('Erro ao processar documento:', err)
      setError(err.message || 'Erro ao processar documento. Tente novamente.')
      setStatus('error')
    }
  }

  const handleCreateTransaction = async (transactionData) => {
    setSaving(true)

    try {
      // Backend `/documents/process` já fez upload pra R2 e criou o import_record.
      // Se a IA extraiu um file_url, anexamos à transaction via attachmentService;
      // senão, transação fica sem anexo (usuário pode anexar depois).
      const transactionWithComprovante = { ...transactionData }
      if (extractedData?.file_url) {
        transactionWithComprovante.attachments = [{
          url: extractedData.file_url,
          fileName: file?.name || 'documento',
          fileType: file?.type || null,
        }]
      }

      await addTransaction(transactionWithComprovante)
      setStatus('success')

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
      // Card_expense não persiste attachments (decisão 2026-04-15);
      // o PDF da fatura fica linkado ao import_record (criado pelo backend).
      await addCardExpense(expenseData)
      setStatus('success')

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

  const handleBatchCardExpenses = async (expenses) => {
    setSaving(true)

    try {
      // Salvar em chunks de BATCH_CHUNK_SIZE (sem anexo — fatura será anexada no pagamento)
      for (let i = 0; i < expenses.length; i += BATCH_CHUNK_SIZE) {
        const chunk = expenses.slice(i, i + BATCH_CHUNK_SIZE)
        await Promise.all(
          chunk.map(expense => addCardExpense(expense))
        )
      }

      // Backend já criou import_record automaticamente em /documents/process.
      // Não precisa addImport client-side.

      setSuccessMessage(`${expenses.length} despesas importadas com sucesso!`)
      setStatus('success')

      setTimeout(() => {
        handleReset()
      }, 2000)

    } catch (err) {
      console.error('Erro ao importar despesas em batch:', err)
      setError('Erro ao importar despesas. Algumas podem ter sido salvas parcialmente.')
    } finally {
      setSaving(false)
    }
  }

  // Pós-migração IA: review de import antigo não tem mais o JSON extraído
  // localmente (ficava em Firestore via addImport). Backend só guarda
  // metadata (file_name, items_imported, total_amount). Pra "reabrir" um
  // import o usuário precisa re-importar o arquivo.
  // Mantemos o handler como no-op interativo: abre o picker novamente.
  const handleReview = (_importItem) => {
    setReviewImport(null)
    setStatus('idle')
  }

  const handleReprocess = () => {
    const docType = reviewImport?.documentType || 'auto'
    handleReset()
    setDocumentType(docType)
  }

  const handlePasswordSubmit = (password) => {
    pendingPasswordRef.current = password
    setShowPasswordModal(false)
    setPasswordIncorrect(false)
    handleProcess()
  }

  const handlePasswordCancel = () => {
    setShowPasswordModal(false)
    setPasswordIncorrect(false)
    pendingPasswordRef.current = null
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
    setSuccessMessage(null)
    setShowPasswordModal(false)
    setPasswordIncorrect(false)
    setReviewImport(null)
    pendingPasswordRef.current = null
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

      {/* Review mode banner */}
      {status === 'result' && reviewImport && (
        <Card className="py-3 px-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-white font-medium truncate">{reviewImport.fileName}</p>
              <p className="text-xs text-dark-400">Dados extraídos anteriormente</p>
            </div>
            <Button onClick={handleReprocess} icon={RotateCcw} variant="secondary" size="sm">
              Reprocessar
            </Button>
          </div>
        </Card>
      )}

      {/* Result */}
      {status === 'result' && extractedData && (
        extractedData.tipo_documento === 'fatura_batch' ? (
          <FaturaResult
            data={extractedData}
            onSave={handleBatchCardExpenses}
            onDiscard={handleDiscard}
            cards={cards}
            categories={allCategories}
            getMainCategories={getMainCategories}
            saving={saving}
            month={month}
            year={year}
          />
        ) : (
          <ProcessingResult
            data={extractedData}
            onCreateTransaction={handleCreateTransaction}
            onCreateCardExpense={handleCreateCardExpense}
            onDiscard={handleDiscard}
            cards={cards}
            accounts={accounts}
            tags={tags}
            file={file}
            saving={saving}
            categories={allCategories}
            getMainCategories={getMainCategories}
          />
        )
      )}

      {/* Success */}
      {status === 'success' && (
        <Card className="py-12">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <p className="text-white font-medium mt-4">Salvo com sucesso!</p>
            <p className="text-sm text-dark-400 mt-1">
              {successMessage || 'O lançamento foi criado'}
            </p>
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
        <ImportHistory imports={imports} onReview={handleReview} />
      )}

      {/* Modal de senha para PDFs protegidos */}
      <PasswordModal
        isOpen={showPasswordModal}
        onSubmit={handlePasswordSubmit}
        onCancel={handlePasswordCancel}
        isIncorrect={passwordIncorrect}
        loading={status === 'processing'}
      />
    </div>
  )
}
