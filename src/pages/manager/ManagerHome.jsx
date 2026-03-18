import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { todayISO } from '../../lib/shiftUtils'

const STATUS_BADGE = {
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

function ShiftCard({ label, shift }) {
  if (!shift) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium text-gray-700">{label}</span>
          <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">no shift</span>
        </div>
        <p className="text-sm text-gray-400">No shift opened today</p>
      </div>
    )
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-gray-700">{label}</span>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${STATUS_BADGE[shift.status] ?? 'bg-gray-100 text-gray-500'}`}>
          {shift.status}
        </span>
      </div>
      {shift.attendants?.length > 0 && (
        <p className="text-sm text-gray-500 mb-3">{shift.attendants.join(', ')}</p>
      )}
      <Link to="/app/manager/shifts" className="text-sm text-indigo-600 hover:underline">
        Review entries →
      </Link>
    </div>
  )
}

export default function ManagerHome() {
  const { user, signOut } = useAuth()
  const [stationName, setStationName] = useState('')
  const [kpis, setKpis] = useState({ pma: 0, ago: 0, cash: 0, card: 0 })
  const [shifts, setShifts] = useState({ day: null, night: null })
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
      const today = todayISO()

      const { data: shiftData } = await supabase
        .from('shifts')
        .select('id, shift_type, status')
        .eq('station_id', user.station_id)
        .eq('shift_date', today)

      const dayShift = shiftData?.find(s => s.shift_type === 'day') ?? null
      const nightShift = shiftData?.find(s => s.shift_type === 'night') ?? null
      const shiftIds = (shiftData ?? []).map(s => s.id)

      if (shiftIds.length === 0) {
        setShifts({ day: dayShift, night: nightShift })
        setLoading(false)
        return
      }

      const { data: entryData } = await supabase
        .from('attendant_entries')
        .select('shift_id, attendant_id, pma_litres_sold, ago_litres_sold, cash_collected, card_collected')
        .in('shift_id', shiftIds)

      const rows = entryData ?? []
      setKpis({
        pma: rows.reduce((s, e) => s + (e.pma_litres_sold ?? 0), 0),
        ago: rows.reduce((s, e) => s + (e.ago_litres_sold ?? 0), 0),
        cash: rows.reduce((s, e) => s + (e.cash_collected ?? 0), 0),
        card: rows.reduce((s, e) => s + (e.card_collected ?? 0), 0),
      })

      const attendantIds = [...new Set(rows.map(e => e.attendant_id))]
      const nameMap = {}
      if (attendantIds.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, full_name')
          .in('id', attendantIds)
        users?.forEach(u => { nameMap[u.id] = u.full_name })
      }

      setShifts({
        day: dayShift ? {
          ...dayShift,
          attendants: rows
            .filter(e => e.shift_id === dayShift.id)
            .map(e => nameMap[e.attendant_id])
            .filter(Boolean),
        } : null,
        night: nightShift ? {
          ...nightShift,
          attendants: rows
            .filter(e => e.shift_id === nightShift.id)
            .map(e => nameMap[e.attendant_id])
            .filter(Boolean),
        } : null,
      })
      setLoading(false)
    }
    load()
  }, [user?.station_id])

  if (!user) return null

  const bothClosed = shifts.day?.status === 'closed' && shifts.night?.status === 'closed'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <span className="font-semibold text-gray-800">Petroda · Manager</span>
        <span className="text-sm font-medium text-gray-600">{stationName}</span>
        <div className="flex items-center gap-4 text-sm">
          <Link to="/app/profile" className="text-gray-500 hover:text-gray-800">{user.full_name}</Link>
          <button onClick={signOut} className="text-gray-500 hover:text-gray-800">Sign out</button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">Today's Totals</h2>
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 h-24 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <KpiCard label="PMA Litres" value={kpis.pma.toLocaleString()} unit="L" />
            <KpiCard label="AGO Litres" value={kpis.ago.toLocaleString()} unit="L" />
            <KpiCard label="Cash" value={kpis.cash.toLocaleString()} unit="MWK" />
            <KpiCard label="Card" value={kpis.card.toLocaleString()} unit="MWK" />
            <KpiCard label="Open Flags" value="0" unit="" />
          </div>
        )}

        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">Shift Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <ShiftCard label="Day Shift" shift={shifts.day} />
          <ShiftCard label="Night Shift" shift={shifts.night} />
        </div>

        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/app/manager/shifts"
            className="bg-gray-900 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Review Shift Entries
          </Link>
          <Link
            to="/app/manager/stock"
            className="bg-white border border-gray-200 text-gray-700 text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Station Stock
          </Link>
          <Link
            to="/app/manager/dip"
            className="bg-white border border-gray-200 text-gray-700 text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Record Dip
          </Link>
          <Link
            to="/app/manager/delivery"
            className="bg-white border border-gray-200 text-gray-700 text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Record Delivery
          </Link>
          <Link
            to="/app/manager/cash"
            className="bg-white border border-gray-200 text-gray-700 text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cash Log
          </Link>
          <Link
            to="/app/manager/flags"
            className="bg-white border border-gray-200 text-gray-700 text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Flags
          </Link>
          <Link
            to="/app/manager/close"
            aria-disabled={!bothClosed}
            className={`text-sm font-medium px-5 py-2.5 rounded-lg transition-colors ${
              bothClosed
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed pointer-events-none'
            }`}
          >
            Close Day
          </Link>
        </div>
      </div>
    </div>
  )
}
