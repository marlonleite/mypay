import { useState } from 'react'
import { Download, FileSpreadsheet, FileJson, X, Calendar, CheckCircle } from 'lucide-react'
import { exportToCSV, exportCardExpensesToCSV, exportFullReportCSV, exportToJSON } from '../../services/exportService'
import { useTransactions, useAllCardExpenses, useCategories, useAccounts, useCards } from '../../hooks/useFirestore'
import { isDateInMonth } from '../../utils/helpers'

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

export default function ExportModal({ isOpen, onClose }) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [exportType, setExportType] = useState('full') // full, transactions, cards, backup
  const [isExporting, setIsExporting] = useState(false)
  const [success, setSuccess] = useState(false)

  // Hooks de dados
  const { transactions } = useTransactions(selectedMonth, selectedYear)
  const { expenses: allCardExpenses } = useAllCardExpenses()
  const { categories } = useCategories()
  const { accounts } = useAccounts()
  const { cards } = useCards()

  // Filtrar despesas de cartão pelo período
  const cardExpenses = allCardExpenses.filter(e =>
    isDateInMonth(e.date, selectedMonth, selectedYear)
  )

  const handleExport = async () => {
    setIsExporting(true)
    setSuccess(false)

    try {
      // Pequeno delay para UX
      await new Promise(resolve => setTimeout(resolve, 500))

      switch (exportType) {
        case 'full':
          exportFullReportCSV({
            transactions,
            cardExpenses,
            categories,
            accounts,
            cards,
            month: selectedMonth,
            year: selectedYear
          })
          break

        case 'transactions':
          exportToCSV(
            transactions,
            categories,
            accounts,
            `transacoes-${MONTHS[selectedMonth].toLowerCase()}-${selectedYear}`
          )
          break

        case 'cards':
          exportCardExpensesToCSV(
            cardExpenses,
            cards,
            categories,
            `cartoes-${MONTHS[selectedMonth].toLowerCase()}-${selectedYear}`
          )
          break

        case 'backup':
          exportToJSON({
            exportedAt: new Date().toISOString(),
            period: { month: selectedMonth, year: selectedYear },
            transactions,
            cardExpenses,
            categories,
            accounts,
            cards
          }, `backup-mypay-${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`)
          break
      }

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (error) {
      console.error('Erro ao exportar:', error)
    } finally {
      setIsExporting(false)
    }
  }

  if (!isOpen) return null

  // Gerar lista de anos (últimos 5 anos)
  const years = []
  const currentYear = new Date().getFullYear()
  for (let y = currentYear; y >= currentYear - 4; y--) {
    years.push(y)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative w-full max-w-md bg-dark-900 rounded-2xl shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-500/20 rounded-lg">
              <Download className="w-5 h-5 text-violet-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">Exportar Dados</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-dark-400 hover:text-white rounded-lg hover:bg-dark-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Período */}
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">
              <Calendar className="w-4 h-4 inline mr-2" />
              Período
            </label>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="px-3 py-2 bg-dark-800 border border-dark-700 rounded-xl text-white focus:outline-none focus:border-violet-500"
              >
                {MONTHS.map((month, index) => (
                  <option key={index} value={index}>{month}</option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="px-3 py-2 bg-dark-800 border border-dark-700 rounded-xl text-white focus:outline-none focus:border-violet-500"
              >
                {years.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Tipo de exportação */}
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">
              Tipo de exportação
            </label>
            <div className="space-y-2">
              <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                exportType === 'full'
                  ? 'bg-violet-500/10 border-violet-500/30'
                  : 'bg-dark-800 border-dark-700 hover:border-dark-600'
              }`}>
                <input
                  type="radio"
                  name="exportType"
                  value="full"
                  checked={exportType === 'full'}
                  onChange={(e) => setExportType(e.target.value)}
                  className="sr-only"
                />
                <FileSpreadsheet className={`w-5 h-5 ${exportType === 'full' ? 'text-violet-400' : 'text-dark-400'}`} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">Relatório Completo</p>
                  <p className="text-xs text-dark-400">Transações + Cartões + Resumo (CSV)</p>
                </div>
              </label>

              <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                exportType === 'transactions'
                  ? 'bg-violet-500/10 border-violet-500/30'
                  : 'bg-dark-800 border-dark-700 hover:border-dark-600'
              }`}>
                <input
                  type="radio"
                  name="exportType"
                  value="transactions"
                  checked={exportType === 'transactions'}
                  onChange={(e) => setExportType(e.target.value)}
                  className="sr-only"
                />
                <FileSpreadsheet className={`w-5 h-5 ${exportType === 'transactions' ? 'text-violet-400' : 'text-dark-400'}`} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">Apenas Transações</p>
                  <p className="text-xs text-dark-400">Receitas e despesas (CSV)</p>
                </div>
              </label>

              <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                exportType === 'cards'
                  ? 'bg-violet-500/10 border-violet-500/30'
                  : 'bg-dark-800 border-dark-700 hover:border-dark-600'
              }`}>
                <input
                  type="radio"
                  name="exportType"
                  value="cards"
                  checked={exportType === 'cards'}
                  onChange={(e) => setExportType(e.target.value)}
                  className="sr-only"
                />
                <FileSpreadsheet className={`w-5 h-5 ${exportType === 'cards' ? 'text-violet-400' : 'text-dark-400'}`} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">Apenas Cartões</p>
                  <p className="text-xs text-dark-400">Despesas de cartão (CSV)</p>
                </div>
              </label>

              <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                exportType === 'backup'
                  ? 'bg-violet-500/10 border-violet-500/30'
                  : 'bg-dark-800 border-dark-700 hover:border-dark-600'
              }`}>
                <input
                  type="radio"
                  name="exportType"
                  value="backup"
                  checked={exportType === 'backup'}
                  onChange={(e) => setExportType(e.target.value)}
                  className="sr-only"
                />
                <FileJson className={`w-5 h-5 ${exportType === 'backup' ? 'text-violet-400' : 'text-dark-400'}`} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">Backup Completo</p>
                  <p className="text-xs text-dark-400">Todos os dados (JSON)</p>
                </div>
              </label>
            </div>
          </div>

          {/* Info do período */}
          <div className="p-3 bg-dark-800 rounded-xl text-sm text-dark-400">
            <p>
              {transactions.length} transações e {cardExpenses.length} despesas de cartão em {MONTHS[selectedMonth]} {selectedYear}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-dark-700">
          {success ? (
            <div className="flex items-center justify-center gap-2 py-2 text-emerald-400">
              <CheckCircle className="w-5 h-5" />
              <span>Exportado com sucesso!</span>
            </div>
          ) : (
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="w-full py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isExporting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Exportando...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  Exportar
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
