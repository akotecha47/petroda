import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

export default function ManagerHome() {
  const { user, session, signOut } = useAuth()
  const navigate = useNavigate()
  const [stationName, setStationName] = useState('')

  useEffect(() => {
    if (!session) navigate('/login', { replace: true })
  }, [session, navigate])

  useEffect(() => {
    if (user?.station_id) {
      supabase
        .from('stations')
        .select('name')
        .eq('id', user.station_id)
        .single()
        .then(({ data }) => {
          if (data) setStationName(data.name)
        })
    }
  }, [user?.station_id])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <span className="font-semibold text-gray-800">Petroda · Manager</span>
        <div className="flex items-center gap-4 text-sm">
          <Link to="/app/profile" className="text-gray-500 hover:text-gray-800">{user?.full_name}</Link>
          <button onClick={signOut} className="text-gray-500 hover:text-gray-800">Sign out</button>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center mt-24 gap-2">
        <span className="inline-block bg-gray-900 text-white text-xs font-semibold uppercase tracking-widest px-4 py-1.5 rounded-full">
          Manager
        </span>
        {stationName && (
          <p className="text-sm text-gray-500">{stationName}</p>
        )}
      </div>
    </div>
  )
}
