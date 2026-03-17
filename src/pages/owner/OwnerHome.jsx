import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function OwnerHome() {
  const { user, session, signOut } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!session) navigate('/login', { replace: true })
  }, [session, navigate])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <span className="font-semibold text-gray-800">Petroda · Owner</span>
        <div className="flex items-center gap-4 text-sm">
          <Link to="/app/profile" className="text-gray-500 hover:text-gray-800">{user?.full_name}</Link>
          <button onClick={signOut} className="text-gray-500 hover:text-gray-800">Sign out</button>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center mt-24">
        <span className="inline-block bg-gray-900 text-white text-xs font-semibold uppercase tracking-widest px-4 py-1.5 rounded-full">
          Owner
        </span>
      </div>
    </div>
  )
}
