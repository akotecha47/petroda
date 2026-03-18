import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import AdminNav from '../../components/admin/AdminNav'

const ROLES = ['owner', 'admin', 'junior_admin', 'manager', 'attendant']
const ROLE_BADGE = {
  owner: 'bg-purple-100 text-purple-700',
  admin: 'bg-blue-100 text-blue-700',
  junior_admin: 'bg-teal-100 text-teal-700',
  manager: 'bg-amber-100 text-amber-700',
  attendant: 'bg-gray-100 text-gray-600',
}
const STATION_REQUIRED = ['manager', 'attendant']

const BLANK_FORM = { full_name: '', username: '', role: 'attendant', station_id: '', is_active: true }

export default function UserManagement() {
  const { user } = useAuth()
  const [users, setUsers] = useState([])
  const [stations, setStations] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState(BLANK_FORM)
  const [addError, setAddError] = useState('')
  const [addSaving, setAddSaving] = useState(false)
  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [editSaving, setEditSaving] = useState(false)

  async function loadData() {
    setLoading(true)
    const [{ data: usersData }, { data: stationsData }] = await Promise.all([
      supabase.from('users').select('id, full_name, username, role, station_id, is_active, stations(name)').order('full_name'),
      supabase.from('stations').select('id, name').eq('is_active', true).order('name'),
    ])
    setUsers(usersData ?? [])
    setStations(stationsData ?? [])
    setLoading(false)
  }

  useEffect(() => {
    if (!user) return
    loadData()
  }, [user])

  async function handleAdd(e) {
    e.preventDefault()
    setAddError('')
    if (STATION_REQUIRED.includes(addForm.role) && !addForm.station_id) {
      setAddError('Station is required for this role.')
      return
    }
    setAddSaving(true)
    const payload = {
      full_name: addForm.full_name.trim(),
      username: addForm.username.trim(),
      role: addForm.role,
      station_id: addForm.station_id || null,
      is_active: addForm.is_active,
    }
    const { error } = await supabase.from('users').insert(payload)
    setAddSaving(false)
    if (error) { setAddError(error.message); return }
    setShowAdd(false)
    setAddForm(BLANK_FORM)
    loadData()
  }

  async function handleToggleActive(u) {
    await supabase.from('users').update({ is_active: !u.is_active }).eq('id', u.id)
    loadData()
  }

  function startEdit(u) {
    setEditId(u.id)
    setEditForm({ full_name: u.full_name, username: u.username, role: u.role, station_id: u.station_id ?? '', is_active: u.is_active })
  }

  async function handleEditSave(id) {
    setEditSaving(true)
    const payload = {
      full_name: editForm.full_name.trim(),
      username: editForm.username.trim(),
      role: editForm.role,
      station_id: editForm.station_id || null,
      is_active: editForm.is_active,
    }
    await supabase.from('users').update(payload).eq('id', id)
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
          <h1 className="text-xs font-semibold uppercase tracking-widest text-gray-400">User Management</h1>
          <button
            onClick={() => { setShowAdd(v => !v); setAddError('') }}
            className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
          >
            {showAdd ? 'Cancel' : '+ Add User'}
          </button>
        </div>

        {showAdd && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">New User Profile</p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700 mb-4">
              Note: This creates the profile record only. The auth account must be created separately in the Supabase dashboard, using the same username/email.
            </div>
            <form onSubmit={handleAdd} className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Full Name</label>
                <input
                  required
                  value={addForm.full_name}
                  onChange={e => setAddForm(f => ({ ...f, full_name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Username / Email</label>
                <input
                  required
                  value={addForm.username}
                  onChange={e => setAddForm(f => ({ ...f, username: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
                <select
                  value={addForm.role}
                  onChange={e => setAddForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white"
                >
                  {ROLES.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Station {STATION_REQUIRED.includes(addForm.role) ? <span className="text-red-500">*</span> : <span className="text-gray-400">(optional)</span>}
                </label>
                <select
                  value={addForm.station_id}
                  onChange={e => setAddForm(f => ({ ...f, station_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white"
                >
                  <option value="">— None —</option>
                  {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2 col-span-2">
                <input
                  type="checkbox"
                  id="add-active"
                  checked={addForm.is_active}
                  onChange={e => setAddForm(f => ({ ...f, is_active: e.target.checked }))}
                  className="rounded"
                />
                <label htmlFor="add-active" className="text-sm text-gray-600">Active</label>
              </div>
              {addError && <p className="col-span-2 text-sm text-red-600">{addError}</p>}
              <div className="col-span-2 flex justify-end">
                <button
                  type="submit"
                  disabled={addSaving}
                  className="px-5 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-50"
                >
                  {addSaving ? 'Saving…' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-5 h-32 animate-pulse" />
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Name</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Username</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Role</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Station</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Active</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-gray-50 last:border-0">
                    {editId === u.id ? (
                      <>
                        <td className="px-5 py-2">
                          <input
                            value={editForm.full_name}
                            onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))}
                            className="border border-gray-200 rounded px-2 py-1 text-sm w-full"
                          />
                        </td>
                        <td className="px-5 py-2">
                          <input
                            value={editForm.username}
                            onChange={e => setEditForm(f => ({ ...f, username: e.target.value }))}
                            className="border border-gray-200 rounded px-2 py-1 text-sm w-full"
                          />
                        </td>
                        <td className="px-5 py-2">
                          <select
                            value={editForm.role}
                            onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}
                            className="border border-gray-200 rounded px-2 py-1 text-sm bg-white"
                          >
                            {ROLES.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                          </select>
                        </td>
                        <td className="px-5 py-2">
                          <select
                            value={editForm.station_id}
                            onChange={e => setEditForm(f => ({ ...f, station_id: e.target.value }))}
                            className="border border-gray-200 rounded px-2 py-1 text-sm bg-white"
                          >
                            <option value="">— None —</option>
                            {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        </td>
                        <td className="px-5 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={editForm.is_active}
                            onChange={e => setEditForm(f => ({ ...f, is_active: e.target.checked }))}
                          />
                        </td>
                        <td className="px-5 py-2 text-right whitespace-nowrap">
                          <button
                            onClick={() => handleEditSave(u.id)}
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
                        <td className="px-5 py-3 text-gray-800 font-medium">{u.full_name}</td>
                        <td className="px-5 py-3 text-gray-500">{u.username}</td>
                        <td className="px-5 py-3">
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${ROLE_BADGE[u.role] ?? 'bg-gray-100 text-gray-500'}`}>
                            {u.role.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-gray-500">{u.stations?.name ?? '—'}</td>
                        <td className="px-5 py-3 text-center">
                          <button
                            onClick={() => handleToggleActive(u)}
                            className={`w-8 h-4 rounded-full transition-colors ${u.is_active ? 'bg-green-500' : 'bg-gray-200'}`}
                          >
                            <span className={`block w-3 h-3 rounded-full bg-white shadow transition-transform mx-0.5 ${u.is_active ? 'translate-x-4' : ''}`} />
                          </button>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button onClick={() => startEdit(u)} className="text-xs text-gray-400 hover:text-gray-700 underline">Edit</button>
                        </td>
                      </>
                    )}
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
