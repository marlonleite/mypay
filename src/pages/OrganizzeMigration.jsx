import { useState } from 'react'
import {
  Download,
  Upload,
  Loader2,
  CheckCircle,
  AlertCircle,
  CreditCard,
  Wallet,
  Tag,
  Receipt,
  ArrowRight,
  RefreshCw
} from 'lucide-react'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { fetchAllData, convertToMyPay } from '../services/organizzeApi'
import { useTransactions, useCards, useCategories, useAccounts } from '../hooks/useFirestore'
import { formatCurrency } from '../utils/helpers'

export default function OrganizzeMigration() {
  // Credenciais do .env
  const email = import.meta.env.VITE_ORGANIZZE_EMAIL
  const apiKey = import.meta.env.VITE_ORGANIZZE_API_KEY

  // Período
  const [startDate, setStartDate] = useState('2022-01-01')
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])

  // Estados
  const [status, setStatus] = useState('idle') // idle, fetching, preview, importing, success, error
  const [progress, setProgress] = useState('')
  const [error, setError] = useState(null)
  const [organizzeData, setOrganizzeData] = useState(null)
  const [convertedData, setConvertedData] = useState(null)
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 })

  // Hooks do Firestore
  const { addTransaction } = useTransactions(0, 2024)
  const { addCard, addCardExpense } = useCards()
  const { addAccount } = useAccounts()
  const { addCategory } = useCategories()

  // Buscar dados do Organizze
  const handleFetch = async () => {
    if (!email || !apiKey) {
      setError('Preencha email e API Key')
      return
    }

    setStatus('fetching')
    setError(null)
    setProgress('Conectando ao Organizze...')

    try {
      const data = await fetchAllData(email, apiKey, startDate, endDate, setProgress)
      setOrganizzeData(data)

      setProgress('Convertendo dados...')
      const converted = convertToMyPay(data)
      setConvertedData(converted)

      setStatus('preview')
    } catch (err) {
      console.error('Erro ao buscar dados:', err)
      setError(err.message)
      setStatus('error')
    }
  }

  // Importar para o myPay
  const handleImport = async () => {
    if (!convertedData) return

    setStatus('importing')
    setError(null)

    const { accounts, cards, transactions, cardExpenses } = convertedData
    const total = accounts.length + cards.length + transactions.length + cardExpenses.length
    let current = 0

    try {
      // 1. Importar contas
      setProgress('Importando contas...')
      for (const account of accounts) {
        try {
          await addAccount({
            name: account.name,
            type: account.type,
            balance: 0,
            isActive: true,
          })
          current++
          setImportProgress({ current, total })
        } catch (e) {
          console.warn('Erro ao importar conta:', account.name, e)
        }
      }

      // 2. Importar cartões
      setProgress('Importando cartões...')
      for (const card of cards) {
        try {
          await addCard({
            name: card.name,
            brand: card.brand,
            limit: card.limit,
            closingDay: card.closingDay,
            dueDay: card.dueDay,
            color: card.color,
            isActive: true,
          })
          current++
          setImportProgress({ current, total })
        } catch (e) {
          console.warn('Erro ao importar cartão:', card.name, e)
        }
      }

      // 3. Importar transações
      setProgress('Importando transações...')
      for (const transaction of transactions) {
        try {
          await addTransaction({
            description: transaction.description,
            amount: transaction.amount,
            type: transaction.type,
            category: transaction.category,
            date: transaction.date,
            isPending: transaction.isPending,
            notes: transaction.notes,
            tags: transaction.tags,
          })
          current++
          setImportProgress({ current, total })
        } catch (e) {
          console.warn('Erro ao importar transação:', transaction.description, e)
        }
      }

      // 4. Importar despesas de cartão
      setProgress('Importando despesas de cartão...')
      for (const expense of cardExpenses) {
        try {
          // Encontrar ID do cartão no myPay pelo nome
          // Por enquanto, vamos criar como transação normal
          await addTransaction({
            description: expense.description,
            amount: expense.amount,
            type: 'expense',
            category: expense.category,
            date: expense.date,
            tags: expense.tags,
            notes: `Cartão: ${expense.cardName}`,
          })
          current++
          setImportProgress({ current, total })
        } catch (e) {
          console.warn('Erro ao importar despesa cartão:', expense.description, e)
        }
      }

      setStatus('success')
    } catch (err) {
      console.error('Erro na importação:', err)
      setError(err.message)
      setStatus('error')
    }
  }

  const handleReset = () => {
    setStatus('idle')
    setOrganizzeData(null)
    setConvertedData(null)
    setError(null)
    setProgress('')
    setImportProgress({ current: 0, total: 0 })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Migrar do Organizze</h2>
          <p className="text-sm text-dark-400">Importe seus dados automaticamente</p>
        </div>
        <div className="p-2 bg-emerald-500/20 rounded-xl">
          <Download className="w-6 h-6 text-emerald-400" />
        </div>
      </div>

      {/* Configuração */}
      {status === 'idle' && (
        <>
          <Card>
            <h3 className="text-sm font-medium text-white mb-4">Período</h3>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Data inicial"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <Input
                label="Data final"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </Card>

          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-500/10 rounded-xl">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <Button onClick={handleFetch} icon={Download} fullWidth>
            Buscar dados do Organizze
          </Button>
        </>
      )}

      {/* Buscando */}
      {status === 'fetching' && (
        <Card className="py-12">
          <div className="flex flex-col items-center justify-center text-center">
            <Loader2 className="w-12 h-12 text-violet-400 animate-spin" />
            <p className="text-white font-medium mt-4">{progress}</p>
          </div>
        </Card>
      )}

      {/* Preview */}
      {status === 'preview' && convertedData && (
        <>
          <Card>
            <h3 className="text-sm font-medium text-white mb-4">Resumo dos dados</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 bg-dark-800/30 rounded-xl">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{convertedData.stats.totalAccounts}</p>
                  <p className="text-xs text-dark-400">Contas</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-dark-800/30 rounded-xl">
                <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{convertedData.stats.totalCards}</p>
                  <p className="text-xs text-dark-400">Cartões</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-dark-800/30 rounded-xl">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <Receipt className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{convertedData.stats.totalTransactions}</p>
                  <p className="text-xs text-dark-400">Transações</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-dark-800/30 rounded-xl">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{convertedData.stats.totalCardExpenses}</p>
                  <p className="text-xs text-dark-400">Gastos Cartão</p>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="text-sm font-medium text-white mb-4">Totais</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-dark-400">Receitas</span>
                <span className="text-emerald-400 font-semibold">
                  +{formatCurrency(convertedData.stats.totalIncome)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-dark-400">Despesas</span>
                <span className="text-red-400 font-semibold">
                  -{formatCurrency(convertedData.stats.totalExpense)}
                </span>
              </div>
              <div className="border-t border-dark-700 pt-3 flex justify-between items-center">
                <span className="text-white font-medium">Saldo</span>
                <span className={`font-bold ${
                  convertedData.stats.totalIncome - convertedData.stats.totalExpense >= 0
                    ? 'text-emerald-400'
                    : 'text-red-400'
                }`}>
                  {formatCurrency(convertedData.stats.totalIncome - convertedData.stats.totalExpense)}
                </span>
              </div>
            </div>
          </Card>

          <div className="flex gap-3">
            <Button onClick={handleReset} variant="ghost" className="flex-1">
              Cancelar
            </Button>
            <Button onClick={handleImport} icon={Upload} className="flex-1">
              Importar para myPay
            </Button>
          </div>
        </>
      )}

      {/* Importando */}
      {status === 'importing' && (
        <Card className="py-12">
          <div className="flex flex-col items-center justify-center text-center">
            <Loader2 className="w-12 h-12 text-violet-400 animate-spin" />
            <p className="text-white font-medium mt-4">{progress}</p>
            <p className="text-sm text-dark-400 mt-2">
              {importProgress.current} de {importProgress.total}
            </p>
            <div className="w-full max-w-xs mt-4 h-2 bg-dark-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-violet-500 transition-all duration-300"
                style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
              />
            </div>
          </div>
        </Card>
      )}

      {/* Sucesso */}
      {status === 'success' && (
        <Card className="py-12">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <p className="text-white font-medium mt-4">Migração concluída!</p>
            <p className="text-sm text-dark-400 mt-1">
              {importProgress.current} itens importados com sucesso
            </p>
            <Button onClick={handleReset} variant="ghost" className="mt-6">
              Fazer nova migração
            </Button>
          </div>
        </Card>
      )}

      {/* Erro */}
      {status === 'error' && (
        <Card className="py-8">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
            <p className="text-white font-medium mt-4">Erro na migração</p>
            <p className="text-sm text-red-400 mt-1 max-w-xs">{error}</p>
            <div className="flex gap-3 mt-6">
              <Button onClick={handleFetch} icon={RefreshCw} variant="secondary">
                Tentar novamente
              </Button>
              <Button onClick={handleReset} variant="ghost">
                Cancelar
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
