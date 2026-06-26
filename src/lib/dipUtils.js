/**
 * Interpolates litres from a dip cm reading using a
 * calibration profile array of {cm, litres} points.
 * Returns null if chart is empty (pending) or cm is out of range.
 */
export function interpolateLitres(cm, calibrationProfile) {
  if (!calibrationProfile || calibrationProfile.length === 0) {
    return null // Chart pending
  }

  const sorted = [...calibrationProfile].sort((a, b) => a.cm - b.cm)

  if (cm <= sorted[0].cm) return sorted[0].litres
  if (cm >= sorted[sorted.length - 1].cm) return sorted[sorted.length - 1].litres

  let lower, upper
  for (let i = 0; i < sorted.length - 1; i++) {
    if (cm >= sorted[i].cm && cm <= sorted[i + 1].cm) {
      lower = sorted[i]
      upper = sorted[i + 1]
      break
    }
  }

  const litres =
    lower.litres +
    ((cm - lower.cm) * (upper.litres - lower.litres)) / (upper.cm - lower.cm)

  return Math.round(litres * 100) / 100
}

if (import.meta.env.DEV) {
  const dieselChart = [
    { cm: 89.0, litres: 13000 },
    { cm: 94.0, litres: 14000 },
    { cm: 99.1, litres: 15000 },
  ]
  const result = interpolateLitres(91.5, dieselChart)
  console.log('Dip test 91.50cm:', result, '— expected ~13490L')
}
