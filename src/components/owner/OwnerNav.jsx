import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const NAV_LINKS = [
  { to: '/app/owner', label: 'Overview' },
  { to: '/app/owner/compare', label: 'Station Comparison' },
  { to: '/app/owner/sales', label: 'Sales & Revenue' },
  { to: '/app/owner/stock', label: 'Stock & Supply' },
  { to: '/app/owner/variance', label: 'Variance & Losses' },
]

const TAB_ICONS = {
  Stock: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 2C10 2 5 7.5 5 11.5a5 5 0 0010 0C15 7.5 10 2 10 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
      <path d="M7.5 12a2.5 2.5 0 005 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  Overview: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="11" y="3" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="3" y="11" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="11" y="11" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  ),
  Revenue: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="11" width="3" height="6" rx="0.5" fill="currentColor"/>
      <rect x="8.5" y="7" width="3" height="10" rx="0.5" fill="currentColor"/>
      <rect x="14" y="3" width="3" height="14" rx="0.5" fill="currentColor"/>
    </svg>
  ),
  Alerts: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 2.5a5.5 5.5 0 00-5.5 5.5v3l-1 2h13l-1-2V8A5.5 5.5 0 0010 2.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
      <path d="M8.5 13v.5a1.5 1.5 0 003 0V13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
}

const BOTTOM_TABS = [
  { to: '/app/owner/stock', label: 'Stock' },
  { to: '/app/owner', label: 'Overview' },
  { to: '/app/owner/sales', label: 'Revenue' },
  { to: '/app/owner/variance', label: 'Alerts' },
]

export default function OwnerNav() {
  const { user, signOut } = useAuth()
  const { pathname } = useLocation()

  return (
    <>
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="font-semibold text-gray-800 mr-4">Petroda · Owner</span>
          <div className="hidden md:flex items-center gap-1">
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
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="hidden md:inline text-xs text-gray-300">Built by Streamline</span>
          <Link to="/app/profile" className="hidden md:inline text-gray-500 hover:text-gray-800">{user?.full_name}</Link>
          <button onClick={signOut} className="text-gray-500 hover:text-gray-800">Sign out</button>
        </div>
      </div>

      {/* Mobile bottom tab bar */}
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-50"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 8px)' }}
      >
        {BOTTOM_TABS.map(tab => {
          const active = pathname === tab.to
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className="flex-1 flex flex-col items-center pt-2 pb-1"
            >
              <span className={`mb-1 ${active ? 'text-gray-900' : 'text-gray-400'}`}>
                {TAB_ICONS[tab.label]}
              </span>
              <span className={`text-xs ${active ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>
    </>
  )
}
