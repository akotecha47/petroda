import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

export default function AdminHome() {
  const { user, signOut } = useAuth()
  const [pendingRecon, setPendingRecon] = useState(null)
  const [openFlags, setOpenFlags] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ count: recon }, { count: flags }] = await Promise.all([
        supabase.from('daily_sales_forms')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'submitted'),
        supabase.from('flags_investigations')
          .select('id', { count: 'exact', head: true })
          .neq('status', 'resolved'),
      ])
      setPendingRecon(recon ?? 0)
      setOpenFlags(flags ?? 0)
      setLoading(false)
    }
    load()
  }, [])

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-6 py-4 flex items-center justify-between" style={{ backgroundColor: '#06476B' }}>
        <div>
          <p className="text-white font-bold text-lg tracking-tight">Petroda</p>
          <p className="text-sm" style={{ color: '#89c4d4' }}>Head Office Operations</p>
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
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">Status</p>

        <div className="grid grid-cols-2 gap-4 mb-8">
          {loading ? (
            <>
              <div className="bg-white rounded-2xl border border-gray-200 p-5 h-24 animate-pulse" />
              <div className="bg-white rounded-2xl border border-gray-200 p-5 h-24 animate-pulse" />
            </>
          ) : (
            <>
              <Link
                to="/admin/reconciliation"
                className="bg-white rounded-2xl border border-gray-200 p-5 hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Pending Recon</p>
                <p className={`text-3xl font-bold leading-none ${pendingRecon > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
                  {pendingRecon}
                </p>
                <p className="text-xs text-gray-400 mt-1">forms awaiting</p>
              </Link>
              <Link
                to="/admin/investigations"
                className="bg-white rounded-2xl border border-gray-200 p-5 hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Open Flags</p>
                <p className={`text-3xl font-bold leading-none ${openFlags > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                  {openFlags}
                </p>
                <p className="text-xs text-gray-400 mt-1">need review</p>
              </Link>
            </>
          )}
        </div>

        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Quick Actions</p>
        <div className="space-y-3">
          <AdminLink to="/admin/reconciliation" label="Reconciliation" desc="Run and review daily recon" primary />
          <AdminLink to="/admin/investigations" label="Flags & Investigations" desc="Review open flags" navy />
          <AdminLink to="/admin/users" label="User Management" />
          <AdminLink to="/admin/fuel-prices" label="Fuel Prices" />
        </div>
      </div>
    </div>
  )
}

function AdminLink({ to, label, desc, primary, navy }) {
  const base = 'flex items-center justify-between w-full px-5 py-4 rounded-xl font-medium transition-opacity'
  const inner = (
    <span>
      {label}
      {desc && <span className="block text-xs font-normal opacity-70 mt-0.5">{desc}</span>}
    </span>
  )
  if (primary) return (
    <Link to={to} className={`${base} text-white hover:opacity-90`} style={{ backgroundColor: '#1988A3' }}>
      {inner}<span className="text-white/60">→</span>
    </Link>
  )
  if (navy) return (
    <Link to={to} className={`${base} text-white hover:opacity-90`} style={{ backgroundColor: '#06476B' }}>
      {inner}<span className="text-white/60">→</span>
    </Link>
  )
  return (
    <Link to={to} className={`${base} bg-white border border-gray-200 text-gray-800 hover:bg-gray-50`}>
      {inner}<span className="text-gray-400">→</span>
    </Link>
  )
}
