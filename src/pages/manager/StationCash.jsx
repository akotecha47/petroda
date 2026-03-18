import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { cashBalance } from '../../lib/cashUtils'

const DIRECTION_BADGE = {
  in: 'bg-green-100 text-green-700',
  out: 'bg-red-100 text-red-700',
}

export default function StationCash() {
  const { user } = useAuth()
  const [stationName, setStationName] = useState('')
  const [balance, setBalance] = useState({ balance: 0, totalIn: 0, totalOut: 0 })
  const [movements, setMovements] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.station_id) return
    supabase
      .from('stations')
      .select('name')
      .eq('id', user.station_id)
      .single()
      .then(({ data }) => { if (data) setStationName(data.name) })
  }, [user?.station_id])

  useEffect(() => {
    if (!user?.station_id) return
    async function load() {
      setLoading(true)

      const [bal, { data: movData }] = await Promise.all([
        cashBalance(user.station_id),
        supabase
          .from('cash_movements')
          .select('id, direction, amount, movement_datetime, reference_note, category_id, recorded_by, payment_categories(name)')
          .eq('station_id', user.station_id)
          .order('movement_datetime', { ascending: false }),
      ])

      setBalance(bal)

      const recordedByIds = [...new Set((movData ?? []).map(m => m.recorded_by).filter(Boolean))]
      const nameMap = {}
      if (recordedByIds.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, full_name')
          .in('id', recordedByIds)
        users?.forEach(u => { nameMap[u.id] = u.full_name })
      }

      setMovements((movData ?? []).map(m => ({ ...m, recordedByName: nameMap[m.recorded_by] ?? '—' })))
      setLoading(false)
    }
    load()
  }, [user?.station_id])

  if (!user) return null

  const filtered = filter === 'all' ? movements : movements.filter(m => m.direction === filter)

  const fmt = n => n.toLocaleString(undefined, { maximumFractionDigits: 0 })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3">
        <Link to="/app/manager" className="text-gray-400 hover:text-gray-700 text-sm">← Dashboard</Link>
        <span className="text-gray-300">|</span>
        <span className="font-semibold text-gray-800">Cash — {stationName}</span>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {loading ? (
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 h-24 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { label: 'Balance', value: balance.balance, color: balance.balance >= 0 ? 'text-gray-900' : 'text-red-600' },
              { label: 'Total In', value: balance.totalIn, color: 'text-green-700' },
              { label: 'Total Out', value: balance.totalOut, color: 'text-red-700' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-200 p-6">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">{label}</p>
                <p className={`text-2xl font-bold leading-none ${color}`}>
                  {fmt(value)}
                  <span className="text-sm font-normal text-gray-400 ml-1">MWK</span>
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400">Movements</h2>
          <div className="flex gap-2">
            {['all', 'in', 'out'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
                  filter === f ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {f === 'all' ? 'All' : f === 'in' ? 'In' : 'Out'}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Date/Time</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Direction</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Category</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Amount (MWK)</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Reference</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Recorded By</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => (
                <tr key={m.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(m.movement_datetime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium uppercase ${DIRECTION_BADGE[m.direction] ?? 'bg-gray-100 text-gray-500'}`}>
                      {m.direction}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{m.payment_categories?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-800">{(m.amount ?? 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{m.reference_note || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{m.recordedByName}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-400">No movements recorded</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Link
          to="/app/manager/cash/new"
          className="bg-gray-900 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-gray-700 transition-colors inline-block"
        >
          Record Movement
        </Link>
      </div>
    </div>
  )
}
