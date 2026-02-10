import { useState } from 'react'
import {
  Sparkles,
  Wallet,
  Tag,
  Receipt,
  PartyPopper,
  ChevronRight,
  ChevronLeft,
  X,
  Plus,
  Check
} from 'lucide-react'
import { useOnboarding } from '../../contexts/OnboardingContext'
import { useAccounts, useCategories } from '../../hooks/useFirestore'
import Button from '../ui/Button'
import Input from '../ui/Input'
import CurrencyInput from '../ui/CurrencyInput'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../../utils/constants'

// Ícones para cada step
const STEP_ICONS = {
  welcome: Sparkles,
  accounts: Wallet,
  categories: Tag,
  transaction: Receipt,
  complete: PartyPopper
}

// Cores de destaque para cada step
const STEP_COLORS = {
  welcome: 'violet',
  accounts: 'blue',
  categories: 'emerald',
  transaction: 'orange',
  complete: 'emerald'
}

export default function OnboardingWizard() {
  const {
    currentStepData,
    currentStep,
    totalSteps,
    showOnboarding,
    loading,
    nextStep,
    prevStep,
    skipOnboarding
  } = useOnboarding()

  const { addAccount, accounts } = useAccounts()
  const { addCategory, categories } = useCategories()

  const [accountName, setAccountName] = useState('')
  const [accountBalance, setAccountBalance] = useState(null)
  const [savingAccount, setSavingAccount] = useState(false)

  const [categoryName, setCategoryName] = useState('')
  const [savingCategory, setSavingCategory] = useState(false)

  if (!showOnboarding || loading) return null

  const StepIcon = STEP_ICONS[currentStepData?.id] || Sparkles
  const stepColor = STEP_COLORS[currentStepData?.id] || 'violet'

  const handleAddAccount = async () => {
    if (!accountName.trim()) return

    try {
      setSavingAccount(true)
      await addAccount({
        name: accountName.trim(),
        type: 'checking',
        balance: accountBalance || 0,
        color: 'blue',
        active: true
      })
      setAccountName('')
      setAccountBalance(null)
    } catch (error) {
      console.error('Erro ao adicionar conta:', error)
    } finally {
      setSavingAccount(false)
    }
  }

  const handleAddCategory = async () => {
    if (!categoryName.trim()) return

    try {
      setSavingCategory(true)
      await addCategory({
        name: categoryName.trim(),
        type: 'expense',
        color: 'gray',
        icon: 'tag'
      })
      setCategoryName('')
    } catch (error) {
      console.error('Erro ao adicionar categoria:', error)
    } finally {
      setSavingCategory(false)
    }
  }

  const renderStepContent = () => {
    switch (currentStepData?.id) {
      case 'welcome':
        return (
          <div className="text-center space-y-4">
            <div className={`w-20 h-20 mx-auto rounded-2xl bg-${stepColor}-500/20 flex items-center justify-center`}>
              <Sparkles className={`w-10 h-10 text-${stepColor}-400`} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                {currentStepData.title}
              </h2>
              <p className="text-dark-400">
                {currentStepData.description}
              </p>
            </div>
            <div className="pt-4 space-y-2 text-left">
              <div className="flex items-center gap-3 p-3 bg-dark-800/50 rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-blue-400" />
                </div>
                <span className="text-sm text-dark-300">Controle de contas e saldos</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-dark-800/50 rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <Receipt className="w-4 h-4 text-emerald-400" />
                </div>
                <span className="text-sm text-dark-300">Receitas e despesas organizadas</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-dark-800/50 rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                  <Tag className="w-4 h-4 text-orange-400" />
                </div>
                <span className="text-sm text-dark-300">Categorização inteligente</span>
              </div>
            </div>
          </div>
        )

      case 'accounts':
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <div className={`w-16 h-16 mx-auto rounded-2xl bg-${stepColor}-500/20 flex items-center justify-center mb-3`}>
                <Wallet className={`w-8 h-8 text-${stepColor}-400`} />
              </div>
              <h2 className="text-xl font-bold text-white">
                {currentStepData.title}
              </h2>
              <p className="text-sm text-dark-400 mt-1">
                {currentStepData.description}
              </p>
            </div>

            {/* Lista de contas existentes */}
            {accounts.length > 0 && (
              <div className="space-y-2 mb-4">
                <p className="text-xs text-dark-400 font-medium">Suas contas:</p>
                {accounts.map(account => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between p-3 bg-dark-800/50 rounded-xl"
                  >
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm text-white">{account.name}</span>
                    </div>
                    <span className="text-sm text-dark-400">
                      R$ {(account.balance || 0).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Form para adicionar conta */}
            <div className="space-y-3 p-4 bg-dark-800/30 rounded-xl border border-dark-700/50">
              <Input
                label="Nome da conta"
                placeholder="Ex: Nubank, Itaú, Carteira"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
              />
              <CurrencyInput
                label="Saldo inicial"
                value={accountBalance}
                onChange={setAccountBalance}
              />
              <Button
                onClick={handleAddAccount}
                loading={savingAccount}
                disabled={!accountName.trim()}
                icon={Plus}
                className="w-full"
              >
                Adicionar Conta
              </Button>
            </div>

            {accounts.length === 0 && (
              <p className="text-xs text-dark-500 text-center">
                Adicione pelo menos uma conta para continuar
              </p>
            )}
          </div>
        )

      case 'categories':
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <div className={`w-16 h-16 mx-auto rounded-2xl bg-${stepColor}-500/20 flex items-center justify-center mb-3`}>
                <Tag className={`w-8 h-8 text-${stepColor}-400`} />
              </div>
              <h2 className="text-xl font-bold text-white">
                {currentStepData.title}
              </h2>
              <p className="text-sm text-dark-400 mt-1">
                {currentStepData.description}
              </p>
            </div>

            {/* Categorias padrão */}
            <div className="space-y-3">
              <div>
                <p className="text-xs text-dark-400 font-medium mb-2">Categorias de despesas:</p>
                <div className="flex flex-wrap gap-1.5">
                  {EXPENSE_CATEGORIES.slice(0, 8).map(cat => (
                    <span
                      key={cat.id}
                      className="px-2 py-1 text-xs bg-red-500/10 text-red-400 rounded-lg"
                    >
                      {cat.name}
                    </span>
                  ))}
                  {EXPENSE_CATEGORIES.length > 8 && (
                    <span className="px-2 py-1 text-xs bg-dark-700 text-dark-400 rounded-lg">
                      +{EXPENSE_CATEGORIES.length - 8}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <p className="text-xs text-dark-400 font-medium mb-2">Categorias de receitas:</p>
                <div className="flex flex-wrap gap-1.5">
                  {INCOME_CATEGORIES.map(cat => (
                    <span
                      key={cat.id}
                      className="px-2 py-1 text-xs bg-emerald-500/10 text-emerald-400 rounded-lg"
                    >
                      {cat.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Categorias customizadas */}
            {categories.length > 0 && (
              <div>
                <p className="text-xs text-dark-400 font-medium mb-2">Suas categorias:</p>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map(cat => (
                    <span
                      key={cat.id}
                      className="px-2 py-1 text-xs bg-violet-500/10 text-violet-400 rounded-lg"
                    >
                      {cat.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Form para adicionar categoria */}
            <div className="space-y-3 p-4 bg-dark-800/30 rounded-xl border border-dark-700/50">
              <Input
                label="Nova categoria (opcional)"
                placeholder="Ex: Streaming, Academia"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
              />
              <Button
                onClick={handleAddCategory}
                loading={savingCategory}
                disabled={!categoryName.trim()}
                variant="ghost"
                icon={Plus}
                className="w-full"
              >
                Adicionar Categoria
              </Button>
            </div>
          </div>
        )

      case 'transaction':
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <div className={`w-16 h-16 mx-auto rounded-2xl bg-${stepColor}-500/20 flex items-center justify-center mb-3`}>
                <Receipt className={`w-8 h-8 text-${stepColor}-400`} />
              </div>
              <h2 className="text-xl font-bold text-white">
                {currentStepData.title}
              </h2>
              <p className="text-sm text-dark-400 mt-1">
                {currentStepData.description}
              </p>
            </div>

            <div className="space-y-3 text-center">
              <p className="text-sm text-dark-300">
                Para adicionar uma transação, use o botão
              </p>
              <div className="flex justify-center">
                <div className="w-14 h-14 rounded-full bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
                  <Plus className="w-7 h-7 text-white" />
                </div>
              </div>
              <p className="text-sm text-dark-300">
                na barra inferior do app
              </p>

              <div className="pt-4 space-y-2 text-left">
                <p className="text-xs text-dark-400 font-medium">Dicas rápidas:</p>
                <div className="p-3 bg-dark-800/50 rounded-xl text-sm text-dark-300">
                  • Receitas = dinheiro que entra (salário, vendas)
                </div>
                <div className="p-3 bg-dark-800/50 rounded-xl text-sm text-dark-300">
                  • Despesas = dinheiro que sai (compras, contas)
                </div>
                <div className="p-3 bg-dark-800/50 rounded-xl text-sm text-dark-300">
                  • Use tags para agrupar gastos relacionados
                </div>
              </div>
            </div>
          </div>
        )

      case 'complete':
        return (
          <div className="text-center space-y-4">
            <div className={`w-20 h-20 mx-auto rounded-2xl bg-${stepColor}-500/20 flex items-center justify-center`}>
              <PartyPopper className={`w-10 h-10 text-${stepColor}-400`} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                {currentStepData.title}
              </h2>
              <p className="text-dark-400">
                {currentStepData.description}
              </p>
            </div>

            <div className="pt-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <p className="text-sm text-emerald-400">
                🎉 Parabéns! Você completou a configuração inicial.
                Agora é só começar a registrar suas finanças!
              </p>
            </div>

            <div className="pt-2 space-y-2 text-left">
              <p className="text-xs text-dark-400 font-medium">Próximos passos:</p>
              <div className="p-3 bg-dark-800/50 rounded-xl text-sm text-dark-300">
                → Adicione sua primeira transação
              </div>
              <div className="p-3 bg-dark-800/50 rounded-xl text-sm text-dark-300">
                → Configure seus cartões de crédito
              </div>
              <div className="p-3 bg-dark-800/50 rounded-xl text-sm text-dark-300">
                → Defina metas financeiras
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  const canProceed = () => {
    // No step de accounts, só pode avançar se tiver pelo menos 1 conta
    if (currentStepData?.id === 'accounts') {
      return accounts.length > 0
    }
    return true
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/95 backdrop-blur-sm">
      <div className="w-full max-w-md bg-dark-900 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-dark-700">
          <div className="flex items-center gap-2">
            {/* Progress dots */}
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i <= currentStep ? 'bg-violet-500' : 'bg-dark-700'
                }`}
              />
            ))}
          </div>
          <button
            onClick={skipOnboarding}
            className="p-1.5 text-dark-400 hover:text-white rounded-lg hover:bg-dark-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {renderStepContent()}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-dark-700 bg-dark-800/50">
          <div>
            {currentStep > 0 && currentStepData?.id !== 'complete' && (
              <Button
                variant="ghost"
                onClick={prevStep}
                icon={ChevronLeft}
              >
                Voltar
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {currentStepData?.id !== 'complete' && (
              <button
                onClick={skipOnboarding}
                className="px-3 py-2 text-sm text-dark-400 hover:text-white transition-colors"
              >
                Pular
              </button>
            )}
            <Button
              onClick={nextStep}
              disabled={!canProceed()}
              icon={currentStepData?.id === 'complete' ? Check : ChevronRight}
              iconPosition="right"
            >
              {currentStepData?.id === 'complete' ? 'Começar' : 'Continuar'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
