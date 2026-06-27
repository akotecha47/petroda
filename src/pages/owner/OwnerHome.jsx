import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function OwnerHome() {
  const { user, signOut } = useAuth()
  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-6 py-4 flex items-center justify-between" style={{ backgroundColor: '#06476B' }}>
        <div>
          <p className="text-white font-bold text-lg tracking-tight">Petroda</p>
          <p className="text-sm" style={{ color: '#89c4d4' }}>System Configuration</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-white text-sm hidden sm:block">{user.full_name}</span>
          <button
            onClick={signOut}
            className="text-sm px-3 py-1.5 rounded-lg text-white hover:bg-white/10 transition-colors border border-white/30"
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-6 py-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Configuration</p>
        <div className="space-y-3">
          <ConfigLink to="/owner/fuel-prices" label="Fuel Prices" />
          <ConfigLink to="/owner/lubricant-prices" label="Lubricant Prices" />
          <ConfigLink to="/owner/thresholds" label="Variance Thresholds" />
        </div>
      </div>
    </div>
  )
}

function ConfigLink({ to, label }) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between w-full px-5 py-4 rounded-xl font-medium transition-colors bg-white border border-gray-200 text-gray-800 hover:bg-gray-50"
    >
      <span>{label}</span>
      <span className="text-gray-400">→</span>
    </Link>
  )
}
