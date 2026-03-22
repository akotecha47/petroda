import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { todayISO } from '../../lib/shiftUtils'

const STATUS_BADGE = {
  open: 'bg-blue-100 text-blue-700',
  submitted: 'bg-amber-100 text-amber-700',
  closed: 'bg-green-100 text-green-700',
}

function ShiftPanel({ label, shift, shiftEntries, closing, onClose }) {
  const pma = shiftEntries.reduce((s, e) => s + (e.pma_litres_sold ?? 0), 0)
  const ago = shiftEntries.reduce((s, e) => s + (e.ago_litres_sold ?? 0), 0)
  const cash = shiftEntries.reduce((s, e) => s + (e.cash_collected ?? 0), 0)
  const card = shiftEntries.reduce((s, e) => s + (e.card_collected ?? 0), 0)

  if (!shift) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-gray-700">{label}</h3>
          <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">no shift</span>
        </div>
        <p className="text-sm text-gray-400">No shift opened today</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-gray-700">{label}</h3>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${STATUS_BADGE[shift.status] ?? 'bg-gray-100 text-gray-500'}`}>
          {shift.status}
        </span>
      </div>

      {shiftEntries.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">PMS Litres</p>
            <p className="text-sm font-semibold text-gray-800">{pma.toLocaleString()} L</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">AGO Litres</p>
            <p className="text-sm font-semibold text-gray-800">{ago.toLocaleString()} L</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">Cash</p>
            <p className="text-sm font-semibold text-gray-800">MWK {cash.toLocaleString()}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">Card</p>
            <p className="text-sm font-semibold text-gray-800">MWK {card.toLocaleString()}</p>
          </div>
        </div>
      )}

      {shift.status === 'submitted' && (
        <button
          onClick={() => onClose(shift)}
          disabled={closing}
          className="w-full bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {closing ? 'Closing…' : 'Close Shift'}
        </button>
      )}
      {shift.status === 'open' && (
        <p className="text-xs text-amber-600">Awaiting attendant submission before this shift can be closed</p>
      )}
      {shift.status === 'closed' && shift.closed_at && (
        <p className="text-xs text-gray-400">
          Closed at {new Date(shift.closed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </div>
  )
}

export default function ShiftClose() {
  const { user } = useAuth()
  const [shifts, setShifts] = useState([])
  const [entryMap, setEntryMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [closingId, setClosingId] = useState(null)
  const [closingDay, setClosingDay] = useState(false)
  const [error, setError] = useState(null)
  const [confirmDay, setConfirmDay] = useState(false)

  useEffect(() => {
    if (!user?.station_id) return
    async function load() {
      setLoading(true)
      const today = todayISO()

      const { data: shiftData } = await supabase
        .from('shifts')
        .select('id, shift_type, status, closed_at, closed_by')
        .eq('station_id', user.station_id)
        .eq('shift_date', today)

      if (!shiftData) { setLoading(false); return }
      setShifts(shiftData)

      const shiftIds = shiftData.map(s => s.id)
      if (shiftIds.length > 0) {
        const { data: entryData } = await supabase
          .from('attendant_entries')
          .select('shift_id, pma_litres_sold, ago_litres_sold, cash_collected, card_collected')
          .in('shift_id', shiftIds)
          .eq('is_corrected', false)

        const grouped = {}
        entryData?.forEach(e => {
          if (!grouped[e.shift_id]) grouped[e.shift_id] = []
          grouped[e.shift_id].push(e)
        })
        setEntryMap(grouped)
      }
      setLoading(false)
    }
    load()
  }, [user?.station_id])

  if (!user) return null

  async function handleCloseShift(shift) {
    setClosingId(shift.id)
    setError(null)
    const now = new Date().toISOString()
    const { error: err } = await supabase
      .from('shifts')
      .update({ status: 'closed', closed_at: now, closed_by: user.id })
      .eq('id', shift.id)

    if (err) { setError(err.message); setClosingId(null); return }
    setShifts(prev => prev.map(s => s.id === shift.id ? { ...s, status: 'closed', closed_at: now } : s))
    setClosingId(null)
  }

  async function handleCloseDay() {
    setConfirmDay(false)
    setClosingDay(true)
    // Both shifts are already closed — day close is a confirmation action.
    // Extend here if a day-level record is needed in future.
    setClosingDay(false)
    alert('Day closed successfully. Both shifts are locked.')
  }

  const dayShift = shifts.find(s => s.shift_type === 'day') ?? null
  const nightShift = shifts.find(s => s.shift_type === 'night') ?? null
  const bothClosed = dayShift?.status === 'closed' && nightShift?.status === 'closed'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3">
        <Link to="/app/manager" className="text-gray-400 hover:text-gray-700 text-sm">← Dashboard</Link>
        <span className="text-gray-300">|</span>
        <span className="font-semibold text-gray-800">Close Shift / Day</span>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-6 text-sm">{error}</div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 h-44 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <ShiftPanel
                label="Day Shift"
                shift={dayShift}
                shiftEntries={entryMap[dayShift?.id] ?? []}
                closing={closingId === dayShift?.id}
                onClose={handleCloseShift}
              />
              <ShiftPanel
                label="Night Shift"
                shift={nightShift}
                shiftEntries={entryMap[nightShift?.id] ?? []}
                closing={closingId === nightShift?.id}
                onClose={handleCloseShift}
              />
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-medium text-gray-700 mb-2">Close Day</h3>
              {shifts.length === 0 ? (
                <p className="text-sm text-red-600">No shifts submitted today. Cannot close day.</p>
              ) : confirmDay ? (
                <div>
                  <p className="text-sm text-gray-700 mb-4">Are you sure you want to close the day? Both shifts will be locked.</p>
                  <div className="flex gap-3">
                    <button
                      onClick={handleCloseDay}
                      disabled={closingDay}
                      className="bg-indigo-600 text-white text-sm font-medium px-5 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      {closingDay ? 'Closing Day…' : 'Yes, close day'}
                    </button>
                    <button
                      onClick={() => setConfirmDay(false)}
                      className="bg-white border border-gray-200 text-gray-600 text-sm font-medium px-5 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-500 mb-4">
                    {bothClosed
                      ? 'Both shifts are closed. You may close the day.'
                      : 'Both shifts must be closed before you can close the day.'}
                  </p>
                  <button
                    onClick={() => setConfirmDay(true)}
                    disabled={!bothClosed || closingDay}
                    className={`text-sm font-medium px-6 py-2.5 rounded-lg transition-colors ${
                      bothClosed
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    Close Day
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
