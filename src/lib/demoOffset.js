const SEED_END_DATE = new Date('2026-02-28')

export function getDemoOffset() {
  const today = new Date()
  const diffMs = today - SEED_END_DATE
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

export function getDemoAdjustedRange(period) {
  const adjustedEnd = new Date(SEED_END_DATE)
  const adjustedStart = new Date(SEED_END_DATE)

  if (period === 'day') {
    return {
      from: SEED_END_DATE.toISOString().slice(0, 10),
      to: SEED_END_DATE.toISOString().slice(0, 10),
    }
  }
  if (period === 'last7days') {
    adjustedStart.setDate(adjustedStart.getDate() - 7)
    return {
      from: adjustedStart.toISOString().slice(0, 10),
      to: SEED_END_DATE.toISOString().slice(0, 10),
    }
  }
  if (period === 'last30days') {
    adjustedStart.setDate(adjustedStart.getDate() - 30)
    return {
      from: adjustedStart.toISOString().slice(0, 10),
      to: SEED_END_DATE.toISOString().slice(0, 10),
    }
  }
  return {
    from: SEED_END_DATE.toISOString().slice(0, 10),
    to: SEED_END_DATE.toISOString().slice(0, 10),
  }
}
