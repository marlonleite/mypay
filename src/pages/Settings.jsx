import { useState } from 'react'
import {
  Settings as SettingsIcon,
  AlertTriangle,
  Bell,
  BellOff,
  Smartphone,
  Download
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { usePushNotifications } from '../hooks/usePushNotifications'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import ExportModal from '../components/export/ExportModal'

export default function Settings() {
  const { user } = useAuth()
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

      {/* Danger Zone */}
      <Card className="border-red-500/20">
        <h2 className="text-sm font-medium text-red-400 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          Zona de Perigo
        </h2>

        <div className="p-4 bg-dark-800/50 rounded-xl">
          <p className="text-white font-medium">Resetar Todos os Dados</p>
          <p className="text-sm text-dark-400 mt-1">
            Disponível após cutover completo para o novo backend.
          </p>
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
