import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { currentStock } from '../../lib/stockUtils'
import { getDemoAdjustedRange } from '../../lib/demoOffset'
import OwnerNav from '../../components/owner/OwnerNav'
import { ResponsiveContainer, LineChart, Line } from 'recharts'

const FLAG_TYPE_LABELS = {
  stock_variance: 'Stock Variance',
  payment_variance: 'Payment Variance',
  positive_variance: 'Positive Variance',
  low_stock: 'Low Stock',
  other: 'Other',
}

const SHIFT_STATUS_BADGE = {
  open: 'bg-blue-100 text-blue-700',
  submitted: 'bg-amber-100 text-amber-700',
  closed: 'bg-green-100 text-green-700',
}

function fmtMWK(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  return Math.round(n).toLocaleString()
}

function KpiCard({ label, value, unit, accentColor, sparklineData, sparklineColor }) {
  return (
    <div
      className="bg-white rounded-xl border border-gray-200 p-5"
      style={accentColor ? { borderLeft: `4px solid ${accentColor}` } : undefined}
    >
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">{label}</p>
      <p className="text-xl md:text-2xl font-bold text-gray-900 leading-none">
        {value}
        {unit && <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>}
      </p>
      {sparklineData?.length > 0 && (
        <div className="hidden md:block mt-2" style={{ height: 32 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparklineData}>
              <Line type="monotone" dataKey="v" stroke={sparklineColor ?? '#9ca3af'} strokeWidth={1.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

function PeriodToggle({ period, onChange }) {
  return (
    <div className="flex gap-2">
      {['day', 'week', 'month'].map(p => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`flex-1 md:flex-none px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
            period === p ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          {p === 'day' ? 'Today' : p === 'week' ? 'Last 7 Days' : 'Last 30 Days'}
        </button>
      ))}
    </div>
  )
}

function StockBar({ pct }) {
  const color = pct === null ? 'bg-gray-200' : pct < 10 ? 'bg-red-500' : pct < 25 ? 'bg-amber-500' : 'bg-green-500'
  const textColor = pct === null ? 'text-gray-400' : pct < 10 ? 'text-red-600' : pct < 25 ? 'text-amber-600' : 'text-green-700'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
        <div className={`${color} rounded-full h-1.5 transition-all`} style={{ width: `${Math.min(pct ?? 0, 100)}%` }} />
      </div>
      <span className={`text-xs font-medium ${textColor} w-8 text-right`}>
        {pct !== null ? `${pct}%` : '—'}
      </span>
    </div>
  )
}

function priceAt(prices, fuelType, date) {
  const ft = fuelType.toUpperCase()
  const relevant = (prices ?? []).filter(p => p.fuel_type === ft && p.effective_from <= date)
  relevant.sort((a, b) => b.effective_from.localeCompare(a.effective_from))
  return relevant[0]?.price_per_litre ?? 0
}

export default function OwnerHome() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [period, setPeriod] = useState('last30days')
  const [kpis, setKpis] = useState(null)
  const [stationCards, setStationCards] = useState([])
  const [criticalAlerts, setCriticalAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [sparkData, setSparkData] = useState([])

  useEffect(() => {
    if (!user) return
    async function load() {
      setLoading(true)
      const periodKey = period === 'week' ? 'last7days' : period === 'month' ? 'last30days' : period
      const { from, to } = getDemoAdjustedRange(periodKey)
      const today = to

      const [
        { data: stations },
        { data: allShifts },
        { data: allPrices },
        { count: openFlagCount },
        { data: criticalFlags },
        { data: allTanks },
        { data: latestShiftsRaw },
      ] = await Promise.all([
        supabase.from('stations').select('id, name').eq('is_active', true).order('name'),
        supabase.from('shifts').select('id, station_id, shift_type, shift_date, status').gte('shift_date', from).lte('shift_date', to),
        supabase.from('fuel_prices').select('fuel_type, price_per_litre, effective_from').order('effective_from', { ascending: false }),
        supabase.from('flags_investigations').select('id', { count: 'exact', head: true }).in('status', ['detected', 'under_investigation', 'corrected']),
        supabase.from('flags_investigations').select('id, flag_type, raised_at, station_id, stations(name), shifts(shift_date, shift_type)').eq('severity', 'critical').in('status', ['detected', 'under_investigation']).order('raised_at', { ascending: false }),
        supabase.from('tanks').select('station_id, fuel_type, capacity_litres'),
        supabase.from('shifts').select('id, station_id, shift_type, shift_date, status').order('shift_date', { ascending: false }),
      ])

      const shiftIds = (allShifts ?? []).map(s => s.id)
      const entries = shiftIds.length > 0
        ? ((await supabase.from('attendant_entries').select('shift_id, pma_litres_sold, ago_litres_sold, cash_collected, card_collected').in('shift_id', shiftIds)).data ?? [])
        : []

      // Sparkline: always fetch last 7 days of seed data
      const sparkRange = getDemoAdjustedRange('last7days')
      const { data: sparkShifts } = await supabase
        .from('shifts')
        .select('id, shift_date')
        .gte('shift_date', sparkRange.from)
        .lte('shift_date', sparkRange.to)
      const sparkShiftIds = (sparkShifts ?? []).map(s => s.id)
      const sparkEntries = sparkShiftIds.length > 0
        ? ((await supabase.from('attendant_entries').select('shift_id, pma_litres_sold, ago_litres_sold, cash_collected, card_collected').in('shift_id', sparkShiftIds)).data ?? [])
        : []
      const sparkShiftMap = {}
      sparkShifts?.forEach(s => { sparkShiftMap[s.id] = s })
      const sparkByDate = {}
      sparkEntries.forEach(e => {
        const date = sparkShiftMap[e.shift_id]?.shift_date
        if (!date) return
        if (!sparkByDate[date]) sparkByDate[date] = { revenue: 0, cash: 0, card: 0 }
        sparkByDate[date].revenue += (e.pma_litres_sold ?? 0) * priceAt(allPrices, 'PMS', date)
                                   + (e.ago_litres_sold ?? 0) * priceAt(allPrices, 'AGO', date)
        sparkByDate[date].cash += e.cash_collected ?? 0
        sparkByDate[date].card += e.card_collected ?? 0
      })
      setSparkData(Object.keys(sparkByDate).sort().map(date => ({ date, ...sparkByDate[date] })))

      const shiftMap = {}
      allShifts?.forEach(s => { shiftMap[s.id] = s })

      let totalPMS = 0, totalAGO = 0, totalRevenue = 0, totalCash = 0, totalCard = 0
      entries.forEach(e => {
        const shift = shiftMap[e.shift_id]
        const date = shift?.shift_date ?? ''
        totalPMS += e.pma_litres_sold ?? 0
        totalAGO += e.ago_litres_sold ?? 0
        totalRevenue += (e.pma_litres_sold ?? 0) * priceAt(allPrices, 'PMS', date)
                      + (e.ago_litres_sold ?? 0) * priceAt(allPrices, 'AGO', date)
        totalCash += e.cash_collected ?? 0
        totalCard += e.card_collected ?? 0
      })

      setKpis({ pma: totalPMS, ago: totalAGO, revenue: totalRevenue, cash: totalCash, card: totalCard, openFlags: openFlagCount ?? 0 })
      setCriticalAlerts(criticalFlags ?? [])

      const todayShifts = (allShifts ?? []).filter(s => s.shift_date === today)
      const todayShiftIds = new Set(todayShifts.map(s => s.id))
      const todayEntries = entries.filter(e => todayShiftIds.has(e.shift_id))

      const capacityMap = {}
      allTanks?.forEach(t => {
        if (!capacityMap[t.station_id]) capacityMap[t.station_id] = { pma: 0, ago: 0 }
        const ft = (t.fuel_type ?? '').toUpperCase()
        if (ft === 'PMS') capacityMap[t.station_id].pma += t.capacity_litres ?? 0
        else if (ft === 'AGO') capacityMap[t.station_id].ago += t.capacity_litres ?? 0
      })

      const { data: stationFlagsData } = await supabase
        .from('flags_investigations')
        .select('station_id')
        .in('status', ['detected', 'under_investigation', 'corrected'])
      const flagsByStation = {}
      stationFlagsData?.forEach(f => {
        flagsByStation[f.station_id] = (flagsByStation[f.station_id] ?? 0) + 1
      })

      const stocks = await Promise.all((stations ?? []).map(s => currentStock(s.id)))

      // Latest known shift per station for last-known shift status display
      const latestShiftDateByStation = {}
      ;(latestShiftsRaw ?? []).forEach(s => {
        if (!latestShiftDateByStation[s.station_id]) {
          latestShiftDateByStation[s.station_id] = s.shift_date
        }
      })
      const latestShiftsByStation = {}
      ;(latestShiftsRaw ?? []).forEach(s => {
        const latestDate = latestShiftDateByStation[s.station_id]
        if (s.shift_date === latestDate) {
          if (!latestShiftsByStation[s.station_id]) latestShiftsByStation[s.station_id] = { date: latestDate, day: null, night: null }
          latestShiftsByStation[s.station_id][s.shift_type] = s
        }
      })

      const cards = (stations ?? []).map((s, i) => {
        const todayStationShifts = todayShifts.filter(sh => sh.station_id === s.id)
        const stationTodayEntries = todayEntries.filter(e => shiftMap[e.shift_id]?.station_id === s.id)
        const cap = capacityMap[s.id] ?? { pma: 0, ago: 0 }
        const stock = stocks[i]
        return {
          id: s.id,
          name: s.name,
          pma: stationTodayEntries.reduce((sum, e) => sum + (e.pma_litres_sold ?? 0), 0),
          ago: stationTodayEntries.reduce((sum, e) => sum + (e.ago_litres_sold ?? 0), 0),
          pmaPct: cap.pma ? Math.round((stock.pma / cap.pma) * 100) : null,
          agoPct: cap.ago ? Math.round((stock.ago / cap.ago) * 100) : null,
          openFlags: flagsByStation[s.id] ?? 0,
          lastShiftInfo: latestShiftsByStation[s.id] ?? null,
        }
      })

      setStationCards(cards)
      setLoading(false)
    }
    load()
  }, [user, period])

  if (!user) return null

  return (
    <div className="min-h-screen bg-slate-100 pb-20 md:pb-0">
      <OwnerNav />
      <div className="max-w-6xl mx-auto px-6 py-8">

        <div className="flex flex-col gap-3 mb-6 md:flex-row md:items-center md:justify-between">
          <h1 className="text-xs font-semibold uppercase tracking-widest text-gray-400">Overview</h1>
          <PeriodToggle period={period} onChange={setPeriod} />
        </div>

        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">Live Stock Levels</h2>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 h-44 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {stationCards.map(card => (
              <div
                key={card.id}
                onClick={() => navigate(`/app/owner/station/${card.id}`)}
                className="bg-white rounded-xl border border-gray-200 p-5 cursor-pointer hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium text-gray-800">{card.name}</span>
                  {card.openFlags > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                      {card.openFlags} flag{card.openFlags !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mb-3">
                  <div>PMS: <span className="font-medium text-gray-700">{card.pma.toLocaleString()} L</span></div>
                  <div>AGO: <span className="font-medium text-gray-700">{card.ago.toLocaleString()} L</span></div>
                </div>
                <div className="space-y-1.5 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-8">PMS</span>
                    <StockBar pct={card.pmaPct} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-8">AGO</span>
                    <StockBar pct={card.agoPct} />
                  </div>
                </div>
                {card.lastShiftInfo ? (
                  <div>
                    <p className="text-xs text-gray-400 mb-1">
                      {new Date(card.lastShiftInfo.date + 'T00:00:00').toLocaleDateString([], { day: 'numeric', month: 'short' })}
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {[{ label: 'Day', shift: card.lastShiftInfo.day }, { label: 'Night', shift: card.lastShiftInfo.night }].map(({ label, shift }) => (
                        <span
                          key={label}
                          className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                            shift ? (SHIFT_STATUS_BADGE[shift.status] ?? 'bg-gray-100 text-gray-500') : 'bg-gray-100 text-gray-400'
                          }`}
                        >
                          {label}: {shift ? shift.status : 'no shift'}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">No shift data.</p>
                )}
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 h-24 animate-pulse" />
            ))}
          </div>
        ) : kpis && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
            <KpiCard label="PMS Sold" value={kpis.pma.toLocaleString()} unit="L" accentColor="#60a5fa" />
            <KpiCard label="AGO Sold" value={kpis.ago.toLocaleString()} unit="L" accentColor="#60a5fa" />
            <KpiCard label="Revenue" value={fmtMWK(kpis.revenue)} unit="MWK" accentColor="#4ade80" sparklineData={sparkData.map(d => ({ v: d.revenue }))} sparklineColor="#4ade80" />
            <KpiCard label="Cash" value={fmtMWK(kpis.cash)} unit="MWK" accentColor="#4ade80" sparklineData={sparkData.map(d => ({ v: d.cash }))} sparklineColor="#4ade80" />
            <KpiCard label="Card" value={fmtMWK(kpis.card)} unit="MWK" accentColor="#4ade80" sparklineData={sparkData.map(d => ({ v: d.card }))} sparklineColor="#4ade80" />
            <KpiCard label="Open Flags" value={kpis.openFlags} unit="" accentColor={kpis.openFlags > 0 ? '#fbbf24' : '#e5e7eb'} />
          </div>
        )}

        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">Major Alerts — Critical</h2>
        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-5 h-24 animate-pulse" />
        ) : criticalAlerts.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-5 text-sm text-gray-400">
            No critical alerts.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {criticalAlerts.map((flag, i) => (
              <div
                key={flag.id}
                className={`px-5 py-4 flex items-center justify-between gap-4 ${i < criticalAlerts.length - 1 ? 'border-b border-gray-50' : ''}`}
              >
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {FLAG_TYPE_LABELS[flag.flag_type] ?? flag.flag_type}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {flag.stations?.name}{flag.shifts && ` · ${new Date(flag.shifts.shift_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} ${flag.shifts.shift_type} shift`}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-xs px-2.5 py-1 rounded-full bg-red-100 text-red-700 font-medium">Critical</span>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(flag.raised_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
