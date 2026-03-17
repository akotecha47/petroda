import { supabase } from './supabase'

/**
 * Returns the id of an existing shift matching station+type+date,
 * or creates one and returns the new id.
 * @param {string} stationId
 * @param {'day'|'night'} shiftType
 * @param {string} shiftDate — 'YYYY-MM-DD'
 * @returns {Promise<{ shiftId: string|null, error: Error|null }>}
 */
export async function getOrCreateShift(stationId, shiftType, shiftDate) {
  const { data: existing, error: fetchError } = await supabase
    .from('shifts')
    .select('id')
    .eq('station_id', stationId)
    .eq('shift_type', shiftType)
    .eq('shift_date', shiftDate)
    .maybeSingle()

  if (fetchError) return { shiftId: null, error: fetchError }
  if (existing) return { shiftId: existing.id, error: null }

  const { data: created, error: createError } = await supabase
    .from('shifts')
    .insert({ station_id: stationId, shift_type: shiftType, shift_date: shiftDate, status: 'open' })
    .select('id')
    .single()

  if (createError) return { shiftId: null, error: createError }
  return { shiftId: created.id, error: null }
}
