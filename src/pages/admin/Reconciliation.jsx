import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { calculateFuelRecon, calculateCashRecon } from '../../lib/reconUtils'
import { fuelLabel } from '../../lib/fuelLabels'

function fmtDate(isoDate) {
  return new Date(isoDate + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

const n = v => parseFloat(v) || 0
const comma = v => Math.round(n(v)).toLocaleString()

function StatusBadge({ status }) {
  const colors = {
    submitted:   'bg-amber-100 text-amber-700',
    reconciled:  'bg-green-100 text-green-700',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[status] ?? 'bg-gray-100 text-gray-500'}`}>
      {status}
    </span>
  )
}

function ReconRow({ label, value, unit, variance }) {
  const num = n(value)
  let color = 'text-gray-900'
  if (variance) {
    color = Math.abs(num) < 0.01 ? 'text-green-600' : num < 0 ? 'text-red-600' : 'text-amber-600'
  }
  return (
    <div className="flex items-baseline justify-between py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <span className={`text-sm font-medium tabular-nums ${color}`}>
        {comma(Math.abs(num))} {unit}
        {variance && Math.abs(num) >= 0.01 && (
          <span className="text-xs ml-1 font-normal">({num < 0 ? 'short' : 'over'})</span>
        )}
      </span>
    </div>
  )
}

function FuelReconCard({ fuelType, recon, threshold }) {
  if (!recon) return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
        {fuelLabel(fuelType)} — Fuel Recon
      </p>
      <p className="text-sm text-gray-400">No dip data recorded — cannot reconcile.</p>
    </div>
  )

  const flagBorder = recon.flagged ? 'border-amber-300 bg-amber-50/40' : 'border-gray-200 bg-white'
  return (
    <div className={`rounded-xl border p-5 ${flagBorder}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
          {fuelLabel(fuelType)} — Fuel Recon
        </p>
        {recon.flagged && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Flagged</span>
        )}
      </div>
      <ReconRow label="Opening Dip"         value={recon.openingDipLitres}   unit="L" />
      <ReconRow label="+ Deliveries Received" value={recon.deliveriesLitres} unit="L" />
      <ReconRow label="− Meter Outflow"     value={recon.totalMeterOutflow}  unit="L" />
      <ReconRow label="= Book Closing"      value={recon.bookClosing}        unit="L" />
      <ReconRow label="Actual Closing (Dip)" value={recon.closingDipLitres} unit="L" />
      <ReconRow label="Variance"            value={recon.variance}           unit="L" variance />
      <p className="text-xs text-gray-400 mt-2">Threshold: {comma(threshold)} L</p>
    </div>
  )
}

function CashReconCard({ recon, threshold, depositRow }) {
  if (!recon) return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Cash Reconciliation</p>
      <p className="text-sm text-gray-400">No deposit recorded — cannot reconcile cash.</p>
    </div>
  )

  const flagBorder = recon.flagged ? 'border-amber-300 bg-amber-50/40' : 'border-gray-200 bg-white'
  return (
    <div className={`rounded-xl border p-5 ${flagBorder}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Cash Reconciliation</p>
        {recon.flagged && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Flagged</span>
        )}
      </div>
      <ReconRow label="Fuel Cash Sales"      value={recon.fuelCashSales}  unit="MWK" />
      <ReconRow label="Lubricants Cash Sales" value={recon.lubsCashSales} unit="MWK" />
      <ReconRow label="Airtime Sales"        value={recon.airtimeSales}   unit="MWK" />
      <ReconRow label="= Expected Cash"      value={recon.expectedCash}   unit="MWK" />
      <ReconRow label="Amount Deposited"     value={recon.depositedAmount} unit="MWK" />
      <ReconRow label="Variance"             value={recon.variance}        unit="MWK" variance />
      <p className="text-xs text-gray-400 mt-2">Threshold: MWK {comma(threshold)}</p>

      {depositRow?.photo_url && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-500 mb-2">{depositRow.bank_name} · MWK {comma(depositRow.deposit_amount)}</p>
          <img
            src={depositRow.photo_url}
            alt="Deposit slip"
            className="max-h-52 w-full object-contain rounded-lg border border-gray-200"
          />
        </div>
      )}
    </div>
  )
}

export default function Reconciliation() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [forms, setForms]               = useState([])
  const [listLoading, setListLoading]   = useState(true)
  const [selectedId, setSelectedId]     = useState(null)
  const [selectedForm, setSelectedForm] = useState(null)
  const [detail, setDetail]             = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [running, setRunning]           = useState(false)
  const [runError, setRunError]         = useState('')

  useEffect(() => { loadList() }, [])

  async function loadList() {
    setListLoading(true)
    const { data } = await supabase
      .from('daily_sales_forms')
      .select('id, form_date, status, station_id, stations(name)')
      .in('status', ['submitted', 'reconciled'])
      .order('form_date', { ascending: false })
      .limit(60)
    setForms(data ?? [])
    setListLoading(false)
  }

  async function openDetail(form) {
    setSelectedId(form.id)
    setSelectedForm(form)
    setDetail(null)
    setRunError('')
    setDetailLoading(true)

    const formId    = form.id
    const stationId = form.station_id
    const formDate  = form.form_date

    const [
      { data: formRow },
      { data: pumps },
      { data: meterRows },
      { data: summaryRow },
      { data: depositRow },
      { data: deliveryRows },
      { data: thresholdRows },
      { data: existingFuelRecon },
      { data: existingCashRecon },
    ] = await Promise.all([
      supabase.from('daily_sales_forms')
        .select('opening_dip_petrol_litres, opening_dip_diesel_litres, closing_dip_petrol_litres, closing_dip_diesel_litres, status')
        .eq('id', formId).single(),
      supabase.from('pumps').select('id, fuel_type').eq('station_id', stationId),
      supabase.from('meter_readings').select('pump_id, closing_meter, opening_meter, pump_test').eq('form_id', formId),
      supabase.from('daily_summary').select('fuel_cash_sales, lubs_cash_sales, airtime_sales').eq('form_id', formId).maybeSingle(),
      supabase.from('deposit_slips').select('deposit_amount, bank_name, photo_url').eq('form_id', formId).maybeSingle(),
      supabase.from('deliveries')
        .select('fuel_type, litres')
        .eq('station_id', stationId)
        .gte('delivery_datetime', formDate + 'T00:00:00')
        .lte('delivery_datetime', formDate + 'T23:59:59'),
      supabase.from('thresholds')
        .select('rule_key, rule_value')
        .in('rule_key', ['fuel_variance_limit', 'cash_variance_limit']),
      supabase.from('fuel_reconciliations').select('*').eq('form_id', formId),
      supabase.from('cash_reconciliations').select('*').eq('form_id', formId).maybeSingle(),
    ])

    // Pump map for outflow calculation
    const pumpMap = {}
    ;(pumps ?? []).forEach(p => { pumpMap[p.id] = p })

    let pmaMeterOutflow = 0, agoMeterOutflow = 0
    ;(meterRows ?? []).forEach(m => {
      const pump = pumpMap[m.pump_id]
      if (!pump) return
      const out = n(m.closing_meter) - n(m.opening_meter) - n(m.pump_test)
      if (pump.fuel_type === 'PMA') pmaMeterOutflow += out
      else if (pump.fuel_type === 'AGO') agoMeterOutflow += out
    })

    let pmaDeliveries = 0, agoDeliveries = 0
    ;(deliveryRows ?? []).forEach(d => {
      if (d.fuel_type === 'PMA') pmaDeliveries += n(d.litres)
      else if (d.fuel_type === 'AGO') agoDeliveries += n(d.litres)
    })

    const tMap = {}
    ;(thresholdRows ?? []).forEach(t => { tMap[t.rule_key] = n(t.rule_value) })
    const fuelThreshold = tMap['fuel_variance_limit'] ?? 100
    const cashThreshold = tMap['cash_variance_limit'] ?? 5000

    const alreadyDone = formRow?.status === 'reconciled' && (existingFuelRecon?.length ?? 0) > 0

    let pmaRecon, agoRecon, cashRecon

    if (alreadyDone) {
      // Normalize stored rows to camelCase shape
      const fr = existingFuelRecon ?? []
      const pmaRow = fr.find(r => r.fuel_type === 'PMA') ?? null
      const agoRow = fr.find(r => r.fuel_type === 'AGO') ?? null
      pmaRecon = pmaRow ? {
        openingDipLitres: pmaRow.opening_dip_litres,
        deliveriesLitres: pmaRow.deliveries_litres,
        totalMeterOutflow: pmaRow.total_meter_outflow,
        bookClosing: pmaRow.book_closing,
        closingDipLitres: pmaRow.closing_dip_litres,
        variance: pmaRow.variance,
        flagged: pmaRow.flagged,
      } : null
      agoRecon = agoRow ? {
        openingDipLitres: agoRow.opening_dip_litres,
        deliveriesLitres: agoRow.deliveries_litres,
        totalMeterOutflow: agoRow.total_meter_outflow,
        bookClosing: agoRow.book_closing,
        closingDipLitres: agoRow.closing_dip_litres,
        variance: agoRow.variance,
        flagged: agoRow.flagged,
      } : null
      cashRecon = existingCashRecon ? {
        fuelCashSales:  existingCashRecon.fuel_cash_sales,
        lubsCashSales:  existingCashRecon.lubs_cash_sales,
        airtimeSales:   existingCashRecon.airtime_sales,
        expectedCash:   existingCashRecon.expected_cash,
        depositedAmount: existingCashRecon.deposited_amount,
        variance: existingCashRecon.variance,
        flagged:  existingCashRecon.flagged,
      } : null
    } else {
      pmaRecon = formRow?.opening_dip_petrol_litres != null ? calculateFuelRecon({
        openingDipLitres: formRow.opening_dip_petrol_litres,
        deliveriesLitres: pmaDeliveries,
        totalMeterOutflow: pmaMeterOutflow,
        closingDipLitres: formRow.closing_dip_petrol_litres,
        threshold: fuelThreshold,
      }) : null

      agoRecon = formRow?.opening_dip_diesel_litres != null ? calculateFuelRecon({
        openingDipLitres: formRow.opening_dip_diesel_litres,
        deliveriesLitres: agoDeliveries,
        totalMeterOutflow: agoMeterOutflow,
        closingDipLitres: formRow.closing_dip_diesel_litres,
        threshold: fuelThreshold,
      }) : null

      const rawCash = depositRow ? calculateCashRecon({
        fuelCashSales:  summaryRow?.fuel_cash_sales,
        lubsCashSales:  summaryRow?.lubs_cash_sales,
        airtimeSales:   summaryRow?.airtime_sales,
        depositedAmount: depositRow.deposit_amount,
        threshold: cashThreshold,
      }) : null
      cashRecon = rawCash ? {
        ...rawCash,
        fuelCashSales: summaryRow?.fuel_cash_sales ?? 0,
        lubsCashSales: summaryRow?.lubs_cash_sales ?? 0,
        airtimeSales:  summaryRow?.airtime_sales   ?? 0,
      } : null
    }

    setDetail({ stationId, formDate, depositRow, pmaRecon, agoRecon, cashRecon, fuelThreshold, cashThreshold, alreadyDone })
    setDetailLoading(false)
  }

  async function handleRunRecon() {
    if (!detail || !selectedId || detail.alreadyDone) return
    setRunning(true)
    setRunError('')

    const { stationId, formDate, pmaRecon, agoRecon, cashRecon, fuelThreshold, cashThreshold } = detail
    const now = new Date().toISOString()

    const sev = (variance, threshold) =>
      Math.abs(variance) > threshold * 3 ? 'critical' : 'warning'

    // Build parallel inserts for whichever recon results exist
    const inserts = []
    if (pmaRecon) {
      inserts.push(supabase.from('fuel_reconciliations').insert({
        form_id: selectedId, fuel_type: 'PMA',
        opening_dip_litres: pmaRecon.openingDipLitres,
        deliveries_litres:  pmaRecon.deliveriesLitres,
        total_meter_outflow: pmaRecon.totalMeterOutflow,
        book_closing:       pmaRecon.bookClosing,
        closing_dip_litres: pmaRecon.closingDipLitres,
        variance: pmaRecon.variance, flagged: pmaRecon.flagged,
        threshold_used: fuelThreshold, created_at: now,
      }))
    }
    if (agoRecon) {
      inserts.push(supabase.from('fuel_reconciliations').insert({
        form_id: selectedId, fuel_type: 'AGO',
        opening_dip_litres: agoRecon.openingDipLitres,
        deliveries_litres:  agoRecon.deliveriesLitres,
        total_meter_outflow: agoRecon.totalMeterOutflow,
        book_closing:       agoRecon.bookClosing,
        closing_dip_litres: agoRecon.closingDipLitres,
        variance: agoRecon.variance, flagged: agoRecon.flagged,
        threshold_used: fuelThreshold, created_at: now,
      }))
    }
    if (cashRecon) {
      inserts.push(supabase.from('cash_reconciliations').insert({
        form_id: selectedId,
        fuel_cash_sales:  cashRecon.fuelCashSales,
        lubs_cash_sales:  cashRecon.lubsCashSales,
        airtime_sales:    cashRecon.airtimeSales,
        expected_cash:    cashRecon.expectedCash,
        deposited_amount: cashRecon.depositedAmount,
        variance: cashRecon.variance, flagged: cashRecon.flagged,
        threshold_used: cashThreshold, created_at: now,
      }))
    }

    const results = await Promise.all(inserts)
    const firstErr = results.find(r => r.error)?.error
    if (firstErr) {
      setRunError(firstErr.message)
      setRunning(false)
      return
    }

    // Insert flags for any flagged results
    const flagInserts = []
    if (pmaRecon?.flagged) {
      flagInserts.push({
        flag_type: 'fuel_variance', station_id: stationId,
        severity: sev(pmaRecon.variance, fuelThreshold),
        status: 'detected', raised_at: now,
        metadata: { form_id: selectedId, form_date: formDate, fuel_type: 'PMA',
          book_closing: pmaRecon.bookClosing, closing_dip_litres: pmaRecon.closingDipLitres,
          variance: pmaRecon.variance, threshold: fuelThreshold },
      })
    }
    if (agoRecon?.flagged) {
      flagInserts.push({
        flag_type: 'fuel_variance', station_id: stationId,
        severity: sev(agoRecon.variance, fuelThreshold),
        status: 'detected', raised_at: now,
        metadata: { form_id: selectedId, form_date: formDate, fuel_type: 'AGO',
          book_closing: agoRecon.bookClosing, closing_dip_litres: agoRecon.closingDipLitres,
          variance: agoRecon.variance, threshold: fuelThreshold },
      })
    }
    if (cashRecon?.flagged) {
      flagInserts.push({
        flag_type: 'cash_variance', station_id: stationId,
        severity: sev(cashRecon.variance, cashThreshold),
        status: 'detected', raised_at: now,
        metadata: { form_id: selectedId, form_date: formDate,
          expected_cash: cashRecon.expectedCash, deposited_amount: cashRecon.depositedAmount,
          variance: cashRecon.variance, threshold: cashThreshold },
      })
    }
    if (flagInserts.length > 0) {
      await supabase.from('flags_investigations').insert(flagInserts)
    }

    // Update form status → reconciled
    const { error: statusErr } = await supabase
      .from('daily_sales_forms')
      .update({ status: 'reconciled' })
      .eq('id', selectedId)
    if (statusErr) {
      setRunError(statusErr.message)
      setRunning(false)
      return
    }

    // Refresh list
    const { data: freshForms } = await supabase
      .from('daily_sales_forms')
      .select('id, form_date, status, station_id, stations(name)')
      .in('status', ['submitted', 'reconciled'])
      .order('form_date', { ascending: false })
      .limit(60)
    setForms(freshForms ?? [])

    // Reload detail with updated form
    const updatedForm = { ...selectedForm, status: 'reconciled' }
    setSelectedForm(updatedForm)
    setRunning(false)
    await openDetail(updatedForm)
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-5 py-3.5 flex items-center justify-between" style={{ backgroundColor: '#06476B' }}>
        <div>
          <p className="text-white font-bold leading-tight">
            {selectedId ? 'Reconciliation Detail' : 'Reconciliation'}
          </p>
          {selectedId && selectedForm && (
            <p className="text-xs" style={{ color: '#89c4d4' }}>{fmtDate(selectedForm.form_date)}</p>
          )}
        </div>
        {selectedId ? (
          <button
            onClick={() => { setSelectedId(null); setSelectedForm(null); setDetail(null) }}
            className="text-sm px-3 py-1.5 rounded-lg text-white border border-white/30 hover:bg-white/10"
          >
            ← Back
          </button>
        ) : (
          <button
            onClick={() => navigate('/admin')}
            className="text-sm px-3 py-1.5 rounded-lg text-white border border-white/30 hover:bg-white/10"
          >
            ← Home
          </button>
        )}
      </div>

      {!selectedId ? (
        // List view
        <div className="max-w-2xl mx-auto px-5 py-6">
          {listLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 h-16 animate-pulse" />
              ))}
            </div>
          ) : forms.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-sm text-gray-400">
              No forms ready for reconciliation.
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {forms.map((form, i) => (
                <div
                  key={form.id}
                  className={`flex items-center justify-between px-5 py-4 ${i > 0 ? 'border-t border-gray-100' : ''}`}
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800">{fmtDate(form.form_date)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{form.stations?.name ?? '—'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={form.status} />
                    <button
                      onClick={() => openDetail(form)}
                      className="text-sm px-3 py-1.5 rounded-lg font-medium text-white hover:opacity-90"
                      style={{ backgroundColor: form.status === 'reconciled' ? '#6b7280' : '#06476B' }}
                    >
                      {form.status === 'reconciled' ? 'View' : 'Reconcile'} →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        // Detail view
        <div className="max-w-2xl mx-auto px-5 py-6 space-y-4">
          {detailLoading ? (
            <>
              <div className="bg-white rounded-xl border border-gray-200 p-5 h-48 animate-pulse" />
              <div className="bg-white rounded-xl border border-gray-200 p-5 h-48 animate-pulse" />
              <div className="bg-white rounded-xl border border-gray-200 p-5 h-40 animate-pulse" />
            </>
          ) : !detail ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-400">
              Could not load form data.
            </div>
          ) : (
            <>
              {detail.alreadyDone && (
                <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-3 text-sm text-green-700 font-medium">
                  ✓ Reconciliation complete — stored results shown below
                </div>
              )}

              <FuelReconCard fuelType="PMA" recon={detail.pmaRecon} threshold={detail.fuelThreshold} />
              <FuelReconCard fuelType="AGO" recon={detail.agoRecon} threshold={detail.fuelThreshold} />
              <CashReconCard recon={detail.cashRecon} threshold={detail.cashThreshold} depositRow={detail.depositRow} />

              {!detail.alreadyDone && (
                <div>
                  {runError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-3">
                      {runError}
                    </div>
                  )}
                  <button
                    onClick={handleRunRecon}
                    disabled={running}
                    className="w-full py-3.5 rounded-xl text-white font-semibold text-sm hover:opacity-90 disabled:opacity-50"
                    style={{ backgroundColor: '#06476B' }}
                  >
                    {running ? 'Running…' : 'Run Reconciliation'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
