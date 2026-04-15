import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { todayISO } from '../../lib/shiftUtils'
import { currentStock } from '../../lib/stockUtils'

function stockColor(pct) {
  if (pct > 25) return 'text-green-600'
  if (pct > 10) return 'text-amber-600'
  return 'text-red-600'
}

function stockBarColor(pct) {
  if (pct > 25) return 'bg-green-500'
  if (pct > 10) return 'bg-amber-400'
  return 'bg-red-500'
}

export default function StationMonitoring() {
  const { user } = useAuth()
  const [stations, setStations] = useState([])
  const [stationFilter, setStationFilter] = useState('all')
  const [cardData, setCardData] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    async function load() {
      setLoading(true)
      const today = todayISO()

      const [
        { data: stationsRaw },
        { data: tanksRaw },
        { data: dipEntriesRaw },
        { data: flagsRaw },
        { data: shiftsRaw },
      ] = await Promise.all([
        supabase.from('stations').select('id, name').eq('is_active', true).order('name'),
        supabase.from('tanks').select('station_id, fuel_type, capacity_litres'),
        supabase.from('dip_entries').select('station_id, recorded_at').order('recorded_at', { ascending: false }),
        supabase.from('flags_investigations').select('station_id').in('status', ['detected', 'under_investigation', 'escalated']),
        supabase.from('shifts').select('id, station_id, shift_type, status').eq('shift_date', today),
      ])

      // Current stock per station via currentStock() — same as StockSupply
      const stocks = await Promise.all((stationsRaw ?? []).map(s => currentStock(s.id)))

      // Attendant entries for today's shifts
      const shiftIds = (shiftsRaw ?? []).map(s => s.id)
      let entriesRaw = []
      if (shiftIds.length > 0) {
        const { data } = await supabase
          .from('attendant_entries')
          .select('shift_id')
          .in('shift_id', shiftIds)
          .eq('is_corrected', false)
        entriesRaw = data ?? []
      }

      // Capacity map per station
      const capacityMap = {}
      ;(tanksRaw ?? []).forEach(t => {
        if (!capacityMap[t.station_id]) capacityMap[t.station_id] = { pma: 0, ago: 0 }
        const ft = (t.fuel_type ?? '').toUpperCase()
        if (ft === 'PMA') capacityMap[t.station_id].pma += t.capacity_litres ?? 0
        else if (ft === 'AGO') capacityMap[t.station_id].ago += t.capacity_litres ?? 0
      })

      // Latest dip timestamp per station
      const latestDipByStation = {}
      ;(dipEntriesRaw ?? []).forEach(d => {
        if (!latestDipByStation[d.station_id]) {
          latestDipByStation[d.station_id] = d.recorded_at
        }
      })

      // Open flags count per station
      const flagsByStation = {}
      ;(flagsRaw ?? []).forEach(f => {
        flagsByStation[f.station_id] = (flagsByStation[f.station_id] ?? 0) + 1
      })

      // Shifts by station and type
      const shiftsByStation = {}
      ;(shiftsRaw ?? []).forEach(s => {
        if (!shiftsByStation[s.station_id]) shiftsByStation[s.station_id] = {}
        shiftsByStation[s.station_id][s.shift_type] = s
      })

      // Shifts with attendant entries
      const shiftsWithEntries = new Set(entriesRaw.map(e => e.shift_id))

      // Build per-station card data
      const result = {}
      ;(stationsRaw ?? []).forEach((station, i) => {
        const cap = capacityMap[station.id] ?? { pma: 0, ago: 0 }
        const stock = stocks[i]

        const pmaPct = cap.pma > 0 ? (stock.pma / cap.pma) * 100 : 0
        const agoPct = cap.ago > 0 ? (stock.ago / cap.ago) * 100 : 0

        const dayShift = shiftsByStation[station.id]?.day ?? null
        const nightShift = shiftsByStation[station.id]?.night ?? null
        const daySubmitted = dayShift ? shiftsWithEntries.has(dayShift.id) : false
        const nightSubmitted = nightShift ? shiftsWithEntries.has(nightShift.id) : false

        result[station.id] = {
          pmaPct,
          agoPct,
          lastDip: latestDipByStation[station.id] ?? null,
          openFlags: flagsByStation[station.id] ?? 0,
          daySubmitted,
          nightSubmitted,
        }
      })

      setStations(stationsRaw ?? [])
      setCardData(result)
      setLoading(false)
    }
    load()
  }, [user])

  if (!user) return null

  const visibleStations = stationFilter === 'all'
    ? stations
    : stations.filter(s => s.id === stationFilter)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3">
        <Link to="/app/junior-admin" className="text-gray-400 hover:text-gray-700 text-sm">← Dashboard</Link>
        <span className="text-gray-300">|</span>
        <span className="font-semibold text-gray-800">Station Monitoring</span>
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
            {[...Array(2)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 h-48 animate-pulse" />
            ))}
          </div>
        ) : visibleStations.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-400">
            No stations found.
          </div>
        ) : (
          <div className="space-y-4">
            {visibleStations.map(station => {
              const d = cardData[station.id] ?? { pmaPct: 0, agoPct: 0, lastDip: null, openFlags: 0, daySubmitted: false, nightSubmitted: false }
              return (
                <div key={station.id} className="bg-white rounded-xl border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="font-semibold text-gray-800">{station.name}</h3>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${d.openFlags > 0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                      {d.openFlags} open {d.openFlags === 1 ? 'flag' : 'flags'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-6 mb-5">
                    {[
                      { label: 'PMA Stock', pct: d.pmaPct },
                      { label: 'AGO Stock', pct: d.agoPct },
                    ].map(({ label, pct }) => (
                      <div key={label}>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
                          <p className={`text-xs font-semibold ${stockColor(pct)}`}>{pct.toFixed(1)}%</p>
                        </div>
                        <div className="w-full h-2 bg-gray-100 rounded-full">
                          <div
                            className={`h-2 rounded-full ${stockBarColor(pct)}`}
                            style={{ width: `${Math.min(pct, 100).toFixed(1)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Day</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${d.daySubmitted ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {d.daySubmitted ? 'Submitted' : 'Not submitted'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Night</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${d.nightSubmitted ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {d.nightSubmitted ? 'Submitted' : 'Not submitted'}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400">
                      {d.lastDip
                        ? `Last dip: ${new Date(d.lastDip).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                        : 'No dip recorded'}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
