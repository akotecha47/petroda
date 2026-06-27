/**
 * Fuel reconciliation — one per fuel type per form
 *
 * book_closing = opening_dip_litres + deliveries - total_meter_outflow
 * variance     = book_closing - closing_dip_litres
 * flagged      = abs(variance) > threshold
 */
export function calculateFuelRecon({
  openingDipLitres,
  deliveriesLitres,
  totalMeterOutflow,
  closingDipLitres,
  threshold,
}) {
  const bookClosing =
    (openingDipLitres || 0) +
    (deliveriesLitres || 0) -
    (totalMeterOutflow || 0)
  const variance = bookClosing - (closingDipLitres || 0)
  const flagged = Math.abs(variance) > (threshold || 0)
  return {
    openingDipLitres,
    deliveriesLitres,
    totalMeterOutflow,
    bookClosing,
    closingDipLitres,
    variance,
    flagged,
  }
}

/**
 * Cash reconciliation — one per form
 *
 * expected = fuel_cash + lubs_cash + airtime
 * variance = expected - deposited
 * flagged  = abs(variance) > threshold
 */
export function calculateCashRecon({
  fuelCashSales,
  lubsCashSales,
  airtimeSales,
  depositedAmount,
  threshold,
}) {
  const expectedCash =
    (fuelCashSales || 0) +
    (lubsCashSales || 0) +
    (airtimeSales || 0)
  const variance = expectedCash - (depositedAmount || 0)
  const flagged = Math.abs(variance) > (threshold || 0)
  return {
    expectedCash,
    depositedAmount,
    variance,
    flagged,
  }
}
