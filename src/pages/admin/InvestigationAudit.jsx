import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import AdminNav from '../../components/admin/AdminNav'

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

const STATUSES = ['detected', 'under_investigation', 'corrected', 'resolved', 'escalated']

const ACTION_LABELS = {
  insert: 'Created',
  update: 'Updated',
  delete: 'Deleted',
}

function dateRange(days) {
  const to = new Date().toISOString().slice(0, 10)
  const d = new Date()
  d.setDate(d.getDate() - days)
  return { from: d.toISOString().slice(0, 10), to }
}

export default function InvestigationAudit() {
  const { user } = useAuth()
  const [tab, setTab] = useState('investigations')

  // Investigations state
  const [flags, setFlags] = useState([])
  const [stations, setStations] = useState([])
  const [flagStation, setFlagStation] = useState('all')
  const [flagStatus, setFlagStatus] = useState('all')
  const [flagSeverity, setFlagSeverity] = useState('all')
  const [flagsLoading, setFlagsLoading] = useState(true)
  const [editFlagId, setEditFlagId] = useState(null)
  const [editStatus, setEditStatus] = useState('')
  const [editNote, setEditNote] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  // Audit log state
  const [auditLogs, setAuditLogs] = useState([])
  const [auditStation, setAuditStation] = useState('all')
  const [auditDays, setAuditDays] = useState(7)
  const [auditLoading, setAuditLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase.from('stations').select('id, name').eq('is_active', true).order('name')
      .then(({ data }) => setStations(data ?? []))
  }, [user])

  useEffect(() => {
    if (!user || tab !== 'investigations') return
    async function loadFlags() {
      setFlagsLoading(true)
      let q = supabase
        .from('flags_investigations')
        .select('id, flag_type, severity, status, raised_at, resolution_note, station_id, stations(name), shifts(shift_date, shift_type)')
        .order('raised_at', { ascending: false })
        .limit(100)
      if (flagStation !== 'all') q = q.eq('station_id', flagStation)
      if (flagStatus !== 'all') q = q.eq('status', flagStatus)
      if (flagSeverity !== 'all') q = q.eq('severity', flagSeverity)
      const { data } = await q
      setFlags(data ?? [])
      setFlagsLoading(false)
    }
    loadFlags()
  }, [user, tab, flagStation, flagStatus, flagSeverity])

  useEffect(() => {
    if (!user || tab !== 'audit') return
    async function loadAudit() {
      setAuditLoading(true)
      const { from, to } = dateRange(auditDays)
      let q = supabase
        .from('audit_log')
        .select('id, action, target_table, target_id, created_at, station_id, users!actor_id(full_name), stations(name)')
        .gte('created_at', from + 'T00:00:00')
        .lte('created_at', to + 'T23:59:59')
        .order('created_at', { ascending: false })
        .limit(50)
      if (auditStation !== 'all') q = q.eq('station_id', auditStation)
      const { data } = await q
      setAuditLogs(data ?? [])
      setAuditLoading(false)
    }
    loadAudit()
  }, [user, tab, auditStation, auditDays])

  function startEditFlag(flag) {
    setEditFlagId(flag.id)
    setEditStatus(flag.status)
    setEditNote(flag.resolution_note ?? '')
  }

  async function handleSaveFlag(flagId) {
    setEditSaving(true)
    await supabase.from('flags_investigations')
      .update({ status: editStatus, resolution_note: editNote || null })
      .eq('id', flagId)
    setEditSaving(false)
    setEditFlagId(null)
    // Re-trigger flags load
    setFlagStation(v => v)
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <div className="max-w-6xl mx-auto px-6 py-8">
        <h1 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-6">Investigations & Audit</h1>

        <div className="flex gap-2 mb-6">
          {['investigations', 'audit'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                tab === t ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t === 'investigations' ? 'Investigations' : 'Audit Log'}
            </button>
          ))}
        </div>

        {tab === 'investigations' && (
          <>
            <div className="flex flex-wrap gap-3 mb-6">
              <select
                value={flagStation}
                onChange={e => setFlagStation(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white"
              >
                <option value="all">All Stations</option>
                {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select
                value={flagStatus}
                onChange={e => setFlagStatus(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white"
              >
                <option value="all">All Statuses</option>
                {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
              <select
                value={flagSeverity}
                onChange={e => setFlagSeverity(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white"
              >
                <option value="all">All Severities</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            {flagsLoading ? (
              <div className="bg-white rounded-xl border border-gray-200 p-5 h-32 animate-pulse" />
            ) : flags.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-5 text-sm text-gray-400">No flags match the current filters.</div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Station</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Date</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Shift</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Type</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Severity</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Status</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Raised</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Resolution</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {flags.map(flag => (
                      <tr key={flag.id} className="border-b border-gray-50 last:border-0">
                        <td className="px-4 py-3 text-gray-700">{flag.stations?.name ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{flag.shifts?.shift_date ? new Date(flag.shifts.shift_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                        <td className="px-4 py-3 capitalize text-gray-500 text-xs">{flag.shifts?.shift_type ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-700 text-xs">{FLAG_TYPE_LABELS[flag.flag_type] ?? flag.flag_type}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${SEVERITY_BADGE[flag.severity] ?? 'bg-gray-100 text-gray-500'}`}>
                            {flag.severity}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {editFlagId === flag.id ? (
                            <select
                              value={editStatus}
                              onChange={e => setEditStatus(e.target.value)}
                              className="border border-gray-200 rounded px-2 py-1 text-xs bg-white"
                            >
                              {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                            </select>
                          ) : (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[flag.status] ?? 'bg-gray-100 text-gray-500'}`}>
                              {flag.status?.replace('_', ' ')}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                          {new Date(flag.raised_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {editFlagId === flag.id ? (
                            <input
                              value={editNote}
                              onChange={e => setEditNote(e.target.value)}
                              placeholder="Resolution note…"
                              className="border border-gray-200 rounded px-2 py-1 text-xs w-40"
                            />
                          ) : (
                            <span className="text-gray-500">{flag.resolution_note ?? '—'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {editFlagId === flag.id ? (
                            <>
                              <button
                                onClick={() => handleSaveFlag(flag.id)}
                                disabled={editSaving}
                                className="text-xs px-2 py-1 bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50 mr-1"
                              >
                                {editSaving ? '…' : 'Save'}
                              </button>
                              <button onClick={() => setEditFlagId(null)} className="text-xs text-gray-400 hover:text-gray-700">Cancel</button>
                            </>
                          ) : (
                            <button onClick={() => startEditFlag(flag)} className="text-xs text-gray-400 hover:text-gray-700 underline">Edit</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {tab === 'audit' && (
          <>
            <div className="flex flex-wrap gap-3 mb-6">
              <select
                value={auditStation}
                onChange={e => setAuditStation(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white"
              >
                <option value="all">All Stations</option>
                {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select
                value={auditDays}
                onChange={e => setAuditDays(Number(e.target.value))}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white"
              >
                <option value={1}>Today</option>
                <option value={7}>Last 7 Days</option>
                <option value={30}>Last 30 Days</option>
              </select>
            </div>

            {auditLoading ? (
              <div className="bg-white rounded-xl border border-gray-200 p-5 h-32 animate-pulse" />
            ) : auditLogs.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-5 text-sm text-gray-400">No audit entries for this period.</div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
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
                    {auditLogs.map(log => (
                      <tr key={log.id} className="border-b border-gray-50 last:border-0">
                        <td className="px-5 py-3 text-gray-500 text-xs whitespace-nowrap">
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
          </>
        )}
      </div>
    </div>
  )
}
