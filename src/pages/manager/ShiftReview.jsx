import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { todayISO } from '../../lib/shiftUtils'

function varianceColor(pct) {
  const abs = Math.abs(pct)
  if (abs < 1) return 'text-green-600'
  if (abs < 2) return 'text-amber-600'
  return 'text-red-600'
}

export default function ShiftReview() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [date, setDate] = useState(todayISO())
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user?.station_id) return
    async function load() {
      setLoading(true)
      setError(null)

      // Latest fuel prices (take first per type after ordering desc)
      const { data: priceData } = await supabase
        .from('fuel_prices')
        .select('fuel_type, price_per_litre')
        .order('effective_from', { ascending: false })

      const priceMap = {}
      priceData?.forEach(p => {
        if (!priceMap[p.fuel_type]) priceMap[p.fuel_type] = p.price_per_litre
      })
      const pmaPrice = priceMap['PMA'] ?? 0
      const agoPrice = priceMap['AGO'] ?? 0

      // Shifts for selected date
      const { data: shiftData, error: shiftErr } = await supabase
        .from('shifts')
        .select('id, shift_type')
        .eq('station_id', user.station_id)
        .eq('shift_date', date)

      if (shiftErr) { setError(shiftErr.message); setLoading(false); return }

      const shiftIds = (shiftData ?? []).map(s => s.id)
      const shiftTypeMap = {}
      shiftData?.forEach(s => { shiftTypeMap[s.id] = s.shift_type })

      if (shiftIds.length === 0) { setRows([]); setLoading(false); return }

      // Entries for those shifts
      const { data: entryData, error: entryErr } = await supabase
        .from('attendant_entries')
        .select('id, shift_id, attendant_id, pma_litres_sold, ago_litres_sold, cash_collected, card_collected, submitted_at, is_corrected')
        .in('shift_id', shiftIds)
        .order('submitted_at', { ascending: true })

      if (entryErr) { setError(entryErr.message); setLoading(false); return }

      // Attendant names
      const attendantIds = [...new Set((entryData ?? []).map(e => e.attendant_id))]
      const nameMap = {}
      if (attendantIds.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, full_name')
          .in('id', attendantIds)
        users?.forEach(u => { nameMap[u.id] = u.full_name })
      }

      const enriched = (entryData ?? []).map(e => {
        const expectedPma = (e.pma_litres_sold ?? 0) * pmaPrice
        const expectedAgo = (e.ago_litres_sold ?? 0) * agoPrice
        const expected = expectedPma + expectedAgo
        const actual = (e.cash_collected ?? 0) + (e.card_collected ?? 0)
        const variance = expected - actual
        const variancePct = expected > 0 ? (variance / expected) * 100 : 0
        return {
          ...e,
          shift_type: shiftTypeMap[e.shift_id] ?? '—',
          attendant_name: nameMap[e.attendant_id] ?? '—',
          expected,
          actual,
          variance,
          variancePct,
        }
      })

      setRows(enriched)
      setLoading(false)
    }
    load()
  }, [user?.station_id, date])

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/app/manager" className="text-gray-400 hover:text-gray-700 text-sm">← Dashboard</Link>
          <span className="text-gray-300">|</span>
          <span className="font-semibold text-gray-800">Shift Entries</span>
        </div>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-6 text-sm">{error}</div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 h-16 animate-pulse" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-gray-400 text-sm">No entries for {date}</p>
          </div>
        ) : (
          <>
            {/* Mobile: entry cards */}
            <div className="md:hidden space-y-3">
              {rows.map(row => (
                <div key={row.id} className={`rounded-xl border p-4 ${row.is_corrected ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                      row.shift_type === 'day' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {row.shift_type}
                    </span>
                    <span className="font-medium text-gray-800 text-sm">{row.attendant_name}</span>
                    <span className="ml-auto text-xs text-gray-400">
                      {row.submitted_at
                        ? new Date(row.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">PMA</p>
                      <p className="tabular-nums text-gray-700">{(row.pma_litres_sold ?? 0).toLocaleString()} L</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">AGO</p>
                      <p className="tabular-nums text-gray-700">{(row.ago_litres_sold ?? 0).toLocaleString()} L</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Cash</p>
                      <p className="tabular-nums text-gray-700">{(row.cash_collected ?? 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Card</p>
                      <p className="tabular-nums text-gray-700">{(row.card_collected ?? 0).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Expected</p>
                      <p className="tabular-nums text-sm text-gray-700">
                        {row.expected.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${varianceColor(row.variancePct)} bg-gray-100`}>
                        {row.variancePct > 0 ? '+' : ''}{row.variancePct.toFixed(1)}%
                      </span>
                      {row.is_corrected ? (
                        <span className="text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 font-medium">
                          Corrected
                        </span>
                      ) : (
                        <button
                          onClick={() => navigate('/app/manager/correct', { state: { entry: row } })}
                          className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-colors"
                        >
                          Correct
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Shift</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Attendant</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">PMA (L)</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">AGO (L)</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Cash</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Card</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Expected</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Variance</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Submitted</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map(row => (
                    <tr key={row.id} className={row.is_corrected ? 'bg-amber-50' : 'hover:bg-gray-50'}>
                      <td className="px-4 py-3 capitalize text-gray-700">{row.shift_type}</td>
                      <td className="px-4 py-3 text-gray-700">{row.attendant_name}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{(row.pma_litres_sold ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{(row.ago_litres_sold ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{(row.cash_collected ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{(row.card_collected ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {row.expected.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                      <td className={`px-4 py-3 text-right font-medium ${varianceColor(row.variancePct)}`}>
                        {row.variancePct > 0 ? '+' : ''}{row.variancePct.toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {row.submitted_at
                          ? new Date(row.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {row.is_corrected ? (
                          <span className="text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 font-medium">
                            Corrected
                          </span>
                        ) : (
                          <button
                            onClick={() => navigate('/app/manager/correct', { state: { entry: row } })}
                            className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-colors"
                          >
                            Correct
                          </button>
                        )}
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
