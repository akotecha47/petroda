import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import AdminNav from '../../components/admin/AdminNav'

const QUICK_LINKS = [
  { label: 'User Management', to: '/app/admin/users', desc: 'Manage staff accounts and roles' },
  { label: 'Station Management', to: '/app/admin/stations', desc: 'Stations, locations and tanks' },
  { label: 'Thresholds & Rules', to: '/app/admin/thresholds', desc: 'Configure variance alert limits' },
  { label: 'Payment Methods', to: '/app/admin/payment-methods', desc: 'Cash movement categories' },
  { label: 'Fuel Prices', to: '/app/admin/fuel-prices', desc: 'Price history and updates' },
  { label: 'Investigations', to: '/app/admin/investigations', desc: 'Flags and audit log' },
]

const ACTION_LABELS = {
  insert: 'Created',
  update: 'Updated',
  delete: 'Deleted',
}

export default function AdminHome() {
  const { user } = useAuth()
  const [kpis, setKpis] = useState({ users: 0, stations: 0, openFlags: 0, pendingDips: 0 })
  const [recentActivity, setRecentActivity] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    async function load() {
      setLoading(true)
      const [
        { count: usersCount },
        { count: stationsCount },
        { count: openFlagsCount },
        { count: pendingDipsCount },
        { data: activity },
      ] = await Promise.all([
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('stations').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('flags_investigations').select('id', { count: 'exact', head: true }).in('status', ['detected', 'under_investigation']),
        supabase.from('flags_investigations').select('id', { count: 'exact', head: true }).eq('flag_type', 'dip_verification').eq('status', 'detected'),
        supabase.from('audit_log')
          .select('id, action, target_table, created_at, station_id, users!actor_id(full_name), stations(name)')
          .order('created_at', { ascending: false })
          .limit(10),
      ])
      setKpis({
        users: usersCount ?? 0,
        stations: stationsCount ?? 0,
        openFlags: openFlagsCount ?? 0,
        pendingDips: pendingDipsCount ?? 0,
      })
      setRecentActivity(activity ?? [])
      setLoading(false)
    }
    load()
  }, [user])

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <div className="max-w-6xl mx-auto px-6 py-8">
        <h1 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-6">Admin Dashboard</h1>

        <div className="grid grid-cols-4 gap-4 mb-8">
          {loading ? (
            [...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 h-24 animate-pulse" />
            ))
          ) : (
            <>
              {[
                { label: 'Active Users', value: kpis.users, color: 'text-gray-900' },
                { label: 'Active Stations', value: kpis.stations, color: 'text-gray-900' },
                { label: 'Open Flags', value: kpis.openFlags, color: kpis.openFlags > 0 ? 'text-amber-600' : 'text-gray-900' },
                { label: 'Pending Dip Verifications', value: kpis.pendingDips, color: kpis.pendingDips > 0 ? 'text-amber-600' : 'text-gray-900' },
              ].map(c => (
                <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-5">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">{c.label}</p>
                  <p className={`text-2xl font-bold leading-none ${c.color}`}>{c.value}</p>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          {QUICK_LINKS.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 hover:shadow-sm transition-all"
            >
              <p className="font-medium text-gray-800 mb-1">{link.label}</p>
              <p className="text-sm text-gray-400">{link.desc}</p>
            </Link>
          ))}
        </div>

        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">Recent Activity</h2>
        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-5 h-32 animate-pulse" />
        ) : recentActivity.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-5 text-sm text-gray-400">No recent activity.</div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Time</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Actor</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Action</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Target</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Station</th>
                </tr>
              </thead>
              <tbody>
                {recentActivity.map(log => (
                  <tr key={log.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-5 py-3 text-gray-500 whitespace-nowrap text-xs">
                      {new Date(log.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-5 py-3 text-gray-700">{log.users?.full_name ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-500 capitalize">{ACTION_LABELS[log.action] ?? log.action}</td>
                    <td className="px-5 py-3 text-gray-500">{log.target_table?.replace('_', ' ')}</td>
                    <td className="px-5 py-3 text-gray-500">{log.stations?.name ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
