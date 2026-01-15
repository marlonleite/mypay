import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wallet, Chrome, AlertCircle, Loader2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const { loginWithGoogle, error, clearError } = useAuth()
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleGoogleLogin = async () => {
    try {
      setLoading(true)
      clearError()
      await loginWithGoogle()
      navigate('/')
    } catch (error) {
      console.error('Login error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 mb-4 shadow-lg shadow-violet-600/20">
            <Wallet className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">myPay</h1>
          <p className="text-dark-400">Controle financeiro pessoal</p>
        </div>

        {/* Login Card */}
        <div className="bg-dark-900/80 backdrop-blur-xl border border-dark-700 rounded-2xl p-8 shadow-xl">
          <h2 className="text-xl font-semibold text-white text-center mb-2">
            Bem-vindo!
          </h2>
          <p className="text-dark-400 text-center mb-6">
            Entre com sua conta Google para começar
          </p>

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl mb-6">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Google Login Button */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white hover:bg-gray-50 text-gray-800 font-medium rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Chrome className="w-5 h-5" />
                <span>Continuar com Google</span>
              </>
            )}
          </button>

          <p className="text-xs text-dark-500 text-center mt-6">
            Ao continuar, você concorda com nossos termos de uso e política de privacidade.
          </p>
        </div>

        {/* Features */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          <div className="p-4">
            <div className="text-2xl mb-2">💰</div>
            <p className="text-sm text-dark-400">Controle suas receitas</p>
          </div>
          <div className="p-4">
            <div className="text-2xl mb-2">💳</div>
            <p className="text-sm text-dark-400">Gerencie cartões</p>
          </div>
          <div className="p-4">
            <div className="text-2xl mb-2">📊</div>
            <p className="text-sm text-dark-400">Acompanhe gastos</p>
          </div>
        </div>
      </div>
    </div>
  )
}
