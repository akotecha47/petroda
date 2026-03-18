import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { todayISO, getOrCreateShift } from '../../lib/shiftUtils'
import { interpolateLitres } from '../../lib/stockUtils'

export default function DipEntry() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [shiftType, setShiftType] = useState('day')
  const [tanks, setTanks] = useState([])
  const [readings, setReadings] = useState({})
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user?.station_id) return
    supabase
      .from('tanks')
      .select('id, label, fuel_type, capacity_litres, calibration_profile')
      .eq('station_id', user.station_id)
      .eq('is_active', true)
      .order('fuel_type')
      .order('label')
      .then(({ data }) => {
        if (data) {
          setTanks(data)
          const initial = {}
          data.forEach(t => { initial[t.id] = '' })
          setReadings(initial)
        }
      })
  }, [user?.station_id])

  if (!user) return null

  function maxCm(tank) {
    if (!tank.calibration_profile || tank.calibration_profile.length === 0) return Infinity
    return Math.max(...tank.calibration_profile.map(p => p.cm))
  }

  function previewLitres(tank) {
    const cm = parseFloat(readings[tank.id])
    if (isNaN(cm) || cm < 0) return null
    return interpolateLitres(tank.calibration_profile ?? [], cm)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    const missing = tanks.filter(t => readings[t.id] === '')
    if (missing.length > 0) {
      const proceed = confirm(
        `${missing.length} tank(s) have no reading: ${missing.map(t => t.label).join(', ')}. Continue anyway?`
      )
      if (!proceed) return
    }

    for (const tank of tanks) {
      const cm = parseFloat(readings[tank.id])
      if (!isNaN(cm) && cm > maxCm(tank)) {
        setError(`Reading for ${tank.label} (${cm} cm) exceeds maximum calibration point (${maxCm(tank)} cm).`)
        return
      }
    }

    setSaving(true)
    const today = todayISO()
    const { shiftId, error: shiftErr } = await getOrCreateShift(user.station_id, shiftType, today)
    if (shiftErr) { setError(shiftErr.message); setSaving(false); return }

    const { data: dipEntry, error: dipErr } = await supabase
      .from('dip_entries')
      .insert({
        shift_id: shiftId,
        station_id: user.station_id,
        recorded_by: user.id,
        recorded_at: new Date().toISOString(),
        is_verified: false,
        note: note.trim() || null,
      })
      .select('id')
      .single()

    if (dipErr) { setError(dipErr.message); setSaving(false); return }

    const tankReadings = tanks
      .filter(t => readings[t.id] !== '')
      .map(t => {
        const cm = parseFloat(readings[t.id])
        return {
          dip_entry_id: dipEntry.id,
          tank_id: t.id,
          reading_cm: cm,
          calculated_litres: Math.round(interpolateLitres(t.calibration_profile ?? [], cm)),
        }
      })

    if (tankReadings.length > 0) {
      const { error: readingsErr } = await supabase
        .from('dip_tank_readings')
        .insert(tankReadings)
      if (readingsErr) { setError(readingsErr.message); setSaving(false); return }
    }

    navigate('/app/manager/stock')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3">
        <Link to="/app/manager/stock" className="text-gray-400 hover:text-gray-700 text-sm">← Stock</Link>
        <span className="text-gray-300">|</span>
        <span className="font-semibold text-gray-800">Record Dip</span>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Shift</p>
            <div className="flex gap-2">
              {['day', 'night'].map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setShiftType(s)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                    shiftType === s
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {s} Shift
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3">Date: {todayISO()}</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-4">Tank Readings</p>
            <div className="space-y-4">
              {tanks.map(tank => {
                const preview = previewLitres(tank)
                const cm = parseFloat(readings[tank.id])
                const overMax = !isNaN(cm) && cm > maxCm(tank)
                return (
                  <div key={tank.id} className="flex items-start gap-4">
                    <div className="flex-1">
                      <label className="text-sm font-medium text-gray-700 block mb-1">
                        {tank.label}
                        <span className="text-xs text-gray-400 font-normal ml-2 uppercase">{tank.fuel_type}</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        placeholder="cm"
                        value={readings[tank.id]}
                        onChange={e => setReadings(prev => ({ ...prev, [tank.id]: e.target.value }))}
                        className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 ${
                          overMax ? 'border-red-300 bg-red-50' : 'border-gray-200'
                        }`}
                      />
                      {overMax && (
                        <p className="text-xs text-red-600 mt-1">Exceeds max {maxCm(tank)} cm</p>
                      )}
                    </div>
                    <div className="w-32 text-right pt-6">
                      {preview != null ? (
                        <p className="text-sm font-medium text-gray-700">
                          {Math.round(preview).toLocaleString()} <span className="text-xs text-gray-400">L</span>
                        </p>
                      ) : (
                        <p className="text-xs text-gray-300">— L</p>
                      )}
                      <p className="text-xs text-gray-400">{tank.capacity_litres?.toLocaleString()} cap</p>
                    </div>
                  </div>
                )
              })}
              {tanks.length === 0 && (
                <p className="text-sm text-gray-400">No active tanks found for this station.</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wide block mb-2">Note (optional)</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              placeholder="Any observations…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 resize-none"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-gray-900 text-white text-sm font-medium px-6 py-2.5 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save Dip Entry'}
            </button>
            <Link
              to="/app/manager/stock"
              className="text-sm font-medium px-6 py-2.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
