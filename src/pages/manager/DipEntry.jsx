import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { todayISO } from '../../lib/shiftUtils'
import { interpolateLitres } from '../../lib/dipUtils'
import { fuelLabel } from '../../lib/fuelLabels'

const EMPTY_DIPS = {
  opening_dip_petrol_cm: '',
  opening_dip_petrol_litres: null,
  opening_dip_diesel_cm: '',
  opening_dip_diesel_litres: null,
  closing_dip_petrol_cm: '',
  closing_dip_petrol_litres: null,
  closing_dip_diesel_cm: '',
  closing_dip_diesel_litres: null,
}

export default function DipEntry() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const today = todayISO()

  const [tanks, setTanks] = useState([])
  const [formId, setFormId] = useState(null)
  const [formStatus, setFormStatus] = useState('draft')
  const [dips, setDips] = useState(EMPTY_DIPS)
  const [showSaved, setShowSaved] = useState(false)
  const [error, setError] = useState(null)

  const formIdRef = useRef(null)
  const dipsRef = useRef(EMPTY_DIPS)
  const tanksRef = useRef([])
  const saveTimerRef = useRef(null)
  const savedTimerRef = useRef(null)

  useEffect(() => {
    if (!user?.station_id) return

    async function load() {
      const { data: tanksData } = await supabase
        .from('tanks')
        .select('id, label, fuel_type, capacity_litres, calibration_profile')
        .eq('station_id', user.station_id)
        .eq('is_active', true)
        .order('fuel_type')
        .order('label')

      tanksRef.current = tanksData ?? []
      setTanks(tanksData ?? [])

      const { data: existing } = await supabase
        .from('daily_sales_forms')
        .select([
          'id', 'status',
          'opening_dip_petrol_cm', 'opening_dip_petrol_litres',
          'opening_dip_diesel_cm', 'opening_dip_diesel_litres',
          'closing_dip_petrol_cm', 'closing_dip_petrol_litres',
          'closing_dip_diesel_cm', 'closing_dip_diesel_litres',
        ].join(', '))
        .eq('station_id', user.station_id)
        .eq('form_date', today)
        .maybeSingle()

      let fId = null, fStatus = 'draft'
      if (existing) {
        fId = existing.id
        fStatus = existing.status
        const loaded = {
          opening_dip_petrol_cm:     existing.opening_dip_petrol_cm     != null ? String(existing.opening_dip_petrol_cm)     : '',
          opening_dip_petrol_litres: existing.opening_dip_petrol_litres ?? null,
          opening_dip_diesel_cm:     existing.opening_dip_diesel_cm     != null ? String(existing.opening_dip_diesel_cm)     : '',
          opening_dip_diesel_litres: existing.opening_dip_diesel_litres ?? null,
          closing_dip_petrol_cm:     existing.closing_dip_petrol_cm     != null ? String(existing.closing_dip_petrol_cm)     : '',
          closing_dip_petrol_litres: existing.closing_dip_petrol_litres ?? null,
          closing_dip_diesel_cm:     existing.closing_dip_diesel_cm     != null ? String(existing.closing_dip_diesel_cm)     : '',
          closing_dip_diesel_litres: existing.closing_dip_diesel_litres ?? null,
        }
        setDips(loaded)
        dipsRef.current = loaded
      } else {
        const { data: created } = await supabase
          .from('daily_sales_forms')
          .insert({ station_id: user.station_id, form_date: today, status: 'draft', submitted_by: user.id })
          .select('id, status')
          .single()
        if (created) { fId = created.id; fStatus = created.status }
      }

      formIdRef.current = fId
      setFormId(fId)
      setFormStatus(fStatus)
    }

    load()
  }, [user?.station_id, today])

  function computeLitres(cmField, cmStr) {
    const cm = parseFloat(cmStr)
    if (isNaN(cm) || cm <= 0) return null
    const fuelType = cmField.includes('petrol') ? 'PMA' : 'AGO'
    const tank = tanksRef.current.find(t => t.fuel_type?.toUpperCase() === fuelType)
    return interpolateLitres(cm, tank?.calibration_profile ?? [])
  }

  function handleChange(cmField, cmValue) {
    const litresField = cmField.replace('_cm', '_litres')
    const litres = computeLitres(cmField, cmValue)

    setDips(prev => {
      const next = { ...prev, [cmField]: cmValue, [litresField]: litres }
      dipsRef.current = next
      return next
    })
    setShowSaved(false)

    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      const fId = formIdRef.current
      if (!fId) return
      const d = dipsRef.current
      const { error: err } = await supabase
        .from('daily_sales_forms')
        .update({
          opening_dip_petrol_cm:     parseFloat(d.opening_dip_petrol_cm) > 0  ? parseFloat(d.opening_dip_petrol_cm)  : null,
          opening_dip_petrol_litres: parseFloat(d.opening_dip_petrol_cm) > 0  ? d.opening_dip_petrol_litres          : null,
          opening_dip_diesel_cm:     parseFloat(d.opening_dip_diesel_cm) > 0  ? parseFloat(d.opening_dip_diesel_cm)  : null,
          opening_dip_diesel_litres: parseFloat(d.opening_dip_diesel_cm) > 0  ? d.opening_dip_diesel_litres          : null,
          closing_dip_petrol_cm:     parseFloat(d.closing_dip_petrol_cm) > 0  ? parseFloat(d.closing_dip_petrol_cm)  : null,
          closing_dip_petrol_litres: parseFloat(d.closing_dip_petrol_cm) > 0  ? d.closing_dip_petrol_litres          : null,
          closing_dip_diesel_cm:     parseFloat(d.closing_dip_diesel_cm) > 0  ? parseFloat(d.closing_dip_diesel_cm)  : null,
          closing_dip_diesel_litres: parseFloat(d.closing_dip_diesel_cm) > 0  ? d.closing_dip_diesel_litres          : null,
        })
        .eq('id', fId)
      if (err) {
        setError(err.message)
      } else {
        clearTimeout(savedTimerRef.current)
        setShowSaved(true)
        savedTimerRef.current = setTimeout(() => setShowSaved(false), 2000)
      }
    }, 500)
  }

  if (!user) return null

  const readOnly = formStatus === 'submitted'
  const petrolTank = tanks.find(t => t.fuel_type?.toUpperCase() === 'PMA')
  const dieselTank  = tanks.find(t => t.fuel_type?.toUpperCase() === 'AGO')

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-5 py-3.5 flex items-center justify-between" style={{ backgroundColor: '#06476B' }}>
        <div>
          <p className="text-white font-bold leading-tight">Record Dip</p>
          <p className="text-xs" style={{ color: '#89c4d4' }}>{today} · 06:00–18:00</p>
        </div>
        <div className="flex items-center gap-3">
          {showSaved && <span className="text-xs font-medium" style={{ color: '#89c4d4' }}>Saved</span>}
          <button
            onClick={() => navigate('/manager')}
            className="text-sm px-3 py-1.5 rounded-lg text-white border border-white/30 hover:bg-white/10"
          >
            ← Back
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-6 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
        )}
        {readOnly && (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-4 py-3 text-sm">
            Form submitted — dip values are read-only.
          </div>
        )}

        <DipSection
          title="Opening Dip"
          subtitle="Start of shift"
          petrolTank={petrolTank}
          dieselTank={dieselTank}
          petrolCm={dips.opening_dip_petrol_cm}
          petrolLitres={dips.opening_dip_petrol_litres}
          dieselCm={dips.opening_dip_diesel_cm}
          dieselLitres={dips.opening_dip_diesel_litres}
          onPetrolChange={v => handleChange('opening_dip_petrol_cm', v)}
          onDieselChange={v => handleChange('opening_dip_diesel_cm', v)}
          readOnly={readOnly}
        />

        <DipSection
          title="Closing Dip"
          subtitle="End of shift"
          petrolTank={petrolTank}
          dieselTank={dieselTank}
          petrolCm={dips.closing_dip_petrol_cm}
          petrolLitres={dips.closing_dip_petrol_litres}
          dieselCm={dips.closing_dip_diesel_cm}
          dieselLitres={dips.closing_dip_diesel_litres}
          onPetrolChange={v => handleChange('closing_dip_petrol_cm', v)}
          onDieselChange={v => handleChange('closing_dip_diesel_cm', v)}
          readOnly={readOnly}
        />
      </div>
    </div>
  )
}

function DipSection({
  title, subtitle,
  petrolTank, dieselTank,
  petrolCm, petrolLitres,
  dieselCm, dieselLitres,
  onPetrolChange, onDieselChange,
  readOnly,
}) {
  const hasAny = parseFloat(petrolCm) > 0 || parseFloat(dieselCm) > 0
  return (
    <div className={`bg-white rounded-xl border overflow-hidden ${hasAny ? 'border-teal-200' : 'border-gray-200'}`}>
      <div className={`px-5 py-3 border-b ${hasAny ? 'bg-teal-50 border-teal-100' : 'bg-gray-50 border-gray-100'}`}>
        <p className="text-sm font-semibold text-gray-700">{title}</p>
        <p className="text-xs text-gray-400">{subtitle}</p>
      </div>
      <div className="p-5 space-y-4">
        <TankRow
          label={fuelLabel('PMA') + ' Tank'}
          cm={petrolCm}
          litres={petrolLitres}
          chartPending={!petrolTank?.calibration_profile?.length}
          capacity={petrolTank?.capacity_litres}
          onChange={onPetrolChange}
          readOnly={readOnly}
        />
        <TankRow
          label={fuelLabel('AGO') + ' Tank'}
          cm={dieselCm}
          litres={dieselLitres}
          chartPending={false}
          capacity={dieselTank?.capacity_litres}
          onChange={onDieselChange}
          readOnly={readOnly}
        />
      </div>
    </div>
  )
}

function TankRow({ label, cm, litres, chartPending, capacity, onChange, readOnly }) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex-1">
        <label className="text-sm font-medium text-gray-700 block mb-1">{label}</label>
        <input
          type="number"
          min="0"
          step="0.1"
          placeholder="cm"
          value={cm}
          onChange={e => onChange(e.target.value)}
          disabled={readOnly}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 disabled:bg-gray-50 disabled:text-gray-400"
        />
      </div>
      <div className="w-40 text-right">
        {chartPending ? (
          <p className="text-xs text-amber-500 font-medium">Chart pending</p>
        ) : litres != null ? (
          <p className="text-base font-semibold text-gray-700">
            {Math.round(litres).toLocaleString()}{' '}
            <span className="text-xs font-normal text-gray-400">L</span>
          </p>
        ) : (
          <p className="text-xs text-gray-300">— L</p>
        )}
        {capacity != null && (
          <p className="text-xs text-gray-400">{capacity.toLocaleString()} L cap</p>
        )}
      </div>
    </div>
  )
}
