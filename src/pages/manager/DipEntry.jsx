import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { todayISO, getOrCreateShift } from '../../lib/shiftUtils'
import { interpolateLitres } from '../../lib/dipUtils'
import { fuelLabel } from '../../lib/fuelLabels'

export default function DipEntry() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tanks, setTanks] = useState([])
  const [openingCm, setOpeningCm] = useState({})
  const [closingCm, setClosingCm] = useState({})
  const [openingSaved, setOpeningSaved] = useState(false)
  const [closingSaved, setClosingSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user?.station_id) return
    const today = todayISO()

    async function load() {
      const { data: tanksData } = await supabase
        .from('tanks')
        .select('id, label, fuel_type, capacity_litres, calibration_profile')
        .eq('station_id', user.station_id)
        .eq('is_active', true)
        .order('fuel_type')
        .order('label')

      const loadedTanks = tanksData ?? []
      setTanks(loadedTanks)

      const oCm = {}, cCm = {}
      loadedTanks.forEach(t => { oCm[t.id] = ''; cCm[t.id] = '' })

      const { data: entries } = await supabase
        .from('dip_entries')
        .select('id, note')
        .eq('station_id', user.station_id)
        .gte('recorded_at', today + 'T00:00:00')
        .lte('recorded_at', today + 'T23:59:59')

      const openEntry = (entries ?? []).find(e => e.note === 'opening')
      const closeEntry = (entries ?? []).find(e => e.note === 'closing')

      if (openEntry) {
        const { data: oReadings } = await supabase
          .from('dip_tank_readings')
          .select('tank_id, reading_cm')
          .eq('dip_entry_id', openEntry.id)
        ;(oReadings ?? []).forEach(r => { oCm[r.tank_id] = String(r.reading_cm) })
        setOpeningSaved(true)
      }

      if (closeEntry) {
        const { data: cReadings } = await supabase
          .from('dip_tank_readings')
          .select('tank_id, reading_cm')
          .eq('dip_entry_id', closeEntry.id)
        ;(cReadings ?? []).forEach(r => { cCm[r.tank_id] = String(r.reading_cm) })
        setClosingSaved(true)
      }

      setOpeningCm(oCm)
      setClosingCm(cCm)
    }

    load()
  }, [user?.station_id])

  function litresPreview(tank, cmMap) {
    const cm = parseFloat(cmMap[tank.id])
    if (isNaN(cm) || cm < 0) return null
    return interpolateLitres(cm, tank.calibration_profile ?? [])
  }

  async function saveSection(dipType, cmMap, setSectionSaved) {
    const hasValues = tanks.some(t => cmMap[t.id] !== '')
    if (!hasValues) return true

    const today = todayISO()
    const { shiftId, error: shiftErr } = await getOrCreateShift(user.station_id, 'day', today)
    if (shiftErr) { setError(shiftErr.message); return false }

    const { data: dipEntry, error: dipErr } = await supabase
      .from('dip_entries')
      .insert({
        shift_id: shiftId,
        station_id: user.station_id,
        recorded_by: user.id,
        recorded_at: new Date().toISOString(),
        is_verified: false,
        note: dipType,
      })
      .select('id')
      .single()

    if (dipErr) { setError(dipErr.message); return false }

    const tankReadings = tanks
      .filter(t => cmMap[t.id] !== '')
      .map(t => {
        const cm = parseFloat(cmMap[t.id])
        const litres = interpolateLitres(cm, t.calibration_profile ?? [])
        return {
          dip_entry_id: dipEntry.id,
          tank_id: t.id,
          reading_cm: cm,
          calculated_litres: litres != null ? Math.round(litres) : 0,
        }
      })

    if (tankReadings.length > 0) {
      const { error: readErr } = await supabase.from('dip_tank_readings').insert(tankReadings)
      if (readErr) { setError(readErr.message); return false }
    }

    setSectionSaved(true)
    return true
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)

    if (!openingSaved) {
      const ok = await saveSection('opening', openingCm, setOpeningSaved)
      if (!ok) { setSaving(false); return }
    }
    if (!closingSaved) {
      const ok = await saveSection('closing', closingCm, setClosingSaved)
      if (!ok) { setSaving(false); return }
    }

    setSaving(false)
    navigate('/manager')
  }

  if (!user) return null

  const allSaved = openingSaved && closingSaved

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-5 py-3.5 flex items-center justify-between" style={{ backgroundColor: '#06476B' }}>
        <div>
          <p className="text-white font-bold leading-tight">Record Dip</p>
          <p className="text-xs" style={{ color: '#89c4d4' }}>{todayISO()} · 06:00–18:00</p>
        </div>
        <button
          onClick={() => navigate('/manager')}
          className="text-sm px-3 py-1.5 rounded-lg text-white border border-white/30 hover:bg-white/10"
        >
          ← Back
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DipSection
            title="Opening Dip"
            subtitle="Start of shift"
            tanks={tanks}
            cmMap={openingCm}
            setCm={(id, v) => setOpeningCm(prev => ({ ...prev, [id]: v }))}
            saved={openingSaved}
            litresPreview={(t) => litresPreview(t, openingCm)}
          />

          <DipSection
            title="Closing Dip"
            subtitle="End of shift"
            tanks={tanks}
            cmMap={closingCm}
            setCm={(id, v) => setClosingCm(prev => ({ ...prev, [id]: v }))}
            saved={closingSaved}
            litresPreview={(t) => litresPreview(t, closingCm)}
          />

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
          )}

          <button
            type="submit"
            disabled={saving || allSaved}
            className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: '#06476B' }}
          >
            {saving ? 'Saving…' : allSaved ? 'All Dips Saved' : 'Save Dip Readings'}
          </button>
        </form>
      </div>
    </div>
  )
}

function DipSection({ title, subtitle, tanks, cmMap, setCm, saved, litresPreview }) {
  return (
    <div className={`bg-white rounded-xl border overflow-hidden ${saved ? 'border-green-200' : 'border-gray-200'}`}>
      <div className={`px-5 py-3 flex items-center justify-between border-b ${saved ? 'bg-green-50 border-green-100' : 'bg-gray-50 border-gray-100'}`}>
        <div>
          <p className="text-sm font-semibold text-gray-700">{title}</p>
          <p className="text-xs text-gray-400">{subtitle}</p>
        </div>
        {saved && <span className="text-xs text-green-600 font-medium">Saved</span>}
      </div>
      <div className="p-5 space-y-4">
        {tanks.map(tank => {
          const preview = litresPreview(tank)
          const chartEmpty = !tank.calibration_profile || tank.calibration_profile.length === 0
          const isPetrol = tank.fuel_type?.toUpperCase() === 'PMA'
          return (
            <div key={tank.id} className="flex items-center gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  {fuelLabel(tank.fuel_type)} Tank
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="cm"
                  value={cmMap[tank.id] ?? ''}
                  onChange={e => setCm(tank.id, e.target.value)}
                  disabled={saved}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 disabled:bg-gray-50 disabled:text-gray-400"
                />
              </div>
              <div className="w-36 text-right">
                {chartEmpty && isPetrol ? (
                  <p className="text-xs text-amber-500 font-medium">Chart pending</p>
                ) : preview != null ? (
                  <p className="text-base font-semibold text-gray-700">
                    {Math.round(preview).toLocaleString()} <span className="text-xs font-normal text-gray-400">L</span>
                  </p>
                ) : (
                  <p className="text-xs text-gray-300">— L</p>
                )}
                {tank.capacity_litres && (
                  <p className="text-xs text-gray-400">{tank.capacity_litres.toLocaleString()} L cap</p>
                )}
              </div>
            </div>
          )
        })}
        {tanks.length === 0 && (
          <p className="text-sm text-gray-400">No active tanks found.</p>
        )}
      </div>
    </div>
  )
}
