import { useMemo, useState } from 'react'
import { Tag, Plus, Trash2, Edit2, Search } from 'lucide-react'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useTags } from '../hooks/useFirestore'

const TAG_SEARCH_DEBOUNCE_MS = 300

function foldForSearch(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

export default function Tags() {
  const { tags, loading, addTag, updateTag, deleteTag } = useTags()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTag, setEditingTag] = useState(null)
  const [tagName, setTagName] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [tagToDelete, setTagToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [tagSearchQuery, setTagSearchQuery] = useState('')
  const debouncedTagSearch = useDebouncedValue(tagSearchQuery, TAG_SEARCH_DEBOUNCE_MS)

  const filteredTags = useMemo(() => {
    const q = debouncedTagSearch.trim()
    if (!q) return tags
    const needle = foldForSearch(q)
    return tags.filter(t => foldForSearch(t).includes(needle))
  }, [tags, debouncedTagSearch])

  const openNewModal = () => {
    setEditingTag(null)
    setTagName('')
    setModalOpen(true)
  }

  const openEditModal = (tag) => {
    setEditingTag(tag)
    setTagName(tag)
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!tagName.trim()) return

    try {
      setSaving(true)
      if (editingTag) {
        await updateTag(editingTag, tagName.trim())
      } else {
        await addTag(tagName.trim())
      }
      setModalOpen(false)
      setTagName('')
      setEditingTag(null)
    } catch (error) {
      console.error('Error saving tag:', error)
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = (tag) => {
    setTagToDelete(tag)
    setDeleteModalOpen(true)
  }

  const handleDelete = async () => {
    if (!tagToDelete) return

    try {
      setDeleting(true)
      await deleteTag(tagToDelete)
      setDeleteModalOpen(false)
      setTagToDelete(null)
    } catch (error) {
      console.error('Error deleting tag:', error)
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Tags</h2>
          <p className="text-sm text-dark-400">Gerencie suas tags</p>
        </div>
        <Button onClick={openNewModal} icon={Plus} size="sm">
          Nova
        </Button>
      </div>

      {/* Tags List */}
      {tags.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="Nenhuma tag"
          description="Crie tags para organizar seus lançamentos"
          action={
            <Button onClick={openNewModal} icon={Plus}>
              Nova Tag
            </Button>
          }
        />
      ) : (
        <Card>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500 pointer-events-none" />
              <input
                type="search"
                value={tagSearchQuery}
                onChange={(e) => setTagSearchQuery(e.target.value)}
                placeholder="Filtrar por nome..."
                autoComplete="off"
                aria-label="Filtrar tags"
                className="w-full pl-10 pr-4 py-2.5 bg-dark-800 border border-dark-700 rounded-xl text-sm text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50"
              />
            </div>
          </div>
          <div className="space-y-2">
            {filteredTags.length === 0 ? (
              <p className="text-sm text-dark-400 text-center py-8">
                Nenhuma tag encontrada para essa busca.
              </p>
            ) : (
              filteredTags.map((tag) => (
                <div
                  key={tag}
                  className="flex items-center justify-between p-3 bg-dark-800/30 rounded-xl border border-dark-700/30"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
                      <Tag className="w-4 h-4 text-violet-400" />
                    </div>
                    <span className="text-white font-medium">{tag}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(tag)}
                      className="p-2 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => confirmDelete(tag)}
                      className="p-2 text-dark-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {/* Modal Nova/Editar Tag */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingTag ? 'Editar Tag' : 'Nova Tag'}
      >
        <div className="space-y-4">
          <Input
            label="Nome da tag"
            type="text"
            placeholder="Digite o nome..."
            value={tagName}
            onChange={(e) => setTagName(e.target.value)}
            autoFocus
          />

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
              onClick={handleSave}
              variant="primary"
              loading={saving}
              disabled={!tagName.trim()}
              className="flex-1"
            >
              {editingTag ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Confirmar Exclusão */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Excluir Tag"
      >
        <div className="space-y-4">
          <p className="text-dark-300">
            Tem certeza que deseja excluir a tag{' '}
            <span className="text-white font-medium">{tagToDelete}</span>?
          </p>
          <p className="text-sm text-dark-400">
            A tag será removida, mas os lançamentos que a utilizam não serão afetados.
          </p>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeleteModalOpen(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleDelete}
              variant="danger"
              loading={deleting}
              className="flex-1"
            >
              Excluir
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
