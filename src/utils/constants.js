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
