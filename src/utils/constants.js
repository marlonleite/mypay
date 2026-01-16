// Categorias de receita
export const INCOME_CATEGORIES = [
  { id: 'salary', name: 'Salário', icon: 'Briefcase' },
  { id: 'freelance', name: 'Freelance', icon: 'Laptop' },
  { id: 'investments', name: 'Investimentos', icon: 'TrendingUp' },
  { id: 'other', name: 'Outros', icon: 'MoreHorizontal' }
]

// Categorias de despesa
export const EXPENSE_CATEGORIES = [
  { id: 'food', name: 'Alimentação', icon: 'Utensils' },
  { id: 'transport', name: 'Transporte', icon: 'Car' },
  { id: 'housing', name: 'Moradia', icon: 'Home' },
  { id: 'health', name: 'Saúde', icon: 'Heart' },
  { id: 'leisure', name: 'Lazer', icon: 'Gamepad2' },
  { id: 'education', name: 'Educação', icon: 'GraduationCap' },
  { id: 'card_payment', name: 'Pagamento de Cartão', icon: 'CreditCard' },
  { id: 'other', name: 'Outros', icon: 'MoreHorizontal' }
]

// Cores disponíveis para cartões
export const CARD_COLORS = [
  { id: 'violet', name: 'Violeta', class: 'bg-violet-600', hex: '#7c3aed' },
  { id: 'indigo', name: 'Índigo', class: 'bg-indigo-600', hex: '#4f46e5' },
  { id: 'blue', name: 'Azul', class: 'bg-blue-600', hex: '#2563eb' },
  { id: 'emerald', name: 'Esmeralda', class: 'bg-emerald-600', hex: '#059669' },
  { id: 'orange', name: 'Laranja', class: 'bg-orange-600', hex: '#ea580c' },
  { id: 'red', name: 'Vermelho', class: 'bg-red-600', hex: '#dc2626' },
  { id: 'pink', name: 'Rosa', class: 'bg-pink-600', hex: '#db2777' },
  { id: 'slate', name: 'Cinza', class: 'bg-slate-600', hex: '#475569' }
]

// Meses do ano
export const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril',
  'Maio', 'Junho', 'Julho', 'Agosto',
  'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

// Tipos de transação
export const TRANSACTION_TYPES = {
  INCOME: 'income',
  EXPENSE: 'expense'
}

// Frequências para despesas fixas
export const FIXED_FREQUENCIES = [
  { id: 'daily', name: 'Diário', days: 1 },
  { id: 'weekly', name: 'Semanal', days: 7 },
  { id: 'biweekly', name: 'Quinzenal', days: 15 },
  { id: 'monthly', name: 'Mensal', months: 1 },
  { id: 'bimonthly', name: 'Bimestral', months: 2 },
  { id: 'quarterly', name: 'Trimestral', months: 3 },
  { id: 'semiannual', name: 'Semestral', months: 6 },
  { id: 'annual', name: 'Anual', months: 12 }
]

// Períodos para parcelamento
export const INSTALLMENT_PERIODS = [
  { id: 'days', name: 'Dias', days: 1 },
  { id: 'weeks', name: 'Semanas', days: 7 },
  { id: 'biweeks', name: 'Quinzenas', days: 15 },
  { id: 'months', name: 'Meses', months: 1 },
  { id: 'bimonths', name: 'Bimestres', months: 2 },
  { id: 'quarters', name: 'Trimestres', months: 3 },
  { id: 'semesters', name: 'Semestres', months: 6 },
  { id: 'years', name: 'Anos', months: 12 }
]

// Tipos de documento para importação
export const DOCUMENT_TYPES = [
  { id: 'auto', name: 'Auto-detectar', icon: 'Sparkles' },
  { id: 'comprovante', name: 'Comprovante', icon: 'Receipt' },
  { id: 'boleto', name: 'Boleto', icon: 'Barcode' },
  { id: 'pix', name: 'PIX', icon: 'QrCode' },
  { id: 'ted', name: 'TED/DOC', icon: 'ArrowLeftRight' },
  { id: 'fatura', name: 'Fatura de Cartão', icon: 'CreditCard' },
  { id: 'extrato', name: 'Extrato Bancário', icon: 'FileText' },
  { id: 'nf', name: 'Nota Fiscal', icon: 'FileCheck' },
  { id: 'recibo', name: 'Recibo', icon: 'ClipboardCheck' }
]

// Tipos de arquivo suportados
export const SUPPORTED_FILE_TYPES = {
  images: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'],
  documents: ['application/pdf']
}

// Tamanho máximo de arquivo (10MB)
export const MAX_FILE_SIZE = 10 * 1024 * 1024

// Ícones disponíveis para categorias
export const CATEGORY_ICONS = [
  { id: 'Tag', name: 'Tag' },
  { id: 'Utensils', name: 'Alimentação' },
  { id: 'Car', name: 'Carro' },
  { id: 'Home', name: 'Casa' },
  { id: 'Heart', name: 'Saúde' },
  { id: 'Gamepad2', name: 'Lazer' },
  { id: 'GraduationCap', name: 'Educação' },
  { id: 'Briefcase', name: 'Trabalho' },
  { id: 'Laptop', name: 'Tecnologia' },
  { id: 'TrendingUp', name: 'Investimentos' },
  { id: 'ShoppingBag', name: 'Compras' },
  { id: 'Shirt', name: 'Roupas' },
  { id: 'Plane', name: 'Viagem' },
  { id: 'Coffee', name: 'Café' },
  { id: 'Gift', name: 'Presente' },
  { id: 'Dumbbell', name: 'Academia' },
  { id: 'Music', name: 'Música' },
  { id: 'Film', name: 'Streaming' },
  { id: 'Phone', name: 'Telefone' },
  { id: 'Wifi', name: 'Internet' },
  { id: 'Zap', name: 'Energia' },
  { id: 'Droplet', name: 'Água' },
  { id: 'Baby', name: 'Filhos' },
  { id: 'PawPrint', name: 'Pet' },
  { id: 'Scissors', name: 'Beleza' },
  { id: 'Pill', name: 'Remédio' },
  { id: 'Bus', name: 'Transporte' },
  { id: 'Fuel', name: 'Combustível' },
  { id: 'Building2', name: 'Empresa' },
  { id: 'Wallet', name: 'Carteira' },
  { id: 'PiggyBank', name: 'Poupança' },
  { id: 'Banknote', name: 'Dinheiro' },
  { id: 'MoreHorizontal', name: 'Outros' }
]

// Cores disponíveis para categorias
export const CATEGORY_COLORS = [
  { id: 'violet', name: 'Violeta', class: 'bg-violet-500', hex: '#8b5cf6' },
  { id: 'indigo', name: 'Índigo', class: 'bg-indigo-500', hex: '#6366f1' },
  { id: 'blue', name: 'Azul', class: 'bg-blue-500', hex: '#3b82f6' },
  { id: 'cyan', name: 'Ciano', class: 'bg-cyan-500', hex: '#06b6d4' },
  { id: 'emerald', name: 'Esmeralda', class: 'bg-emerald-500', hex: '#10b981' },
  { id: 'green', name: 'Verde', class: 'bg-green-500', hex: '#22c55e' },
  { id: 'lime', name: 'Lima', class: 'bg-lime-500', hex: '#84cc16' },
  { id: 'yellow', name: 'Amarelo', class: 'bg-yellow-500', hex: '#eab308' },
  { id: 'orange', name: 'Laranja', class: 'bg-orange-500', hex: '#f97316' },
  { id: 'red', name: 'Vermelho', class: 'bg-red-500', hex: '#ef4444' },
  { id: 'pink', name: 'Rosa', class: 'bg-pink-500', hex: '#ec4899' },
  { id: 'slate', name: 'Cinza', class: 'bg-slate-500', hex: '#64748b' }
]
