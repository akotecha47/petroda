import { supabase } from './supabase'

/**
 * Linear interpolation from a calibration profile array [{cm, litres}, ...].
 * Returns 0 if profile is empty or cm <= 0.
 * Clamps to max litres if cm exceeds the highest calibration point.
 */
export function interpolateLitres(profile, cm) {
  if (!profile || profile.length === 0 || cm <= 0) return 0
  const sorted = [...profile].sort((a, b) => a.cm - b.cm)
  if (cm <= sorted[0].cm) return sorted[0].litres
  if (cm >= sorted[sorted.length - 1].cm) return sorted[sorted.length - 1].litres
  for (let i = 0; i < sorted.length - 1; i++) {
    const lo = sorted[i]
    const hi = sorted[i + 1]
    if (cm >= lo.cm && cm <= hi.cm) {
      const t = (cm - lo.cm) / (hi.cm - lo.cm)
      return lo.litres + t * (hi.litres - lo.litres)
    }
  }
  return 0
}

/**
 * Returns current stock { pma, ago } in litres for a station.
 * Logic: latest dip entry → sum calculated_litres per fuel_type
 * + any deliveries recorded after that dip.
 */
export async function currentStock(stationId) {
  const { data: latestDip } = await supabase
    .from('dip_entries')
    .select('id, recorded_at')
    .eq('station_id', stationId)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let pmaStock = 0
  let agoStock = 0
  let latestDipTime = null

  if (latestDip) {
    latestDipTime = latestDip.recorded_at

    const { data: readings } = await supabase
      .from('dip_tank_readings')
      .select('calculated_litres, tanks(fuel_type)')
      .eq('dip_entry_id', latestDip.id)

    readings?.forEach(r => {
      const ft = r.tanks?.fuel_type?.toUpperCase()
      if (ft === 'PMA') pmaStock += r.calculated_litres ?? 0
      else if (ft === 'AGO') agoStock += r.calculated_litres ?? 0
    })
  }

  let deliveryQuery = supabase
    .from('deliveries')
    .select('fuel_type, litres')
    .eq('station_id', stationId)

  if (latestDipTime) {
    deliveryQuery = deliveryQuery.gt('delivery_datetime', latestDipTime)
  }

  const { data: deliveries } = await deliveryQuery
  deliveries?.forEach(d => {
    const ft = d.fuel_type?.toUpperCase()
    if (ft === 'PMA') pmaStock += d.litres ?? 0
    else if (ft === 'AGO') agoStock += d.litres ?? 0
  })

  return { pma: pmaStock, ago: agoStock }
}
