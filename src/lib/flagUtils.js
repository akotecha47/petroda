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

  // attendant_entries removed — flag logic to be rebuilt
  // against daily_sales_forms in a later step

  const thresholds = await getThresholds()
  const flagsToCreate = []

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
      r.tanks?.fuel_type?.toUpperCase() === 'PMA' ? s + (r.calculated_litres ?? 0) : s, 0)
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
        r.tanks?.fuel_type?.toUpperCase() === 'PMA' ? s + (r.calculated_litres ?? 0) : s, 0)
      const prevAgo = (prevReadings ?? []).reduce((s, r) =>
        r.tanks?.fuel_type?.toUpperCase() === 'AGO' ? s + (r.calculated_litres ?? 0) : s, 0)

      let deliveryPma = 0
      let deliveryAgo = 0
      deliveriesBetween?.forEach(d => {
        const ft = d.fuel_type?.toUpperCase()
        if (ft === 'PMA') deliveryPma += d.litres ?? 0
        else if (ft === 'AGO') deliveryAgo += d.litres ?? 0
      })

      // totalPma / totalAgo will come from daily_sales_forms once rebuilt
      const totalPma = 0
      const totalAgo = 0

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
