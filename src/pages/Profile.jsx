import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { ROLE_HOME } from '../lib/roles'

export default function Profile() {
  const { user } = useAuth()
  const [fullName, setFullName] = useState(user?.full_name ?? '')
  const [nameStatus, setNameStatus] = useState(null) // { ok: bool, msg: string }
  const [password, setPassword] = useState('')
  const [passStatus, setPassStatus] = useState(null)

  async function saveName(e) {
    e.preventDefault()
    setNameStatus(null)
    const { error } = await supabase
      .from('users')
      .update({ full_name: fullName })
      .eq('id', user.id)
    if (error) {
      const msg = error.message?.toLowerCase().includes('unique')
        ? 'Username already taken'
        : error.message
      setNameStatus({ ok: false, msg })
    } else {
      setNameStatus({ ok: true, msg: 'Username updated' })
    }
  }

  async function savePassword(e) {
    e.preventDefault()
    setPassStatus(null)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setPassStatus({ ok: false, msg: error.message })
    } else {
      setPassStatus({ ok: true, msg: 'Password updated' })
      setPassword('')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="max-w-md mx-auto space-y-6">
        <Link
          to={ROLE_HOME[user?.role]}
          className="text-sm text-gray-500 hover:text-gray-800"
        >
          ← Back
        </Link>

        <h1 className="text-xl font-semibold text-gray-900">Profile</h1>

        {/* Username */}
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-sm font-medium text-gray-700 mb-4">Username</h2>
          <form onSubmit={saveName} className="space-y-3">
            <input
              type="text"
              required
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
            <button
              type="submit"
              className="bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-700 transition-colors"
            >
              Save
            </button>
            {nameStatus && (
              <p className={`text-sm ${nameStatus.ok ? 'text-green-600' : 'text-red-600'}`}>
                {nameStatus.msg}
              </p>
            )}
          </form>
        </div>

        {/* Password */}
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-sm font-medium text-gray-700 mb-4">Change password</h2>
          <form onSubmit={savePassword} className="space-y-3">
            <input
              type="password"
              required
              placeholder="New password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
            <button
              type="submit"
              className="bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-700 transition-colors"
            >
              Save
            </button>
            {passStatus && (
              <p className={`text-sm ${passStatus.ok ? 'text-green-600' : 'text-red-600'}`}>
                {passStatus.msg}
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
