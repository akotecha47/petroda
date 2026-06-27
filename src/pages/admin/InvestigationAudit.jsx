import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

const FLAG_TYPE_LABELS = {
  fuel_variance:    'Fuel Variance',
  cash_variance:    'Cash Variance',
  stock_variance:   'Stock Variance',
  payment_variance: 'Payment Variance',
  other:            'Other',
}

const SEVERITY_COLORS = {
  warning:  'bg-amber-100 text-amber-700',
  critical: 'bg-red-100 text-red-700',
}

const STATUS_COLORS = {
  detected:            'bg-blue-100 text-blue-700',
  under_investigation: 'bg-amber-100 text-amber-700',
  resolved:            'bg-green-100 text-green-700',
  corrected:           'bg-gray-100 text-gray-600',
  escalated:           'bg-red-100 text-red-700',
}

const n = v => parseFloat(v) || 0
const comma = v => Math.round(n(v)).toLocaleString()

function fmtDate(isoDate) {
  if (!isoDate) return '—'
  return new Date(isoDate + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function MetadataDetail({ flag }) {
  const m = flag.metadata
  if (!m) return null

  if (flag.flag_type === 'fuel_variance') {
    return (
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm mt-3">
        <span className="text-gray-500">Fuel type</span>
        <span className="font-medium text-gray-800">{m.fuel_type === 'PMA' ? 'Petrol' : m.fuel_type === 'AGO' ? 'Diesel' : m.fuel_type ?? '—'}</span>
        <span className="text-gray-500">Book closing</span>
        <span className="font-medium text-gray-800">{m.book_closing != null ? comma(m.book_closing) + ' L' : '—'}</span>
        <span className="text-gray-500">Actual (dip)</span>
        <span className="font-medium text-gray-800">{m.closing_dip_litres != null ? comma(m.closing_dip_litres) + ' L' : '—'}</span>
        <span className="text-gray-500">Variance</span>
        <span className={`font-semibold ${n(m.variance) < 0 ? 'text-red-600' : 'text-amber-600'}`}>
          {m.variance != null ? comma(Math.abs(m.variance)) + ' L ' + (n(m.variance) < 0 ? 'short' : 'over') : '—'}
        </span>
        <span className="text-gray-500">Threshold</span>
        <span className="text-gray-700">{m.threshold != null ? comma(m.threshold) + ' L' : '—'}</span>
      </div>
    )
  }

  if (flag.flag_type === 'cash_variance') {
    return (
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm mt-3">
        <span className="text-gray-500">Expected cash</span>
        <span className="font-medium text-gray-800">{m.expected_cash != null ? 'MWK ' + comma(m.expected_cash) : '—'}</span>
        <span className="text-gray-500">Deposited</span>
        <span className="font-medium text-gray-800">{m.deposited_amount != null ? 'MWK ' + comma(m.deposited_amount) : '—'}</span>
        <span className="text-gray-500">Variance</span>
        <span className={`font-semibold ${n(m.variance) < 0 ? 'text-red-600' : 'text-amber-600'}`}>
          {m.variance != null ? 'MWK ' + comma(Math.abs(m.variance)) + ' ' + (n(m.variance) < 0 ? 'short' : 'over') : '—'}
        </span>
        <span className="text-gray-500">Threshold</span>
        <span className="text-gray-700">{m.threshold != null ? 'MWK ' + comma(m.threshold) : '—'}</span>
      </div>
    )
  }

  return null
}

function FlagCard({ flag, onResolved }) {
  const [open, setOpen]         = useState(false)
  const [note, setNote]         = useState(flag.resolution_note ?? '')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  const isResolved = flag.status === 'resolved'
  const formDate = flag.metadata?.form_date ?? null

  async function handleResolve() {
    setSaving(true)
    setError('')
    const { error: err } = await supabase
      .from('flags_investigations')
      .update({ status: 'resolved', resolution_note: note || null })
      .eq('id', flag.id)
    if (err) { setError(err.message); setSaving(false); return }
    setSaving(false)
    onResolved()
  }

  return (
    <div className={`bg-white rounded-xl border overflow-hidden ${isResolved ? 'border-gray-200' : 'border-amber-200'}`}>
      <button
        className="w-full flex items-center gap-3 px-5 py-4 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-800">
              {FLAG_TYPE_LABELS[flag.flag_type] ?? flag.flag_type}
            </span>
            {formDate && (
              <span className="text-xs text-gray-400">{fmtDate(formDate)}</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_COLORS[flag.severity] ?? 'bg-gray-100 text-gray-600'}`}>
              {flag.severity}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[flag.status] ?? 'bg-gray-100 text-gray-600'}`}>
              {flag.status?.replace('_', ' ')}
            </span>
          </div>
        </div>
        <span className="text-gray-400 text-sm flex-shrink-0">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-gray-100 pt-4">
          <MetadataDetail flag={flag} />

          {flag.resolution_note && !isResolved && (
            <p className="text-sm text-gray-500 mt-3 italic">"{flag.resolution_note}"</p>
          )}

          {isResolved ? (
            <div className="mt-4 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
              <p className="text-sm font-medium text-green-700">Resolved</p>
              {flag.resolution_note && (
                <p className="text-sm text-green-600 mt-0.5">"{flag.resolution_note}"</p>
              )}
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Resolution note (optional)…"
                rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
              />
              {error && <p className="text-xs text-red-600">{error}</p>}
              <button
                onClick={handleResolve}
                disabled={saving}
                className="px-5 py-2 rounded-lg text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: '#06476B' }}
              >
                {saving ? 'Saving…' : 'Mark as Resolved'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function InvestigationAudit() {
  const { user } = useAuth()
  const [flags, setFlags] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('open')

  async function loadFlags() {
    setLoading(true)
    let q = supabase
      .from('flags_investigations')
      .select('id, flag_type, severity, status, raised_at, resolution_note, station_id, metadata, stations(name)')
      .order('raised_at', { ascending: false })
      .limit(100)
    if (statusFilter === 'open') q = q.neq('status', 'resolved')
    else if (statusFilter === 'resolved') q = q.eq('status', 'resolved')
    const { data } = await q
    setFlags(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    if (!user) return
    loadFlags()
  }, [user, statusFilter])

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-5 py-3.5 flex items-center justify-between" style={{ backgroundColor: '#06476B' }}>
        <p className="text-white font-bold leading-tight">Flags &amp; Investigations</p>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-6">
        <div className="flex gap-2 mb-5">
          {[
            { value: 'open', label: 'Open' },
            { value: 'resolved', label: 'Resolved' },
            { value: 'all', label: 'All' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === opt.value
                  ? 'bg-gray-900 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 h-20 animate-pulse" />
            ))}
          </div>
        ) : flags.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-sm text-gray-400">
            No flags in this category.
          </div>
        ) : (
          <div className="space-y-3">
            {flags.map(flag => (
              <FlagCard key={flag.id} flag={flag} onResolved={loadFlags} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
