import { useState, useEffect, useCallback } from 'react'
import { Lock, Unlock } from 'lucide-react'
import Modal from '../ui/Modal'
import Input from '../ui/Input'
import Button from '../ui/Button'

const AUTO_FOCUS_DELAY_MS = 100

export default function PasswordModal({ isOpen, onSubmit, onCancel, isIncorrect, loading }) {
  const [password, setPassword] = useState('')

  useEffect(() => {
    if (isOpen) {
      setPassword('')
      const timer = setTimeout(() => {
        document.getElementById('pdf-password-input')?.focus()
      }, AUTO_FOCUS_DELAY_MS)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  const handleSubmit = useCallback(() => {
    if (!password.trim()) return
    onSubmit(password)
  }, [password, onSubmit])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }, [handleSubmit])

  return (
    <Modal isOpen={isOpen} onClose={onCancel} title="PDF Protegido">
      <div className="space-y-4">
        <p className="text-sm text-dark-400">
          Este PDF é protegido por senha. Digite a senha para continuar.
        </p>

        <Input
          id="pdf-password-input"
          type="password"
          label="Senha do PDF"
          placeholder="Digite a senha"
          icon={Lock}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={handleKeyDown}
          error={isIncorrect ? 'Senha incorreta. Tente novamente.' : null}
        />

        <div className="flex gap-3 pt-2">
          <Button
            onClick={handleSubmit}
            icon={Unlock}
            fullWidth
            disabled={!password.trim() || loading}
            loading={loading}
          >
            Desbloquear
          </Button>
          <Button onClick={onCancel} variant="ghost">
            Cancelar
          </Button>
        </div>
      </div>
    </Modal>
  )
}
