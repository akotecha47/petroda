import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const NAV_LINKS = [
  { label: 'Dashboard', to: '/app/admin' },
  { label: 'Users', to: '/app/admin/users' },
  { label: 'Stations', to: '/app/admin/stations' },
  { label: 'Thresholds', to: '/app/admin/thresholds' },
  { label: 'Payment Methods', to: '/app/admin/payment-methods' },
  { label: 'Fuel Prices', to: '/app/admin/fuel-prices' },
  { label: 'Investigations', to: '/app/admin/investigations' },
]

export default function AdminNav() {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="relative">
      <div className="bg-white border-b border-gray-200 px-6 py-0 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="font-semibold text-gray-800 mr-4 py-3">Petroda · Admin</span>
          <div className="hidden md:flex items-center">
            {NAV_LINKS.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className={`px-3 py-3 text-sm font-medium border-b-2 transition-colors ${
                  location.pathname === link.to
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="hidden md:inline text-xs text-gray-300">Built by Streamline</span>
          <Link to="/app/profile" className="hidden md:inline text-gray-500 hover:text-gray-800">{user?.full_name}</Link>
          <button onClick={handleSignOut} className="hidden md:inline text-gray-500 hover:text-gray-800">Sign out</button>
          <button
            className="md:hidden flex flex-col gap-1 p-1"
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Open menu"
          >
            <div className="w-5 h-0.5 bg-gray-700" />
            <div className="w-5 h-0.5 bg-gray-700" />
            <div className="w-5 h-0.5 bg-gray-700" />
          </button>
        </div>
      </div>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className="md:hidden absolute top-full left-0 right-0 bg-white border-b border-gray-200 z-50">
            {NAV_LINKS.map(link => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMenuOpen(false)}
                className="block py-3 px-6 text-sm text-gray-700 border-b border-gray-100 last:border-0 hover:bg-gray-50"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
