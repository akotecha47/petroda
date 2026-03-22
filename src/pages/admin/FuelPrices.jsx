import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import AdminNav from '../../components/admin/AdminNav'

const BLANK_FORM = { fuel_type: 'PMS', price_per_litre: '', effective_from: new Date().toISOString().slice(0, 16) }

export default function FuelPrices() {
  const { user } = useAuth()
  const [prices, setPrices] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState(BLANK_FORM)
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState('')

  const isOwner = user?.role === 'owner'

  async function loadData() {
    setLoading(true)
    const { data } = await supabase
      .from('fuel_prices')
      .select('id, fuel_type, price_per_litre, effective_from, set_by, users!set_by(full_name)')
      .order('effective_from', { ascending: false })
      .limit(50)
    setPrices(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    if (!user) return
    loadData()
  }, [user])

  async function handleAdd(e) {
    e.preventDefault()
    setAddError('')
    const price = parseFloat(addForm.price_per_litre)
    if (isNaN(price) || price <= 0) { setAddError('Enter a valid price.'); return }
    setAddSaving(true)
    const { error } = await supabase.from('fuel_prices').insert({
      fuel_type: addForm.fuel_type,
      price_per_litre: price,
      effective_from: addForm.effective_from,
      set_by: user.id,
    })
    setAddSaving(false)
    if (error) { setAddError(error.message); return }
    setShowAdd(false)
    setAddForm({ ...BLANK_FORM, effective_from: new Date().toISOString().slice(0, 16) })
    loadData()
  }

  const today = new Date().toISOString().slice(0, 10)
  const currentPMS = prices.find(p => p.fuel_type === 'PMS' && p.effective_from.slice(0, 10) <= today)
  const currentAGO = prices.find(p => p.fuel_type === 'AGO' && p.effective_from.slice(0, 10) <= today)

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xs font-semibold uppercase tracking-widest text-gray-400">Fuel Prices</h1>
          {isOwner && (
            <button
              onClick={() => { setShowAdd(v => !v); setAddError('') }}
              className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
            >
              {showAdd ? 'Cancel' : '+ Change Price'}
            </button>
          )}
        </div>

        {!isOwner && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700 mb-6">
            Price history is read-only. Only the owner can set new fuel prices.
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-6">
          {loading ? (
            [...Array(2)].map((_, i) => <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 h-24 animate-pulse" />)
          ) : (
            <>
              {[{ label: 'PMS', entry: currentPMS }, { label: 'AGO', entry: currentAGO }].map(({ label, entry }) => (
                <div key={label} className="bg-white rounded-xl border border-gray-200 p-5">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Current {label} Price</p>
                  <p className="text-2xl font-bold text-gray-900 leading-none">
                    {entry ? entry.price_per_litre.toLocaleString() : '—'}
                    <span className="text-sm font-normal text-gray-400 ml-1">MWK/L</span>
                  </p>
                  {entry && (
                    <p className="text-xs text-gray-400 mt-1">Since {new Date(entry.effective_from).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  )}
                </div>
              ))}
            </>
          )}
        </div>

        {showAdd && isOwner && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">New Price Entry</p>
            <form onSubmit={handleAdd} className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Fuel Type</label>
                <select
                  value={addForm.fuel_type}
                  onChange={e => setAddForm(f => ({ ...f, fuel_type: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white"
                >
                  <option value="PMS">PMS</option>
                  <option value="AGO">AGO</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Price (MWK/L)</label>
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0"
                  value={addForm.price_per_litre}
                  onChange={e => setAddForm(f => ({ ...f, price_per_litre: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Effective From</label>
                <input
                  required
                  type="datetime-local"
                  value={addForm.effective_from}
                  onChange={e => setAddForm(f => ({ ...f, effective_from: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                />
              </div>
              {addError && <p className="col-span-3 text-sm text-red-600">{addError}</p>}
              <div className="col-span-3 flex justify-end">
                <button
                  type="submit"
                  disabled={addSaving}
                  className="px-5 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-50"
                >
                  {addSaving ? 'Saving…' : 'Set Price'}
                </button>
              </div>
            </form>
          </div>
        )}

        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">Price History</h2>
        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-5 h-32 animate-pulse" />
        ) : prices.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-5 text-sm text-gray-400">No price history.</div>
        ) : (
          <>
            {/* Mobile: price history cards */}
            <div className="md:hidden space-y-3">
              {prices.map(p => (
                <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium uppercase ${
                      p.fuel_type === 'PMS' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                    }`}>{p.fuel_type}</span>
                    <span className="text-xl font-bold tabular-nums text-gray-900">
                      {p.price_per_litre.toLocaleString()}
                      <span className="text-xs font-normal text-gray-400 ml-1">MWK/L</span>
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    {p.effective_from ? new Date(p.effective_from).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                    {p.users?.full_name && ` · ${p.users.full_name}`}
                  </p>
                </div>
              ))}
            </div>

            {/* Desktop: price history table */}
            <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Fuel Type</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Price (MWK/L)</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Effective From</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Set By</th>
                  </tr>
                </thead>
                <tbody>
                  {prices.map(p => (
                    <tr key={p.id} className="border-b border-gray-50 last:border-0">
                      <td className="px-5 py-3 text-gray-700 uppercase font-medium">{p.fuel_type}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-gray-700">{p.price_per_litre.toLocaleString()}</td>
                      <td className="px-5 py-3 text-gray-500">{p.effective_from ? new Date(p.effective_from).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                      <td className="px-5 py-3 text-gray-500">{p.users?.full_name ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
