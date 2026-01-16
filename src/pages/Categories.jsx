import { useState, useMemo } from 'react'
import {
  Plus,
  Edit2,
  Archive,
  Trash2,
  ChevronDown,
  ChevronRight,
  FolderInput,
  Tag,
  Utensils,
  Car,
  Home,
  Heart,
  Gamepad2,
  GraduationCap,
  Briefcase,
  Laptop,
  TrendingUp,
  ShoppingBag,
  Shirt,
  Plane,
  Coffee,
  Gift,
  Dumbbell,
  Music,
  Film,
  Phone,
  Wifi,
  Zap,
  Droplet,
  Baby,
  PawPrint,
  Scissors,
  Pill,
  Bus,
  Fuel,
  Building2,
  Wallet,
  PiggyBank,
  Banknote,
  MoreHorizontal,
  RotateCcw,
  Sparkles
} from 'lucide-react'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Loading from '../components/ui/Loading'
import EmptyState from '../components/ui/EmptyState'
import { useCategories } from '../hooks/useFirestore'
import {
  TRANSACTION_TYPES,
  CATEGORY_ICONS,
  CATEGORY_COLORS
} from '../utils/constants'

// Mapa de ícones para renderização dinâmica
const iconMap = {
  Tag, Utensils, Car, Home, Heart, Gamepad2, GraduationCap,
  Briefcase, Laptop, TrendingUp, ShoppingBag, Shirt, Plane,
  Coffee, Gift, Dumbbell, Music, Film, Phone, Wifi, Zap,
  Droplet, Baby, PawPrint, Scissors, Pill, Bus, Fuel,
  Building2, Wallet, PiggyBank, Banknote, MoreHorizontal
}

export default function Categories() {
  const {
    categories,
    loading,
    needsInitialization,
    initializeDefaultCategories,
    addCategory,
    updateCategory,
    moveCategory,
    archiveCategory,
    restoreCategory,
    deleteCategory,
    getMainCategories,
    getSubcategories,
    getArchivedCategories
  } = useCategories()

  const [activeType, setActiveType] = useState(TRANSACTION_TYPES.EXPENSE)
  const [modalOpen, setModalOpen] = useState(false)
  const [moveModalOpen, setMoveModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)
  const [parentCategory, setParentCategory] = useState(null)
  const [movingCategory, setMovingCategory] = useState(null)
  const [deletingCategory, setDeletingCategory] = useState(null)
  const [expandedCategories, setExpandedCategories] = useState({})
  const [showArchived, setShowArchived] = useState(false)
  const [saving, setSaving] = useState(false)
  const [initializing, setInitializing] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    icon: 'Tag',
    color: 'violet'
  })

  const [selectedParentId, setSelectedParentId] = useState('')

  // Categorias do usuário
  const userCategories = useMemo(() => {
    return getMainCategories(activeType)
  }, [categories, activeType])

  const archivedCategories = useMemo(() => {
    return getArchivedCategories().filter(c => c.type === activeType)
  }, [categories, activeType])

  // Opções para mover (categorias principais do mesmo tipo, exceto a própria)
  const moveOptions = useMemo(() => {
    if (!movingCategory) return []
    const mainCats = getMainCategories(movingCategory.type)
      .filter(c => c.id !== movingCategory.id && c.id !== movingCategory.parentId)
    return [
      { value: '', label: 'Categoria principal (sem pai)' },
      ...mainCats.map(c => ({ value: c.id, label: c.name }))
    ]
  }, [movingCategory, categories])

  const handleInitialize = async () => {
    try {
      setInitializing(true)
      await initializeDefaultCategories()
    } catch (error) {
      console.error('Error initializing categories:', error)
    } finally {
      setInitializing(false)
    }
  }

  const toggleExpand = (categoryId) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }))
  }

  const openNewModal = (parent = null) => {
    setEditingCategory(null)
    setParentCategory(parent)
    setFormData({
      name: '',
      icon: 'Tag',
      color: parent?.color || 'violet'
    })
    setModalOpen(true)
  }

  const openEditModal = (category) => {
    setEditingCategory(category)
    setParentCategory(null)
    setFormData({
      name: category.name,
      icon: category.icon || 'Tag',
      color: category.color || 'violet'
    })
    setModalOpen(true)
  }

  const openMoveModal = (category) => {
    setMovingCategory(category)
    setSelectedParentId(category.parentId || '')
    setMoveModalOpen(true)
  }

  const openDeleteModal = (category) => {
    setDeletingCategory(category)
    setDeleteModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name.trim()) return

    try {
      setSaving(true)
      if (editingCategory) {
        await updateCategory(editingCategory.id, {
          name: formData.name.trim(),
          icon: formData.icon,
          color: formData.color
        })
      } else {
        await addCategory({
          name: formData.name.trim(),
          type: parentCategory?.type || activeType,
          icon: formData.icon,
          color: formData.color,
          parentId: parentCategory?.id || null
        })
      }
      setModalOpen(false)
    } catch (error) {
      console.error('Error saving category:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleMove = async () => {
    if (!movingCategory) return
    try {
      setSaving(true)
      await moveCategory(movingCategory.id, selectedParentId || null)
      setMoveModalOpen(false)
    } catch (error) {
      console.error('Error moving category:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleArchive = async (category) => {
    try {
      await archiveCategory(category.id)
      // Também arquivar subcategorias
      const subs = getSubcategories(category.id)
      for (const sub of subs) {
        await archiveCategory(sub.id)
      }
    } catch (error) {
      console.error('Error archiving category:', error)
    }
  }

  const handleRestore = async (category) => {
    try {
      await restoreCategory(category.id)
    } catch (error) {
      console.error('Error restoring category:', error)
    }
  }

  const handleDelete = async () => {
    if (!deletingCategory) return
    try {
      setSaving(true)
      await deleteCategory(deletingCategory.id)
      setDeleteModalOpen(false)
    } catch (error) {
      console.error('Error deleting category:', error)
    } finally {
      setSaving(false)
    }
  }

  const renderIcon = (iconName, className = "w-5 h-5") => {
    const IconComponent = iconMap[iconName] || Tag
    return <IconComponent className={className} />
  }

  const getColorClass = (colorId) => {
    return CATEGORY_COLORS.find(c => c.id === colorId)?.class || 'bg-violet-500'
  }

  const CategoryItem = ({ category, isSubcategory = false }) => {
    const subcategories = getSubcategories(category.id)
    const hasSubcategories = subcategories.length > 0
    const isExpanded = expandedCategories[category.id]

    return (
      <div>
        <div className={`flex items-center justify-between py-3 ${isSubcategory ? 'pl-8' : ''}`}>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {!isSubcategory && hasSubcategories && (
              <button
                onClick={() => toggleExpand(category.id)}
                className="p-1 text-dark-400 hover:text-white transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
            )}
            {!isSubcategory && !hasSubcategories && (
              <div className="w-6" />
            )}

            <div className={`p-2 rounded-lg ${getColorClass(category.color)}`}>
              {renderIcon(category.icon, 'w-4 h-4 text-white')}
            </div>

            <span className="text-sm text-white font-medium truncate">
              {category.name}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => openEditModal(category)}
              className="p-1.5 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors"
              title="Editar"
            >
              <Edit2 className="w-4 h-4" />
            </button>

            {!isSubcategory && (
              <button
                onClick={() => openNewModal(category)}
                className="p-1.5 text-dark-400 hover:text-violet-400 hover:bg-violet-500/10 rounded-lg transition-colors"
                title="Adicionar subcategoria"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={() => openMoveModal(category)}
              className="p-1.5 text-dark-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
              title="Mover"
            >
              <FolderInput className="w-4 h-4" />
            </button>

            <button
              onClick={() => handleArchive(category)}
              className="p-1.5 text-dark-400 hover:text-orange-400 hover:bg-orange-500/10 rounded-lg transition-colors"
              title="Arquivar"
            >
              <Archive className="w-4 h-4" />
            </button>

            <button
              onClick={() => openDeleteModal(category)}
              className="p-1.5 text-dark-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              title="Excluir"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Subcategorias */}
        {isExpanded && subcategories.map(sub => (
          <CategoryItem key={sub.id} category={sub} isSubcategory />
        ))}
      </div>
    )
  }

  if (loading) {
    return <Loading />
  }

  // Tela de inicialização
  if (needsInitialization) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-white">Categorias</h1>
        <EmptyState
          icon={Sparkles}
          title="Configurar categorias"
          description="Clique abaixo para criar as categorias padrão (Alimentação, Transporte, Salário, etc). Você poderá editar, excluir ou criar novas depois."
          action={
            <Button onClick={handleInitialize} icon={Plus} loading={initializing}>
              Criar Categorias Padrão
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Categorias</h1>
        <Button
          onClick={() => openNewModal()}
          icon={Plus}
          size="sm"
        >
          Nova
        </Button>
      </div>

      {/* Type Tabs */}
      <div className="flex gap-2 p-1 bg-dark-800 rounded-xl">
        <button
          onClick={() => setActiveType(TRANSACTION_TYPES.EXPENSE)}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
            activeType === TRANSACTION_TYPES.EXPENSE
              ? 'bg-red-600 text-white'
              : 'text-dark-400 hover:text-white'
          }`}
        >
          Despesas
        </button>
        <button
          onClick={() => setActiveType(TRANSACTION_TYPES.INCOME)}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
            activeType === TRANSACTION_TYPES.INCOME
              ? 'bg-emerald-600 text-white'
              : 'text-dark-400 hover:text-white'
          }`}
        >
          Receitas
        </button>
      </div>

      {/* Categories List */}
      {userCategories.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="Nenhuma categoria"
          description="Crie sua primeira categoria"
          action={
            <Button onClick={() => openNewModal()} icon={Plus}>
              Nova Categoria
            </Button>
          }
        />
      ) : (
        <Card className="divide-y divide-dark-700/50">
          {userCategories.map(category => (
            <CategoryItem key={category.id} category={category} />
          ))}
        </Card>
      )}

      {/* Archived Categories */}
      {archivedCategories.length > 0 && (
        <div className="space-y-3">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="flex items-center gap-2 text-sm text-dark-400 hover:text-white transition-colors"
          >
            {showArchived ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            Arquivadas ({archivedCategories.length})
          </button>

          {showArchived && (
            <Card className="divide-y divide-dark-700/50 opacity-60">
              {archivedCategories.map(category => (
                <div key={category.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-6" />
                    <div className={`p-2 rounded-lg ${getColorClass(category.color)} opacity-50`}>
                      {renderIcon(category.icon, 'w-4 h-4 text-white')}
                    </div>
                    <span className="text-sm text-dark-400 line-through">
                      {category.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleRestore(category)}
                      className="p-1.5 text-dark-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                      title="Restaurar"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openDeleteModal(category)}
                      className="p-1.5 text-dark-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Excluir permanentemente"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </div>
      )}

      {/* Modal Criar/Editar Categoria */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          editingCategory
            ? 'Editar Categoria'
            : parentCategory
              ? `Nova Subcategoria de ${parentCategory.name}`
              : `Nova Categoria de ${activeType === TRANSACTION_TYPES.INCOME ? 'Receita' : 'Despesa'}`
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nome da categoria"
            type="text"
            placeholder="Ex: Academia, Streaming..."
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />

          {/* Seletor de Ícone */}
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">
              Ícone
            </label>
            <div className="grid grid-cols-8 gap-2 p-3 bg-dark-800 rounded-xl max-h-40 overflow-y-auto">
              {CATEGORY_ICONS.map(icon => (
                <button
                  key={icon.id}
                  type="button"
                  onClick={() => setFormData({ ...formData, icon: icon.id })}
                  className={`p-2 rounded-lg transition-all ${
                    formData.icon === icon.id
                      ? `${getColorClass(formData.color)} text-white`
                      : 'bg-dark-700 text-dark-400 hover:text-white'
                  }`}
                  title={icon.name}
                >
                  {renderIcon(icon.id, 'w-4 h-4')}
                </button>
              ))}
            </div>
          </div>

          {/* Seletor de Cor */}
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">
              Cor
            </label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_COLORS.map(color => (
                <button
                  key={color.id}
                  type="button"
                  onClick={() => setFormData({ ...formData, color: color.id })}
                  className={`w-8 h-8 rounded-full ${color.class} transition-all ${
                    formData.color === color.id
                      ? 'ring-2 ring-white ring-offset-2 ring-offset-dark-900 scale-110'
                      : 'hover:scale-110'
                  }`}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="flex items-center gap-3 p-3 bg-dark-800 rounded-xl">
            <div className={`p-2 rounded-lg ${getColorClass(formData.color)}`}>
              {renderIcon(formData.icon, 'w-5 h-5 text-white')}
            </div>
            <span className="text-white font-medium">
              {formData.name || 'Nome da categoria'}
            </span>
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
              variant="primary"
              loading={saving}
              disabled={!formData.name.trim()}
              className="flex-1"
            >
              {editingCategory ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Mover Categoria */}
      <Modal
        isOpen={moveModalOpen}
        onClose={() => setMoveModalOpen(false)}
        title={`Mover "${movingCategory?.name}"`}
      >
        <div className="space-y-4">
          <p className="text-sm text-dark-400">
            Escolha para onde mover esta categoria. Selecione uma categoria principal para transformá-la em subcategoria, ou deixe vazio para torná-la uma categoria principal.
          </p>

          <Select
            label="Mover para"
            value={selectedParentId}
            onChange={(e) => setSelectedParentId(e.target.value)}
            options={moveOptions}
          />

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setMoveModalOpen(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleMove}
              variant="primary"
              loading={saving}
              className="flex-1"
            >
              Mover
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Confirmar Exclusão */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Excluir categoria"
      >
        <div className="space-y-4">
          <p className="text-sm text-dark-400">
            Tem certeza que deseja excluir <strong className="text-white">"{deletingCategory?.name}"</strong> permanentemente?
          </p>
          {deletingCategory && getSubcategories(deletingCategory.id).length > 0 && (
            <p className="text-sm text-orange-400">
              Atenção: As subcategorias também serão excluídas.
            </p>
          )}
          <p className="text-xs text-dark-500">
            Lançamentos que usam esta categoria não serão excluídos, mas ficarão sem categoria.
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
              loading={saving}
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
