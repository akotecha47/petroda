import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

function ReadOnlyField({ label, value }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">{value ?? '—'}</p>
    </div>
  )
}

export default function ShiftCorrection() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const original = location.state?.entry

  const [pma, setPma] = useState('')
  const [ago, setAgo] = useState('')
  const [cash, setCash] = useState('')
  const [card, setCard] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  if (!user) return null

  if (!original) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">No entry selected for correction.</p>
          <Link to="/app/manager/shifts" className="text-indigo-600 hover:underline text-sm">
            ← Back to Shift Review
          </Link>
        </div>
      </div>
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!reason.trim()) { setError('Reason is required.'); return }
    setSaving(true)
    setError(null)

    // 1. Insert corrected entry (the live record going forward)
    const { data: newEntry, error: insertErr } = await supabase
      .from('attendant_entries')
      .insert({
        shift_id: original.shift_id,
        attendant_id: original.attendant_id,
        pma_litres_sold: Number(pma),
        ago_litres_sold: Number(ago),
        cash_collected: Number(cash),
        card_collected: Number(card),
        is_corrected: false,
      })
      .select('id')
      .single()

    if (insertErr) { setError(insertErr.message); setSaving(false); return }

    // 2. Mark original as corrected, link to new entry
    const { error: updateErr } = await supabase
      .from('attendant_entries')
      .update({ is_corrected: true, correction_id: newEntry.id })
      .eq('id', original.id)

    if (updateErr) { setError(updateErr.message); setSaving(false); return }

    // 3. Insert audit record in corrections table
    const { error: corrErr } = await supabase
      .from('corrections')
      .insert({
        original_entry_id: original.id,
        corrected_entry_id: newEntry.id,
        corrected_by: user.id,
        reason: reason.trim(),
        corrected_at: new Date().toISOString(),
      })

    if (corrErr) { setError(corrErr.message); setSaving(false); return }

    navigate('/app/manager/shifts')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3">
        <Link to="/app/manager/shifts" className="text-gray-400 hover:text-gray-700 text-sm">← Shift Review</Link>
        <span className="text-gray-300">|</span>
        <span className="font-semibold text-gray-800">Correct Entry</span>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Original values — read only */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Original Values</h2>
          <div className="grid grid-cols-2 gap-4">
            <ReadOnlyField label="Shift" value={original.shift_type} />
            <ReadOnlyField label="Attendant" value={original.attendant_name} />
            <ReadOnlyField label="PMS Litres" value={original.pma_litres_sold} />
            <ReadOnlyField label="AGO Litres" value={original.ago_litres_sold} />
            <ReadOnlyField label="Cash Collected" value={original.cash_collected != null ? Number(original.cash_collected).toLocaleString() : null} />
            <ReadOnlyField label="Card Collected" value={original.card_collected != null ? Number(original.card_collected).toLocaleString() : null} />
          </div>
        </div>

        {/* Correction form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <h2 className="text-sm font-semibold text-gray-700">Corrected Values</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">PMS Litres</label>
              <input
                type="number" min="0" step="0.01" required
                placeholder={original.pma_litres_sold ?? 0}
                value={pma}
                onChange={e => setPma(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">AGO Litres</label>
              <input
                type="number" min="0" step="0.01" required
                placeholder={original.ago_litres_sold ?? 0}
                value={ago}
                onChange={e => setAgo(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Cash Collected</label>
              <input
                type="number" min="0" step="0.01" required
                placeholder={original.cash_collected ?? 0}
                value={cash}
                onChange={e => setCash(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Card Collected</label>
              <input
                type="number" min="0" step="0.01" required
                placeholder={original.card_collected ?? 0}
                value={card}
                onChange={e => setCard(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              required
              rows={3}
              placeholder="Explain why this correction is needed…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
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
              {saving ? 'Saving…' : 'Submit Correction'}
            </button>
            <Link
              to="/app/manager/shifts"
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
