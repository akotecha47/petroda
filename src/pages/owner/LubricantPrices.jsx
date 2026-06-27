import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

export default function LubricantPrices() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [skus, setSkus] = useState([])
  const [prices, setPrices] = useState({})
  const [rowSaving, setRowSaving] = useState({})
  const [rowSaved, setRowSaved] = useState({})
  const [loading, setLoading] = useState(true)
  const [saveAllBusy, setSaveAllBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    supabase
      .from('lubricant_skus')
      .select('id, name, unit_price')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => {
        const loaded = data ?? []
        setSkus(loaded)
        const init = {}
        loaded.forEach(s => { init[s.id] = s.unit_price != null ? String(s.unit_price) : '' })
        setPrices(init)
        setLoading(false)
      })
  }, [user])

  async function saveOne(sku) {
    const p = parseFloat(prices[sku.id])
    if (isNaN(p) || p < 0) return
    setRowSaving(prev => ({ ...prev, [sku.id]: true }))
    const { error: err } = await supabase
      .from('lubricant_skus')
      .update({ unit_price: p })
      .eq('id', sku.id)
    setRowSaving(prev => ({ ...prev, [sku.id]: false }))
    if (err) { setError(err.message); return }
    setRowSaved(prev => ({ ...prev, [sku.id]: true }))
    setTimeout(() => setRowSaved(prev => ({ ...prev, [sku.id]: false })), 2000)
  }

  async function saveAll() {
    setSaveAllBusy(true)
    setError('')
    for (const sku of skus) {
      const p = parseFloat(prices[sku.id])
      if (isNaN(p) || p < 0) continue
      const { error: err } = await supabase
        .from('lubricant_skus').update({ unit_price: p }).eq('id', sku.id)
      if (err) { setError(err.message); setSaveAllBusy(false); return }
    }
    setSaveAllBusy(false)
    const allSaved = {}
    skus.forEach(s => { allSaved[s.id] = true })
    setRowSaved(allSaved)
    setTimeout(() => setRowSaved({}), 2000)
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-5 py-3.5 flex items-center justify-between" style={{ backgroundColor: '#06476B' }}>
        <div>
          <p className="text-white font-bold leading-tight">Lubricant Prices</p>
          <p className="text-xs" style={{ color: '#89c4d4' }}>Unit prices per SKU (MWK)</p>
        </div>
        <button
          onClick={() => navigate('/owner')}
          className="text-sm px-3 py-1.5 rounded-lg text-white border border-white/30 hover:bg-white/10"
        >
          ← Back
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-5 py-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">{error}</div>
        )}

        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-5 h-48 animate-pulse" />
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">SKU</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide w-44">Unit Price (MWK)</th>
                  <th className="px-4 py-3 w-24" />
                </tr>
              </thead>
              <tbody>
                {skus.map((sku, i) => (
                  <tr key={sku.id} className={`border-b border-gray-50 last:border-0 ${i % 2 === 1 ? 'bg-gray-50/30' : ''}`}>
                    <td className="px-4 py-2 text-gray-700 text-xs">{sku.name}</td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={prices[sku.id] ?? ''}
                        onChange={e => setPrices(prev => ({ ...prev, [sku.id]: e.target.value }))}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-sm text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-teal-400"
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      {rowSaved[sku.id] ? (
                        <span className="text-xs text-green-600 font-medium">Saved</span>
                      ) : (
                        <button
                          onClick={() => saveOne(sku)}
                          disabled={rowSaving[sku.id]}
                          className="text-xs px-3 py-1 rounded text-white disabled:opacity-50 hover:opacity-90"
                          style={{ backgroundColor: '#1988A3' }}
                        >
                          {rowSaving[sku.id] ? '…' : 'Save'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && skus.length > 0 && (
          <div className="flex justify-end mt-4">
            <button
              onClick={saveAll}
              disabled={saveAllBusy}
              className="px-6 py-2.5 text-sm font-medium text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
              style={{ backgroundColor: '#06476B' }}
            >
              {saveAllBusy ? 'Saving All…' : 'Save All'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
