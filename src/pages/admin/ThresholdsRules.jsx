import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

const THRESHOLDS = [
  {
    key: 'fuel_variance_limit',
    label: 'Fuel Variance Limit',
    unit: 'L',
    description: 'Flag if fuel variance exceeds this many litres',
    defaultValue: 100,
  },
  {
    key: 'cash_variance_limit',
    label: 'Cash Variance Limit',
    unit: 'MWK',
    description: 'Flag if cash variance exceeds this amount',
    defaultValue: 5000,
  },
]

export default function ThresholdsRules() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [rows, setRows] = useState({})
  const [loading, setLoading] = useState(true)
  const [editKey, setEditKey] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function loadData() {
    setLoading(true)
    const { data } = await supabase
      .from('thresholds')
      .select('id, rule_key, rule_value, updated_by, updated_at, users!updated_by(full_name)')
      .in('rule_key', ['fuel_variance_limit', 'cash_variance_limit'])

    const byKey = {}
    ;(data ?? []).forEach(r => { byKey[r.rule_key] = r })

    for (const t of THRESHOLDS) {
      if (!byKey[t.key] && user?.id) {
        const { data: seeded } = await supabase
          .from('thresholds')
          .insert({
            rule_key: t.key,
            rule_value: t.defaultValue,
            updated_by: user.id,
            updated_at: new Date().toISOString(),
          })
          .select('id, rule_key, rule_value, updated_by, updated_at, users!updated_by(full_name)')
          .single()
        if (seeded) byKey[t.key] = seeded
      }
    }

    setRows(byKey)
    setLoading(false)
  }

  useEffect(() => {
    if (!user) return
    loadData()
  }, [user])

  function startEdit(key, currentValue) {
    setEditKey(key)
    setEditValue(currentValue != null ? String(currentValue) : '')
    setError('')
  }

  async function handleSave(key) {
    const parsed = parseFloat(editValue)
    if (isNaN(parsed) || parsed < 0) { setError('Enter a valid positive number.'); return }
    setSaving(true)
    const row = rows[key]
    const { error: err } = await supabase
      .from('thresholds')
      .update({ rule_value: parsed, updated_by: user.id, updated_at: new Date().toISOString() })
      .eq('id', row.id)
    setSaving(false)
    if (err) { setError(err.message); return }
    setEditKey(null)
    loadData()
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-5 py-3.5 flex items-center justify-between" style={{ backgroundColor: '#06476B' }}>
        <div>
          <p className="text-white font-bold leading-tight">Variance Thresholds</p>
          <p className="text-xs" style={{ color: '#89c4d4' }}>Values that trigger flags in reconciliation</p>
        </div>
        <button
          onClick={() => navigate('/owner')}
          className="text-sm px-3 py-1.5 rounded-lg text-white border border-white/30 hover:bg-white/10"
        >
          ← Back
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-6 space-y-4">
        {loading ? (
          [...Array(2)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 h-24 animate-pulse" />
          ))
        ) : (
          THRESHOLDS.map(t => {
            const row = rows[t.key]
            const isEditing = editKey === t.key
            return (
              <div key={t.key} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800 text-sm">{t.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{t.description}</p>
                  </div>
                  {!isEditing && (
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-2xl font-bold tabular-nums text-gray-900 leading-none">
                          {row ? row.rule_value.toLocaleString() : '—'}
                          <span className="text-sm font-normal text-gray-400 ml-1">{t.unit}</span>
                        </p>
                        {row?.updated_at && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {new Date(row.updated_at).toLocaleDateString()}
                            {row.users?.full_name && ` · ${row.users.full_name}`}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => startEdit(t.key, row?.rule_value)}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg text-white hover:opacity-90"
                        style={{ backgroundColor: '#1988A3' }}
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>

                {isEditing && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        className="w-36 border border-gray-200 rounded-lg px-3 py-2 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-teal-400"
                        autoFocus
                      />
                      <span className="text-sm text-gray-500">{t.unit}</span>
                      <button
                        onClick={() => handleSave(t.key)}
                        disabled={saving}
                        className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 hover:opacity-90"
                        style={{ backgroundColor: '#06476B' }}
                      >
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        onClick={() => { setEditKey(null); setError('') }}
                        className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                    {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
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
