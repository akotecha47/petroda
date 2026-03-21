import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { todayISO } from '../../lib/shiftUtils'
import { generateShiftFlags } from '../../lib/flagUtils'

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

const STATUS_LABELS = {
  detected: 'Detected',
  under_investigation: 'Under Investigation',
  corrected: 'Corrected',
  resolved: 'Resolved',
  escalated: 'Escalated',
}

const OPEN_STATUSES = ['detected', 'under_investigation', 'corrected']

export default function FlagsInvestigations() {
  const { user } = useAuth()
  const [stationName, setStationName] = useState('')
  const [flags, setFlags] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [generateMsg, setGenerateMsg] = useState(null)
  const [resolvingFlag, setResolvingFlag] = useState(null) // { flagId, note }

  async function loadFlags() {
    setLoading(true)
    const { data } = await supabase
      .from('flags_investigations')
      .select('id, flag_type, severity, status, raised_at, resolution_note, shift_id, shifts(shift_date, shift_type)')
      .eq('station_id', user.station_id)
      .order('raised_at', { ascending: false })
    setFlags(data ?? [])
    setLoading(false)
  }

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
    loadFlags()
  }, [user?.station_id])

  if (!user) return null

  const filtered = filter === 'all'
    ? flags
    : filter === 'open'
      ? flags.filter(f => OPEN_STATUSES.includes(f.status))
      : flags.filter(f => ['resolved', 'escalated'].includes(f.status))

  async function updateStatus(flagId, status, resolutionNote = null) {
    const update = { status }
    if (status === 'resolved') {
      update.resolved_at = new Date().toISOString()
      update.resolution_note = resolutionNote
    }
    const { error } = await supabase
      .from('flags_investigations')
      .update(update)
      .eq('id', flagId)
    if (!error) {
      setFlags(prev => prev.map(f => f.id === flagId ? { ...f, ...update } : f))
      setResolvingFlag(null)
    }
  }

  async function handleGenerate() {
    setGenerating(true)
    setGenerateMsg(null)
    const today = todayISO()
    const { data: todayShifts } = await supabase
      .from('shifts')
      .select('id')
      .eq('station_id', user.station_id)
      .eq('shift_date', today)

    if (!todayShifts?.length) {
      setGenerateMsg('No shifts found for today.')
      setGenerating(false)
      return
    }

    let totalCreated = 0
    for (const shift of todayShifts) {
      const created = await generateShiftFlags(shift.id, user.station_id)
      totalCreated += created.length
    }

    setGenerateMsg(totalCreated > 0 ? `${totalCreated} flag(s) generated.` : 'No new flags detected.')
    await loadFlags()
    setGenerating(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3">
        <Link to="/app/manager" className="text-gray-400 hover:text-gray-700 text-sm">← Dashboard</Link>
        <span className="text-gray-300">|</span>
        <span className="font-semibold text-gray-800">Flags & Investigations — {stationName}</span>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex flex-col gap-3 mb-6 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-2">
            {['all', 'open', 'resolved'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
                  filter === f ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {f === 'all' ? 'All' : f === 'open' ? 'Open' : 'Resolved'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            {generateMsg && <span className="text-xs text-gray-500">{generateMsg}</span>}
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {generating ? 'Generating…' : 'Generate Flags for Today'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 h-24 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-400">
            No flags found.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(flag => {
              const isReadOnly = ['escalated', 'resolved'].includes(flag.status)
              const isResolving = resolvingFlag?.flagId === flag.id

              return (
                <div key={flag.id} className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${SEVERITY_BADGE[flag.severity] ?? 'bg-gray-100 text-gray-500'}`}>
                        {flag.severity}
                      </span>
                      <span className="font-medium text-gray-800 text-sm">
                        {FLAG_TYPE_LABELS[flag.flag_type] ?? flag.flag_type}
                      </span>
                      {flag.shifts && (
                        <span className="text-xs text-gray-400 capitalize">
                          {flag.shifts.shift_date} · {flag.shifts.shift_type} shift
                        </span>
                      )}
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap ${STATUS_BADGE[flag.status] ?? 'bg-gray-100 text-gray-500'}`}>
                      {STATUS_LABELS[flag.status] ?? flag.status}
                    </span>
                  </div>

                  <p className="text-xs text-gray-400 mt-2">
                    Raised {new Date(flag.raised_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>

                  {flag.resolution_note && (
                    <p className="text-sm text-gray-600 mt-2 bg-gray-50 rounded-lg px-3 py-2">
                      {flag.resolution_note}
                    </p>
                  )}

                  {!isReadOnly && (
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      {flag.status === 'detected' && (
                        <button
                          onClick={() => updateStatus(flag.id, 'under_investigation')}
                          className="text-xs font-medium px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
                        >
                          Investigate
                        </button>
                      )}
                      {!isResolving ? (
                        <button
                          onClick={() => setResolvingFlag({ flagId: flag.id, note: '' })}
                          className="text-xs font-medium px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
                        >
                          Mark Resolved
                        </button>
                      ) : (
                        <div className="flex items-center gap-2 w-full mt-1">
                          <input
                            type="text"
                            value={resolvingFlag.note}
                            onChange={e => setResolvingFlag(prev => ({ ...prev, note: e.target.value }))}
                            placeholder="Resolution note…"
                            className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-gray-300"
                            autoFocus
                          />
                          <button
                            onClick={() => updateStatus(flag.id, 'resolved', resolvingFlag.note.trim() || null)}
                            disabled={!resolvingFlag.note.trim()}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setResolvingFlag(null)}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                      <button
                        onClick={() => updateStatus(flag.id, 'escalated')}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
                      >
                        Escalate
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
