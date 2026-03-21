import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import AdminNav from '../../components/admin/AdminNav'

const BLANK_STATION = { name: '', location: '' }

export default function StationManagement() {
  const { user } = useAuth()
  const [stations, setStations] = useState([])
  const [tanks, setTanks] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState(BLANK_STATION)
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState('')
  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [editSaving, setEditSaving] = useState(false)
  const [expandedId, setExpandedId] = useState(null)

  async function loadData() {
    setLoading(true)
    const [{ data: stationsData }, { data: tanksData }] = await Promise.all([
      supabase.from('stations').select('id, name, location, is_active').order('name'),
      supabase.from('tanks').select('id, station_id, fuel_type, capacity_litres, is_active').order('fuel_type'),
    ])
    setStations(stationsData ?? [])
    setTanks(tanksData ?? [])
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
    const { error } = await supabase.from('stations').insert({
      name: addForm.name.trim(),
      location: addForm.location.trim() || null,
      is_active: true,
    })
    setAddSaving(false)
    if (error) { setAddError(error.message); return }
    setShowAdd(false)
    setAddForm(BLANK_STATION)
    loadData()
  }

  async function handleToggleActive(s) {
    await supabase.from('stations').update({ is_active: !s.is_active }).eq('id', s.id)
    loadData()
  }

  function startEdit(s) {
    setEditId(s.id)
    setEditForm({ name: s.name, location: s.location ?? '' })
  }

  async function handleEditSave(id) {
    setEditSaving(true)
    await supabase.from('stations').update({ name: editForm.name.trim(), location: editForm.location.trim() || null }).eq('id', id)
    setEditSaving(false)
    setEditId(null)
    loadData()
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xs font-semibold uppercase tracking-widest text-gray-400">Station Management</h1>
          <button
            onClick={() => { setShowAdd(v => !v); setAddError('') }}
            className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
          >
            {showAdd ? 'Cancel' : '+ Add Station'}
          </button>
        </div>

        {showAdd && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">New Station</p>
            <form onSubmit={handleAdd} className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Station Name</label>
                <input
                  required
                  value={addForm.name}
                  onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Location</label>
                <input
                  value={addForm.location}
                  onChange={e => setAddForm(f => ({ ...f, location: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                />
              </div>
              {addError && <p className="col-span-2 text-sm text-red-600">{addError}</p>}
              <div className="col-span-2 flex justify-end">
                <button
                  type="submit"
                  disabled={addSaving}
                  className="px-5 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-50"
                >
                  {addSaving ? 'Saving…' : 'Create Station'}
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-5 h-32 animate-pulse" />
        ) : (
          <>
            {/* Mobile: station cards */}
            <div className="md:hidden space-y-3">
              {stations.map(s => {
                const stationTanks = tanks.filter(t => t.station_id === s.id)
                return (
                  <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-4">
                    {editId === s.id ? (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">Station Name</label>
                          <input
                            value={editForm.name}
                            onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">Location</label>
                          <input
                            value={editForm.location}
                            onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))}
                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditSave(s.id)}
                            disabled={editSaving}
                            className="flex-1 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-50"
                          >
                            {editSaving ? '…' : 'Save'}
                          </button>
                          <button onClick={() => setEditId(null)} className="px-4 py-2 text-sm text-gray-400 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-gray-800 text-sm">{s.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{s.location ?? '—'}</p>
                          <p className="text-xs text-gray-500 mt-1">{stationTanks.length} tank{stationTanks.length !== 1 ? 's' : ''}</p>
                          <span className={`inline-block mt-1.5 text-xs px-2 py-0.5 rounded-full ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {s.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          <button
                            onClick={() => handleToggleActive(s)}
                            className={`w-8 h-4 rounded-full transition-colors ${s.is_active ? 'bg-green-500' : 'bg-gray-200'}`}
                          >
                            <span className={`block w-3 h-3 rounded-full bg-white shadow transition-transform mx-0.5 ${s.is_active ? 'translate-x-4' : ''}`} />
                          </button>
                          <button onClick={() => startEdit(s)} className="text-xs text-gray-400 hover:text-gray-700 underline">Edit</button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Desktop: stations table */}
            <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Name</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Location</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Tanks</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Active</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {stations.map(s => {
                  const stationTanks = tanks.filter(t => t.station_id === s.id)
                  const isExpanded = expandedId === s.id
                  return (
                    <>
                      <tr key={s.id} className="border-b border-gray-50">
                        {editId === s.id ? (
                          <>
                            <td className="px-5 py-2">
                              <input
                                value={editForm.name}
                                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                                className="border border-gray-200 rounded px-2 py-1 text-sm w-full"
                              />
                            </td>
                            <td className="px-5 py-2">
                              <input
                                value={editForm.location}
                                onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))}
                                className="border border-gray-200 rounded px-2 py-1 text-sm w-full"
                              />
                            </td>
                            <td className="px-5 py-2 text-center text-gray-500">{stationTanks.length}</td>
                            <td className="px-5 py-2 text-center">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                {s.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="px-5 py-2 text-right whitespace-nowrap">
                              <button
                                onClick={() => handleEditSave(s.id)}
                                disabled={editSaving}
                                className="text-xs px-3 py-1 bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50 mr-2"
                              >
                                {editSaving ? '…' : 'Save'}
                              </button>
                              <button onClick={() => setEditId(null)} className="text-xs text-gray-400 hover:text-gray-700">Cancel</button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-5 py-3 text-gray-800 font-medium">{s.name}</td>
                            <td className="px-5 py-3 text-gray-500">{s.location ?? '—'}</td>
                            <td className="px-5 py-3 text-center">
                              <button
                                onClick={() => setExpandedId(isExpanded ? null : s.id)}
                                className="text-xs text-blue-600 hover:underline"
                              >
                                {stationTanks.length} {isExpanded ? '▲' : '▼'}
                              </button>
                            </td>
                            <td className="px-5 py-3 text-center">
                              <button
                                onClick={() => handleToggleActive(s)}
                                className={`w-8 h-4 rounded-full transition-colors ${s.is_active ? 'bg-green-500' : 'bg-gray-200'}`}
                              >
                                <span className={`block w-3 h-3 rounded-full bg-white shadow transition-transform mx-0.5 ${s.is_active ? 'translate-x-4' : ''}`} />
                              </button>
                            </td>
                            <td className="px-5 py-3 text-right">
                              <button onClick={() => startEdit(s)} className="text-xs text-gray-400 hover:text-gray-700 underline">Edit</button>
                            </td>
                          </>
                        )}
                      </tr>
                      {isExpanded && (
                        <tr key={`${s.id}-tanks`} className="border-b border-gray-100 bg-gray-50">
                          <td colSpan={5} className="px-8 py-3">
                            {stationTanks.length === 0 ? (
                              <p className="text-xs text-gray-400">No tanks configured.</p>
                            ) : (
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-gray-400 uppercase tracking-wide">
                                    <th className="text-left py-1 font-medium">Fuel Type</th>
                                    <th className="text-right py-1 font-medium">Capacity (L)</th>
                                    <th className="text-center py-1 font-medium">Active</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {stationTanks.map(t => (
                                    <tr key={t.id}>
                                      <td className="py-1 text-gray-700 uppercase">{t.fuel_type}</td>
                                      <td className="py-1 text-right tabular-nums text-gray-600">{(t.capacity_litres ?? 0).toLocaleString()}</td>
                                      <td className="py-1 text-center">
                                        <span className={`px-2 py-0.5 rounded-full ${t.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                          {t.is_active ? 'Yes' : 'No'}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
