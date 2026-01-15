import { useState } from 'react'
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Receipt,
  CreditCard,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Select from '../ui/Select'
import { formatCurrency } from '../../utils/helpers'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../../utils/constants'

const confidenceConfig = {
  alta: { color: 'text-emerald-400', bg: 'bg-emerald-500/20', icon: CheckCircle2 },
  media: { color: 'text-yellow-400', bg: 'bg-yellow-500/20', icon: AlertTriangle },
  baixa: { color: 'text-red-400', bg: 'bg-red-500/20', icon: AlertCircle }
}

export default function ProcessingResult({
  data,
  onCreateTransaction,
  onCreateCardExpense,
  onDiscard,
  cards = [],
  saving = false
}) {
  const [editedData, setEditedData] = useState({
    descricao: data.descricao || '',
    valor: data.valor || 0,
    data: data.data || new Date().toISOString().split('T')[0],
    categoria: data.categoria_sugerida || 'other',
    tipo: data.tipo_transacao || 'expense'
  })
  const [selectedCard, setSelectedCard] = useState(cards[0]?.id || '')
  const [showDetails, setShowDetails] = useState(false)

  const confidence = confidenceConfig[data.confianca] || confidenceConfig.media
  const ConfidenceIcon = confidence.icon

  const categories = editedData.tipo === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  const handleCreateTransaction = () => {
    onCreateTransaction({
      description: editedData.descricao,
      amount: parseFloat(editedData.valor),
      date: editedData.data,
      category: editedData.categoria,
      type: editedData.tipo
    })
  }

  const handleCreateCardExpense = () => {
    if (!selectedCard) return
    onCreateCardExpense({
      cardId: selectedCard,
      description: editedData.descricao,
      amount: parseFloat(editedData.valor),
      date: editedData.data,
      category: editedData.categoria
    })
  }

  return (
    <div className="bg-dark-900 border border-dark-700 rounded-2xl overflow-hidden">
      {/* Header com confiança */}
      <div className="p-4 border-b border-dark-700 flex items-center justify-between">
        <h3 className="font-medium text-white">Dados Extraídos</h3>
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${confidence.bg}`}>
          <ConfidenceIcon className={`w-4 h-4 ${confidence.color}`} />
          <span className={`text-xs font-medium ${confidence.color}`}>
            Confiança {data.confianca}
          </span>
        </div>
      </div>

      {/* Formulário editável */}
      <div className="p-4 space-y-4">
        {/* Tipo (receita/despesa) */}
        <div className="flex gap-2 p-1 bg-dark-800 rounded-xl">
          <button
            type="button"
            onClick={() => setEditedData({ ...editedData, tipo: 'income', categoria: 'salary' })}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
              editedData.tipo === 'income'
                ? 'bg-emerald-600 text-white'
                : 'text-dark-400 hover:text-white'
            }`}
          >
            Receita
          </button>
          <button
            type="button"
            onClick={() => setEditedData({ ...editedData, tipo: 'expense', categoria: 'other' })}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
              editedData.tipo === 'expense'
                ? 'bg-red-600 text-white'
                : 'text-dark-400 hover:text-white'
            }`}
          >
            Despesa
          </button>
        </div>

        {/* Descrição */}
        <Input
          label="Descrição"
          value={editedData.descricao}
          onChange={(e) => setEditedData({ ...editedData, descricao: e.target.value })}
          placeholder="Descrição da transação"
        />

        {/* Valor e Data */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Valor"
            type="number"
            step="0.01"
            min="0"
            value={editedData.valor}
            onChange={(e) => setEditedData({ ...editedData, valor: e.target.value })}
          />
          <Input
            label="Data"
            type="date"
            value={editedData.data}
            onChange={(e) => setEditedData({ ...editedData, data: e.target.value })}
          />
        </div>

        {/* Categoria */}
        <Select
          label="Categoria"
          value={editedData.categoria}
          onChange={(e) => setEditedData({ ...editedData, categoria: e.target.value })}
          options={categories.map(c => ({ value: c.id, label: c.name }))}
        />

        {/* Detalhes extras (se houver) */}
        {data.dados_completos && Object.keys(data.dados_completos).length > 5 && (
          <div>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-2 text-sm text-dark-400 hover:text-white transition-colors"
            >
              {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {showDetails ? 'Ocultar detalhes' : 'Ver detalhes extraídos'}
            </button>

            {showDetails && (
              <pre className="mt-2 p-3 bg-dark-800 rounded-lg text-xs text-dark-300 overflow-auto max-h-48">
                {JSON.stringify(data.dados_completos, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>

      {/* Ações */}
      <div className="p-4 border-t border-dark-700 space-y-3">
        {/* Criar Transação */}
        <Button
          onClick={handleCreateTransaction}
          icon={Receipt}
          fullWidth
          variant={editedData.tipo === 'income' ? 'success' : 'danger'}
          loading={saving}
          disabled={!editedData.descricao || !editedData.valor}
        >
          Criar {editedData.tipo === 'income' ? 'Receita' : 'Despesa'}
        </Button>

        {/* Criar Despesa de Cartão (só para despesas) */}
        {editedData.tipo === 'expense' && cards.length > 0 && (
          <div className="flex gap-2">
            <Select
              value={selectedCard}
              onChange={(e) => setSelectedCard(e.target.value)}
              options={cards.map(c => ({ value: c.id, label: c.name }))}
              className="flex-1"
            />
            <Button
              onClick={handleCreateCardExpense}
              icon={CreditCard}
              variant="secondary"
              loading={saving}
              disabled={!editedData.descricao || !editedData.valor || !selectedCard}
            >
              Cartão
            </Button>
          </div>
        )}

        {/* Descartar */}
        <Button
          onClick={onDiscard}
          variant="ghost"
          fullWidth
          disabled={saving}
        >
          Descartar
        </Button>
      </div>
    </div>
  )
}
