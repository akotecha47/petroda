import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import AdminNav from '../../components/admin/AdminNav'

const DIRECTION_BADGE = {
  in: 'bg-green-100 text-green-700',
  out: 'bg-red-100 text-red-700',
  both: 'bg-gray-100 text-gray-600',
}

const BLANK_FORM = { name: '', direction_default: 'in' }

export default function PaymentMethods() {
  const { user } = useAuth()
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState(BLANK_FORM)
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState('')

  async function loadData() {
    setLoading(true)
    const { data } = await supabase
      .from('payment_categories')
      .select('id, name, direction_default, is_active')
      .order('name')
    setCategories(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    if (!user) return
    loadData()
  }, [user])

  async function handleAdd(e) {
    e.preventDefault()
    setAddError('')
    setAddSaving(true)
    const { error } = await supabase.from('payment_categories').insert({
      name: addForm.name.trim(),
      direction_default: addForm.direction_default,
      is_active: true,
    })
    setAddSaving(false)
    if (error) { setAddError(error.message); return }
    setShowAdd(false)
    setAddForm(BLANK_FORM)
    loadData()
  }

  async function handleToggleActive(c) {
    await supabase.from('payment_categories').update({ is_active: !c.is_active }).eq('id', c.id)
    loadData()
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xs font-semibold uppercase tracking-widest text-gray-400">Payment Methods</h1>
          <button
            onClick={() => { setShowAdd(v => !v); setAddError('') }}
            className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
          >
            {showAdd ? 'Cancel' : '+ Add Category'}
          </button>
        </div>

        {showAdd && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">New Payment Category</p>
            <form onSubmit={handleAdd} className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
                <input
                  required
                  value={addForm.name}
                  onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                  placeholder="e.g. Mobile Money"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Direction</label>
                <select
                  value={addForm.direction_default}
                  onChange={e => setAddForm(f => ({ ...f, direction_default: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white"
                >
                  <option value="in">In (receipt)</option>
                  <option value="out">Out (expense)</option>
                  <option value="both">Both</option>
                </select>
              </div>
              {addError && <p className="col-span-2 text-sm text-red-600">{addError}</p>}
              <div className="col-span-2 flex justify-end">
                <button
                  type="submit"
                  disabled={addSaving}
                  className="px-5 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-50"
                >
                  {addSaving ? 'Saving…' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-5 h-32 animate-pulse" />
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Name</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Direction</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Active</th>
                </tr>
              </thead>
              <tbody>
                {categories.map(c => (
                  <tr key={c.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-5 py-3 text-gray-800 font-medium">{c.name}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${DIRECTION_BADGE[c.direction_default] ?? 'bg-gray-100 text-gray-500'}`}>
                        {c.direction_default}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <button
                        onClick={() => handleToggleActive(c)}
                        className={`w-8 h-4 rounded-full transition-colors ${c.is_active ? 'bg-green-500' : 'bg-gray-200'}`}
                      >
                        <span className={`block w-3 h-3 rounded-full bg-white shadow transition-transform mx-0.5 ${c.is_active ? 'translate-x-4' : ''}`} />
                      </button>
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
