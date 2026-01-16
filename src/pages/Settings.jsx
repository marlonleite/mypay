import { useState } from 'react'
import {
  Settings as SettingsIcon,
  Trash2,
  AlertTriangle,
  Check,
  Loader2
} from 'lucide-react'
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  writeBatch
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../contexts/AuthContext'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'

// Coleções para deletar
const COLLECTIONS = [
  { id: 'transactions', name: 'Transações' },
  { id: 'cardExpenses', name: 'Despesas de Cartão' },
  { id: 'cards', name: 'Cartões' },
  { id: 'accounts', name: 'Contas' },
  { id: 'categories', name: 'Categorias' },
  { id: 'tags', name: 'Tags' },
  { id: 'budgets', name: 'Orçamentos' },
  { id: 'billPayments', name: 'Pagamentos de Fatura' },
  { id: 'transfers', name: 'Transferências' }
]

export default function Settings() {
  const { user } = useAuth()
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [counting, setCounting] = useState(false)
  const [progress, setProgress] = useState(null)
  const [counts, setCounts] = useState({})
  const [completed, setCompleted] = useState(false)
  const [error, setError] = useState(null)

  // Contar documentos antes de deletar
  const countDocuments = async () => {
    if (!user) return

    try {
      setCounting(true)
      const newCounts = {}
      let total = 0

      for (const col of COLLECTIONS) {
        const colRef = collection(db, `users/${user.uid}/${col.id}`)
        const snapshot = await getDocs(colRef)
        newCounts[col.id] = snapshot.size
        total += snapshot.size
      }

      newCounts.total = total
      setCounts(newCounts)
      return total
    } catch (err) {
      console.error('Erro ao contar documentos:', err)
      setError('Erro ao carregar dados: ' + err.message)
      return 0
    } finally {
      setCounting(false)
    }
  }

  // Abrir modal e contar documentos
  const handleOpenResetModal = () => {
    setShowResetModal(true)
    setCompleted(false)
    setError(null)
    setProgress(null)
    setCounts({})
    // Contar após o modal abrir
    setTimeout(() => countDocuments(), 100)
  }

  // Deletar uma coleção
  const deleteCollection = async (collectionId) => {
    const colRef = collection(db, `users/${user.uid}/${collectionId}`)
    const snapshot = await getDocs(colRef)

    if (snapshot.empty) return 0

    // Deletar em batches de 500 (limite do Firestore)
    const batchSize = 500
    let deleted = 0

    while (deleted < snapshot.docs.length) {
      const batch = writeBatch(db)
      const chunk = snapshot.docs.slice(deleted, deleted + batchSize)

      chunk.forEach(docSnap => {
        batch.delete(doc(db, `users/${user.uid}/${collectionId}`, docSnap.id))
      })

      await batch.commit()
      deleted += chunk.length
    }

    return snapshot.size
  }

  // Resetar todos os dados
  const handleResetData = async () => {
    if (!user) return

    try {
      setResetting(true)
      setError(null)
      let totalDeleted = 0

      for (const col of COLLECTIONS) {
        if (counts[col.id] > 0) {
          setProgress({ collection: col.name, status: 'deleting' })
          const deleted = await deleteCollection(col.id)
          totalDeleted += deleted
          setProgress({ collection: col.name, status: 'done', count: deleted })
        }
      }

      setProgress({ collection: 'Concluído', status: 'complete', total: totalDeleted })
      setCompleted(true)
    } catch (err) {
      console.error('Erro ao resetar dados:', err)
      setError(err.message || 'Erro ao deletar dados')
    } finally {
      setResetting(false)
    }
  }

  const handleCloseModal = () => {
    if (!resetting) {
      setShowResetModal(false)
      setProgress(null)
      setCounts({})
      setCompleted(false)
      setError(null)
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

      {/* Danger Zone */}
      <Card className="border-red-500/20">
        <h2 className="text-sm font-medium text-red-400 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          Zona de Perigo
        </h2>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-dark-800/50 rounded-xl">
            <div>
              <p className="text-white font-medium">Resetar Todos os Dados</p>
              <p className="text-sm text-dark-400">
                Apaga todas as transações, cartões, contas e categorias
              </p>
            </div>
            <Button
              variant="danger"
              onClick={handleOpenResetModal}
              icon={Trash2}
            >
              Resetar
            </Button>
          </div>
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

      {/* Reset Modal */}
      <Modal
        isOpen={showResetModal}
        onClose={handleCloseModal}
        title="Resetar Dados"
      >
        <div className="space-y-4">
          {!completed ? (
            <>
              {/* Warning */}
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-400 font-medium">Atenção!</p>
                    <p className="text-sm text-red-400/80 mt-1">
                      Esta ação é irreversível. Todos os seus dados serão permanentemente excluídos.
                    </p>
                  </div>
                </div>
              </div>

              {/* Loading state */}
              {counting && (
                <div className="p-4 bg-dark-800 rounded-xl text-center">
                  <Loader2 className="w-8 h-8 text-violet-400 mx-auto mb-2 animate-spin" />
                  <p className="text-white">Contando documentos...</p>
                </div>
              )}

              {/* Document counts */}
              {!counting && counts.total !== undefined && counts.total > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-dark-300 font-medium">
                    Dados a serem excluídos:
                  </p>
                  <div className="bg-dark-800 rounded-xl p-3 space-y-2">
                    {COLLECTIONS.map(col => (
                      counts[col.id] > 0 && (
                        <div key={col.id} className="flex justify-between text-sm">
                          <span className="text-dark-400">{col.name}</span>
                          <span className="text-white">{counts[col.id]} itens</span>
                        </div>
                      )
                    ))}
                    <div className="flex justify-between text-sm pt-2 border-t border-dark-700">
                      <span className="text-dark-300 font-medium">Total</span>
                      <span className="text-red-400 font-bold">{counts.total} itens</span>
                    </div>
                  </div>
                </div>
              )}

              {!counting && counts.total === 0 && (
                <div className="p-4 bg-dark-800 rounded-xl text-center">
                  <Check className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-white">Nenhum dado encontrado</p>
                  <p className="text-sm text-dark-400">Seu banco já está limpo!</p>
                </div>
              )}

              {/* Progress */}
              {progress && !completed && (
                <div className="p-3 bg-dark-800 rounded-xl">
                  <div className="flex items-center gap-2">
                    {progress.status === 'deleting' ? (
                      <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4 text-emerald-400" />
                    )}
                    <span className="text-sm text-white">
                      {progress.status === 'deleting'
                        ? `Deletando ${progress.collection}...`
                        : `${progress.collection}: ${progress.count} deletados`}
                    </span>
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="ghost"
                  onClick={handleCloseModal}
                  disabled={resetting}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  variant="danger"
                  onClick={handleResetData}
                  loading={resetting}
                  disabled={counting || counts.total === 0 || resetting}
                  className="flex-1"
                >
                  {resetting ? 'Deletando...' : 'Confirmar Reset'}
                </Button>
              </div>
            </>
          ) : (
            /* Success state */
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Reset Concluído!</h3>
              <p className="text-dark-400 mb-4">
                {progress?.total || 0} itens foram excluídos com sucesso.
              </p>
              <Button onClick={handleCloseModal} className="w-full">
                Fechar
              </Button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
