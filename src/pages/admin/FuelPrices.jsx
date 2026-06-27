import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { fuelLabel } from '../../lib/fuelLabels'

const DEFAULTS = { PMA: 2350, AGO: 2300 }

export default function FuelPrices({ readOnly = false }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isOwner = user?.role === 'owner'
  const canEdit = isOwner && !readOnly
  const backTo = isOwner ? '/owner' : '/admin'

  const [prices, setPrices] = useState({ PMA: [], AGO: [] })
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(null)
  const [newPrice, setNewPrice] = useState('')
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadPrices() {
    setLoading(true)
    const { data } = await supabase
      .from('fuel_prices')
      .select('id, fuel_type, price_per_litre, effective_from, set_by, users!set_by(full_name)')
      .order('effective_from', { ascending: false })
      .limit(30)

    const grouped = { PMA: [], AGO: [] }
    ;(data ?? []).forEach(p => {
      if (p.fuel_type === 'PMA') grouped.PMA.push(p)
      else if (p.fuel_type === 'AGO') grouped.AGO.push(p)
    })

    if (canEdit) {
      for (const ft of ['PMA', 'AGO']) {
        if (grouped[ft].length === 0) {
          const { data: seeded } = await supabase
            .from('fuel_prices')
            .insert({
              fuel_type: ft,
              price_per_litre: DEFAULTS[ft],
              effective_from: new Date().toISOString(),
              set_by: user.id,
            })
            .select('id, fuel_type, price_per_litre, effective_from, set_by, users!set_by(full_name)')
            .single()
          if (seeded) grouped[ft] = [seeded]
        }
      }
    }

    setPrices(grouped)
    setLoading(false)
  }

  useEffect(() => {
    if (!user) return
    loadPrices()
  }, [user])

  async function handleUpdate(ft) {
    setSaveError('')
    const p = parseFloat(newPrice)
    if (isNaN(p) || p <= 0) { setSaveError('Enter a valid price.'); return }
    setSaving(true)
    const { error } = await supabase.from('fuel_prices').insert({
      fuel_type: ft,
      price_per_litre: p,
      effective_from: new Date().toISOString(),
      set_by: user.id,
    })
    setSaving(false)
    if (error) { setSaveError(error.message); return }
    setUpdating(null)
    setNewPrice('')
    loadPrices()
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-5 py-3.5 flex items-center justify-between" style={{ backgroundColor: '#06476B' }}>
        <div>
          <p className="text-white font-bold leading-tight">Fuel Prices</p>
          <p className="text-xs" style={{ color: '#89c4d4' }}>
            {readOnly ? 'Read only — set by owner' : 'Price per litre (MWK)'}
          </p>
        </div>
        <button
          onClick={() => navigate(backTo)}
          className="text-sm px-3 py-1.5 rounded-lg text-white border border-white/30 hover:bg-white/10"
        >
          ← Back
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-6 space-y-5">
        {!canEdit && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
            Price history is read-only. Only the owner can update fuel prices.
          </div>
        )}

        {loading ? (
          [...Array(2)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 h-32 animate-pulse" />
          ))
        ) : (
          ['PMA', 'AGO'].map(ft => {
            const history = prices[ft] ?? []
            const current = history[0]
            const isEditing = updating === ft
            return (
              <div key={ft} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
                        {fuelLabel(ft)} — Current Price
                      </p>
                      <p className="text-3xl font-bold text-gray-900 leading-none">
                        {current ? current.price_per_litre.toLocaleString() : '—'}
                        <span className="text-sm font-normal text-gray-400 ml-1">MWK / L</span>
                      </p>
                      {current && (
                        <p className="text-xs text-gray-400 mt-1">
                          Since {new Date(current.effective_from).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {current.users?.full_name && ` · ${current.users.full_name}`}
                        </p>
                      )}
                    </div>
                    {canEdit && !isEditing && (
                      <button
                        onClick={() => { setUpdating(ft); setNewPrice(''); setSaveError('') }}
                        className="flex-shrink-0 px-4 py-2 text-sm font-medium rounded-lg text-white hover:opacity-90 transition-opacity"
                        style={{ backgroundColor: '#1988A3' }}
                      >
                        Update Price
                      </button>
                    )}
                  </div>

                  {isEditing && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-xs font-medium text-gray-500 mb-2">New price (MWK / L)</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={newPrice}
                          onChange={e => setNewPrice(e.target.value)}
                          className="w-40 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                          placeholder="e.g. 2350"
                          autoFocus
                        />
                        <button
                          onClick={() => handleUpdate(ft)}
                          disabled={saving}
                          className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 hover:opacity-90"
                          style={{ backgroundColor: '#06476B' }}
                        >
                          {saving ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          onClick={() => { setUpdating(null); setSaveError('') }}
                          className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
                        >
                          Cancel
                        </button>
                      </div>
                      {saveError && <p className="text-xs text-red-600 mt-1">{saveError}</p>}
                    </div>
                  )}
                </div>

                {history.length > 1 && (
                  <div className="border-t border-gray-100">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide px-5 pt-3 pb-1">
                      Recent History
                    </p>
                    {history.slice(1, 6).map(p => (
                      <div key={p.id} className="flex items-center justify-between px-5 py-2 border-t border-gray-50">
                        <span className="text-xs text-gray-400">
                          {new Date(p.effective_from).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {p.users?.full_name && ` · ${p.users.full_name}`}
                        </span>
                        <span className="text-sm tabular-nums text-gray-600 font-medium">
                          {p.price_per_litre.toLocaleString()} MWK
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
