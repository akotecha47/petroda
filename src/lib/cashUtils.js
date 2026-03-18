import { supabase } from './supabase'

/**
 * Returns current cash balance for a station.
 * balance = total cash/card collected by attendants
 *           + cash movements IN
 *           - cash movements OUT
 */
export async function cashBalance(stationId) {
  const [{ data: entries }, { data: movements }] = await Promise.all([
    supabase
      .from('attendant_entries')
      .select('cash_collected, card_collected')
      .eq('station_id', stationId),
    supabase
      .from('cash_movements')
      .select('direction, amount')
      .eq('station_id', stationId),
  ])

  const collected = (entries ?? []).reduce(
    (s, e) => s + (e.cash_collected ?? 0) + (e.card_collected ?? 0),
    0,
  )

  let totalIn = collected
  let totalOut = 0

  ;(movements ?? []).forEach(m => {
    if (m.direction === 'in') totalIn += m.amount ?? 0
    else if (m.direction === 'out') totalOut += m.amount ?? 0
  })

  return { balance: totalIn - totalOut, totalIn, totalOut }
}
