import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ROLE_HOME } from '../lib/roles'

export default function ProtectedRoute({ roles, children }) {
  const { session, user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (user && !roles.includes(user.role)) {
    return <Navigate to={ROLE_HOME[user.role]} replace />
  }

  return children
}
