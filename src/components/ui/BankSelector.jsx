import { useState } from 'react'
import { Search, Check } from 'lucide-react'
import Modal from './Modal'
import { BRAZILIAN_BANKS } from '../../utils/bankIcons'

export default function BankSelector({ isOpen, onClose, onSelect, selectedBankId }) {
  const [searchTerm, setSearchTerm] = useState('')

  const filteredBanks = BRAZILIAN_BANKS.filter(bank =>
    bank.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleSelect = (bankId) => {
    onSelect(bankId)
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Selecionar Banco"
    >
      <div className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
          <input
            type="text"
            placeholder="Buscar banco..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-dark-800 border border-dark-700 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:border-violet-500"
          />
        </div>

        {/* Bank Grid */}
        <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto">
          {filteredBanks.map(bank => {
            const isSelected = bank.id === selectedBankId

            return (
              <button
                key={bank.id}
                onClick={() => handleSelect(bank.id)}
                className={`relative flex items-center gap-3 p-3 rounded-xl transition-all ${
                  isSelected
                    ? 'bg-violet-500/20 ring-2 ring-violet-500'
                    : 'bg-dark-800 hover:bg-dark-700'
                }`}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2 w-5 h-5 bg-violet-500 rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}

                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                  style={{ backgroundColor: `${bank.color}20` }}
                >
                  {bank.emoji}
                </div>

                <span className="text-sm text-white font-medium text-left flex-1">
                  {bank.name}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </Modal>
  )
}
