import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ROLE_HOME } from '../lib/roles'

export default function Profile() {
  const { user } = useAuth()

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
          <input
            type="text"
            readOnly
            value={user?.full_name ?? ''}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
          />
        </div>

        {/* Password */}
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-sm font-medium text-gray-700 mb-4">Password</h2>
          <input
            type="password"
            readOnly
            value="••••••••"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
          />
        </div>

        <p className="text-sm text-gray-400">Contact your admin to update your account details.</p>
      </div>
    </div>
  )
}
