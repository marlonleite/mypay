import { useState, useMemo } from 'react'
import {
  Search,
  X,
  Plus,
  List,
  Grid3X3,
  ChevronRight,
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
  CreditCard,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  Check
} from 'lucide-react'
import Modal from '../ui/Modal'
import Input from '../ui/Input'
import Button from '../ui/Button'
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../../utils/constants'

// Mapa de ícones
const ICON_MAP = {
  Tag, Utensils, Car, Home, Heart, Gamepad2, GraduationCap,
  Briefcase, Laptop, TrendingUp, ShoppingBag, Shirt, Plane,
  Coffee, Gift, Dumbbell, Music, Film, Phone, Wifi, Zap,
  Droplet, Baby, PawPrint, Scissors, Pill, Bus, Fuel,
  Building2, Wallet, PiggyBank, Banknote, MoreHorizontal,
  CreditCard, ArrowUpRight, ArrowDownLeft, ArrowLeftRight
}

// Cores padrão para categorias built-in
const DEFAULT_CATEGORY_COLORS = {
  // Income
  salary: 'emerald',
  freelance: 'blue',
  investments: 'violet',
  transfer_in: 'cyan',
  // Expense
  food: 'orange',
  transport: 'blue',
  housing: 'indigo',
  health: 'red',
  leisure: 'pink',
  education: 'violet',
  card_payment: 'slate',
  transfer_out: 'cyan',
  other: 'slate'
}

export default function CategorySelector({
  value,
  onChange,
  categories = [],
  type = 'expense', // 'income' ou 'expense'
  onCreateCategory,
  placeholder = 'Selecione uma categoria'
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState('list') // 'list' ou 'grid'
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryIcon, setNewCategoryIcon] = useState('Tag')
  const [newCategoryColor, setNewCategoryColor] = useState('violet')
  const [creating, setCreating] = useState(false)

  // Encontrar categoria selecionada
  const selectedCategory = useMemo(() => {
    return categories.find(c => c.id === value)
  }, [categories, value])

  // Filtrar categorias pela busca
  const filteredCategories = useMemo(() => {
    if (!searchTerm.trim()) return categories

    const term = searchTerm.toLowerCase()
    return categories.filter(c =>
      c.name.toLowerCase().includes(term)
    )
  }, [categories, searchTerm])

  // Obter ícone da categoria
  const getCategoryIcon = (category) => {
    const iconName = category.icon || 'Tag'
    return ICON_MAP[iconName] || Tag
  }

  // Obter cor da categoria
  const getCategoryColor = (category) => {
    const colorId = category.color || DEFAULT_CATEGORY_COLORS[category.id] || 'slate'
    const colorObj = CATEGORY_COLORS.find(c => c.id === colorId)
    return colorObj?.hex || '#64748b'
  }

  const handleSelect = (categoryId) => {
    onChange(categoryId)
    setIsOpen(false)
    setSearchTerm('')
  }

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim() || !onCreateCategory) return

    try {
      setCreating(true)
      await onCreateCategory({
        name: newCategoryName.trim(),
        type,
        icon: newCategoryIcon,
        color: newCategoryColor
      })
      setNewCategoryName('')
      setNewCategoryIcon('Tag')
      setNewCategoryColor('violet')
      setShowCreateForm(false)
    } catch (error) {
      console.error('Erro ao criar categoria:', error)
    } finally {
      setCreating(false)
    }
  }

  const SelectedIcon = selectedCategory ? getCategoryIcon(selectedCategory) : Tag

  return (
    <>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-dark-800 border border-dark-700 rounded-xl text-left hover:border-dark-600 transition-colors"
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            backgroundColor: selectedCategory
              ? `${getCategoryColor(selectedCategory)}20`
              : 'rgba(100, 116, 139, 0.2)'
          }}
        >
          <SelectedIcon
            className="w-4 h-4"
            style={{
              color: selectedCategory
                ? getCategoryColor(selectedCategory)
                : '#64748b'
            }}
          />
        </div>
        <span className={`flex-1 ${selectedCategory ? 'text-white' : 'text-dark-500'}`}>
          {selectedCategory?.name || placeholder}
        </span>
        <ChevronRight className="w-4 h-4 text-dark-500" />
      </button>

      {/* Selection Modal */}
      <Modal
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false)
          setSearchTerm('')
          setShowCreateForm(false)
        }}
        title="Selecionar categoria"
      >
        <div className="space-y-4">
          {/* Search & View Toggle */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
              <input
                type="text"
                placeholder="Buscar categoria..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-dark-800 border border-dark-700 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:border-violet-500"
              />
            </div>
            <div className="flex bg-dark-800 rounded-xl p-1">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === 'list'
                    ? 'bg-dark-700 text-white'
                    : 'text-dark-400 hover:text-white'
                }`}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-dark-700 text-white'
                    : 'text-dark-400 hover:text-white'
                }`}
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Create Category Button */}
          {onCreateCategory && !showCreateForm && (
            <button
              type="button"
              onClick={() => setShowCreateForm(true)}
              className="w-full flex items-center gap-3 p-3 bg-dark-800/50 hover:bg-dark-800 border border-dashed border-dark-600 rounded-xl text-dark-400 hover:text-white transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-dark-700 flex items-center justify-center">
                <Plus className="w-4 h-4" />
              </div>
              <span>Criar categoria</span>
            </button>
          )}

          {/* Create Category Form */}
          {showCreateForm && (
            <div className="p-4 bg-dark-800/50 rounded-xl border border-dark-700 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-dark-300">Nova categoria</span>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="p-1 text-dark-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <Input
                placeholder="Nome da categoria"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
              />

              {/* Icon selector */}
              <div>
                <label className="block text-xs text-dark-400 mb-2">Ícone</label>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-dark-900 rounded-lg">
                  {CATEGORY_ICONS.slice(0, 20).map(icon => {
                    const IconComp = ICON_MAP[icon.id] || Tag
                    return (
                      <button
                        key={icon.id}
                        type="button"
                        onClick={() => setNewCategoryIcon(icon.id)}
                        className={`p-2 rounded-lg transition-colors ${
                          newCategoryIcon === icon.id
                            ? 'bg-violet-500/20 text-violet-400'
                            : 'text-dark-400 hover:text-white hover:bg-dark-700'
                        }`}
                      >
                        <IconComp className="w-4 h-4" />
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Color selector */}
              <div>
                <label className="block text-xs text-dark-400 mb-2">Cor</label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORY_COLORS.map(color => (
                    <button
                      key={color.id}
                      type="button"
                      onClick={() => setNewCategoryColor(color.id)}
                      className={`w-7 h-7 rounded-full transition-all ${
                        newCategoryColor === color.id
                          ? 'ring-2 ring-white ring-offset-2 ring-offset-dark-900'
                          : ''
                      }`}
                      style={{ backgroundColor: color.hex }}
                    />
                  ))}
                </div>
              </div>

              <Button
                onClick={handleCreateCategory}
                loading={creating}
                disabled={!newCategoryName.trim()}
                className="w-full"
              >
                Criar categoria
              </Button>
            </div>
          )}

          {/* Categories List */}
          <div className={`max-h-64 overflow-y-auto ${
            viewMode === 'grid' ? 'grid grid-cols-3 gap-2' : 'space-y-1'
          }`}>
            {filteredCategories.length === 0 ? (
              <div className="text-center py-8 text-dark-400">
                Nenhuma categoria encontrada
              </div>
            ) : (
              filteredCategories.map(category => {
                const Icon = getCategoryIcon(category)
                const color = getCategoryColor(category)
                const isSelected = category.id === value

                if (viewMode === 'grid') {
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => handleSelect(category.id)}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-colors ${
                        isSelected
                          ? 'bg-violet-500/20 border border-violet-500/30'
                          : 'bg-dark-800/50 hover:bg-dark-800 border border-transparent'
                      }`}
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: `${color}20` }}
                      >
                        <Icon className="w-5 h-5" style={{ color }} />
                      </div>
                      <span className="text-xs text-white text-center truncate w-full">
                        {category.name}
                      </span>
                    </button>
                  )
                }

                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => handleSelect(category.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
                      isSelected
                        ? 'bg-violet-500/20'
                        : 'hover:bg-dark-800'
                    }`}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${color}20` }}
                    >
                      <Icon className="w-5 h-5" style={{ color }} />
                    </div>
                    <span className="flex-1 text-left text-white">
                      {category.name}
                    </span>
                    {isSelected && (
                      <Check className="w-5 h-5 text-violet-400" />
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>
      </Modal>
    </>
  )
}
