import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const NAV_LINKS = [
  { to: '/app/owner', label: 'Overview' },
  { to: '/app/owner/compare', label: 'Station Comparison' },
  { to: '/app/owner/sales', label: 'Sales & Revenue' },
  { to: '/app/owner/stock', label: 'Stock & Supply' },
  { to: '/app/owner/variance', label: 'Variance & Losses' },
]

export default function OwnerNav() {
  const { user, signOut } = useAuth()
  const { pathname } = useLocation()

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-1">
        <span className="font-semibold text-gray-800 mr-4">Petroda · Owner</span>
        {NAV_LINKS.map(link => (
          <Link
            key={link.to}
            to={link.to}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              pathname === link.to
                ? 'bg-gray-900 text-white'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>
      <div className="flex items-center gap-4 text-sm">
        <span className="text-xs text-gray-300">Built by Streamline</span>
        <Link to="/app/profile" className="text-gray-500 hover:text-gray-800">{user?.full_name}</Link>
        <button onClick={signOut} className="text-gray-500 hover:text-gray-800">Sign out</button>
      </div>
    </div>
  )
}
