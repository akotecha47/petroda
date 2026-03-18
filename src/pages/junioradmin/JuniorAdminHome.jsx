import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

const FLAG_TYPE_LABELS = {
  stock_variance: 'Stock Variance',
  payment_variance: 'Payment Variance',
  positive_variance: 'Positive Variance',
  low_stock: 'Low Stock',
  other: 'Other',
}

export default function JuniorAdminHome() {
  const { user, signOut } = useAuth()
  const [kpis, setKpis] = useState({ pendingDips: 0, openFlags: 0 })
  const [escalatedFlags, setEscalatedFlags] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    async function load() {
      setLoading(true)
      const [{ count: dipCount }, { count: flagCount }, { data: escalated }] = await Promise.all([
        supabase
          .from('dip_entries')
          .select('id', { count: 'exact', head: true })
          .eq('is_verified', false),
        supabase
          .from('flags_investigations')
          .select('id', { count: 'exact', head: true })
          .in('status', ['detected', 'under_investigation', 'corrected']),
        supabase
          .from('flags_investigations')
          .select('id, flag_type, severity, raised_at, station_id, stations(name), shifts(shift_date, shift_type)')
          .eq('status', 'escalated')
          .order('raised_at', { ascending: false }),
      ])
      setKpis({ pendingDips: dipCount ?? 0, openFlags: flagCount ?? 0 })
      setEscalatedFlags(escalated ?? [])
      setLoading(false)
    }
    load()
  }, [user])

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <span className="font-semibold text-gray-800">Petroda · Junior Admin</span>
        <div className="flex items-center gap-4 text-sm">
          <Link to="/app/profile" className="text-gray-500 hover:text-gray-800">{user.full_name}</Link>
          <button onClick={signOut} className="text-gray-500 hover:text-gray-800">Sign out</button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">Overview</h2>
        {loading ? (
          <div className="grid grid-cols-2 gap-4 mb-8">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 h-24 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Pending Verifications</p>
              <p className={`text-2xl font-bold leading-none ${kpis.pendingDips > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
                {kpis.pendingDips}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Open Flags</p>
              <p className={`text-2xl font-bold leading-none ${kpis.openFlags > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
                {kpis.openFlags}
              </p>
            </div>
          </div>
        )}

        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3 mb-8">
          <Link
            to="/app/junior-admin/dip-verify"
            className="bg-gray-900 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Dip Verification
          </Link>
          <span className="bg-white border border-gray-200 text-gray-300 text-sm font-medium px-5 py-2.5 rounded-lg cursor-not-allowed">
            Station Monitoring
          </span>
        </div>

        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">Escalated Flags</h2>
        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-5 h-24 animate-pulse" />
        ) : escalatedFlags.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-5 text-sm text-gray-400">
            No escalated flags.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {escalatedFlags.map((flag, i) => (
              <div
                key={flag.id}
                className={`px-5 py-4 flex items-center justify-between gap-4 ${i < escalatedFlags.length - 1 ? 'border-b border-gray-50' : ''}`}
              >
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {FLAG_TYPE_LABELS[flag.flag_type] ?? flag.flag_type}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 capitalize">
                    {flag.stations?.name}
                    {flag.shifts && ` · ${flag.shifts.shift_date} ${flag.shifts.shift_type} shift`}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-xs px-2.5 py-1 rounded-full bg-red-100 text-red-700 font-medium">Escalated</span>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(flag.raised_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
