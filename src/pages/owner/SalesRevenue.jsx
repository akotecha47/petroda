import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { getDemoAdjustedRange } from '../../lib/demoOffset'
import OwnerNav from '../../components/owner/OwnerNav'

function priceAt(prices, fuelType, date) {
  const ft = fuelType.toUpperCase()
  const relevant = (prices ?? []).filter(p => p.fuel_type === ft && p.effective_from <= date)
  relevant.sort((a, b) => b.effective_from.localeCompare(a.effective_from))
  return relevant[0]?.price_per_litre ?? 0
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

export default function SalesRevenue() {
  const { user } = useAuth()
  const [period, setPeriod] = useState('last30days')
  const [stations, setStations] = useState([])
  const [stationFilter, setStationFilter] = useState('all')
  const [rows, setRows] = useState([])
  const [summary, setSummary] = useState({ total: 0, pma: 0, ago: 0 })
  const [currentPrices, setCurrentPrices] = useState({ pma: 0, ago: 0, pmaDate: null, agoDate: null })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('stations').select('id, name').eq('is_active', true).order('name')
      .then(({ data }) => setStations(data ?? []))
  }, [])

  useEffect(() => {
    if (!user) return
    async function load() {
      setLoading(true)
      const periodKey = period === 'week' ? 'last7days' : period === 'month' ? 'last30days' : period
      const { from, to } = getDemoAdjustedRange(periodKey)

      const [{ data: allShifts }, { data: allPrices }] = await Promise.all([
        supabase.from('shifts').select('id, station_id, shift_type, shift_date, stations(name)').gte('shift_date', from).lte('shift_date', to),
        supabase.from('fuel_prices').select('fuel_type, price_per_litre, effective_from').order('effective_from', { ascending: false }),
      ])

      let filteredShifts = allShifts ?? []
      if (stationFilter !== 'all') {
        filteredShifts = filteredShifts.filter(s => s.station_id === stationFilter)
      }

      const shiftIds = filteredShifts.map(s => s.id)
      const entries = shiftIds.length > 0
        ? ((await supabase.from('attendant_entries').select('shift_id, pma_litres_sold, ago_litres_sold, cash_collected, card_collected').in('shift_id', shiftIds)).data ?? [])
        : []

      const entriesByShift = {}
      entries.forEach(e => {
        if (!entriesByShift[e.shift_id]) entriesByShift[e.shift_id] = []
        entriesByShift[e.shift_id].push(e)
      })

      let totalRevenue = 0, pmaRevenue = 0, agoRevenue = 0

      const tableRows = filteredShifts
        .filter(s => entriesByShift[s.id]?.length > 0)
        .map(s => {
          const shiftEntries = entriesByShift[s.id]
          const pmaP = priceAt(allPrices, 'PMS', s.shift_date)
          const agoP = priceAt(allPrices, 'AGO', s.shift_date)
          const pma = shiftEntries.reduce((sum, e) => sum + (e.pma_litres_sold ?? 0), 0)
          const ago = shiftEntries.reduce((sum, e) => sum + (e.ago_litres_sold ?? 0), 0)
          const cash = shiftEntries.reduce((sum, e) => sum + (e.cash_collected ?? 0), 0)
          const card = shiftEntries.reduce((sum, e) => sum + (e.card_collected ?? 0), 0)
          const expected = pma * pmaP + ago * agoP
          const actual = cash + card
          const variance = expected > 0 ? ((expected - actual) / expected * 100) : 0
          totalRevenue += expected
          pmaRevenue += pma * pmaP
          agoRevenue += ago * agoP
          return {
            shiftId: s.id,
            date: s.shift_date,
            station: s.stations?.name ?? '',
            shiftType: s.shift_type,
            pma, ago, expected, actual, variance,
          }
        })
        .sort((a, b) => b.date.localeCompare(a.date) || b.shiftType.localeCompare(a.shiftType))

      setRows(tableRows)
      setSummary({ total: totalRevenue, pma: pmaRevenue, ago: agoRevenue })

      const seedDate = getDemoAdjustedRange('day').from
      const pmaEntry = (allPrices ?? []).find(p => p.fuel_type === 'PMS' && p.effective_from <= seedDate)
      const agoEntry = (allPrices ?? []).find(p => p.fuel_type === 'AGO' && p.effective_from <= seedDate)
      setCurrentPrices({
        pma: pmaEntry?.price_per_litre ?? 0,
        ago: agoEntry?.price_per_litre ?? 0,
        pmaDate: pmaEntry?.effective_from ?? null,
        agoDate: agoEntry?.effective_from ?? null,
      })
      setLoading(false)
    }
    load()
  }, [user, period, stationFilter])

  if (!user) return null

  return (
    <div className="min-h-screen bg-slate-100 pb-20 md:pb-0">
      <OwnerNav />
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <h1 className="text-xs font-semibold uppercase tracking-widest text-gray-400">Sales & Revenue</h1>
          <div className="flex-1" />
          <select
            value={stationFilter}
            onChange={e => setStationFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white"
          >
            <option value="all">All Stations</option>
            {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <PeriodToggle period={period} onChange={setPeriod} />
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 h-24 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Total Revenue', value: summary.total },
              { label: 'PMS Revenue', value: summary.pma },
              { label: 'AGO Revenue', value: summary.ago },
            ].map(c => (
              <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-5">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">{c.label}</p>
                <p className="text-2xl font-bold text-gray-900 leading-none">
                  {Math.round(c.value).toLocaleString()}
                  <span className="text-sm font-normal text-gray-400 ml-1">MWK</span>
                </p>
              </div>
            ))}
          </div>
        )}

        {!loading && (
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-3 flex flex-wrap gap-6 text-sm mb-6">
            <span className="text-gray-400">Current prices:</span>
            <span>
              PMS <strong>{currentPrices.pma.toLocaleString()} MWK/L</strong>
              {currentPrices.pmaDate && <span className="text-gray-400 ml-1">(since {new Date(currentPrices.pmaDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })})</span>}
            </span>
            <span>
              AGO <strong>{currentPrices.ago.toLocaleString()} MWK/L</strong>
              {currentPrices.agoDate && <span className="text-gray-400 ml-1">(since {new Date(currentPrices.agoDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })})</span>}
            </span>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 h-12 animate-pulse" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-400">
            No data for this period.
          </div>
        ) : (
          <>
            {/* Mobile: shift cards */}
            <div className="md:hidden space-y-3">
              {rows.map(r => (
                <div key={r.shiftId} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    <span className="font-medium text-gray-800 text-sm">
                      {new Date(r.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    <span className="text-gray-500 text-sm">{r.station}</span>
                    <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                      r.shiftType === 'day' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {r.shiftType}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">PMS</p>
                      <p className="font-medium text-gray-700 tabular-nums text-sm">{r.pma.toLocaleString()} L</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">AGO</p>
                      <p className="font-medium text-gray-700 tabular-nums text-sm">{r.ago.toLocaleString()} L</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Expected → Collected</p>
                      <p className="tabular-nums text-gray-700 text-sm">
                        {Math.round(r.expected).toLocaleString()} → {Math.round(r.actual).toLocaleString()}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      r.variance > 2 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {r.variance > 0 ? '+' : ''}{r.variance.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Date</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Station</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Shift</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">PMS (L)</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">AGO (L)</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Expected</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Collected</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Variance %</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.shiftId} className="border-b border-gray-50 last:border-0">
                      <td className="px-5 py-3 text-gray-700">{new Date(r.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                      <td className="px-5 py-3 text-gray-700">{r.station}</td>
                      <td className="px-5 py-3 capitalize text-gray-500">{r.shiftType}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-gray-700">{r.pma.toLocaleString()}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-gray-700">{r.ago.toLocaleString()}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-gray-700">{Math.round(r.expected).toLocaleString()}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-gray-700">{Math.round(r.actual).toLocaleString()}</td>
                      <td className={`px-5 py-3 text-right tabular-nums font-medium ${
                        r.variance > 2 ? 'text-red-600' : r.variance < -0.5 ? 'text-amber-600' : 'text-green-700'
                      }`}>
                        {r.variance > 0 ? '+' : ''}{r.variance.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
