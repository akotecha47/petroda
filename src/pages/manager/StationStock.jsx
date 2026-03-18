import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
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

export default function StationStock() {
  const { user } = useAuth()
  const [stationName, setStationName] = useState('')
  const [stock, setStock] = useState({ pma: 0, ago: 0 })
  const [tanks, setTanks] = useState([])
  const [deliveries, setDeliveries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.station_id) return
    supabase
      .from('stations')
      .select('name')
      .eq('id', user.station_id)
      .single()
      .then(({ data }) => { if (data) setStationName(data.name) })
  }, [user?.station_id])

  useEffect(() => {
    if (!user?.station_id) return
    async function load() {
      setLoading(true)

      const stockData = await currentStock(user.station_id)
      setStock(stockData)

      const { data: tankData } = await supabase
        .from('tanks')
        .select('id, label, fuel_type, capacity_litres')
        .eq('station_id', user.station_id)
        .eq('is_active', true)
        .order('fuel_type')
        .order('label')

      if (tankData && tankData.length > 0) {
        const tankIds = tankData.map(t => t.id)

        // Fetch dip entries for station to get timestamps
        const { data: dipEntries } = await supabase
          .from('dip_entries')
          .select('id, recorded_at')
          .eq('station_id', user.station_id)
          .order('recorded_at', { ascending: false })

        if (dipEntries && dipEntries.length > 0) {
          const dipIds = dipEntries.map(d => d.id)
          const dipTimeMap = {}
          dipEntries.forEach(d => { dipTimeMap[d.id] = d.recorded_at })

          const { data: readings } = await supabase
            .from('dip_tank_readings')
            .select('tank_id, reading_cm, calculated_litres, dip_entry_id')
            .in('tank_id', tankIds)
            .in('dip_entry_id', dipIds)

          const latestReading = {}
          readings?.forEach(r => {
            const existing = latestReading[r.tank_id]
            const thisTime = dipTimeMap[r.dip_entry_id]
            if (!existing || thisTime > dipTimeMap[existing.dip_entry_id]) {
              latestReading[r.tank_id] = r
            }
          })

          setTanks(tankData.map(t => ({
            ...t,
            lastCm: latestReading[t.id]?.reading_cm ?? null,
            lastLitres: latestReading[t.id]?.calculated_litres ?? null,
            lastAt: latestReading[t.id] ? dipTimeMap[latestReading[t.id].dip_entry_id] : null,
          })))
        } else {
          setTanks(tankData.map(t => ({ ...t, lastCm: null, lastLitres: null, lastAt: null })))
        }
      } else {
        setTanks([])
      }

      const { data: deliveryData } = await supabase
        .from('deliveries')
        .select('id, fuel_type, litres, depot_reference, delivery_datetime')
        .eq('station_id', user.station_id)
        .order('delivery_datetime', { ascending: false })
        .limit(10)

      setDeliveries(deliveryData ?? [])
      setLoading(false)
    }
    load()
  }, [user?.station_id])

  if (!user) return null

  const pmaCap = tanks.filter(t => t.fuel_type === 'pma').reduce((s, t) => s + (t.capacity_litres ?? 0), 0)
  const agoCap = tanks.filter(t => t.fuel_type === 'ago').reduce((s, t) => s + (t.capacity_litres ?? 0), 0)
  const pmaPct = pmaCap > 0 ? (stock.pma / pmaCap) * 100 : 0
  const agoPct = agoCap > 0 ? (stock.ago / agoCap) * 100 : 0

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3">
        <Link to="/app/manager" className="text-gray-400 hover:text-gray-700 text-sm">← Dashboard</Link>
        <span className="text-gray-300">|</span>
        <span className="font-semibold text-gray-800">Stock — {stationName}</span>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {loading ? (
          <div className="grid grid-cols-2 gap-4 mb-8">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 h-28 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 mb-8">
              {[
                { label: 'PMA Stock', litres: stock.pma, pct: pmaPct },
                { label: 'AGO Stock', litres: stock.ago, pct: agoPct },
              ].map(({ label, litres, pct }) => (
                <div key={label} className="bg-white rounded-xl border border-gray-200 p-6">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">{label}</p>
                  <p className="text-2xl font-bold text-gray-900 mb-3">
                    {litres.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    <span className="text-sm font-normal text-gray-400 ml-1">L</span>
                  </p>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full mb-1">
                    <div
                      className={`h-1.5 rounded-full ${stockBarColor(pct)}`}
                      style={{ width: `${Math.min(pct, 100).toFixed(1)}%` }}
                    />
                  </div>
                  <p className={`text-xs font-medium ${stockColor(pct)}`}>
                    {pct.toFixed(1)}% of capacity
                  </p>
                </div>
              ))}
            </div>

            <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Tanks</h2>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-8">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Tank</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Fuel</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Last cm</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Last L</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Dip Time</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Capacity</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">% Full</th>
                  </tr>
                </thead>
                <tbody>
                  {tanks.map(t => {
                    const pct = t.capacity_litres && t.lastLitres != null
                      ? (t.lastLitres / t.capacity_litres) * 100
                      : null
                    return (
                      <tr key={t.id} className="border-b border-gray-50 last:border-0">
                        <td className="px-4 py-3 font-medium text-gray-700">{t.label}</td>
                        <td className="px-4 py-3 text-gray-500 uppercase text-xs font-medium">{t.fuel_type}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{t.lastCm != null ? t.lastCm : '—'}</td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {t.lastLitres != null
                            ? t.lastLitres.toLocaleString(undefined, { maximumFractionDigits: 0 })
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {t.lastAt
                            ? new Date(t.lastAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">{t.capacity_litres?.toLocaleString()}</td>
                        <td className={`px-4 py-3 text-right font-medium ${pct != null ? stockColor(pct) : 'text-gray-400'}`}>
                          {pct != null ? `${pct.toFixed(1)}%` : '—'}
                        </td>
                      </tr>
                    )
                  })}
                  {tanks.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-sm text-gray-400">No active tanks found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Recent Deliveries</h2>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Fuel</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Litres</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Depot Ref</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Datetime</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map(d => (
                    <tr key={d.id} className="border-b border-gray-50 last:border-0">
                      <td className="px-4 py-3 text-gray-500 uppercase text-xs font-medium">{d.fuel_type}</td>
                      <td className="px-4 py-3 text-right text-gray-700 font-medium">{d.litres.toLocaleString()}</td>
                      <td className="px-4 py-3 text-gray-600">{d.depot_reference}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {new Date(d.delivery_datetime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                  {deliveries.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-400">No deliveries recorded</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex gap-3">
              <Link
                to="/app/manager/dip"
                className="bg-gray-900 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Record Dip
              </Link>
              <Link
                to="/app/manager/delivery"
                className="bg-white border border-gray-200 text-gray-700 text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Record Delivery
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
