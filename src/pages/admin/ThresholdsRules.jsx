import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import AdminNav from '../../components/admin/AdminNav'

const RULE_LABELS = {
  fuel_variance_warning: 'Fuel Variance Warning',
  fuel_variance_critical: 'Fuel Variance Critical',
  payment_variance_warning: 'Payment Variance Warning',
  payment_variance_critical: 'Payment Variance Critical',
  positive_variance_warning: 'Positive Variance Warning',
  positive_variance_critical: 'Positive Variance Critical',
  low_stock_warning: 'Low Stock Warning',
  low_stock_critical: 'Low Stock Critical',
}

export default function ThresholdsRules() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function loadData() {
    setLoading(true)
    const { data } = await supabase
      .from('thresholds')
      .select('id, rule_key, rule_value, description, updated_by, updated_at, users!updated_by(full_name)')
      .order('rule_key')
    setRows(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    if (!user) return
    loadData()
  }, [user])

  function startEdit(row) {
    setEditId(row.id)
    setEditValue((row.rule_value * 100).toFixed(2))
    setError('')
  }

  async function handleSave(row) {
    const parsed = parseFloat(editValue)
    if (isNaN(parsed) || parsed < 0) { setError('Enter a valid positive number.'); return }
    setSaving(true)
    const { error: err } = await supabase
      .from('thresholds')
      .update({ rule_value: parsed / 100, updated_by: user.id, updated_at: new Date().toISOString() })
      .eq('id', row.id)
    setSaving(false)
    if (err) { setError(err.message); return }
    setEditId(null)
    loadData()
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <div className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-6">Thresholds & Rules</h1>
        <p className="text-sm text-gray-500 mb-6">Values are stored as decimals. Display and edit are in percentage (e.g. 0.5 = 0.5%).</p>

        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-5 h-32 animate-pulse" />
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Rule</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Description</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Value</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Last Updated</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-5 py-3 text-gray-800 font-medium">{RULE_LABELS[row.rule_key] ?? row.rule_key}</td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{row.description ?? '—'}</td>
                    <td className="px-5 py-3 text-right">
                      {editId === row.id ? (
                        <div className="flex items-center justify-end gap-1">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            className="border border-gray-200 rounded px-2 py-1 text-sm w-20 text-right"
                          />
                          <span className="text-gray-400 text-xs">%</span>
                        </div>
                      ) : (
                        <span className="tabular-nums font-medium text-gray-700">
                          {(row.rule_value * 100).toFixed(2)}%
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-400 text-xs">
                      {row.updated_at
                        ? `${new Date(row.updated_at).toLocaleDateString()} by ${row.users?.full_name ?? '—'}`
                        : '—'}
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      {editId === row.id ? (
                        <>
                          {error && <span className="text-xs text-red-500 mr-2">{error}</span>}
                          <button
                            onClick={() => handleSave(row)}
                            disabled={saving}
                            className="text-xs px-3 py-1 bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50 mr-2"
                          >
                            {saving ? '…' : 'Save'}
                          </button>
                          <button onClick={() => setEditId(null)} className="text-xs text-gray-400 hover:text-gray-700">Cancel</button>
                        </>
                      ) : (
                        <button onClick={() => startEdit(row)} className="text-xs text-gray-400 hover:text-gray-700 underline">Edit</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
