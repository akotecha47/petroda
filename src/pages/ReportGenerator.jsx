import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { getDemoAdjustedRange } from '../lib/demoOffset'
import { currentStock } from '../lib/stockUtils'
import OwnerNav from '../components/owner/OwnerNav'
import AdminNav from '../components/admin/AdminNav'
import jsPDF from 'jspdf'

// ─── Helpers ───────────────────────────────────────────────────────────────────

function priceAt(prices, fuelType, date) {
  const ft = fuelType.toUpperCase()
  const relevant = (prices ?? []).filter(p => p.fuel_type === ft && p.effective_from <= date)
  relevant.sort((a, b) => b.effective_from.localeCompare(a.effective_from))
  return relevant[0]?.price_per_litre ?? 0
}

function fmtMWK(n) { return Math.round(n).toLocaleString() + ' MWK' }
function fmtL(n)   { return Math.round(Math.max(0, n)).toLocaleString() + ' L' }
function fmtDate(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const FLAG_TYPE_LABELS = {
  stock_variance:    'Stock Variance',
  payment_variance:  'Payment Variance',
  positive_variance: 'Positive Variance',
  low_stock:         'Low Stock',
  other:             'Other',
}

const SEED_MAX = '2026-02-28'

// ─── Data Fetch ────────────────────────────────────────────────────────────────

async function fetchReportData(from, to, stationId) {
  // Shifts
  let shiftsQ = supabase
    .from('shifts')
    .select('id, station_id, shift_type, shift_date, stations(name)')
    .gte('shift_date', from)
    .lte('shift_date', to)
    .order('shift_date', { ascending: false })
  if (stationId !== 'all') shiftsQ = shiftsQ.eq('station_id', stationId)
  const { data: shifts } = await shiftsQ

  const shiftIds = (shifts ?? []).map(s => s.id)
  const entries = shiftIds.length > 0
    ? ((await supabase
        .from('attendant_entries')
        .select('shift_id, pma_litres_sold, ago_litres_sold, cash_collected, card_collected, user_id, users(full_name)')
        .in('shift_id', shiftIds)).data ?? [])
    : []

  const { data: prices } = await supabase
    .from('fuel_prices')
    .select('fuel_type, price_per_litre, effective_from')
    .order('effective_from', { ascending: false })

  // Flags
  let flagsQ = supabase
    .from('flags_investigations')
    .select('id, flag_type, severity, status, raised_at, station_id, stations(name), shifts(shift_date)')
    .gte('raised_at', from + 'T00:00:00')
    .lte('raised_at', to + 'T23:59:59')
    .order('raised_at', { ascending: false })
  if (stationId !== 'all') flagsQ = flagsQ.eq('station_id', stationId)
  const { data: flags } = await flagsQ

  // Deliveries
  let delivQ = supabase
    .from('deliveries')
    .select('station_id, fuel_type, litres, delivery_datetime, stations(name)')
    .gte('delivery_datetime', from + 'T00:00:00')
    .lte('delivery_datetime', to + 'T23:59:59')
    .order('delivery_datetime', { ascending: false })
  if (stationId !== 'all') delivQ = delivQ.eq('station_id', stationId)
  const { data: deliveries } = await delivQ

  // Build lookup maps
  const entriesByShift = {}
  ;(entries ?? []).forEach(e => {
    if (!entriesByShift[e.shift_id]) entriesByShift[e.shift_id] = []
    entriesByShift[e.shift_id].push(e)
  })

  // ── Fuel Sales by Shift
  const fuelSales = (shifts ?? [])
    .filter(s => entriesByShift[s.id]?.length > 0)
    .map(s => {
      const es = entriesByShift[s.id]
      return {
        date:      s.shift_date,
        station:   s.stations?.name ?? '—',
        shiftType: s.shift_type,
        attendant: es[0]?.users?.full_name ?? '—',
        pma: es.reduce((sum, e) => sum + (e.pma_litres_sold ?? 0), 0),
        ago: es.reduce((sum, e) => sum + (e.ago_litres_sold ?? 0), 0),
      }
    })

  // ── Revenue by Station
  const revByStation = {}
  ;(shifts ?? []).forEach(s => {
    if (!revByStation[s.station_id])
      revByStation[s.station_id] = { name: s.stations?.name ?? '—', pmaRev: 0, agoRev: 0 }
    const es = entriesByShift[s.id] ?? []
    const pmaP = priceAt(prices, 'PMS', s.shift_date)
    const agoP = priceAt(prices, 'AGO', s.shift_date)
    es.forEach(e => {
      revByStation[s.station_id].pmaRev += (e.pma_litres_sold ?? 0) * pmaP
      revByStation[s.station_id].agoRev += (e.ago_litres_sold ?? 0) * agoP
    })
  })
  const revenue = Object.values(revByStation).map(r => ({ ...r, total: r.pmaRev + r.agoRev }))

  // ── Cash by Station
  const cashByStation = {}
  ;(shifts ?? []).forEach(s => {
    if (!cashByStation[s.station_id])
      cashByStation[s.station_id] = { name: s.stations?.name ?? '—', expected: 0, actual: 0 }
    const es = entriesByShift[s.id] ?? []
    const pmaP = priceAt(prices, 'PMS', s.shift_date)
    const agoP = priceAt(prices, 'AGO', s.shift_date)
    es.forEach(e => {
      cashByStation[s.station_id].expected += (e.pma_litres_sold ?? 0) * pmaP + (e.ago_litres_sold ?? 0) * agoP
      cashByStation[s.station_id].actual   += (e.cash_collected ?? 0) + (e.card_collected ?? 0)
    })
  })
  const cash = Object.values(cashByStation).map(c => ({ ...c, variance: c.expected - c.actual }))

  // ── Stock Position
  const { data: allStations } = await supabase
    .from('stations').select('id, name').eq('is_active', true).order('name')
  const filteredStations = stationId === 'all'
    ? (allStations ?? [])
    : (allStations ?? []).filter(s => s.id === stationId)

  const delivByStation = {}
  ;(deliveries ?? []).forEach(d => {
    if (!delivByStation[d.station_id]) delivByStation[d.station_id] = { pma: 0, ago: 0 }
    const ft = (d.fuel_type ?? '').toUpperCase()
    if (ft === 'PMS') delivByStation[d.station_id].pma += d.litres ?? 0
    else if (ft === 'AGO') delivByStation[d.station_id].ago += d.litres ?? 0
  })

  const salesByStation = {}
  ;(shifts ?? []).forEach(s => {
    if (!salesByStation[s.station_id]) salesByStation[s.station_id] = { pma: 0, ago: 0 }
    ;(entriesByShift[s.id] ?? []).forEach(e => {
      salesByStation[s.station_id].pma += e.pma_litres_sold ?? 0
      salesByStation[s.station_id].ago += e.ago_litres_sold ?? 0
    })
  })

  const closingStocks = await Promise.all(filteredStations.map(s => currentStock(s.id)))
  const stock = filteredStations.flatMap((s, i) => {
    const closing = closingStocks[i]
    const deliv   = delivByStation[s.id]   ?? { pma: 0, ago: 0 }
    const sales   = salesByStation[s.id]   ?? { pma: 0, ago: 0 }
    return [
      { station: s.name, fuelType: 'PMS', opening: closing.pma + sales.pma - deliv.pma, deliveries: deliv.pma, sales: sales.pma, closing: closing.pma },
      { station: s.name, fuelType: 'AGO', opening: closing.ago + sales.ago - deliv.ago, deliveries: deliv.ago, sales: sales.ago, closing: closing.ago },
    ]
  })

  // ── Variance Summary (flags grouped by station + type + status)
  const flagsByGroup = {}
  ;(flags ?? []).forEach(f => {
    const key = `${f.station_id}|${f.flag_type}|${f.status}`
    if (!flagsByGroup[key])
      flagsByGroup[key] = { station: f.stations?.name ?? '—', flagType: f.flag_type, status: f.status, count: 0 }
    flagsByGroup[key].count++
  })
  const varianceSummary = Object.values(flagsByGroup)
    .sort((a, b) => a.station.localeCompare(b.station) || a.flagType.localeCompare(b.flagType))

  return {
    fuelSales,
    revenue,
    cash,
    stock,
    varianceSummary,
    flags: flags ?? [],
    meta: { from, to, generatedAt: new Date().toISOString() },
  }
}

// ─── PDF Generation ────────────────────────────────────────────────────────────

async function generatePDF(data, from, to, stationId, stations) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const pageW   = 210
  const pageH   = 297
  const mL      = 14
  const mR      = 14
  const mT      = 14
  const mB      = 18
  const contW   = pageW - mL - mR
  let y = mT

  function checkBreak(needed = 10) {
    if (y + needed > pageH - mB) { doc.addPage(); y = mT }
  }

  function sectionHeader(title) {
    checkBreak(12)
    doc.setFillColor(242, 242, 242)
    doc.rect(mL, y, contW, 7.5, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(70, 70, 70)
    doc.text(title, mL + 3, y + 5.2)
    y += 10
  }

  function emptyNote(text) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(170, 170, 170)
    doc.text(text, mL + 2, y + 4.5)
    y += 10
  }

  function drawTable(cols, rows, footer = null) {
    const rH = 6
    const hH = 7
    checkBreak(hH + rH)

    // Header
    doc.setFillColor(248, 248, 248)
    doc.rect(mL, y, contW, hH, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(130, 130, 130)
    let xCur = mL
    cols.forEach(c => {
      if (c.right) doc.text(c.label.toUpperCase(), xCur + c.w - 2, y + 4.8, { align: 'right' })
      else         doc.text(c.label.toUpperCase(), xCur + 2,        y + 4.8)
      xCur += c.w
    })
    y += hH

    // Rows
    rows.forEach((row, ri) => {
      checkBreak(rH)
      if (ri % 2 === 1) {
        doc.setFillColor(250, 251, 252)
        doc.rect(mL, y, contW, rH, 'F')
      }
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(55, 55, 55)
      let xCur = mL
      cols.forEach((c, ci) => {
        const raw  = String(row[ci] ?? '—')
        const cell = doc.getStringUnitWidth(raw) * 8.5 / doc.internal.scaleFactor > c.w - 4
          ? raw.slice(0, Math.floor((c.w - 6) / (doc.getStringUnitWidth('M') * 8.5 / doc.internal.scaleFactor))) + '…'
          : raw
        if (c.right) doc.text(cell, xCur + c.w - 2, y + 4.2, { align: 'right' })
        else         doc.text(cell, xCur + 2,        y + 4.2)
        xCur += c.w
      })
      y += rH
    })

    // Footer / totals row
    if (footer) {
      checkBreak(rH)
      doc.setFillColor(232, 232, 232)
      doc.rect(mL, y, contW, rH, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      doc.setTextColor(30, 30, 30)
      let xCur = mL
      cols.forEach((c, ci) => {
        const cell = String(footer[ci] ?? '')
        if (c.right) doc.text(cell, xCur + c.w - 2, y + 4.2, { align: 'right' })
        else         doc.text(cell, xCur + 2,        y + 4.2)
        xCur += c.w
      })
      y += rH
    }

    y += 5
  }

  const { fuelSales, revenue, cash, stock, varianceSummary, flags, meta } = data
  const stationName = stationId === 'all'
    ? 'All Stations'
    : stations.find(s => s.id === stationId)?.name ?? '—'
  const dateLabel = from === to ? fmtDate(from) : `${fmtDate(from)} to ${fmtDate(to)}`
  const reportTitle = `${stationName} — ${dateLabel} Operations Report`

  const revTotals  = revenue.reduce((a, r) => ({ pmaRev: a.pmaRev + r.pmaRev, agoRev: a.agoRev + r.agoRev, total: a.total + r.total }), { pmaRev: 0, agoRev: 0, total: 0 })
  const cashTotals = cash.reduce((a, c)    => ({ expected: a.expected + c.expected, actual: a.actual + c.actual, variance: a.variance + c.variance }), { expected: 0, actual: 0, variance: 0 })

  // ── Report Header
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(20, 20, 20)
  doc.text(reportTitle, mL, y + 6, { maxWidth: contW - 50 })
  y += 10
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(150, 150, 150)
  doc.text(
    `Generated ${new Date(meta.generatedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
    mL, y
  )
  doc.text('Built by Streamline', pageW - mR, y, { align: 'right' })
  y += 10

  // ── 1. Fuel Sales by Shift
  sectionHeader('1. Fuel Sales by Shift')
  if (fuelSales.length === 0) {
    emptyNote('No shift data for this period.')
  } else {
    drawTable(
      [{ label: 'Shift Date', w: 28 }, { label: 'Station', w: 46 }, { label: 'Shift Type', w: 24 }, { label: 'PMS Sold (L)', w: 26, right: true }, { label: 'AGO Sold (L)', w: 26, right: true }, { label: 'Attendant', w: 32 }],
      fuelSales.map(r => [fmtDate(r.date), r.station, r.shiftType, fmtL(r.pma), fmtL(r.ago), r.attendant])
    )
  }

  // ── 2. Revenue Summary
  sectionHeader('2. Revenue Summary')
  if (revenue.length === 0) {
    emptyNote('No revenue data for this period.')
  } else {
    drawTable(
      [{ label: 'Station', w: 60 }, { label: 'PMS Revenue (MWK)', w: 42, right: true }, { label: 'AGO Revenue (MWK)', w: 42, right: true }, { label: 'Total Revenue (MWK)', w: 38, right: true }],
      revenue.map(r => [r.name, fmtMWK(r.pmaRev), fmtMWK(r.agoRev), fmtMWK(r.total)]),
      ['Total', fmtMWK(revTotals.pmaRev), fmtMWK(revTotals.agoRev), fmtMWK(revTotals.total)]
    )
  }

  // ── 3. Cash Summary
  sectionHeader('3. Cash Summary')
  if (cash.length === 0) {
    emptyNote('No cash data for this period.')
  } else {
    drawTable(
      [{ label: 'Station', w: 60 }, { label: 'Expected Cash (MWK)', w: 42, right: true }, { label: 'Actual Cash (MWK)', w: 42, right: true }, { label: 'Variance (MWK)', w: 38, right: true }],
      cash.map(c => [c.name, fmtMWK(c.expected), fmtMWK(c.actual), fmtMWK(c.variance)]),
      ['Total', fmtMWK(cashTotals.expected), fmtMWK(cashTotals.actual), fmtMWK(cashTotals.variance)]
    )
  }

  // ── 4. Stock Position
  sectionHeader('4. Stock Position')
  if (stock.length === 0) {
    emptyNote('No stock data available.')
  } else {
    drawTable(
      [{ label: 'Station', w: 48 }, { label: 'Fuel', w: 16 }, { label: 'Opening (L)', w: 30, right: true }, { label: 'Deliveries (L)', w: 33, right: true }, { label: 'Sales (L)', w: 27, right: true }, { label: 'Closing (L)', w: 28, right: true }],
      stock.map(r => [r.station, r.fuelType, fmtL(r.opening), fmtL(r.deliveries), fmtL(r.sales), fmtL(r.closing)])
    )
  }

  // ── 5. Variance Summary
  sectionHeader('5. Variance Summary')
  if (varianceSummary.length === 0) {
    emptyNote('No flags for this period.')
  } else {
    drawTable(
      [{ label: 'Station', w: 55 }, { label: 'Flag Type', w: 60 }, { label: 'Count', w: 20, right: true }, { label: 'Status', w: 47 }],
      varianceSummary.map(r => [r.station, FLAG_TYPE_LABELS[r.flagType] ?? r.flagType, String(r.count), (r.status ?? '').replace(/_/g, ' ')])
    )
  }

  // ── 6. Open & Resolved Flags
  sectionHeader('6. Open & Resolved Flags')
  if (flags.length === 0) {
    emptyNote('No flags for this period.')
  } else {
    drawTable(
      [{ label: 'Date', w: 28 }, { label: 'Station', w: 45 }, { label: 'Flag Type', w: 45 }, { label: 'Severity', w: 25 }, { label: 'Status', w: 39 }],
      flags.map(f => [
        f.shifts?.shift_date ? fmtDate(f.shifts.shift_date) : new Date(f.raised_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
        f.stations?.name ?? '—',
        FLAG_TYPE_LABELS[f.flag_type] ?? f.flag_type,
        f.severity ?? '—',
        (f.status ?? '').replace(/_/g, ' '),
      ])
    )
  }

  // ── Page footers
  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(190, 190, 190)
    doc.text('Built by Streamline', mL, pageH - 8)
    doc.text(`Page ${p} of ${totalPages}`, pageW - mR, pageH - 8, { align: 'right' })
  }

  // ── Save
  const slug      = stationName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const dateSlug  = from === to ? from : `${from}-to-${to}`
  doc.save(`petroda-${slug}-${dateSlug}-report.pdf`)
}

// ─── Preview Components ────────────────────────────────────────────────────────

function SectionHeader({ title }) {
  return (
    <div className="bg-gray-50 px-5 py-2.5 border-b border-gray-100">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">{title}</p>
    </div>
  )
}

function PreviewTable({ headers, rows, footer }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            {headers.map((h, i) => (
              <th key={i} className={`px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-400 ${h.right ? 'text-right' : 'text-left'}`}>
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={`border-b border-gray-50 last:border-0 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
              {row.map((cell, j) => (
                <td key={j} className={`px-5 py-2 text-gray-700 tabular-nums text-sm ${headers[j]?.right ? 'text-right' : ''}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
          {footer && (
            <tr className="border-t-2 border-gray-200 bg-gray-50">
              {footer.map((cell, j) => (
                <td key={j} className={`px-5 py-2.5 font-semibold text-gray-800 text-sm ${headers[j]?.right ? 'text-right' : ''}`}>
                  {cell}
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function ReportPreview({ data, from, to, stationId, stations }) {
  const { fuelSales, revenue, cash, stock, varianceSummary, flags, meta } = data
  const stationName = stationId === 'all'
    ? 'All Stations'
    : stations.find(s => s.id === stationId)?.name ?? '—'
  const dateLabel   = from === to ? fmtDate(from) : `${fmtDate(from)} to ${fmtDate(to)}`
  const reportTitle = `${stationName} — ${dateLabel} Operations Report`
  const revTotals   = revenue.reduce((a, r) => ({ pmaRev: a.pmaRev + r.pmaRev, agoRev: a.agoRev + r.agoRev, total: a.total + r.total }), { pmaRev: 0, agoRev: 0, total: 0 })
  const cashTotals  = cash.reduce((a, c)    => ({ expected: a.expected + c.expected, actual: a.actual + c.actual, variance: a.variance + c.variance }), { expected: 0, actual: 0, variance: 0 })

  const empty = (msg) => <p className="px-5 py-4 text-sm text-gray-400">{msg}</p>

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-bold text-gray-900 text-base leading-snug">{reportTitle}</h2>
          <p className="text-xs text-gray-400 mt-1">
            Generated {new Date(meta.generatedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <p className="text-xs text-gray-300 whitespace-nowrap">Built by Streamline</p>
      </div>

      {/* 1. Fuel Sales by Shift */}
      <SectionHeader title="1. Fuel Sales by Shift" />
      {fuelSales.length === 0 ? empty('No shift data for this period.') : (
        <PreviewTable
          headers={[{ label: 'Shift Date' }, { label: 'Station' }, { label: 'Shift Type' }, { label: 'PMS Sold', right: true }, { label: 'AGO Sold', right: true }, { label: 'Attendant' }]}
          rows={fuelSales.map(r => [fmtDate(r.date), r.station, r.shiftType, fmtL(r.pma), fmtL(r.ago), r.attendant])}
        />
      )}

      {/* 2. Revenue Summary */}
      <SectionHeader title="2. Revenue Summary" />
      {revenue.length === 0 ? empty('No revenue data for this period.') : (
        <PreviewTable
          headers={[{ label: 'Station' }, { label: 'PMS Revenue', right: true }, { label: 'AGO Revenue', right: true }, { label: 'Total Revenue', right: true }]}
          rows={revenue.map(r => [r.name, fmtMWK(r.pmaRev), fmtMWK(r.agoRev), fmtMWK(r.total)])}
          footer={['Total', fmtMWK(revTotals.pmaRev), fmtMWK(revTotals.agoRev), fmtMWK(revTotals.total)]}
        />
      )}

      {/* 3. Cash Summary */}
      <SectionHeader title="3. Cash Summary" />
      {cash.length === 0 ? empty('No cash data for this period.') : (
        <PreviewTable
          headers={[{ label: 'Station' }, { label: 'Expected Cash', right: true }, { label: 'Actual Cash', right: true }, { label: 'Variance', right: true }]}
          rows={cash.map(c => [c.name, fmtMWK(c.expected), fmtMWK(c.actual), fmtMWK(c.variance)])}
          footer={['Total', fmtMWK(cashTotals.expected), fmtMWK(cashTotals.actual), fmtMWK(cashTotals.variance)]}
        />
      )}

      {/* 4. Stock Position */}
      <SectionHeader title="4. Stock Position" />
      {stock.length === 0 ? empty('No stock data available.') : (
        <PreviewTable
          headers={[{ label: 'Station' }, { label: 'Fuel' }, { label: 'Opening Stock', right: true }, { label: 'Deliveries', right: true }, { label: 'Sales', right: true }, { label: 'Closing Stock', right: true }]}
          rows={stock.map(r => [r.station, r.fuelType, fmtL(r.opening), fmtL(r.deliveries), fmtL(r.sales), fmtL(r.closing)])}
        />
      )}

      {/* 5. Variance Summary */}
      <SectionHeader title="5. Variance Summary" />
      {varianceSummary.length === 0 ? empty('No flags for this period.') : (
        <PreviewTable
          headers={[{ label: 'Station' }, { label: 'Flag Type' }, { label: 'Count', right: true }, { label: 'Status' }]}
          rows={varianceSummary.map(r => [r.station, FLAG_TYPE_LABELS[r.flagType] ?? r.flagType, String(r.count), (r.status ?? '').replace(/_/g, ' ')])}
        />
      )}

      {/* 6. Open & Resolved Flags */}
      <SectionHeader title="6. Open & Resolved Flags" />
      {flags.length === 0 ? empty('No flags for this period.') : (
        <PreviewTable
          headers={[{ label: 'Date' }, { label: 'Station' }, { label: 'Flag Type' }, { label: 'Severity' }, { label: 'Status' }]}
          rows={flags.map(f => [
            f.shifts?.shift_date
              ? fmtDate(f.shifts.shift_date)
              : new Date(f.raised_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
            f.stations?.name ?? '—',
            FLAG_TYPE_LABELS[f.flag_type] ?? f.flag_type,
            f.severity ?? '—',
            (f.status ?? '').replace(/_/g, ' '),
          ])}
        />
      )}
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function ReportGenerator() {
  const { user } = useAuth()
  const [stations, setStations]         = useState([])
  const [stationFilter, setStationFilter] = useState('all')
  const [preset, setPreset]             = useState('last7days')
  const [customFrom, setCustomFrom]     = useState(getDemoAdjustedRange('last7days').from)
  const [customTo, setCustomTo]         = useState(getDemoAdjustedRange('last7days').to)
  const [reportData, setReportData]     = useState(null)
  const [generating, setGenerating]     = useState(false)
  const [downloading, setDownloading]   = useState(false)

  const { from, to } = preset === 'custom'
    ? { from: customFrom, to: customTo }
    : preset === 'today'
      ? getDemoAdjustedRange('day')
      : preset === 'last7days'
        ? getDemoAdjustedRange('last7days')
        : getDemoAdjustedRange('last30days')

  useEffect(() => {
    supabase.from('stations').select('id, name').eq('is_active', true).order('name')
      .then(({ data }) => setStations(data ?? []))
  }, [])

  async function handleGenerate() {
    setGenerating(true)
    setReportData(null)
    const data = await fetchReportData(from, to, stationFilter)
    setReportData(data)
    setGenerating(false)
  }

  async function handleDownload() {
    if (!reportData) return
    setDownloading(true)
    await generatePDF(reportData, from, to, stationFilter, stations)
    setDownloading(false)
  }

  if (!user) return null

  const Nav = user.role === 'admin' ? AdminNav : OwnerNav

  return (
    <div className="min-h-screen bg-slate-100 pb-20 md:pb-0">
      <Nav />
      <div className="max-w-6xl mx-auto px-6 py-8">
        <h1 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-6">Report Generator</h1>

        {/* Parameters card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-5">Report Parameters</p>

          {/* Period presets */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 mb-2">Date Range</label>
            <div className="flex gap-2 flex-wrap">
              {[
                { value: 'today',      label: 'Today' },
                { value: 'last7days',  label: 'Last 7 Days' },
                { value: 'last30days', label: 'Last 30 Days' },
                { value: 'custom',     label: 'Custom' },
              ].map(p => (
                <button
                  key={p.value}
                  onClick={() => setPreset(p.value)}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    preset === p.value
                      ? 'bg-gray-900 text-white'
                      : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {preset === 'custom' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
                <input
                  type="date"
                  value={customFrom}
                  max={SEED_MAX}
                  onChange={e => setCustomFrom(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
                <input
                  type="date"
                  value={customTo}
                  max={SEED_MAX}
                  onChange={e => setCustomTo(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                />
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400 mb-4">
              {from === to ? fmtDate(from) : `${fmtDate(from)} — ${fmtDate(to)}`}
            </p>
          )}

          {/* Station selector */}
          <div className="mb-5">
            <label className="block text-xs font-medium text-gray-500 mb-2">Station</label>
            <select
              value={stationFilter}
              onChange={e => setStationFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white"
            >
              <option value="all">All Stations</option>
              {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-5 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {generating ? 'Generating…' : 'Generate Report'}
          </button>
        </div>

        {/* Preview */}
        {reportData && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Preview</p>
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="px-5 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                {downloading ? 'Building PDF…' : 'Download PDF'}
              </button>
            </div>
            <ReportPreview
              data={reportData}
              from={from}
              to={to}
              stationId={stationFilter}
              stations={stations}
            />
          </div>
        )}
      </div>
    </div>
  )
}
