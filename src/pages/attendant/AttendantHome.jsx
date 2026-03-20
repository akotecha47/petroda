import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { getOrCreateShift } from '../../lib/shiftUtils'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

const EMPTY_FORM = { pma: '', ago: '', cash: '', card: '' }

export default function AttendantHome() {
  const { user, session, signOut } = useAuth()
  const navigate = useNavigate()
  const today = todayISO()

  const [stationName, setStationName] = useState('')
  const [shiftType, setShiftType] = useState('day')
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [existingEntries, setExistingEntries] = useState({ day: null, night: null })
  const [todayHistory, setTodayHistory] = useState([])
  const [loadingEntries, setLoadingEntries] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!session) navigate('/login', { replace: true })
  }, [session, navigate])

  useEffect(() => {
    if (user?.station_id) {
      supabase
        .from('stations')
        .select('name')
        .eq('id', user.station_id)
        .single()
        .then(({ data }) => { if (data) setStationName(data.name) })
    }
  }, [user?.station_id])

  const loadTodayEntries = useCallback(async () => {
    if (!user?.id || !user?.station_id) return
    setLoadingEntries(true)

    // Fetch all shifts for this station today
    const { data: shifts } = await supabase
      .from('shifts')
      .select('id, shift_type')
      .eq('station_id', user.station_id)
      .eq('shift_date', today)

    if (!shifts || shifts.length === 0) {
      setExistingEntries({ day: null, night: null })
      setTodayHistory([])
      setLoadingEntries(false)
      return
    }

    const shiftIds = shifts.map(s => s.id)

    const { data: entries } = await supabase
      .from('attendant_entries')
      .select('id, shift_id, pma_litres_sold, ago_litres_sold, cash_collected, card_collected, submitted_at')
      .eq('attendant_id', user.id)
      .in('shift_id', shiftIds)
      .order('submitted_at', { ascending: false })

    const byShift = {}
    if (entries) {
      for (const e of entries) byShift[e.shift_id] = e
    }

    const dayShift = shifts.find(s => s.shift_type === 'day')
    const nightShift = shifts.find(s => s.shift_type === 'night')

    setExistingEntries({
      day: dayShift && byShift[dayShift.id] ? byShift[dayShift.id] : null,
      night: nightShift && byShift[nightShift.id] ? byShift[nightShift.id] : null,
    })

    // Build history list with shift type label
    const history = (entries ?? []).map(e => {
      const shift = shifts.find(s => s.id === e.shift_id)
      return { ...e, shift_type: shift?.shift_type ?? '?' }
    })
    setTodayHistory(history)
    setLoadingEntries(false)
  }, [user?.id, user?.station_id, today])

  useEffect(() => {
    loadTodayEntries()
  }, [loadTodayEntries])

  // Reset form when switching shift type
  useEffect(() => {
    setForm(EMPTY_FORM)
    setSubmitError(null)
  }, [shiftType])

  const currentEntry = existingEntries[shiftType]
  const alreadySubmitted = Boolean(currentEntry)

  const pmaVal = parseFloat(form.pma) || 0
  const agoVal = parseFloat(form.ago) || 0
  const cashVal = parseFloat(form.cash) || 0
  const cardVal = parseFloat(form.card) || 0
  const showCollectionWarning =
    !alreadySubmitted && (pmaVal + agoVal) > 0 && (cashVal + cardVal) === 0

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitError(null)
    setSubmitting(true)

    const { shiftId, error: shiftError } = await getOrCreateShift(
      user.station_id, shiftType, today
    )
    if (shiftError) {
      setSubmitError(shiftError.message)
      setSubmitting(false)
      return
    }

    const { error: insertError } = await supabase
      .from('attendant_entries')
      .insert({
        shift_id: shiftId,
        attendant_id: user.id,
        pma_litres_sold: pmaVal,
        ago_litres_sold: agoVal,
        cash_collected: cashVal,
        card_collected: cardVal,
      })

    if (insertError) {
      setSubmitError(insertError.message)
      setSubmitting(false)
      return
    }

    setSubmitting(false)
    await loadTodayEntries()
  }

  function field(label, key, prefix) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-gray-400">
          {prefix && (
            <span className="px-3 py-2 text-sm text-gray-500 bg-gray-50 border-r border-gray-300 select-none">
              {prefix}
            </span>
          )}
          <input
            type="number"
            min="0"
            step="0.01"
            required
            disabled={alreadySubmitted}
            value={form[key]}
            onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
            className="flex-1 px-3 py-2 text-sm focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="relative">
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          <span className="font-semibold text-gray-800">Petroda · Attendant</span>
          <div className="hidden md:flex items-center gap-4 text-sm">
            <span className="text-xs text-gray-300">Built by Streamline</span>
            <Link to="/app/profile" className="text-gray-500 hover:text-gray-800">
              {user?.full_name}
            </Link>
            <button onClick={signOut} className="text-gray-500 hover:text-gray-800">Sign out</button>
          </div>
          <button
            className="md:hidden flex flex-col gap-1 p-1"
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Open menu"
          >
            <div className="w-5 h-0.5 bg-gray-700" />
            <div className="w-5 h-0.5 bg-gray-700" />
            <div className="w-5 h-0.5 bg-gray-700" />
          </button>
        </div>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="md:hidden absolute top-full left-0 right-0 bg-white border-b border-gray-200 z-50">
              <button
                onClick={() => { setMenuOpen(false); signOut() }}
                className="block w-full text-left py-3 px-6 text-sm text-gray-700 hover:bg-gray-50"
              >
                Sign out
              </button>
            </div>
          </>
        )}
      </div>

      {/* Station name */}
      {stationName && (
        <div className="bg-white border-b border-gray-100 px-6 py-2">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">{stationName}</p>
        </div>
      )}

      <div className="max-w-md mx-auto px-4 py-8 space-y-6">
        {/* Shift Entry Form */}
        <div className="bg-white rounded-2xl shadow p-6 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-gray-800 mb-1">Shift Entry</h2>
            <p className="text-xs text-gray-400">{formatDate(today)}</p>
          </div>

          {/* Day / Night selector */}
          <div className="flex gap-2">
            {['day', 'night'].map(type => (
              <button
                key={type}
                type="button"
                onClick={() => setShiftType(type)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  shiftType === type
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {type === 'day' ? 'Day' : 'Night'}
              </button>
            ))}
          </div>

          {alreadySubmitted ? (
            <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
              Already submitted at {formatTime(currentEntry.submitted_at)}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {field('PMA Litres Sold', 'pma')}
              {field('AGO Litres Sold', 'ago')}
              {field('Cash Collected — MWK', 'cash', 'MWK')}
              {field('Bank Card Collected — MWK', 'card', 'MWK')}

              {showCollectionWarning && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Warning: litres sold but no cash or card collected.
                </p>
              )}

              {submitError && (
                <p className="text-xs text-red-600">{submitError}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Submitting…' : 'Submit Shift Entry'}
              </button>
            </form>
          )}
        </div>

        {/* Same-Day History */}
        <div className="bg-white rounded-2xl shadow p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-800">Today's Submissions</h2>
          {loadingEntries ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : todayHistory.length === 0 ? (
            <p className="text-sm text-gray-400">No submissions today</p>
          ) : (
            <ul className="space-y-3">
              {todayHistory.map(entry => (
                <li key={entry.id} className="border border-gray-100 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {entry.shift_type} shift
                    </span>
                    <span className="text-xs text-gray-400">{formatTime(entry.submitted_at)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-700">
                    <span className="text-gray-400">PMA</span>
                    <span>{entry.pma_litres_sold} L</span>
                    <span className="text-gray-400">AGO</span>
                    <span>{entry.ago_litres_sold} L</span>
                    <span className="text-gray-400">Cash</span>
                    <span>MWK {entry.cash_collected}</span>
                    <span className="text-gray-400">Card</span>
                    <span>MWK {entry.card_collected}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
