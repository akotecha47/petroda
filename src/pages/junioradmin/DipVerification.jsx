import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

export default function DipVerification() {
  const { user } = useAuth()
  const [stations, setStations] = useState([])
  const [stationFilter, setStationFilter] = useState('all')
  const [dips, setDips] = useState([])
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(null)

  useEffect(() => {
    supabase
      .from('stations')
      .select('id, name')
      .order('name')
      .then(({ data }) => { setStations(data ?? []) })
  }, [])

  useEffect(() => {
    async function load() {
      setLoading(true)

      let query = supabase
        .from('dip_entries')
        .select('id, station_id, shift_id, recorded_by, recorded_at, is_verified, verified_by, verified_at, note, shifts(shift_date, shift_type), stations(name)')
        .order('recorded_at', { ascending: false })

      if (stationFilter !== 'all') {
        query = query.eq('station_id', stationFilter)
      }

      const { data: dipData } = await query

      const userIds = [...new Set([
        ...(dipData ?? []).map(d => d.recorded_by).filter(Boolean),
        ...(dipData ?? []).map(d => d.verified_by).filter(Boolean),
      ])]

      const nameMap = {}
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, full_name')
          .in('id', userIds)
        users?.forEach(u => { nameMap[u.id] = u.full_name })
      }

      const dipIds = (dipData ?? []).map(d => d.id)
      const readingsMap = {}
      if (dipIds.length > 0) {
        const { data: allReadings } = await supabase
          .from('dip_tank_readings')
          .select('dip_entry_id, reading_cm, calculated_litres, tanks(label, fuel_type)')
          .in('dip_entry_id', dipIds)
        allReadings?.forEach(r => {
          if (!readingsMap[r.dip_entry_id]) readingsMap[r.dip_entry_id] = []
          readingsMap[r.dip_entry_id].push(r)
        })
      }

      setDips((dipData ?? []).map(d => ({
        ...d,
        recordedByName: nameMap[d.recorded_by] ?? '—',
        verifiedByName: nameMap[d.verified_by] ?? '—',
        tankReadings: readingsMap[d.id] ?? [],
      })))
      setLoading(false)
    }
    load()
  }, [stationFilter])

  if (!user) return null

  async function handleVerify(dipId) {
    setVerifying(dipId)
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('dip_entries')
      .update({ is_verified: true, verified_by: user.id, verified_at: now })
      .eq('id', dipId)

    if (!error) {
      setDips(prev => prev.map(d =>
        d.id === dipId
          ? { ...d, is_verified: true, verified_by: user.id, verified_at: now, verifiedByName: user.full_name }
          : d
      ))
    }
    setVerifying(null)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3">
        <Link to="/app/junior-admin" className="text-gray-400 hover:text-gray-700 text-sm">← Dashboard</Link>
        <span className="text-gray-300">|</span>
        <span className="font-semibold text-gray-800">Dip Verification</span>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center gap-4 mb-6">
          <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Station</label>
          <select
            value={stationFilter}
            onChange={e => setStationFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white"
          >
            <option value="all">All Stations</option>
            {stations.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 h-32 animate-pulse" />
            ))}
          </div>
        ) : dips.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-400">
            No dip entries found.
          </div>
        ) : (
          <div className="space-y-4">
            {dips.map(dip => (
              <div key={dip.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{dip.stations?.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5 capitalize">
                      {dip.shifts?.shift_date} · {dip.shifts?.shift_type} shift
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Recorded by {dip.recordedByName} at{' '}
                      {new Date(dip.recorded_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {dip.note && (
                      <p className="text-xs text-gray-500 mt-1 italic">{dip.note}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    {dip.is_verified ? (
                      <div className="text-right">
                        <span className="inline-block text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-700 font-medium">Verified</span>
                        <p className="text-xs text-gray-400 mt-1">{dip.verifiedByName}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(dip.verified_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleVerify(dip.id)}
                        disabled={verifying === dip.id}
                        className="bg-gray-900 text-white text-xs font-medium px-4 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
                      >
                        {verifying === dip.id ? 'Verifying…' : 'Verify'}
                      </button>
                    )}
                  </div>
                </div>

                {dip.tankReadings.length > 0 && (
                  <div className="mt-4 border-t border-gray-100 pt-4">
                    <table className="w-full text-xs">
                      <thead>
                        <tr>
                          <th className="text-left text-gray-400 font-medium pb-1">Tank</th>
                          <th className="text-right text-gray-400 font-medium pb-1">Reading (cm)</th>
                          <th className="text-right text-gray-400 font-medium pb-1">Litres</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dip.tankReadings.map((r, i) => (
                          <tr key={i} className="border-t border-gray-50">
                            <td className="py-1 text-gray-600">
                              {r.tanks?.label}
                              <span className="text-gray-400 ml-1 uppercase">{r.tanks?.fuel_type}</span>
                            </td>
                            <td className="py-1 text-right text-gray-600">{r.reading_cm}</td>
                            <td className="py-1 text-right font-medium text-gray-800">
                              {(r.calculated_litres ?? 0).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
