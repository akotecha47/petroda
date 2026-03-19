import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { currentStock } from '../../lib/stockUtils'
import OwnerNav from '../../components/owner/OwnerNav'

function StockBar({ pct }) {
  const overCap = pct !== null && pct > 100
  const color = pct === null ? 'bg-gray-200' : overCap ? 'bg-amber-400' : pct < 10 ? 'bg-red-500' : pct < 25 ? 'bg-amber-500' : 'bg-green-500'
  const textColor = pct === null ? 'text-gray-400' : pct < 10 ? 'text-red-600' : pct < 25 ? 'text-amber-600' : 'text-green-700'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
        <div className={`${color} rounded-full h-1.5`} style={{ width: `${Math.min(pct ?? 0, 100)}%` }} />
      </div>
      <span className={`text-xs font-medium ${textColor} w-8 text-right`}>
        {pct !== null ? `${pct}%` : '—'}
      </span>
      {overCap && <span className="text-xs text-amber-600">above capacity</span>}
    </div>
  )
}

export default function StockSupply() {
  const { user } = useAuth()
  const [stationStocks, setStationStocks] = useState([])
  const [deliveries, setDeliveries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    async function load() {
      setLoading(true)
      const [{ data: stations }, { data: tanks }, { data: latestDips }, { data: recentDeliveries }] = await Promise.all([
        supabase.from('stations').select('id, name').eq('is_active', true).order('name'),
        supabase.from('tanks').select('station_id, fuel_type, capacity_litres'),
        supabase.from('dip_entries').select('station_id, recorded_at').order('recorded_at', { ascending: false }),
        supabase.from('deliveries').select('station_id, fuel_type, litres, delivery_datetime, stations(name)').order('delivery_datetime', { ascending: false }).limit(20),
      ])

      const capacityMap = {}
      tanks?.forEach(t => {
        if (!capacityMap[t.station_id]) capacityMap[t.station_id] = { pma: 0, ago: 0 }
        const ft = (t.fuel_type ?? '').toUpperCase()
        if (ft === 'PMA') capacityMap[t.station_id].pma += t.capacity_litres ?? 0
        else if (ft === 'AGO') capacityMap[t.station_id].ago += t.capacity_litres ?? 0
      })

      const latestDipByStation = {}
      latestDips?.forEach(d => {
        if (!latestDipByStation[d.station_id]) latestDipByStation[d.station_id] = d.recorded_at
      })

      const stocks = await Promise.all((stations ?? []).map(s => currentStock(s.id)))

      const stationData = (stations ?? []).map((s, i) => {
        const cap = capacityMap[s.id] ?? { pma: 0, ago: 0 }
        const stock = stocks[i]
        return {
          id: s.id,
          name: s.name,
          pmaStock: stock.pma,
          agoStock: stock.ago,
          pmaCap: cap.pma,
          agoCap: cap.ago,
          pmaPct: cap.pma ? Math.round((stock.pma / cap.pma) * 100) : null,
          agoPct: cap.ago ? Math.round((stock.ago / cap.ago) * 100) : null,
          lastDip: latestDipByStation[s.id] ?? null,
        }
      })

      setStationStocks(stationData)
      setDeliveries(recentDeliveries ?? [])
      setLoading(false)
    }
    load()
  }, [user])

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <OwnerNav />
      <div className="max-w-6xl mx-auto px-6 py-8">
        <h1 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-6">Stock & Supply</h1>

        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">Current Stock</h2>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 h-44 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {stationStocks.map(s => (
              <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <p className="font-medium text-gray-800 mb-3">{s.name}</p>
                <div className="space-y-2 mb-3">
                  <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>PMA</span>
                      <span>{s.pmaStock.toLocaleString()} / {s.pmaCap.toLocaleString()} L</span>
                    </div>
                    <StockBar pct={s.pmaPct} />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>AGO</span>
                      <span>{s.agoStock.toLocaleString()} / {s.agoCap.toLocaleString()} L</span>
                    </div>
                    <StockBar pct={s.agoPct} />
                  </div>
                </div>
                <p className="text-xs text-gray-400">
                  Last dip:{' '}
                  {s.lastDip
                    ? new Date(s.lastDip).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : 'never'}
                </p>
              </div>
            ))}
          </div>
        )}

        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">Recent Deliveries</h2>
        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-5 h-32 animate-pulse" />
        ) : deliveries.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-5 text-sm text-gray-400">
            No recent deliveries.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Station</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Fuel</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Litres</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Date & Time</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((d, i) => (
                  <tr key={i} className="border-b border-gray-50 last:border-0">
                    <td className="px-5 py-3 text-gray-700">{d.stations?.name ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-500 uppercase">{d.fuel_type}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-gray-700">{(d.litres ?? 0).toLocaleString()}</td>
                    <td className="px-5 py-3 text-right text-gray-500">
                      {new Date(d.delivery_datetime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
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
