import { useState, useMemo } from 'react'
import {
  Plus,
  Wallet,
  Building2,
  PiggyBank,
  Trash2,
  Edit2,
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
  ArrowRight
} from 'lucide-react'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Loading from '../components/ui/Loading'
import EmptyState from '../components/ui/EmptyState'
import { useAccounts, useTransactions, useTransfers } from '../hooks/useFirestore'
import { formatCurrency, getCurrentMonthYear } from '../utils/helpers'

const ACCOUNT_TYPES = [
  { value: 'wallet', label: 'Carteira', icon: Wallet },
  { value: 'checking', label: 'Conta Corrente', icon: Building2 },
  { value: 'savings', label: 'Poupança', icon: PiggyBank }
]

const ACCOUNT_COLORS = [
  { value: 'emerald', label: 'Verde', class: 'bg-emerald-500' },
  { value: 'blue', label: 'Azul', class: 'bg-blue-500' },
  { value: 'violet', label: 'Violeta', class: 'bg-violet-500' },
  { value: 'orange', label: 'Laranja', class: 'bg-orange-500' },
  { value: 'pink', label: 'Rosa', class: 'bg-pink-500' },
  { value: 'slate', label: 'Cinza', class: 'bg-slate-500' }
]

export default function Accounts() {
  const {
    accounts,
    loading,
    addAccount,
    updateAccount,
    deleteAccount,
    getActiveAccounts
  } = useAccounts()

  const { month, year } = getCurrentMonthYear()

  // Buscar todas as transações (sem filtro de mês) para calcular saldo total
  const { transactions } = useTransactions(month, year)

  // Transferências do mês atual
  const { transfers, addTransfer, deleteTransfer, loading: loadingTransfers } = useTransfers(month, year)

  const [modalOpen, setModalOpen] = useState(false)
  const [transferModalOpen, setTransferModalOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    name: '',
    type: 'checking',
    color: 'blue',
    initialBalance: ''
  })

  const [transferForm, setTransferForm] = useState({
    fromAccountId: '',
    toAccountId: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: ''
  })

  const activeAccounts = getActiveAccounts()

  // Calcular saldo de cada conta baseado nas transações
  const accountsWithBalance = useMemo(() => {
    return activeAccounts.map(account => {
      // Saldo inicial da conta
      const initialBalance = account.balance || 0

      // Calcular movimentações (transações vinculadas a esta conta)
      const accountTransactions = transactions.filter(t => t.accountId === account.id)
      const income = accountTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + (t.amount || 0), 0)
      const expenses = accountTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + (t.amount || 0), 0)

      const currentBalance = initialBalance + income - expenses

      return {
        ...account,
        initialBalance,
        income,
        expenses,
        currentBalance
      }
    })
  }, [activeAccounts, transactions])

  // Totais
  const totals = useMemo(() => {
    const totalBalance = accountsWithBalance.reduce((sum, a) => sum + a.currentBalance, 0)
    const totalIncome = accountsWithBalance.reduce((sum, a) => sum + a.income, 0)
    const totalExpenses = accountsWithBalance.reduce((sum, a) => sum + a.expenses, 0)

    return { totalBalance, totalIncome, totalExpenses }
  }, [accountsWithBalance])

  const getAccountIcon = (type) => {
    const accountType = ACCOUNT_TYPES.find(t => t.value === type)
    return accountType?.icon || Wallet
  }

  const getAccountTypeName = (type) => {
    const accountType = ACCOUNT_TYPES.find(t => t.value === type)
    return accountType?.label || type
  }

  const getColorClass = (color) => {
    return ACCOUNT_COLORS.find(c => c.value === color)?.class || 'bg-slate-500'
  }

  const openNewModal = () => {
    setEditingAccount(null)
    setForm({
      name: '',
      type: 'checking',
      color: 'blue',
      initialBalance: ''
    })
    setModalOpen(true)
  }

  const openEditModal = (account) => {
    setEditingAccount(account)
    setForm({
      name: account.name,
      type: account.type,
      color: account.color || 'blue',
      initialBalance: (account.balance || 0).toString()
    })
    setModalOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.name) return

    try {
      setSaving(true)

      const data = {
        name: form.name,
        type: form.type,
        color: form.color,
        balance: parseFloat(form.initialBalance) || 0
      }

      if (editingAccount) {
        await updateAccount(editingAccount.id, data)
      } else {
        await addAccount(data)
      }

      setModalOpen(false)
    } catch (error) {
      console.error('Error saving account:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Excluir esta conta? As transações vinculadas não serão excluídas.')) return

    try {
      await deleteAccount(id)
    } catch (error) {
      console.error('Error deleting account:', error)
    }
  }

  const openTransferModal = () => {
    if (activeAccounts.length < 2) {
      alert('Você precisa de pelo menos 2 contas para fazer transferências')
      return
    }
    setTransferForm({
      fromAccountId: activeAccounts[0]?.id || '',
      toAccountId: activeAccounts[1]?.id || '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      description: ''
    })
    setTransferModalOpen(true)
  }

  const handleTransfer = async (e) => {
    e.preventDefault()
    if (!transferForm.fromAccountId || !transferForm.toAccountId || !transferForm.amount) return
    if (transferForm.fromAccountId === transferForm.toAccountId) {
      alert('Selecione contas diferentes')
      return
    }

    try {
      setSaving(true)
      const fromAccount = activeAccounts.find(a => a.id === transferForm.fromAccountId)
      const toAccount = activeAccounts.find(a => a.id === transferForm.toAccountId)

      await addTransfer({
        fromAccountId: transferForm.fromAccountId,
        fromAccountName: fromAccount?.name || 'Conta',
        toAccountId: transferForm.toAccountId,
        toAccountName: toAccount?.name || 'Conta',
        amount: parseFloat(transferForm.amount),
        date: transferForm.date,
        description: transferForm.description
      })

      setTransferModalOpen(false)
    } catch (error) {
      console.error('Error creating transfer:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteTransfer = async (transfer) => {
    if (!confirm('Excluir esta transferência?')) return

    try {
      await deleteTransfer(transfer)
    } catch (error) {
      console.error('Error deleting transfer:', error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Contas</h2>
          <p className="text-sm text-dark-400">Gerencie suas contas e saldos</p>
        </div>
        <div className="p-2 bg-blue-500/20 rounded-xl">
          <Wallet className="w-6 h-6 text-blue-400" />
        </div>
      </div>

      {/* Total Balance Card */}
      {accountsWithBalance.length > 0 && (
        <Card className="!p-4">
          <div className="text-center">
            <p className="text-xs text-dark-400 mb-1">Saldo Total</p>
            <p className={`text-3xl font-bold ${totals.totalBalance >= 0 ? 'text-white' : 'text-red-400'}`}>
              {formatCurrency(totals.totalBalance)}
            </p>
          </div>
          <div className="flex justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-dark-400">Entradas</p>
                <p className="text-sm font-semibold text-emerald-400">{formatCurrency(totals.totalIncome)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
                <TrendingDown className="w-4 h-4 text-red-400" />
              </div>
              <div>
                <p className="text-xs text-dark-400">Saídas</p>
                <p className="text-sm font-semibold text-red-400">{formatCurrency(totals.totalExpenses)}</p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button onClick={openNewModal} icon={Plus} className="flex-1">
          Nova Conta
        </Button>
        <Button onClick={openTransferModal} icon={ArrowLeftRight} variant="secondary" className="flex-1">
          Transferir
        </Button>
      </div>

      {/* Accounts List */}
      {loading ? (
        <Loading />
      ) : accountsWithBalance.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Nenhuma conta"
          description="Adicione suas contas para controlar seus saldos"
          action={
            <Button onClick={openNewModal} icon={Plus}>
              Adicionar Conta
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {accountsWithBalance.map((account) => {
            const Icon = getAccountIcon(account.type)
            return (
              <Card key={account.id} className="!p-4">
                <div className="flex items-center gap-4">
                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-xl ${getColorClass(account.color)} flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-medium truncate">{account.name}</h3>
                    <p className="text-xs text-dark-400">{getAccountTypeName(account.type)}</p>
                  </div>

                  {/* Balance */}
                  <div className="text-right">
                    <p className={`text-lg font-bold ${account.currentBalance >= 0 ? 'text-white' : 'text-red-400'}`}>
                      {formatCurrency(account.currentBalance)}
                    </p>
                    {account.income > 0 || account.expenses > 0 ? (
                      <p className="text-xs text-dark-500">
                        <span className="text-emerald-400">+{formatCurrency(account.income)}</span>
                        {' / '}
                        <span className="text-red-400">-{formatCurrency(account.expenses)}</span>
                      </p>
                    ) : null}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEditModal(account)}
                      className="p-1.5 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(account.id)}
                      className="p-1.5 text-dark-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Recent Transfers */}
      {transfers.length > 0 && (
        <Card>
          <h3 className="text-sm font-medium text-dark-300 mb-4">
            Transferências do Mês
          </h3>
          <div className="space-y-3">
            {transfers.map((transfer) => (
              <div
                key={transfer.id}
                className="flex items-center justify-between p-3 bg-dark-800/30 rounded-xl border border-dark-700/30"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/20">
                    <ArrowLeftRight className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-white font-medium">{transfer.fromAccountName}</span>
                      <ArrowRight className="w-3 h-3 text-dark-500" />
                      <span className="text-white font-medium">{transfer.toAccountName}</span>
                    </div>
                    <p className="text-xs text-dark-400">
                      {transfer.date?.toLocaleDateString('pt-BR')}
                      {transfer.description && ` • ${transfer.description}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-blue-400">
                    {formatCurrency(transfer.amount)}
                  </span>
                  <button
                    onClick={() => handleDeleteTransfer(transfer)}
                    className="p-1.5 text-dark-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Modal Nova Conta */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingAccount ? 'Editar Conta' : 'Nova Conta'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Nome da Conta"
            type="text"
            placeholder="Ex: Nubank, Carteira..."
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />

          <Select
            label="Tipo"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            options={ACCOUNT_TYPES.map(t => ({ value: t.value, label: t.label }))}
          />

          <Input
            label="Saldo Inicial"
            type="number"
            step="0.01"
            placeholder="0,00"
            value={form.initialBalance}
            onChange={(e) => setForm({ ...form, initialBalance: e.target.value })}
          />

          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">
              Cor
            </label>
            <div className="flex gap-2 flex-wrap">
              {ACCOUNT_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setForm({ ...form, color: color.value })}
                  className={`w-10 h-10 rounded-xl ${color.class} transition-all ${
                    form.color === color.value
                      ? 'ring-2 ring-white ring-offset-2 ring-offset-dark-900'
                      : 'opacity-60 hover:opacity-100'
                  }`}
                  title={color.label}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setModalOpen(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              loading={saving}
              className="flex-1"
            >
              {editingAccount ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Transferência */}
      <Modal
        isOpen={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        title="Nova Transferência"
      >
        <form onSubmit={handleTransfer} className="space-y-4">
          <Select
            label="De"
            value={transferForm.fromAccountId}
            onChange={(e) => setTransferForm({ ...transferForm, fromAccountId: e.target.value })}
            options={activeAccounts.map(a => ({ value: a.id, label: a.name }))}
          />

          <Select
            label="Para"
            value={transferForm.toAccountId}
            onChange={(e) => setTransferForm({ ...transferForm, toAccountId: e.target.value })}
            options={activeAccounts.map(a => ({ value: a.id, label: a.name }))}
          />

          <Input
            label="Valor"
            type="number"
            step="0.01"
            min="0.01"
            placeholder="0,00"
            value={transferForm.amount}
            onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })}
            required
          />

          <Input
            label="Data"
            type="date"
            value={transferForm.date}
            onChange={(e) => setTransferForm({ ...transferForm, date: e.target.value })}
            required
          />

          <Input
            label="Descrição (opcional)"
            type="text"
            placeholder="Ex: Reserva de emergência..."
            value={transferForm.description}
            onChange={(e) => setTransferForm({ ...transferForm, description: e.target.value })}
          />

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setTransferModalOpen(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              loading={saving}
              className="flex-1"
            >
              Transferir
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
