import { Loader2 } from 'lucide-react'

export default function Loading({ text = 'Carregando...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Loader2 className="w-8 h-8 text-violet-500 animate-spin mb-3" />
      <p className="text-dark-400 text-sm">{text}</p>
    </div>
  )
}

export function LoadingScreen() {
  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-violet-500 animate-spin mx-auto mb-4" />
        <p className="text-dark-400">Carregando...</p>
      </div>
    </div>
  )
}
