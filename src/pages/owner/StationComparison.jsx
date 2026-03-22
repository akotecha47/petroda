import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { getDemoAdjustedRange } from '../../lib/demoOffset'
import OwnerNav from '../../components/owner/OwnerNav'

const ROWS = [
  { key: 'pma', label: 'PMS Sold', unit: 'L', best: 'max' },
  { key: 'ago', label: 'AGO Sold', unit: 'L', best: 'max' },
  { key: 'revenue', label: 'Revenue', unit: 'MWK', best: 'max' },
  { key: 'cash', label: 'Cash', unit: 'MWK', best: 'max' },
  { key: 'card', label: 'Card', unit: 'MWK', best: 'max' },
  { key: 'openFlags', label: 'Open Flags', unit: '', best: 'min' },
  { key: 'variancePct', label: 'Payment Variance', unit: '%', best: 'min' },
]

function priceAt(prices, fuelType, date) {
  const ft = fuelType.toUpperCase()
  const relevant = (prices ?? []).filter(p => p.fuel_type === ft && p.effective_from <= date)
  relevant.sort((a, b) => b.effective_from.localeCompare(a.effective_from))
  return relevant[0]?.price_per_litre ?? 0
}

function getHighlightClass(values, i) {
  return i === 0 ? 'text-gray-900 font-medium' : 'text-gray-400'
}

function PeriodToggle({ period, onChange }) {
  return (
    <div className="flex gap-2">
      {['day', 'week', 'month'].map(p => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
            period === p ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          {p === 'day' ? 'Today' : p === 'week' ? 'Last 7 Days' : 'Last 30 Days'}
        </button>
      ))}
    </div>
  )
}

export default function StationComparison() {
  const { user } = useAuth()
  const [period, setPeriod] = useState('last30days')
  const [stations, setStations] = useState([])
  const [stationData, setStationData] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    async function load() {
      setLoading(true)
      const periodKey = period === 'week' ? 'last7days' : period === 'month' ? 'last30days' : period
      const { from, to } = getDemoAdjustedRange(periodKey)

      const [{ data: stationsData }, { data: allShifts }, { data: allPrices }] = await Promise.all([
        supabase.from('stations').select('id, name').eq('is_active', true).order('name'),
        supabase.from('shifts').select('id, station_id, shift_date').gte('shift_date', from).lte('shift_date', to),
        supabase.from('fuel_prices').select('fuel_type, price_per_litre, effective_from').order('effective_from', { ascending: false }),
      ])

      const shiftIds = (allShifts ?? []).map(s => s.id)
      const entries = shiftIds.length > 0
        ? ((await supabase.from('attendant_entries').select('shift_id, pma_litres_sold, ago_litres_sold, cash_collected, card_collected').in('shift_id', shiftIds)).data ?? [])
        : []

      const shiftMap = {}
      allShifts?.forEach(s => { shiftMap[s.id] = s })

      const { data: flagsData } = await supabase
        .from('flags_investigations')
        .select('station_id')
        .in('status', ['detected', 'under_investigation', 'corrected'])
      const flagsByStation = {}
      flagsData?.forEach(f => { flagsByStation[f.station_id] = (flagsByStation[f.station_id] ?? 0) + 1 })

      const result = {}
      stationsData?.forEach(s => {
        result[s.id] = { pma: 0, ago: 0, revenue: 0, cash: 0, card: 0, openFlags: flagsByStation[s.id] ?? 0, expectedRevenue: 0 }
      })

      entries.forEach(e => {
        const shift = shiftMap[e.shift_id]
        if (!shift || !result[shift.station_id]) return
        const pmaP = priceAt(allPrices, 'PMS', shift.shift_date)
        const agoP = priceAt(allPrices, 'AGO', shift.shift_date)
        const r = result[shift.station_id]
        r.pma += e.pma_litres_sold ?? 0
        r.ago += e.ago_litres_sold ?? 0
        r.cash += e.cash_collected ?? 0
        r.card += e.card_collected ?? 0
        const rev = (e.pma_litres_sold ?? 0) * pmaP + (e.ago_litres_sold ?? 0) * agoP
        r.revenue += rev
        r.expectedRevenue += rev
      })

      stationsData?.forEach(s => {
        const r = result[s.id]
        const actual = r.cash + r.card
        r.variancePct = r.expectedRevenue > 0
          ? parseFloat(((r.expectedRevenue - actual) / r.expectedRevenue * 100).toFixed(1))
          : 0
      })

      setStations(stationsData ?? [])
      setStationData(result)
      setLoading(false)
    }
    load()
  }, [user, period])

  if (!user) return null

  return (
    <div className="min-h-screen bg-slate-100 pb-20 md:pb-0">
      <OwnerNav />
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xs font-semibold uppercase tracking-widest text-gray-400">Station Comparison</h1>
          <PeriodToggle period={period} onChange={setPeriod} />
        </div>

        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 h-64 animate-pulse" />
        ) : stations.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-400">No stations found.</div>
        ) : (
          <>
            {/* Mobile: stacked station cards */}
            <div className="md:hidden space-y-4">
              {stations.map((s, i) => {
                const data = stationData[s.id] ?? {}
                return (
                  <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-5">
                    <p className="font-medium text-gray-800 mb-3">{s.name}</p>
                    <div className="space-y-2">
                      {ROWS.map(row => {
                        const values = stations.map(st => stationData[st.id]?.[row.key] ?? 0)
                        const val = data[row.key] ?? 0
                        return (
                          <div key={row.key} className="flex items-center justify-between">
                            <span className="text-xs text-gray-500">{row.label}</span>
                            <span className={`tabular-nums text-sm font-medium ${getHighlightClass(values, i)}`}>
                              {row.unit === '%' ? `${val}%` : Math.round(val).toLocaleString()}
                              {row.unit && row.unit !== '%' && (
                                <span className="text-xs text-gray-400 ml-1">{row.unit}</span>
                              )}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Desktop: comparison table */}
            <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide w-44">Metric</th>
                    {stations.map(s => (
                      <th key={s.id} className="text-right px-5 py-3 text-xs font-medium text-gray-700 uppercase tracking-wide">
                        {s.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map(row => {
                    const values = stations.map(s => stationData[s.id]?.[row.key] ?? 0)
                    return (
                      <tr key={row.key} className="border-b border-gray-50 last:border-0">
                        <td className="px-5 py-3 text-xs font-medium text-gray-500">{row.label}</td>
                        {values.map((val, i) => (
                          <td
                            key={i}
                            className={`text-right px-5 py-3 tabular-nums ${getHighlightClass(values, i)}`}
                          >
                            {row.unit === '%'
                              ? `${val}%`
                              : Math.round(val).toLocaleString()}
                            {row.unit && row.unit !== '%' && (
                              <span className="text-xs text-gray-400 ml-1">{row.unit}</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
