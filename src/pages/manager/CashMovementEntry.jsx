import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

function nowLocalDatetime() {
  const d = new Date()
  d.setSeconds(0, 0)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function CashMovementEntry() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [direction, setDirection] = useState('in')
  const [categories, setCategories] = useState([])
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState('')
  const [datetime, setDatetime] = useState(nowLocalDatetime)
  const [referenceNote, setReferenceNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    supabase
      .from('payment_categories')
      .select('id, name, direction_default')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => { setCategories(data ?? []) })
  }, [])

  // Reset category when direction changes
  useEffect(() => { setCategoryId('') }, [direction])

  if (!user) return null

  const filteredCategories = categories.filter(
    c => c.direction_default === direction || c.direction_default === 'both',
  )

  async function handleSubmit(e) {
    e.preventDefault()
    if (!categoryId) { setError('Please select a category.'); return }
    setSaving(true)
    setError(null)

    const { error: err } = await supabase
      .from('cash_movements')
      .insert({
        station_id: user.station_id,
        direction,
        category_id: categoryId,
        amount: Number(amount),
        movement_datetime: new Date(datetime).toISOString(),
        recorded_by: user.id,
        reference_note: referenceNote.trim() || null,
      })

    if (err) { setError(err.message); setSaving(false); return }
    navigate('/app/manager/cash')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3">
        <Link to="/app/manager/cash" className="text-gray-400 hover:text-gray-700 text-sm">← Cash Log</Link>
        <span className="text-gray-300">|</span>
        <span className="font-semibold text-gray-800">Record Cash Movement</span>
      </div>

      <div className="max-w-lg mx-auto px-6 py-8">
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">

          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Direction</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDirection('in')}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  direction === 'in'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                IN
              </button>
              <button
                type="button"
                onClick={() => setDirection('out')}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  direction === 'out'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                OUT
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wide block mb-1">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white"
            >
              <option value="">Select category…</option>
              {filteredCategories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wide block mb-1">
              Amount (MWK) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">MWK</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full border border-gray-200 rounded-lg pl-12 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wide block mb-1">Date &amp; Time</label>
            <input
              type="datetime-local"
              required
              value={datetime}
              onChange={e => setDatetime(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wide block mb-1">Reference Note (optional)</label>
            <input
              type="text"
              value={referenceNote}
              onChange={e => setReferenceNote(e.target.value)}
              placeholder="Invoice number, supplier name, etc."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
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
              {saving ? 'Saving…' : 'Save Movement'}
            </button>
            <Link
              to="/app/manager/cash"
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
