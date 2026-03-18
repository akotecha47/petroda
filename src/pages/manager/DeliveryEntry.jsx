import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

function nowLocalDatetime() {
  const d = new Date()
  d.setSeconds(0, 0)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function DeliveryEntry() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [fuelType, setFuelType] = useState('pma')
  const [litres, setLitres] = useState('')
  const [depotRef, setDepotRef] = useState('')
  const [datetime, setDatetime] = useState(nowLocalDatetime)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  if (!user) return null

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const { error: err } = await supabase
      .from('deliveries')
      .insert({
        station_id: user.station_id,
        fuel_type: fuelType.toUpperCase(),
        litres: Number(litres),
        depot_reference: depotRef.trim(),
        delivery_datetime: new Date(datetime).toISOString(),
        recorded_by: user.id,
        note: note.trim() || null,
      })

    if (err) { setError(err.message); setSaving(false); return }
    navigate('/app/manager/stock')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3">
        <Link to="/app/manager/stock" className="text-gray-400 hover:text-gray-700 text-sm">← Stock</Link>
        <span className="text-gray-300">|</span>
        <span className="font-semibold text-gray-800">Record Delivery</span>
      </div>

      <div className="max-w-lg mx-auto px-6 py-8">
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">

          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Fuel Type</p>
            <div className="flex gap-2">
              {['pma', 'ago'].map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFuelType(f)}
                  className={`px-5 py-2 rounded-lg text-sm font-medium uppercase transition-colors ${
                    fuelType === f
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wide block mb-1">Litres</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              required
              value={litres}
              onChange={e => setLitres(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wide block mb-1">
              Depot Reference <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={depotRef}
              onChange={e => setDepotRef(e.target.value)}
              placeholder="e.g. INV-2024-001"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wide block mb-1">Delivery Date &amp; Time</label>
            <input
              type="datetime-local"
              required
              value={datetime}
              onChange={e => setDatetime(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wide block mb-1">Note (optional)</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              placeholder="Driver name, vehicle, etc."
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
              {saving ? 'Saving…' : 'Save Delivery'}
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
