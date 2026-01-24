// Brazilian Bank Icons and Colors
export const BRAZILIAN_BANKS = [
  {
    id: 'nubank',
    name: 'Nubank',
    color: '#820AD1',
    emoji: '💜',
    textColor: 'text-purple-600'
  },
  {
    id: 'inter',
    name: 'Banco Inter',
    color: '#FF7A00',
    emoji: '🧡',
    textColor: 'text-orange-500'
  },
  {
    id: 'c6',
    name: 'C6 Bank',
    color: '#000000',
    emoji: '⬛',
    textColor: 'text-gray-900'
  },
  {
    id: 'bradesco',
    name: 'Bradesco',
    color: '#CC092F',
    emoji: '🔴',
    textColor: 'text-red-600'
  },
  {
    id: 'itau',
    name: 'Itaú',
    color: '#EC7000',
    emoji: '🟠',
    textColor: 'text-orange-600'
  },
  {
    id: 'bb',
    name: 'Banco do Brasil',
    color: '#FFD500',
    emoji: '💛',
    textColor: 'text-yellow-500'
  },
  {
    id: 'santander',
    name: 'Santander',
    color: '#EC0000',
    emoji: '❤️',
    textColor: 'text-red-500'
  },
  {
    id: 'caixa',
    name: 'Caixa',
    color: '#0057A8',
    emoji: '💙',
    textColor: 'text-blue-600'
  },
  {
    id: 'xp',
    name: 'XP Investimentos',
    color: '#000000',
    emoji: '⚫',
    textColor: 'text-gray-900'
  },
  {
    id: 'rico',
    name: 'Rico',
    color: '#FF6B00',
    emoji: '🟠',
    textColor: 'text-orange-500'
  },
  {
    id: 'btg',
    name: 'BTG Pactual',
    color: '#000080',
    emoji: '🔵',
    textColor: 'text-blue-900'
  },
  {
    id: 'picpay',
    name: 'PicPay',
    color: '#21C25E',
    emoji: '💚',
    textColor: 'text-green-500'
  },
  {
    id: 'mercadopago',
    name: 'Mercado Pago',
    color: '#009EE3',
    emoji: '💙',
    textColor: 'text-blue-500'
  },
  {
    id: 'pagbank',
    name: 'PagBank',
    color: '#FFD700',
    emoji: '💛',
    textColor: 'text-yellow-400'
  },
  {
    id: 'neon',
    name: 'Neon',
    color: '#00D9E1',
    emoji: '💎',
    textColor: 'text-cyan-400'
  },
  {
    id: 'next',
    name: 'Next',
    color: '#00AB63',
    emoji: '💚',
    textColor: 'text-green-600'
  },
  {
    id: 'original',
    name: 'Banco Original',
    color: '#00A868',
    emoji: '💚',
    textColor: 'text-green-500'
  },
  {
    id: 'safra',
    name: 'Safra',
    color: '#003A70',
    emoji: '🔵',
    textColor: 'text-blue-800'
  },
  {
    id: 'sicoob',
    name: 'Sicoob',
    color: '#00652E',
    emoji: '💚',
    textColor: 'text-green-700'
  },
  {
    id: 'sicredi',
    name: 'Sicredi',
    color: '#00843D',
    emoji: '💚',
    textColor: 'text-green-600'
  },
  {
    id: 'generic',
    name: 'Outro',
    color: '#6B7280',
    emoji: '🏦',
    textColor: 'text-gray-500'
  }
]

export const getBankById = (bankId) => {
  return BRAZILIAN_BANKS.find(bank => bank.id === bankId) || BRAZILIAN_BANKS[BRAZILIAN_BANKS.length - 1]
}

export const getBankIcon = (bankId) => {
  const bank = getBankById(bankId)
  return bank.emoji
}

export const getBankColor = (bankId) => {
  const bank = getBankById(bankId)
  return bank.color
}

export const getBankName = (bankId) => {
  const bank = getBankById(bankId)
  return bank.name
}
