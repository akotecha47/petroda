import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { getDemoAdjustedRange } from '../../lib/demoOffset'
import OwnerNav from '../../components/owner/OwnerNav'

const FLAG_TYPE_LABELS = {
  stock_variance: 'Stock Variance',
  payment_variance: 'Payment Variance',
  positive_variance: 'Positive Variance',
  low_stock: 'Low Stock',
  other: 'Other',
}

const SEVERITY_BADGE = {
  warning: 'bg-amber-100 text-amber-700',
  critical: 'bg-red-100 text-red-700',
}

const STATUS_BADGE = {
  detected: 'bg-blue-100 text-blue-700',
  under_investigation: 'bg-amber-100 text-amber-700',
  corrected: 'bg-gray-100 text-gray-600',
  resolved: 'bg-green-100 text-green-700',
  escalated: 'bg-red-100 text-red-700',
}


function PeriodToggle({ period, onChange }) {
  return (
    <div className="flex gap-2">
      {['day', 'week', 'month'].map(p => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
            period === p ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          {p === 'day' ? 'Today' : p === 'week' ? 'Last 7 Days' : 'Last 30 Days'}
        </button>
      ))}
    </div>
  )
}

export default function VarianceLosses() {
  const { user } = useAuth()
  const [period, setPeriod] = useState('last30days')
  const [stations, setStations] = useState([])
  const [stationFilter, setStationFilter] = useState('all')
  const [flags, setFlags] = useState([])
  const [summary, setSummary] = useState({ totalVariance: 0, totalFlags: 0, criticalFlags: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('stations').select('id, name').eq('is_active', true).order('name')
      .then(({ data }) => setStations(data ?? []))
  }, [])

  useEffect(() => {
    if (!user) return
    async function load() {
      setLoading(true)
      const periodKey = period === 'week' ? 'last7days' : period === 'month' ? 'last30days' : period
      const { from, to } = getDemoAdjustedRange(periodKey)

      let flagsQuery = supabase
        .from('flags_investigations')
        .select('id, flag_type, severity, status, raised_at, resolution_note, station_id, stations(name), shifts(shift_date, shift_type)')
        .gte('raised_at', from + 'T00:00:00')
        .lte('raised_at', to + 'T23:59:59')
        .order('raised_at', { ascending: false })
      if (stationFilter !== 'all') {
        flagsQuery = flagsQuery.eq('station_id', stationFilter)
      }

      const { data: flagData } = await flagsQuery

      setFlags(flagData ?? [])
      setSummary({
        totalVariance: 0,
        totalFlags: (flagData ?? []).length,
        criticalFlags: (flagData ?? []).filter(f => f.severity === 'critical').length,
      })
      setLoading(false)
    }
    load()
  }, [user, period, stationFilter])

  if (!user) return null

  return (
    <div className="min-h-screen bg-slate-100 pb-20 md:pb-0">
      <OwnerNav />
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <h1 className="text-xs font-semibold uppercase tracking-widest text-gray-400">Variance & Losses</h1>
          <div className="flex-1" />
          <select
            value={stationFilter}
            onChange={e => setStationFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white"
          >
            <option value="all">All Stations</option>
            {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <PeriodToggle period={period} onChange={setPeriod} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {loading ? (
            [...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 h-24 animate-pulse" />
            ))
          ) : (
            <>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Payment Variance</p>
                <p className={`text-2xl font-bold leading-none ${summary.totalVariance > 0 ? 'text-red-600' : 'text-green-700'}`}>
                  {summary.totalVariance > 0 ? '+' : ''}{Math.round(summary.totalVariance).toLocaleString()}
                  <span className="text-sm font-normal text-gray-400 ml-1">MWK</span>
                </p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Total Flags</p>
                <p className={`text-2xl font-bold leading-none ${summary.totalFlags > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
                  {summary.totalFlags}
                </p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Critical Flags</p>
                <p className={`text-2xl font-bold leading-none ${summary.criticalFlags > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                  {summary.criticalFlags}
                </p>
              </div>
            </>
          )}
        </div>

        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">Flags</h2>
        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-5 h-32 animate-pulse mb-8" />
        ) : flags.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-5 text-sm text-gray-400 mb-8">
            No flags for this period.
          </div>
        ) : (
          <>
            {/* Mobile: flag cards */}
            <div className="md:hidden space-y-3 mb-8">
              {flags.map(flag => (
                <div key={flag.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="font-medium text-gray-800 text-sm">{flag.stations?.name ?? '—'}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {flag.shifts?.shift_date
                          ? new Date(flag.shifts.shift_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                          : '—'}
                      </p>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0 flex-wrap justify-end">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${SEVERITY_BADGE[flag.severity] ?? 'bg-gray-100 text-gray-500'}`}>
                        {flag.severity}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[flag.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {flag.status?.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 mb-1">{FLAG_TYPE_LABELS[flag.flag_type] ?? flag.flag_type}</p>
                  {flag.resolution_note && (
                    <p className="text-xs text-gray-400 mt-1">{flag.resolution_note}</p>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop: flags table */}
            <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-x-auto mb-8">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Station</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Date</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Shift</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Flag Type</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Severity</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Status</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Raised</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Resolution</th>
                  </tr>
                </thead>
                <tbody>
                  {flags.map(flag => (
                    <tr key={flag.id} className="border-b border-gray-50 last:border-0">
                      <td className="px-5 py-3 text-gray-700">{flag.stations?.name ?? '—'}</td>
                      <td className="px-5 py-3 text-gray-500">{flag.shifts?.shift_date ? new Date(flag.shifts.shift_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                      <td className="px-5 py-3 capitalize text-gray-500">{flag.shifts?.shift_type ?? '—'}</td>
                      <td className="px-5 py-3 text-gray-700">{FLAG_TYPE_LABELS[flag.flag_type] ?? flag.flag_type}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${SEVERITY_BADGE[flag.severity] ?? 'bg-gray-100 text-gray-500'}`}>
                          {flag.severity}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_BADGE[flag.status] ?? 'bg-gray-100 text-gray-500'}`}>
                          {flag.status?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-500 whitespace-nowrap">
                        {new Date(flag.raised_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-5 py-3 text-gray-500 text-xs">{flag.resolution_note ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
