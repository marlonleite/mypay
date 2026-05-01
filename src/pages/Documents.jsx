import { useState, useRef } from 'react'
import {
  Sparkles,
  Loader2,
  CheckCircle,
  AlertCircle,
  RotateCcw,
  Lock,
  X,
} from 'lucide-react'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Select from '../components/ui/Select'
import FileUpload from '../components/documents/FileUpload'
import FilePreview from '../components/documents/FilePreview'
import ProcessingResult from '../components/documents/ProcessingResult'
import FaturaResult from '../components/documents/FaturaResult'
import ImportHistory from '../components/documents/ImportHistory'
import { useCards, useTransactions, useCategories, useAccounts, useTags } from '../hooks/useFirestore'
import { useImportHistory } from '../hooks/useDocumentImport'
import {
  processDocument,
  applyDocumentImport,
  buildCardExpenseBatchItem,
  buildCategoryNameToIdMap,
  buildTagNameToIdMap,
  buildInvoiceCardExpenseApiItem,
  resolveCategoryIdForApply,
  DOCUMENT_IMPORT_APPLY_MAX_ITEMS,
  getImportDetail,
} from '../services/documentService'
import { buildTransactionPayload, resolveCreditCardInvoiceIdForDueMonth } from '../hooks/useFirestore'
import { apiClient } from '../services/apiClient'
import { DOCUMENT_TYPES } from '../utils/constants'
import Input from '../components/ui/Input'

const BATCH_CHUNK_SIZE = 20

function isPdfFile(file) {
  if (!file) return false
  if (file.type === 'application/pdf') return true
  return typeof file.name === 'string' && file.name.toLowerCase().endsWith('.pdf')
}

/** Resultado suspeito em PDF: vale tentar de novo com pdf_password. */
function isSuspiciousPdfExtract(file, result) {
  if (!isPdfFile(file) || !result) return false
  if (result.tipo_documento === 'fatura_batch') {
    return !Array.isArray(result.transacoes) || result.transacoes.length === 0
  }
  const noDesc = !result.descricao?.trim()
  const noAmount = result.valor === undefined || result.valor === null || Number(result.valor) === 0
  return noDesc && noAmount
}

export default function Documents({ month, year }) {
  // Estados
  const [file, setFile] = useState(null)
  const [documentType, setDocumentType] = useState('auto')
  const [status, setStatus] = useState('idle') // idle, preview, processing, result, success, error
  const [extractedData, setExtractedData] = useState(null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState(null)
  const [reviewImport, setReviewImport] = useState(null)
  /** Senha só em memória; limpa após cada envio e no reset (não persistir). */
  const [pdfPassword, setPdfPassword] = useState('')
  const [processHint, setProcessHint] = useState(null)
  const [faturaPruneSelection, setFaturaPruneSelection] = useState(null)
  const [faturaApplyBanner, setFaturaApplyBanner] = useState(null)
  /** Texto de progresso durante importação em lote (FaturaResult). */
  const [faturaImportProgress, setFaturaImportProgress] = useState(null)
  /** Aviso ao tocar em item do histórico (preview da IA não é persistida). */
  const [recentImportHint, setRecentImportHint] = useState(null)
  const uploadAreaRef = useRef(null)
  const [loadingImportDetail, setLoadingImportDetail] = useState(false)

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
    setReviewImport(null)
    setError(null)
    setExtractedData(null)
    setPdfPassword('')
    setProcessHint(null)
    setRecentImportHint(null)
  }

  const handleRemoveFile = () => {
    setFile(null)
    setStatus('idle')
    setError(null)
    setExtractedData(null)
    setPdfPassword('')
    setProcessHint(null)
    setRecentImportHint(null)
  }

  const handleProcess = async () => {
    if (!file) return

    setStatus('processing')
    setError(null)
    setProcessHint(null)

    try {
      // Backend faz: extrair texto/PDF, chamar Gemini, upload R2, criar import_record.
      // pdf_password opcional no multipart (PDFs cifrados, ex. Bradesco/C6).
      const pwd = pdfPassword.trim()
      const result = await processDocument(file, documentType, null, pwd || null)

      if (isSuspiciousPdfExtract(file, result)) {
        setProcessHint(
          'Nada útil foi detectado neste PDF. Se ele estiver protegido por senha, preencha o campo abaixo e processe de novo.'
        )
        setStatus('preview')
        setExtractedData(null)
        refreshImports()
        return
      }

      setExtractedData(result)
      setStatus('result')

      // Refresh do histórico — backend já criou o import_record.
      refreshImports()

    } catch (err) {
      console.error('Erro ao processar documento:', err)
      setError(err.message || 'Erro ao processar documento. Tente novamente.')
      setStatus('error')
    } finally {
      setPdfPassword('')
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

      const importId = extractedData?.import_id
      if (importId) {
        const forPayload = { ...transactionWithComprovante }
        delete forPayload.attachments
        const payload = await buildTransactionPayload(forPayload, apiClient)
        const idempotencyKey = crypto.randomUUID()
        const r = await applyDocumentImport(importId, [payload], { idempotencyKey })
        if (r.failed > 0) {
          const msg =
            r.results[0]?.error?.message ||
            r.results[0]?.error?.type ||
            'Não foi possível salvar o lançamento'
          throw new Error(msg)
        }
      } else {
        await addTransaction(transactionWithComprovante)
      }

      refreshImports()
      setStatus('success')

      setTimeout(() => {
        handleReset()
      }, 2000)

    } catch (err) {
      console.error('Erro ao criar transação:', err)
      setError(err.message || 'Erro ao salvar transação. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateCardExpense = async (expenseData) => {
    setSaving(true)

    try {
      const creditCardInvoiceId = await resolveCreditCardInvoiceIdForDueMonth(
        expenseData.cardId,
        month,
        year
      )
      const expenseWithInvoice = { ...expenseData, creditCardInvoiceId }

      // Card_expense não persiste attachments (decisão 2026-04-15);
      // o PDF da fatura fica linkado ao import_record (criado pelo backend).
      const importId = extractedData?.import_id
      if (importId) {
        const item = await buildCardExpenseBatchItem(expenseWithInvoice)
        const idempotencyKey = crypto.randomUUID()
        const r = await applyDocumentImport(importId, [item], { idempotencyKey })
        if (r.failed > 0) {
          const msg =
            r.results[0]?.error?.message ||
            r.results[0]?.error?.type ||
            'Não foi possível salvar a despesa do cartão'
          throw new Error(msg)
        }
      } else {
        await addCardExpense(expenseWithInvoice)
      }

      refreshImports()
      setStatus('success')

      setTimeout(() => {
        handleReset()
      }, 2000)

    } catch (err) {
      console.error('Erro ao criar despesa do cartão:', err)
      setError(err.message || 'Erro ao salvar despesa do cartão. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const handleBatchCardExpenses = async (expenses) => {
    if (!expenses?.length) return
    setSaving(true)
    setError(null)
    setFaturaApplyBanner(null)
    setFaturaImportProgress('Preparando importação…')

    try {
      const importId = extractedData?.import_id

      if (importId && expenses.length > DOCUMENT_IMPORT_APPLY_MAX_ITEMS) {
        throw new Error(
          `Máximo de ${DOCUMENT_IMPORT_APPLY_MAX_ITEMS} linhas por envio. Reduza a seleção.`
        )
      }

      if (importId) {
        // Uma única chamada apply = lote completo (fatura como um todo); ver plano batch no mypay-api.
        const idempotencyKey = crypto.randomUUID()
        setFaturaImportProgress('Carregando tags e montando o lote…')
        const tagsList = await apiClient.get('/api/v1/tags')
        const tagIdByName = buildTagNameToIdMap(tagsList)
        const nameToIdMap = buildCategoryNameToIdMap(allCategories)

        const enriched = expenses.map((e) => ({
          ...e,
          _clientLineId: crypto.randomUUID(),
        }))

        const items = enriched.map((e) => {
          const category_id = resolveCategoryIdForApply({
            categoryId: e.category,
            suggestedName: e.categoria_sugerida,
            nameToIdMap,
            categories: allCategories,
            type: e.type === 'income' ? 'income' : 'expense',
          })
          return buildInvoiceCardExpenseApiItem(e, {
            category_id,
            client_line_id: e._clientLineId,
            tagIdByName,
            credit_card_invoice_id: e.creditCardInvoiceId || undefined,
          })
        })

        const n = expenses.length
        setFaturaImportProgress(
          `Enviando ${n} lançamento${n !== 1 ? 's' : ''} ao servidor…`
        )
        const applyResponse = await applyDocumentImport(importId, items, {
          atomic: false,
          idempotencyKey,
        })

        if (applyResponse.failed === 0) {
          refreshImports()
          setFaturaPruneSelection(null)
          setSuccessMessage(`${expenses.length} despesas importadas com sucesso!`)
          setStatus('success')
          setTimeout(() => {
            handleReset()
          }, 2000)
          return
        }

        const succeededLineIds = []
        for (const r of applyResponse.results) {
          if (r.id && r.client_line_id) {
            const ex = enriched.find((x) => x._clientLineId === r.client_line_id)
            if (ex?.lineId) succeededLineIds.push(ex.lineId)
          }
        }
        if (succeededLineIds.length > 0) {
          setFaturaPruneSelection({ lineIds: succeededLineIds, token: Date.now() })
        }

        const retryExpenses = enriched
          .filter((e) =>
            applyResponse.results.some((r) => r.error && r.client_line_id === e._clientLineId)
          )
          .map(({ _clientLineId, ...rest }) => rest)

        const failedLines = applyResponse.results
          .filter((r) => r.error)
          .map((r) => {
            const ex = enriched.find((x) => x._clientLineId === r.client_line_id)
            return {
              lineId: ex?.lineId,
              description: ex?.description || '—',
              message: r.error?.message || r.error?.type || 'Erro',
            }
          })

        setFaturaApplyBanner({
          succeeded: applyResponse.succeeded,
          failed: applyResponse.failed,
          failedLines,
          onRetry: () => {
            setFaturaApplyBanner(null)
            handleBatchCardExpenses(retryExpenses)
          },
        })
        refreshImports()
        return
      }

      // Sem import_id (legado): mantém chunks de N× POST /transactions
      const totalLegacy = expenses.length
      const nChunks = Math.ceil(totalLegacy / BATCH_CHUNK_SIZE) || 1
      const fallbackInvoiceId = await resolveCreditCardInvoiceIdForDueMonth(
        expenses[0]?.cardId,
        month,
        year
      )
      for (let i = 0; i < expenses.length; i += BATCH_CHUNK_SIZE) {
        const chunkIdx = Math.floor(i / BATCH_CHUNK_SIZE) + 1
        const end = Math.min(i + BATCH_CHUNK_SIZE, totalLegacy)
        setFaturaImportProgress(
          nChunks > 1
            ? `Enviando lote ${chunkIdx} de ${nChunks} (${end}/${totalLegacy} lançamentos)…`
            : `Enviando ${totalLegacy} lançamento${totalLegacy !== 1 ? 's' : ''}…`
        )
        const chunk = expenses.slice(i, i + BATCH_CHUNK_SIZE)
        await Promise.all(
          chunk.map((expense) =>
            addCardExpense({
              ...expense,
              creditCardInvoiceId: expense.creditCardInvoiceId ?? fallbackInvoiceId ?? undefined,
            })
          )
        )
      }

      refreshImports()
      setSuccessMessage(`${expenses.length} despesas importadas com sucesso!`)
      setStatus('success')

      setTimeout(() => {
        handleReset()
      }, 2000)
    } catch (err) {
      console.error('Erro ao importar despesas em batch:', err)
      setError(err.message || 'Erro ao importar despesas. Algumas podem ter sido salvas parcialmente.')
    } finally {
      setSaving(false)
      setFaturaImportProgress(null)
    }
  }

  /** Reabre revisão a partir do GET /documents/imports/{id} quando o backend expõe o payload. */
  const handleReview = async (importItem) => {
    if (!importItem?.id) return
    setReviewImport(importItem)
    setRecentImportHint(null)
    setError(null)
    setStatus('processing')
    setLoadingImportDetail(true)
    try {
      const extracted = await getImportDetail(importItem.id)
      setExtractedData(extracted)
      setFaturaPruneSelection(null)
      setFaturaApplyBanner(null)
      setStatus('result')
    } catch (err) {
      console.error('Erro ao carregar importação:', err)
      setError(err.message || 'Não foi possível carregar esta importação.')
      setStatus('error')
    } finally {
      setLoadingImportDetail(false)
    }
  }

  const handleReprocess = () => {
    const docType = reviewImport?.documentType || 'auto'
    handleReset()
    setDocumentType(docType)
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
    setReviewImport(null)
    setPdfPassword('')
    setProcessHint(null)
    setFaturaPruneSelection(null)
    setFaturaApplyBanner(null)
    setFaturaImportProgress(null)
    setRecentImportHint(null)
    setLoadingImportDetail(false)
  }

  const handleRetry = () => {
    setError(null)
    if (file) {
      setStatus('preview')
      if (isPdfFile(file)) {
        setProcessHint(
          'Se o PDF estiver protegido por senha, informe abaixo e processe novamente.'
        )
      }
      return
    }
    if (reviewImport?.id) {
      void handleReview(reviewImport)
      return
    }
    setStatus('idle')
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

      <div ref={uploadAreaRef} className="space-y-3 scroll-mt-4">
      {/* Seletor de tipo de documento */}
      {(status === 'idle' || status === 'preview') && (
        <Select
          label="Tipo de documento"
          value={documentType}
          onChange={(e) => setDocumentType(e.target.value)}
          options={DOCUMENT_TYPES.map(t => ({ value: t.id, label: t.name }))}
        />
      )}

      {status === 'idle' && recentImportHint && (
        <div className="flex gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-2.5 text-sm text-violet-100">
          <p className="min-w-0 flex-1 leading-snug">{recentImportHint}</p>
          <button
            type="button"
            onClick={() => setRecentImportHint(null)}
            className="shrink-0 p-1 rounded-lg text-violet-300/80 hover:text-white hover:bg-violet-500/20"
            aria-label="Fechar aviso"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Upload / Preview */}
      {status === 'idle' && (
        <FileUpload onFileSelect={handleFileSelect} />
      )}

      {status === 'preview' && file && (
        <div className="space-y-4">
          <FilePreview file={file} onRemove={handleRemoveFile} />

          {processHint && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200/90">
              {processHint}
            </div>
          )}

          {isPdfFile(file) && (
            <Input
              type="password"
              label="Senha do PDF (opcional)"
              placeholder="Só se o banco exigir senha ao abrir o arquivo"
              icon={Lock}
              value={pdfPassword}
              onChange={(e) => setPdfPassword(e.target.value)}
              autoComplete="off"
            />
          )}

          <Button
            onClick={handleProcess}
            icon={Sparkles}
            fullWidth
          >
            Processar com IA
          </Button>
        </div>
      )}
      </div>

      {/* Processing */}
      {(status === 'processing' || loadingImportDetail) && (
        <Card className="py-12">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-violet-500/20 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
              </div>
              <div className="absolute inset-0 rounded-full border-2 border-violet-500/30 animate-ping" />
            </div>
            <p className="text-white font-medium mt-4">
              {loadingImportDetail ? 'Carregando importação…' : 'Analisando documento…'}
            </p>
            <p className="text-sm text-dark-400 mt-1">
              {loadingImportDetail ? 'Buscando dados no servidor' : 'Isso pode levar alguns segundos'}
            </p>
          </div>
        </Card>
      )}

      {/* Review mode banner */}
      {status === 'result' && reviewImport && (
        <Card className="py-3 px-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-white font-medium truncate">{reviewImport.fileName}</p>
              <p className="text-xs text-dark-400">Dados do servidor · importação salva</p>
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
            fileName={file?.name ?? reviewImport?.fileName ?? null}
            selectionPruneRequest={faturaPruneSelection}
            applyWarningBanner={faturaApplyBanner}
            importProgress={faturaImportProgress}
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
            sourceFileName={reviewImport?.fileName ?? null}
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
            {isPdfFile(file) && (
              <p className="text-sm text-dark-400 mt-3 max-w-sm">
                PDFs protegidos por senha precisam da senha informada antes de processar. Volte, preencha &quot;Senha do PDF (opcional)&quot; e tente de novo.
              </p>
            )}

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

    </div>
  )
}
