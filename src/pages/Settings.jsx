import { useState, useEffect } from 'react'
import {
  Settings as SettingsIcon,
  Bell,
  BellOff,
  Smartphone,
  Download,
  Tag
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { useCategories } from '../hooks/useFirestore'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Select from '../components/ui/Select'
import ExportModal from '../components/export/ExportModal'
import { fetchSettings, updateSettings } from '../services/settingsService'
import { TRANSACTION_TYPES } from '../utils/constants'

export default function Settings() {
  const { user } = useAuth()
  const {
    getMainCategories,
    loading: categoriesLoading
  } = useCategories()
  const {
    isSupported: pushSupported,
    permission: pushPermission,
    isEnabled: pushEnabled,
    loading: pushLoading,
    error: pushError,
    enablePush,
    disablePush,
    sendTestNotification
  } = usePushNotifications()
  const [showExportModal, setShowExportModal] = useState(false)
  const [defaultExpenseId, setDefaultExpenseId] = useState('')
  const [defaultIncomeId, setDefaultIncomeId] = useState('')
  const [defaultsLoading, setDefaultsLoading] = useState(true)
  const [defaultsSaving, setDefaultsSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!user) {
        setDefaultsLoading(false)
        return
      }
      try {
        const s = await fetchSettings()
        if (cancelled || !s) return
        setDefaultExpenseId(s.defaultCategoryIdExpense || '')
        setDefaultIncomeId(s.defaultCategoryIdIncome || '')
      } catch (err) {
        console.error('Erro ao carregar categorias padrão:', err)
      } finally {
        if (!cancelled) setDefaultsLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [user])

  const expenseDefaultOptions = [
    { value: '', label: 'Nenhuma (deixar vazio no servidor)' },
    ...getMainCategories(TRANSACTION_TYPES.EXPENSE).map((c) => ({ value: c.id, label: c.name }))
  ]

  const incomeDefaultOptions = [
    { value: '', label: 'Nenhuma (deixar vazio no servidor)' },
    ...getMainCategories(TRANSACTION_TYPES.INCOME).map((c) => ({ value: c.id, label: c.name }))
  ]

  const handleSaveDefaultCategories = async () => {
    try {
      setDefaultsSaving(true)
      await updateSettings({
        defaultCategoryIdExpense: defaultExpenseId || null,
        defaultCategoryIdIncome: defaultIncomeId || null
      })
    } catch (err) {
      console.error('Erro ao salvar categorias padrão:', err)
    } finally {
      setDefaultsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-dark-800 rounded-xl flex items-center justify-center">
          <SettingsIcon className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Configurações</h1>
          <p className="text-sm text-dark-400">Gerencie seu app</p>
        </div>
      </div>

      {/* Push Notifications */}
      <Card>
        <h2 className="text-sm font-medium text-dark-300 mb-4 flex items-center gap-2">
          <Bell className="w-4 h-4" />
          Notificacoes Push
        </h2>

        <div className="space-y-4">
          {!pushSupported ? (
            <div className="flex items-center gap-3 p-4 bg-dark-800/50 rounded-xl">
              <BellOff className="w-5 h-5 text-dark-400" />
              <div>
                <p className="text-white font-medium">Nao suportado</p>
                <p className="text-sm text-dark-400">
                  Seu navegador nao suporta notificacoes push
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between p-4 bg-dark-800/50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    pushEnabled ? 'bg-emerald-500/20' : 'bg-dark-700'
                  }`}>
                    {pushEnabled ? (
                      <Bell className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <BellOff className="w-5 h-5 text-dark-400" />
                    )}
                  </div>
                  <div>
                    <p className="text-white font-medium">
                      {pushEnabled ? 'Notificacoes ativas' : 'Notificacoes desativadas'}
                    </p>
                    <p className="text-sm text-dark-400">
                      {pushEnabled
                        ? 'Voce recebera alertas de vencimentos e faturas'
                        : 'Ative para receber alertas no celular'}
                    </p>
                  </div>
                </div>
                <Button
                  variant={pushEnabled ? 'ghost' : 'primary'}
                  onClick={pushEnabled ? disablePush : enablePush}
                  loading={pushLoading}
                  icon={pushEnabled ? BellOff : Bell}
                >
                  {pushEnabled ? 'Desativar' : 'Ativar'}
                </Button>
              </div>

              {pushPermission === 'denied' && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <p className="text-sm text-red-400">
                    Permissao bloqueada. Habilite nas configuracoes do navegador.
                  </p>
                </div>
              )}

              {pushError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <p className="text-sm text-red-400">{pushError}</p>
                </div>
              )}

              {pushEnabled && (
                <div className="flex items-center justify-between p-4 bg-dark-800/50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Smartphone className="w-5 h-5 text-violet-400" />
                    <div>
                      <p className="text-white font-medium">Testar notificacao</p>
                      <p className="text-sm text-dark-400">
                        Envie uma notificacao de teste
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={sendTestNotification}
                    size="sm"
                  >
                    Testar
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </Card>

      {/* Default categories */}
      <Card>
        <h2 className="text-sm font-medium text-dark-300 mb-4 flex items-center gap-2">
          <Tag className="w-4 h-4" />
          Categorias padrão
        </h2>
        <p className="text-sm text-dark-400 mb-4">
          Ao criar um lançamento sem escolher categoria (e quando o servidor aplicar a mesma regra),
          usamos estes IDs como despesa ou receita. Transferências não recebem padrão automático no servidor.
        </p>
        <div className="space-y-4">
          <Select
            label="Padrão para despesas"
            value={defaultExpenseId}
            onChange={(e) => setDefaultExpenseId(e.target.value)}
            options={expenseDefaultOptions}
            disabled={defaultsLoading || categoriesLoading}
          />
          <Select
            label="Padrão para receitas"
            value={defaultIncomeId}
            onChange={(e) => setDefaultIncomeId(e.target.value)}
            options={incomeDefaultOptions}
            disabled={defaultsLoading || categoriesLoading}
          />
          <Button
            variant="primary"
            onClick={handleSaveDefaultCategories}
            loading={defaultsSaving}
            disabled={defaultsLoading || categoriesLoading}
          >
            Salvar categorias padrão
          </Button>
        </div>
      </Card>

      {/* Export Data */}
      <Card>
        <h2 className="text-sm font-medium text-dark-300 mb-4 flex items-center gap-2">
          <Download className="w-4 h-4" />
          Exportar Dados
        </h2>

        <div className="flex items-center justify-between p-4 bg-dark-800/50 rounded-xl">
          <div>
            <p className="text-white font-medium">Exportar para CSV/JSON</p>
            <p className="text-sm text-dark-400">
              Baixe seus dados em formato de planilha ou backup
            </p>
          </div>
          <Button
            variant="primary"
            onClick={() => setShowExportModal(true)}
            icon={Download}
          >
            Exportar
          </Button>
        </div>
      </Card>

      {/* User Info */}
      <Card>
        <h2 className="text-sm font-medium text-dark-300 mb-4">Conta</h2>
        <div className="flex items-center gap-3 p-3 bg-dark-800/50 rounded-xl">
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName}
              className="w-10 h-10 rounded-full"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center">
              <span className="text-violet-400 font-medium">
                {user?.displayName?.charAt(0) || user?.email?.charAt(0) || '?'}
              </span>
            </div>
          )}
          <div>
            <p className="text-white font-medium">{user?.displayName || 'Usuário'}</p>
            <p className="text-sm text-dark-400">{user?.email}</p>
          </div>
        </div>
      </Card>

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
      />
    </div>
  )
}
