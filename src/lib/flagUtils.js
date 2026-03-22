import { supabase } from './supabase'

const DEFAULT_THRESHOLDS = {
  fuel_variance_warning: 0.005,
  fuel_variance_critical: 0.010,
  payment_variance_warning: 0.010,
  payment_variance_critical: 0.020,
}

async function getThresholds() {
  const { data } = await supabase.from('thresholds').select('key, value')
  const map = { ...DEFAULT_THRESHOLDS }
  data?.forEach(t => { map[t.key] = t.value })
  return map
}

export async function generateShiftFlags(shiftId, stationId) {
  const { data: shift } = await supabase
    .from('shifts')
    .select('id, shift_date, shift_type')
    .eq('id', shiftId)
    .single()

  if (!shift) return []

  const [
    { data: entries },
    pmaPriceResult,
    agoPriceResult,
    thresholds,
  ] = await Promise.all([
    supabase
      .from('attendant_entries')
      .select('pma_litres_sold, ago_litres_sold, cash_collected, card_collected')
      .eq('shift_id', shiftId),
    supabase
      .from('fuel_prices')
      .select('price_per_litre')
      .eq('fuel_type', 'PMS')
      .lte('effective_from', shift.shift_date)
      .order('effective_from', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('fuel_prices')
      .select('price_per_litre')
      .eq('fuel_type', 'AGO')
      .lte('effective_from', shift.shift_date)
      .order('effective_from', { ascending: false })
      .limit(1)
      .maybeSingle(),
    getThresholds(),
  ])

  if (!entries?.length) return []

  const totalPma = entries.reduce((s, e) => s + (e.pma_litres_sold ?? 0), 0)
  const totalAgo = entries.reduce((s, e) => s + (e.ago_litres_sold ?? 0), 0)
  const totalCash = entries.reduce((s, e) => s + (e.cash_collected ?? 0), 0)
  const totalCard = entries.reduce((s, e) => s + (e.card_collected ?? 0), 0)
  const totalCollected = totalCash + totalCard

  const pmaPriceVal = pmaPriceResult.data?.price_per_litre ?? 0
  const agoPriceVal = agoPriceResult.data?.price_per_litre ?? 0
  const expectedRevenue = totalPma * pmaPriceVal + totalAgo * agoPriceVal
  const paymentVariance = expectedRevenue - totalCollected
  const paymentVariancePct = expectedRevenue > 0 ? Math.abs(paymentVariance) / expectedRevenue : 0

  const flagsToCreate = []

  if (paymentVariancePct >= thresholds.payment_variance_warning) {
    const severity = paymentVariancePct >= thresholds.payment_variance_critical ? 'critical' : 'warning'
    const flagType = paymentVariance < 0 ? 'positive_variance' : 'payment_variance'
    flagsToCreate.push({ flag_type: flagType, severity })
  }

  // Stock variance — only if a dip exists for this shift and a prior dip exists to establish opening stock
  const { data: dipEntry } = await supabase
    .from('dip_entries')
    .select('id, recorded_at')
    .eq('shift_id', shiftId)
    .eq('station_id', stationId)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (dipEntry) {
    const { data: currentReadings } = await supabase
      .from('dip_tank_readings')
      .select('calculated_litres, tanks(fuel_type)')
      .eq('dip_entry_id', dipEntry.id)

    const actualPma = (currentReadings ?? []).reduce((s, r) =>
      r.tanks?.fuel_type?.toUpperCase() === 'PMS' ? s + (r.calculated_litres ?? 0) : s, 0)
    const actualAgo = (currentReadings ?? []).reduce((s, r) =>
      r.tanks?.fuel_type?.toUpperCase() === 'AGO' ? s + (r.calculated_litres ?? 0) : s, 0)

    const { data: prevDip } = await supabase
      .from('dip_entries')
      .select('id, recorded_at')
      .eq('station_id', stationId)
      .lt('recorded_at', dipEntry.recorded_at)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (prevDip) {
      const [{ data: prevReadings }, { data: deliveriesBetween }] = await Promise.all([
        supabase
          .from('dip_tank_readings')
          .select('calculated_litres, tanks(fuel_type)')
          .eq('dip_entry_id', prevDip.id),
        supabase
          .from('deliveries')
          .select('fuel_type, litres')
          .eq('station_id', stationId)
          .gte('delivery_datetime', prevDip.recorded_at)
          .lte('delivery_datetime', dipEntry.recorded_at),
      ])

      const prevPma = (prevReadings ?? []).reduce((s, r) =>
        r.tanks?.fuel_type?.toUpperCase() === 'PMS' ? s + (r.calculated_litres ?? 0) : s, 0)
      const prevAgo = (prevReadings ?? []).reduce((s, r) =>
        r.tanks?.fuel_type?.toUpperCase() === 'AGO' ? s + (r.calculated_litres ?? 0) : s, 0)

      let deliveryPma = 0
      let deliveryAgo = 0
      deliveriesBetween?.forEach(d => {
        const ft = d.fuel_type?.toUpperCase()
        if (ft === 'PMS') deliveryPma += d.litres ?? 0
        else if (ft === 'AGO') deliveryAgo += d.litres ?? 0
      })

      const expectedPma = prevPma + deliveryPma - totalPma
      const expectedAgo = prevAgo + deliveryAgo - totalAgo
      const totalExpected = expectedPma + expectedAgo
      const totalActual = actualPma + actualAgo
      const stockVariancePct = totalExpected > 0 ? Math.abs(totalActual - totalExpected) / totalExpected : 0

      if (stockVariancePct >= thresholds.fuel_variance_warning) {
        const severity = stockVariancePct >= thresholds.fuel_variance_critical ? 'critical' : 'warning'
        flagsToCreate.push({ flag_type: 'stock_variance', severity })
      }
    }
  }

  const created = []
  for (const flag of flagsToCreate) {
    const { data: existing } = await supabase
      .from('flags_investigations')
      .select('id')
      .eq('shift_id', shiftId)
      .eq('flag_type', flag.flag_type)
      .maybeSingle()

    if (!existing) {
      const { data: newFlag } = await supabase
        .from('flags_investigations')
        .insert({
          station_id: stationId,
          shift_id: shiftId,
          flag_type: flag.flag_type,
          severity: flag.severity,
          status: 'detected',
          raised_at: new Date().toISOString(),
          raised_by_system: true,
        })
        .select()
        .single()

      if (newFlag) created.push(newFlag)
    }
  }

  return created
}
