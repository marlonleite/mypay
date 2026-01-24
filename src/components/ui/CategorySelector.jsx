import { useState, useMemo } from 'react'
import { Search, Plus, Check, X, Grid3x3, List } from 'lucide-react'
import Modal from './Modal'
import Input from './Input'
import Button from './Button'
import { CATEGORY_ICONS, CATEGORY_COLORS } from '../../utils/constants'

export default function CategorySelector({
  isOpen,
  onClose,
  onSelect,
  selectedCategoryId,
  categories = [],
  type = 'expense',
  onCreateCategory
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState('grid') // 'grid' or 'list'
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryIcon, setNewCategoryIcon] = useState('circle')
  const [newCategoryColor, setNewCategoryColor] = useState('violet')

  // Filter categories by type and search term
  const filteredCategories = useMemo(() => {
    return categories.filter(cat => {
      const matchesType = cat.type === type
      const matchesSearch = searchTerm === '' ||
        cat.name.toLowerCase().includes(searchTerm.toLowerCase())
      const isNotArchived = !cat.archived
      return matchesType && matchesSearch && isNotArchived
    })
  }, [categories, type, searchTerm])

  const handleSelect = (categoryId) => {
    onSelect(categoryId)
    onClose()
  }

  const handleCreateCategory = () => {
    if (!newCategoryName.trim()) return

    if (onCreateCategory) {
      onCreateCategory({
        name: newCategoryName.trim(),
        type: type,
        icon: newCategoryIcon,
        color: newCategoryColor
      })
    }

    // Reset form
    setNewCategoryName('')
    setNewCategoryIcon('circle')
    setNewCategoryColor('violet')
    setShowCreateForm(false)
    onClose()
  }

  const getCategoryIcon = (iconId) => {
    const icon = CATEGORY_ICONS.find(i => i.id === iconId)
    return icon?.emoji || '⚪'
  }

  const getCategoryColorClass = (colorId) => {
    const color = CATEGORY_COLORS.find(c => c.id === colorId)
    return color?.class || 'bg-violet-500'
  }

  const getCategoryColorHex = (colorId) => {
    const color = CATEGORY_COLORS.find(c => c.id === colorId)
    return color?.hex || '#8b5cf6'
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Selecionar Categoria"
      hideHeader={false}
    >
      <div className="space-y-4">
        {/* Search and Actions */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
            <input
              type="text"
              placeholder="Buscar categoria..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-dark-800 border border-dark-700 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:border-violet-500"
            />
          </div>

          {/* View Toggle */}
          <div className="flex bg-dark-800 rounded-xl border border-dark-700 p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'list' ? 'bg-dark-700 text-white' : 'text-dark-400 hover:text-white'
              }`}
              title="Lista"
            >
              <List className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'grid' ? 'bg-dark-700 text-white' : 'text-dark-400 hover:text-white'
              }`}
              title="Grade"
            >
              <Grid3x3 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Create Category Button */}
        {!showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="w-full flex items-center justify-center gap-2 p-3 bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 rounded-xl transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span className="font-medium">Nova Categoria</span>
          </button>
        )}

        {/* Create Category Form */}
        {showCreateForm && (
          <div className="p-4 bg-dark-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-white">Nova Categoria</h3>
              <button
                onClick={() => {
                  setShowCreateForm(false)
                  setNewCategoryName('')
                }}
                className="p-1 text-dark-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <Input
              type="text"
              placeholder="Nome da categoria"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleCreateCategory()
                }
              }}
            />

            {/* Icon Picker */}
            <div>
              <label className="block text-xs text-dark-400 mb-2">Ícone</label>
              <div className="grid grid-cols-8 gap-2 max-h-32 overflow-y-auto">
                {CATEGORY_ICONS.map(icon => (
                  <button
                    key={icon.id}
                    type="button"
                    onClick={() => setNewCategoryIcon(icon.id)}
                    className={`w-10 h-10 flex items-center justify-center text-xl rounded-lg transition-all ${
                      newCategoryIcon === icon.id
                        ? 'bg-violet-500/30 ring-2 ring-violet-500'
                        : 'bg-dark-700 hover:bg-dark-600'
                    }`}
                  >
                    {icon.emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Color Picker */}
            <div>
              <label className="block text-xs text-dark-400 mb-2">Cor</label>
              <div className="flex gap-2 flex-wrap">
                {CATEGORY_COLORS.map(color => (
                  <button
                    key={color.id}
                    type="button"
                    onClick={() => setNewCategoryColor(color.id)}
                    className={`w-8 h-8 rounded-lg ${color.class} transition-all ${
                      newCategoryColor === color.id
                        ? 'ring-2 ring-white ring-offset-2 ring-offset-dark-800'
                        : 'opacity-60 hover:opacity-100'
                    }`}
                    title={color.name}
                  />
                ))}
              </div>
            </div>

            <Button
              onClick={handleCreateCategory}
              fullWidth
              disabled={!newCategoryName.trim()}
            >
              Criar Categoria
            </Button>
          </div>
        )}

        {/* Categories Display */}
        {viewMode === 'grid' ? (
          /* Grid View */
          <div className="grid grid-cols-3 gap-3 max-h-[50vh] overflow-y-auto">
            {filteredCategories.map(category => {
              const isSelected = category.id === selectedCategoryId
              const icon = getCategoryIcon(category.icon)
              const colorClass = getCategoryColorClass(category.color)

              return (
                <button
                  key={category.id}
                  onClick={() => handleSelect(category.id)}
                  className={`relative flex flex-col items-center gap-2 p-4 rounded-xl transition-all ${
                    isSelected
                      ? 'bg-violet-500/20 ring-2 ring-violet-500'
                      : 'bg-dark-800 hover:bg-dark-700'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-1 right-1 w-5 h-5 bg-violet-500 rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                  <div className={`w-12 h-12 rounded-full ${colorClass} flex items-center justify-center text-2xl`}>
                    {icon}
                  </div>
                  <span className="text-xs text-center text-white font-medium line-clamp-2">
                    {category.name}
                  </span>
                </button>
              )
            })}
          </div>
        ) : (
          /* List View */
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {filteredCategories.map(category => {
              const isSelected = category.id === selectedCategoryId
              const icon = getCategoryIcon(category.icon)
              const colorHex = getCategoryColorHex(category.color)

              return (
                <button
                  key={category.id}
                  onClick={() => handleSelect(category.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                    isSelected
                      ? 'bg-violet-500/20 ring-2 ring-violet-500'
                      : 'bg-dark-800 hover:bg-dark-700'
                  }`}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0"
                    style={{ backgroundColor: `${colorHex}30` }}
                  >
                    {icon}
                  </div>
                  <span className="text-sm text-white font-medium flex-1 text-left">
                    {category.name}
                  </span>
                  {isSelected && (
                    <Check className="w-5 h-5 text-violet-400 flex-shrink-0" />
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* Empty State */}
        {filteredCategories.length === 0 && !showCreateForm && (
          <div className="text-center py-8">
            <p className="text-dark-400 mb-4">
              {searchTerm ? 'Nenhuma categoria encontrada' : 'Nenhuma categoria disponível'}
            </p>
            {!searchTerm && (
              <Button onClick={() => setShowCreateForm(true)} icon={Plus}>
                Criar Primeira Categoria
              </Button>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
