import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { currentStock } from '../../lib/stockUtils'
import OwnerNav from '../../components/owner/OwnerNav'

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

function KpiCard({ label, value, unit }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">{label}</p>
      <p className="text-2xl font-bold text-gray-900 leading-none">
        {value}
        {unit && <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>}
      </p>
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

function dateRange(period) {
  const today = new Date().toISOString().slice(0, 10)
  if (period === 'day') return { from: today, to: today }
  const d = new Date()
  d.setDate(d.getDate() - (period === 'week' ? 6 : 29))
  return { from: d.toISOString().slice(0, 10), to: today }
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

  useEffect(() => {
    if (!user) return
    async function load() {
      setLoading(true)
      const { from, to } = dateRange(period)
      const today = new Date().toISOString().slice(0, 10)

      const [
        { data: stations },
        { data: allShifts },
        { data: allPrices },
        { count: openFlagCount },
        { data: criticalFlags },
        { data: allTanks },
      ] = await Promise.all([
        supabase.from('stations').select('id, name').eq('is_active', true).order('name'),
        supabase.from('shifts').select('id, station_id, shift_type, shift_date, status').gte('shift_date', from).lte('shift_date', to),
        supabase.from('fuel_prices').select('fuel_type, price_per_litre, effective_from').order('effective_from', { ascending: false }),
        supabase.from('flags_investigations').select('id', { count: 'exact', head: true }).in('status', ['detected', 'under_investigation', 'corrected']),
        supabase.from('flags_investigations').select('id, flag_type, raised_at, station_id, stations(name), shifts(shift_date, shift_type)').eq('severity', 'critical').in('status', ['detected', 'under_investigation']).order('raised_at', { ascending: false }),
        supabase.from('tanks').select('station_id, fuel_type, capacity_litres'),
      ])

      const shiftIds = (allShifts ?? []).map(s => s.id)
      const entries = shiftIds.length > 0
        ? ((await supabase.from('attendant_entries').select('shift_id, pma_litres_sold, ago_litres_sold, cash_collected, card_collected').in('shift_id', shiftIds)).data ?? [])
        : []

      const shiftMap = {}
      allShifts?.forEach(s => { shiftMap[s.id] = s })

      let totalPMA = 0, totalAGO = 0, totalRevenue = 0, totalCash = 0, totalCard = 0
      entries.forEach(e => {
        const shift = shiftMap[e.shift_id]
        const date = shift?.shift_date ?? ''
        totalPMA += e.pma_litres_sold ?? 0
        totalAGO += e.ago_litres_sold ?? 0
        totalRevenue += (e.pma_litres_sold ?? 0) * priceAt(allPrices, 'PMA', date)
                      + (e.ago_litres_sold ?? 0) * priceAt(allPrices, 'AGO', date)
        totalCash += e.cash_collected ?? 0
        totalCard += e.card_collected ?? 0
      })

      setKpis({ pma: totalPMA, ago: totalAGO, revenue: totalRevenue, cash: totalCash, card: totalCard, openFlags: openFlagCount ?? 0 })
      setCriticalAlerts(criticalFlags ?? [])

      const todayShifts = (allShifts ?? []).filter(s => s.shift_date === today)
      const todayShiftIds = new Set(todayShifts.map(s => s.id))
      const todayEntries = entries.filter(e => todayShiftIds.has(e.shift_id))

      const capacityMap = {}
      allTanks?.forEach(t => {
        if (!capacityMap[t.station_id]) capacityMap[t.station_id] = { pma: 0, ago: 0 }
        const ft = (t.fuel_type ?? '').toUpperCase()
        if (ft === 'PMA') capacityMap[t.station_id].pma += t.capacity_litres ?? 0
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
          dayShift: todayStationShifts.find(sh => sh.shift_type === 'day') ?? null,
          nightShift: todayStationShifts.find(sh => sh.shift_type === 'night') ?? null,
        }
      })

      setStationCards(cards)
      setLoading(false)
    }
    load()
  }, [user, period])

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <OwnerNav />
      <div className="max-w-6xl mx-auto px-6 py-8">

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xs font-semibold uppercase tracking-widest text-gray-400">Overview</h1>
          <PeriodToggle period={period} onChange={setPeriod} />
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 h-24 animate-pulse" />
            ))}
          </div>
        ) : kpis && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
            <KpiCard label="PMA Sold" value={kpis.pma.toLocaleString()} unit="L" />
            <KpiCard label="AGO Sold" value={kpis.ago.toLocaleString()} unit="L" />
            <KpiCard label="Revenue" value={Math.round(kpis.revenue).toLocaleString()} unit="MWK" />
            <KpiCard label="Cash" value={Math.round(kpis.cash).toLocaleString()} unit="MWK" />
            <KpiCard label="Card" value={Math.round(kpis.card).toLocaleString()} unit="MWK" />
            <KpiCard label="Open Flags" value={kpis.openFlags} unit="" />
          </div>
        )}

        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">Station Health — Today</h2>
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
                  <div>PMA: <span className="font-medium text-gray-700">{card.pma.toLocaleString()} L</span></div>
                  <div>AGO: <span className="font-medium text-gray-700">{card.ago.toLocaleString()} L</span></div>
                </div>
                <div className="space-y-1.5 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-8">PMA</span>
                    <StockBar pct={card.pmaPct} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-8">AGO</span>
                    <StockBar pct={card.agoPct} />
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {[{ label: 'Day', shift: card.dayShift }, { label: 'Night', shift: card.nightShift }].map(({ label, shift }) => (
                    <span
                      key={label}
                      className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                        shift ? (SHIFT_STATUS_BADGE[shift.status] ?? 'bg-gray-100 text-gray-500') : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {label}: {shift ? shift.status : 'none'}
                    </span>
                  ))}
                </div>
              </div>
            ))}
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
                    {flag.stations?.name}{flag.shifts && ` · ${flag.shifts.shift_date} ${flag.shifts.shift_type} shift`}
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
