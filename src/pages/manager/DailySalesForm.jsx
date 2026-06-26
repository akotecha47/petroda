import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { todayISO } from '../../lib/shiftUtils'

// ─── Helpers ───────────────────────────────────────────────────────────────────
const n = v => parseFloat(v) || 0
const comma = v => Math.round(n(v)).toLocaleString()

// ─── Primitive UI pieces ───────────────────────────────────────────────────────

function Calc({ value, negative = false }) {
  const val = n(value)
  const color = negative && val !== 0 ? (val < 0 ? 'text-red-600' : 'text-green-600') : 'text-gray-700'
  return (
    <div className={`w-full px-2 py-1.5 bg-gray-100 border border-gray-200 rounded text-sm text-right tabular-nums select-none ${color}`}>
      {comma(val)}
    </div>
  )
}

function Num({ value, onChange, disabled }) {
  return (
    <input
      type="number" step="any" min="0"
      value={value ?? ''}
      placeholder="0"
      disabled={disabled}
      onChange={e => onChange(e.target.value)}
      className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-teal-400 disabled:bg-gray-50 disabled:text-gray-400"
    />
  )
}

function Txt({ value, onChange, disabled, placeholder = '' }) {
  return (
    <input
      type="text"
      value={value ?? ''}
      placeholder={placeholder}
      disabled={disabled}
      onChange={e => onChange(e.target.value)}
      className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-teal-400 disabled:bg-gray-50 disabled:text-gray-400"
    />
  )
}

function SectionTitle({ children }) {
  return (
    <div className="px-5 py-3 border-b border-gray-200" style={{ backgroundColor: '#06476B' }}>
      <h2 className="text-xs font-bold uppercase tracking-widest text-white">{children}</h2>
    </div>
  )
}

function FuelLabel({ children }) {
  return (
    <div className="px-4 py-2" style={{ backgroundColor: '#1988A3' }}>
      <span className="text-xs font-semibold uppercase tracking-wide text-white">{children}</span>
    </div>
  )
}

// ─── Section 1: Meter Readings + Sales Buildup ─────────────────────────────────

function PumpBlock({ pumps, fuelType, meterState, onMeter, dipStock, receipts, onReceipt, buildupState, onBuildup, disabled }) {
  const label = fuelType === 'PMA' ? 'Petrol' : 'Diesel'
  const fuelPumps = pumps.filter(p => p.fuel_type === fuelType)

  const totalOutflow = fuelPumps.reduce((s, p) => {
    const m = meterState[p.id] || {}
    return s + n(m.closing_meter) - n(m.opening_meter) - n(m.pump_test)
  }, 0)

  const b = buildupState[fuelType] || {}
  const creditAmt    = n(b.credit_qty)    * n(b.credit_rate)
  const petroCardAmt = n(b.petro_card_qty) * n(b.petro_card_rate)
  const cashAmt      = n(b.cash_qty)      * n(b.cash_rate)
  const rKey = fuelType === 'PMA' ? 'pma' : 'ago'

  return (
    <div className="mb-4">
      <FuelLabel>{label}</FuelLabel>

      <div className="flex flex-col lg:flex-row gap-0 lg:gap-6 p-4">
        {/* Pump readings */}
        <div className="flex-1 min-w-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-2 py-2 text-left text-xs text-gray-500 w-14">Pump</th>
                  <th className="px-2 py-2 text-right text-xs text-gray-500 w-28">Closing Meter</th>
                  <th className="px-2 py-2 text-right text-xs text-gray-500 w-28">Opening Meter</th>
                  <th className="px-2 py-2 text-right text-xs text-gray-500 w-28">Less Pump Test</th>
                  <th className="px-2 py-2 text-right text-xs text-gray-500 w-28">Out Flow</th>
                </tr>
              </thead>
              <tbody>
                {fuelPumps.map(pump => {
                  const m = meterState[pump.id] || {}
                  const outflow = n(m.closing_meter) - n(m.opening_meter) - n(m.pump_test)
                  return (
                    <tr key={pump.id} className="border-b border-gray-100">
                      <td className="px-2 py-1.5 font-medium text-gray-700">{pump.pump_number}</td>
                      <td className="px-2 py-1.5">
                        <Num value={m.closing_meter} onChange={v => onMeter(pump.id, 'closing_meter', v)} disabled={disabled} />
                      </td>
                      <td className="px-2 py-1.5">
                        <Num value={m.opening_meter} onChange={v => onMeter(pump.id, 'opening_meter', v)} disabled={disabled} />
                      </td>
                      <td className="px-2 py-1.5">
                        <Num value={m.pump_test} onChange={v => onMeter(pump.id, 'pump_test', v)} disabled={disabled} />
                      </td>
                      <td className="px-2 py-1.5"><Calc value={outflow} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Totals row */}
          <div className="grid grid-cols-3 gap-2 mt-2 bg-gray-50 border border-gray-200 rounded p-2">
            <div>
              <p className="text-xs text-gray-500 mb-1">Total Sales (L)</p>
              <Calc value={totalOutflow} />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Stock (L)</p>
              <Calc value={dipStock[fuelType] ?? 0} />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Receipt Ref</p>
              <Txt value={receipts[rKey]} onChange={v => onReceipt(rKey, v)} disabled={disabled} placeholder="Ref #" />
            </div>
          </div>
        </div>

        {/* Sales buildup */}
        <div className="w-full lg:w-80 flex-shrink-0 mt-4 lg:mt-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Sales Built Up</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-2 py-2 text-left text-xs text-gray-500"></th>
                  <th className="px-2 py-2 text-right text-xs text-gray-500 w-24">Qty (L)</th>
                  <th className="px-2 py-2 text-right text-xs text-gray-500 w-24">Rate</th>
                  <th className="px-2 py-2 text-right text-xs text-gray-500 w-28">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="px-2 py-1.5 text-xs text-gray-600 whitespace-nowrap">Credit Sales</td>
                  <td className="px-2 py-1.5"><Num value={b.credit_qty} onChange={v => onBuildup(fuelType, 'credit_qty', v)} disabled={disabled} /></td>
                  <td className="px-2 py-1.5"><Num value={b.credit_rate} onChange={v => onBuildup(fuelType, 'credit_rate', v)} disabled={disabled} /></td>
                  <td className="px-2 py-1.5"><Calc value={creditAmt} /></td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-2 py-1.5 text-xs text-gray-600 whitespace-nowrap">Petro Card</td>
                  <td className="px-2 py-1.5"><Num value={b.petro_card_qty} onChange={v => onBuildup(fuelType, 'petro_card_qty', v)} disabled={disabled} /></td>
                  <td className="px-2 py-1.5"><Num value={b.petro_card_rate} onChange={v => onBuildup(fuelType, 'petro_card_rate', v)} disabled={disabled} /></td>
                  <td className="px-2 py-1.5"><Calc value={petroCardAmt} /></td>
                </tr>
                <tr>
                  <td className="px-2 py-1.5 text-xs text-gray-600 whitespace-nowrap">Cash Sales</td>
                  <td className="px-2 py-1.5"><Num value={b.cash_qty} onChange={v => onBuildup(fuelType, 'cash_qty', v)} disabled={disabled} /></td>
                  <td className="px-2 py-1.5"><Num value={b.cash_rate} onChange={v => onBuildup(fuelType, 'cash_rate', v)} disabled={disabled} /></td>
                  <td className="px-2 py-1.5"><Calc value={cashAmt} /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Section 2: Lubricants ─────────────────────────────────────────────────────

function LubricantSection({ skus, lubState, onLub, disabled }) {
  let totalCash = 0
  let totalCR   = 0
  skus.forEach(sku => {
    const l = lubState[sku.id] || {}
    const up = n(l.unit_price !== undefined ? l.unit_price : sku.unit_price)
    totalCash += n(l.cash_sales_qty) * up
    totalCR   += n(l.cr_sales_qty)   * up
  })

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-3 py-2 text-left text-xs text-gray-500 min-w-56">Item</th>
            <th className="px-2 py-2 text-right text-xs text-gray-500 w-20">Op. Stock</th>
            <th className="px-2 py-2 text-right text-xs text-gray-500 w-20">Received</th>
            <th className="px-2 py-2 text-right text-xs text-gray-500 w-20">Total</th>
            <th className="px-2 py-2 text-right text-xs text-gray-500 w-22">Cash Qty</th>
            <th className="px-2 py-2 text-right text-xs text-gray-500 w-20">CR Qty</th>
            <th className="px-2 py-2 text-right text-xs text-gray-500 w-24">Unit Price</th>
            <th className="px-2 py-2 text-right text-xs text-gray-500 w-28">Cash Amt</th>
            <th className="px-2 py-2 text-right text-xs text-gray-500 w-28">CR Amt</th>
            <th className="px-2 py-2 text-right text-xs text-gray-500 w-24">Closing</th>
          </tr>
        </thead>
        <tbody>
          {skus.map((sku, i) => {
            const l = lubState[sku.id] || {}
            const up      = n(l.unit_price !== undefined ? l.unit_price : sku.unit_price)
            const total   = n(l.opening_stock) + n(l.received)
            const cashAmt = n(l.cash_sales_qty) * up
            const crAmt   = n(l.cr_sales_qty) * up
            const closing = total - n(l.cash_sales_qty) - n(l.cr_sales_qty)
            return (
              <tr key={sku.id} className={`border-b border-gray-100 ${i % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                <td className="px-3 py-1 text-gray-700 text-xs">{sku.name}</td>
                <td className="px-2 py-1"><Num value={l.opening_stock} onChange={v => onLub(sku.id, 'opening_stock', v, sku)} disabled={disabled} /></td>
                <td className="px-2 py-1"><Num value={l.received} onChange={v => onLub(sku.id, 'received', v, sku)} disabled={disabled} /></td>
                <td className="px-2 py-1"><Calc value={total} /></td>
                <td className="px-2 py-1"><Num value={l.cash_sales_qty} onChange={v => onLub(sku.id, 'cash_sales_qty', v, sku)} disabled={disabled} /></td>
                <td className="px-2 py-1"><Num value={l.cr_sales_qty} onChange={v => onLub(sku.id, 'cr_sales_qty', v, sku)} disabled={disabled} /></td>
                <td className="px-2 py-1"><Num value={l.unit_price !== undefined ? l.unit_price : sku.unit_price} onChange={v => onLub(sku.id, 'unit_price', v, sku)} disabled={disabled} /></td>
                <td className="px-2 py-1"><Calc value={cashAmt} /></td>
                <td className="px-2 py-1"><Calc value={crAmt} /></td>
                <td className="px-2 py-1"><Calc value={closing} /></td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-300 bg-gray-100">
            <td className="px-3 py-2 text-xs font-bold text-gray-700" colSpan={7}>Total Sales</td>
            <td className="px-2 py-2"><Calc value={totalCash} /></td>
            <td className="px-2 py-2"><Calc value={totalCR} /></td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ─── Section 3: Daily Summary ──────────────────────────────────────────────────

function SummarySection({ buildupState, lubState, skus, summaryState, onSummary, disabled }) {
  const b = buildupState
  const creditAmt    = n(b.PMA?.credit_qty)    * n(b.PMA?.credit_rate)    + n(b.AGO?.credit_qty)    * n(b.AGO?.credit_rate)
  const petroCardAmt = n(b.PMA?.petro_card_qty) * n(b.PMA?.petro_card_rate) + n(b.AGO?.petro_card_qty) * n(b.AGO?.petro_card_rate)
  const fuelCashAmt  = n(b.PMA?.cash_qty)      * n(b.PMA?.cash_rate)      + n(b.AGO?.cash_qty)      * n(b.AGO?.cash_rate)

  const lubsCashAmt = skus.reduce((s, sku) => {
    const l = lubState[sku.id] || {}
    return s + n(l.cash_sales_qty) * n(l.unit_price !== undefined ? l.unit_price : sku.unit_price)
  }, 0)

  const creditTotal   = creditAmt + petroCardAmt
  const airtime       = n(summaryState.airtime_sales)
  const totalCash     = fuelCashAmt + lubsCashAmt + airtime
  const cashDep       = n(summaryState.cash_deposited)
  const cheqDep       = n(summaryState.cheques_deposited)
  const masterVisa    = n(summaryState.master_visa_card)
  const totalDeposit  = cashDep + cheqDep + masterVisa
  const underOver     = totalCash - totalDeposit

  const tnmOpen       = n(summaryState.tnm_opening_balance)
  const tnmTopUp      = n(summaryState.tnm_top_up)
  const tnmTotal      = tnmOpen + tnmTopUp
  const tnmClose      = n(summaryState.tnm_closing_balance)
  const tnmSales      = tnmTotal - tnmClose

  const Row = ({ label, children }) => (
    <div className="flex items-center gap-3 py-1">
      <span className="text-xs text-gray-600 flex-none w-44">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )

  return (
    <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* Left — Cash summary */}
      <div>
        <Row label="Fuel Credit Sales"><Calc value={creditAmt} /></Row>
        <Row label="Petro Card Sales"><Calc value={petroCardAmt} /></Row>
        <Row label="Total"><Calc value={creditTotal} /></Row>
        <Row label="Fuel Cash Sales"><Calc value={fuelCashAmt} /></Row>
        <Row label="Lubs Cash Sales"><Calc value={lubsCashAmt} /></Row>
        <Row label="Airtime (MWK)">
          <Num value={summaryState.airtime_sales} onChange={v => onSummary('airtime_sales', v)} disabled={disabled} />
        </Row>
        <Row label="Total Cash"><Calc value={totalCash} /></Row>
        <div className="border-t border-gray-200 my-2" />
        <Row label="Cash Deposited (MWK)">
          <Num value={summaryState.cash_deposited} onChange={v => onSummary('cash_deposited', v)} disabled={disabled} />
        </Row>
        <Row label="Cheques Deposited">
          <Num value={summaryState.cheques_deposited} onChange={v => onSummary('cheques_deposited', v)} disabled={disabled} />
        </Row>
        <Row label="Master & Visa Card">
          <Num value={summaryState.master_visa_card} onChange={v => onSummary('master_visa_card', v)} disabled={disabled} />
        </Row>
        <Row label="Total Deposit"><Calc value={totalDeposit} /></Row>
        <Row label="Under / Over Deposit"><Calc value={underOver} negative /></Row>
      </div>

      {/* Right — TNM */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">TNM Airtime</p>
        <Row label="Opening Balance (MK)">
          <Num value={summaryState.tnm_opening_balance} onChange={v => onSummary('tnm_opening_balance', v)} disabled={disabled} />
        </Row>
        <Row label="Top Up (MK)">
          <Num value={summaryState.tnm_top_up} onChange={v => onSummary('tnm_top_up', v)} disabled={disabled} />
        </Row>
        <Row label="Total (MK)"><Calc value={tnmTotal} /></Row>
        <Row label="Closing Balance (MK)">
          <Num value={summaryState.tnm_closing_balance} onChange={v => onSummary('tnm_closing_balance', v)} disabled={disabled} />
        </Row>
        <Row label="Total Sales (MK)"><Calc value={tnmSales} /></Row>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function DailySalesForm() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const today = todayISO()

  const [pageLoading, setPageLoading]   = useState(true)
  const [formId, setFormId]             = useState(null)
  const [formStatus, setFormStatus]     = useState('draft')
  const [pumps, setPumps]               = useState([])
  const [skus, setSkus]                 = useState([])
  const [dipStock, setDipStock]         = useState({ PMA: 0, AGO: 0 })
  const [receipts, setReceipts]         = useState({ pma: '', ago: '' })
  const [meterState, setMeterState]     = useState({})
  const [buildupState, setBuildupState] = useState({ PMA: {}, AGO: {} })
  const [lubState, setLubState]         = useState({})
  const [summaryState, setSummaryState] = useState({
    id: null, airtime_sales: '', cash_deposited: '', cheques_deposited: '',
    master_visa_card: '', tnm_opening_balance: '', tnm_top_up: '',
    tnm_closing_balance: '', form_completed_by: '', form_checked_by: '',
  })
  const [saving, setSaving]             = useState(false)
  const [submitting, setSubmitting]     = useState(false)
  const [showConfirm, setShowConfirm]   = useState(false)
  const [submitError, setSubmitError]   = useState('')

  // Refs for use inside the save callback (avoids stale closures)
  const formIdRef       = useRef(null)
  const formStatusRef   = useRef('draft')
  const pumpsRef        = useRef([])
  const skusRef         = useRef([])
  const meterRef        = useRef({})
  const buildupRef      = useRef({ PMA: {}, AGO: {} })
  const lubRef          = useRef({})
  const summaryRef      = useRef({})
  const receiptsRef     = useRef({ pma: '', ago: '' })
  const initialized     = useRef(false)
  const saveTimerRef    = useRef(null)

  // ── Load ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.station_id) return
    let cancelled = false

    async function load() {
      setPageLoading(true)

      const [{ data: pumpsData }, { data: skusData }] = await Promise.all([
        supabase.from('pumps').select('id, pump_number, fuel_type')
          .eq('station_id', user.station_id).eq('is_active', true).order('pump_number'),
        supabase.from('lubricant_skus').select('id, name, unit_price')
          .eq('is_active', true).order('name'),
      ])
      if (cancelled) return

      const loadedPumps = pumpsData ?? []
      const loadedSkus  = skusData  ?? []
      setPumps(loadedPumps);  pumpsRef.current = loadedPumps
      setSkus(loadedSkus);    skusRef.current  = loadedSkus

      // Get or create today's form
      let fId = null, fStatus = 'draft'
      const { data: existing } = await supabase
        .from('daily_sales_forms')
        .select('id, status, receipt_reference')
        .eq('station_id', user.station_id).eq('form_date', today)
        .maybeSingle()

      if (existing) {
        fId = existing.id; fStatus = existing.status
        try {
          const r = JSON.parse(existing.receipt_reference || '{}')
          const rec = { pma: r.pma || '', ago: r.ago || '' }
          setReceipts(rec); receiptsRef.current = rec
        } catch {}
      } else {
        const { data: created } = await supabase
          .from('daily_sales_forms')
          .insert({ station_id: user.station_id, form_date: today, status: 'draft', submitted_by: user.id })
          .select('id, status').single()
        if (created) { fId = created.id; fStatus = created.status }
      }

      if (cancelled) return
      setFormId(fId);         formIdRef.current     = fId
      setFormStatus(fStatus); formStatusRef.current = fStatus

      if (!fId) { setPageLoading(false); return }

      // Load all form data + dip stock in parallel
      const [
        { data: meterData }, { data: buildupData }, { data: lubData },
        { data: summaryData }, { data: dipEntry },
      ] = await Promise.all([
        supabase.from('meter_readings').select('*').eq('form_id', fId),
        supabase.from('sales_buildup').select('*').eq('form_id', fId),
        supabase.from('lubricant_entries').select('*').eq('form_id', fId),
        supabase.from('daily_summary').select('*').eq('form_id', fId).maybeSingle(),
        supabase.from('dip_entries').select('id')
          .eq('station_id', user.station_id)
          .gte('recorded_at', today + 'T00:00:00')
          .lte('recorded_at', today + 'T23:59:59')
          .order('recorded_at', { ascending: false }).limit(1).maybeSingle(),
      ])
      if (cancelled) return

      // Meter state
      const mInit = {}
      loadedPumps.forEach(pump => {
        const ex = (meterData ?? []).find(m => m.pump_id === pump.id)
        mInit[pump.id] = {
          id: ex?.id ?? null,
          closing_meter: ex?.closing_meter ?? '',
          opening_meter: ex?.opening_meter ?? '',
          pump_test:     ex?.pump_test     ?? '',
        }
      })
      setMeterState(mInit); meterRef.current = mInit

      // Buildup state
      const bInit = { PMA: { id: null }, AGO: { id: null } }
      ;(buildupData ?? []).forEach(b => {
        if (b.fuel_type === 'PMA' || b.fuel_type === 'AGO') {
          bInit[b.fuel_type] = {
            id: b.id,
            credit_qty:     b.credit_qty     || '',
            credit_rate:    b.credit_rate    || '',
            petro_card_qty:  b.petro_card_qty  || '',
            petro_card_rate: b.petro_card_rate || '',
            cash_qty:       b.cash_qty       || '',
            cash_rate:      b.cash_rate      || '',
          }
        }
      })
      setBuildupState(bInit); buildupRef.current = bInit

      // Lub state
      const lInit = {}
      loadedSkus.forEach(sku => {
        const ex = (lubData ?? []).find(l => l.sku_id === sku.id)
        lInit[sku.id] = {
          id:             ex?.id             ?? null,
          opening_stock:  ex?.opening_stock  ?? '',
          received:       ex?.received       ?? '',
          cash_sales_qty: ex?.cash_sales_qty ?? '',
          cr_sales_qty:   ex?.cr_sales_qty   ?? '',
          unit_price:     ex?.unit_price     ?? sku.unit_price,
        }
      })
      setLubState(lInit); lubRef.current = lInit

      // Summary state
      if (summaryData) {
        const s = {
          id:                    summaryData.id,
          airtime_sales:         summaryData.airtime_sales         || '',
          cash_deposited:        summaryData.cash_deposited        || '',
          cheques_deposited:     summaryData.cheques_deposited     || '',
          master_visa_card:      summaryData.master_visa_card      || '',
          tnm_opening_balance:   summaryData.tnm_opening_balance   || '',
          tnm_top_up:            summaryData.tnm_top_up            || '',
          tnm_closing_balance:   summaryData.tnm_closing_balance   || '',
          form_completed_by:     summaryData.form_completed_by     || '',
          form_checked_by:       summaryData.form_checked_by       || user.full_name || '',
        }
        setSummaryState(s); summaryRef.current = s
      } else {
        setSummaryState(prev => {
          const s = { ...prev, form_checked_by: user.full_name || '' }
          summaryRef.current = s
          return s
        })
      }

      // Dip stock
      if (dipEntry) {
        const { data: dipReadings } = await supabase
          .from('dip_tank_readings')
          .select('calculated_litres, tanks(fuel_type)')
          .eq('dip_entry_id', dipEntry.id)
        if (!cancelled && dipReadings) {
          const stock = { PMA: 0, AGO: 0 }
          dipReadings.forEach(r => {
            const ft = r.tanks?.fuel_type?.toUpperCase()
            if (ft === 'PMA') stock.PMA += r.calculated_litres ?? 0
            else if (ft === 'AGO') stock.AGO += r.calculated_litres ?? 0
          })
          setDipStock(stock)
        }
      }

      if (!cancelled) {
        setPageLoading(false)
        setTimeout(() => { initialized.current = true }, 200)
      }
    }

    load()
    return () => { cancelled = true }
  }, [user?.station_id, today])

  // ── Auto-save ─────────────────────────────────────────────────────────────────
  const performSave = useCallback(async () => {
    const fId = formIdRef.current
    if (!fId || formStatusRef.current === 'submitted') return
    setSaving(true)

    try {
      const meter   = meterRef.current
      const buildup = buildupRef.current
      const lub     = lubRef.current
      const summary = summaryRef.current
      const recs    = receiptsRef.current
      const pumpsD  = pumpsRef.current
      const skusD   = skusRef.current

      // Meter readings
      for (const pump of pumpsD) {
        const m = meter[pump.id] || {}
        const payload = {
          form_id: fId, pump_id: pump.id,
          pump_number: pump.pump_number, fuel_type: pump.fuel_type,
          closing_meter: n(m.closing_meter), opening_meter: n(m.opening_meter), pump_test: n(m.pump_test),
        }
        if (m.id) {
          await supabase.from('meter_readings')
            .update({ closing_meter: payload.closing_meter, opening_meter: payload.opening_meter, pump_test: payload.pump_test })
            .eq('id', m.id)
        } else {
          const { data } = await supabase.from('meter_readings').insert(payload).select('id').single()
          if (data) {
            meterRef.current = { ...meterRef.current, [pump.id]: { ...meterRef.current[pump.id], id: data.id } }
            setMeterState(prev => ({ ...prev, [pump.id]: { ...prev[pump.id], id: data.id } }))
          }
        }
      }

      // Sales buildup
      for (const ft of ['PMA', 'AGO']) {
        const bx = buildup[ft] || {}
        const payload = {
          form_id: fId, fuel_type: ft,
          credit_qty: n(bx.credit_qty), credit_rate: n(bx.credit_rate),
          credit_amount: n(bx.credit_qty) * n(bx.credit_rate),
          petro_card_qty: n(bx.petro_card_qty), petro_card_rate: n(bx.petro_card_rate),
          petro_card_amount: n(bx.petro_card_qty) * n(bx.petro_card_rate),
          cash_qty: n(bx.cash_qty), cash_rate: n(bx.cash_rate),
          cash_amount: n(bx.cash_qty) * n(bx.cash_rate),
        }
        if (bx.id) {
          const { form_id, fuel_type, ...up } = payload
          await supabase.from('sales_buildup').update(up).eq('id', bx.id)
        } else {
          const { data } = await supabase.from('sales_buildup').insert(payload).select('id').single()
          if (data) {
            buildupRef.current = { ...buildupRef.current, [ft]: { ...buildupRef.current[ft], id: data.id } }
            setBuildupState(prev => ({ ...prev, [ft]: { ...prev[ft], id: data.id } }))
          }
        }
      }

      // Lubricant entries
      for (const sku of skusD) {
        const l = lub[sku.id] || {}
        const hasData = n(l.opening_stock) > 0 || n(l.received) > 0 || n(l.cash_sales_qty) > 0 || n(l.cr_sales_qty) > 0
        if (!hasData && !l.id) continue
        const up = n(l.unit_price !== undefined ? l.unit_price : sku.unit_price)
        const payload = {
          form_id: fId, sku_id: sku.id,
          opening_stock: n(l.opening_stock), received: n(l.received),
          cash_sales_qty: n(l.cash_sales_qty), cr_sales_qty: n(l.cr_sales_qty),
          unit_price: up,
          cash_amount: n(l.cash_sales_qty) * up,
          cr_amount:   n(l.cr_sales_qty)   * up,
        }
        if (l.id) {
          const { form_id, sku_id, ...upd } = payload
          await supabase.from('lubricant_entries').update(upd).eq('id', l.id)
        } else {
          const { data } = await supabase.from('lubricant_entries').insert(payload).select('id').single()
          if (data) {
            lubRef.current = { ...lubRef.current, [sku.id]: { ...lubRef.current[sku.id], id: data.id } }
            setLubState(prev => ({ ...prev, [sku.id]: { ...prev[sku.id], id: data.id } }))
          }
        }
      }

      // Daily summary
      const bPMA = buildup.PMA || {}, bAGO = buildup.AGO || {}
      const fuelCredit  = n(bPMA.credit_qty) * n(bPMA.credit_rate) + n(bAGO.credit_qty) * n(bAGO.credit_rate)
      const petroCard   = n(bPMA.petro_card_qty) * n(bPMA.petro_card_rate) + n(bAGO.petro_card_qty) * n(bAGO.petro_card_rate)
      const fuelCash    = n(bPMA.cash_qty) * n(bPMA.cash_rate) + n(bAGO.cash_qty) * n(bAGO.cash_rate)
      const lubsCash    = skusD.reduce((s, sku) => {
        const l = lub[sku.id] || {}
        return s + n(l.cash_sales_qty) * n(l.unit_price !== undefined ? l.unit_price : sku.unit_price)
      }, 0)
      const totalCash   = fuelCash + lubsCash + n(summary.airtime_sales)
      const totalDep    = n(summary.cash_deposited) + n(summary.cheques_deposited) + n(summary.master_visa_card)
      const underOver   = totalCash - totalDep

      const sPayload = {
        form_id: fId,
        fuel_credit_sales: fuelCredit, petro_card_sales: petroCard,
        fuel_cash_sales: fuelCash, lubs_cash_sales: lubsCash,
        airtime_sales: n(summary.airtime_sales),
        total_cash: totalCash, cash_deposited: n(summary.cash_deposited),
        cheques_deposited: n(summary.cheques_deposited), master_visa_card: n(summary.master_visa_card),
        total_deposit: totalDep, under_over_deposit: underOver,
        tnm_opening_balance: n(summary.tnm_opening_balance), tnm_top_up: n(summary.tnm_top_up),
        tnm_closing_balance: n(summary.tnm_closing_balance),
        form_completed_by: summary.form_completed_by || '',
        form_checked_by:   summary.form_checked_by   || '',
      }
      if (summary.id) {
        const { form_id, ...upd } = sPayload
        await supabase.from('daily_summary').update(upd).eq('id', summary.id)
      } else {
        const { data } = await supabase.from('daily_summary').insert(sPayload).select('id').single()
        if (data) {
          summaryRef.current = { ...summaryRef.current, id: data.id }
          setSummaryState(prev => ({ ...prev, id: data.id }))
        }
      }

      // Receipt reference
      await supabase.from('daily_sales_forms')
        .update({ receipt_reference: JSON.stringify({ pma: recs.pma || '', ago: recs.ago || '' }) })
        .eq('id', fId)

    } catch (err) {
      console.error('Auto-save error:', err)
    } finally {
      setSaving(false)
    }
  }, [])

  function scheduleSave() {
    if (!initialized.current || formStatusRef.current === 'submitted') return
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(performSave, 1500)
  }

  // ── Update handlers ───────────────────────────────────────────────────────────
  function onMeter(pumpId, field, val) {
    setMeterState(prev => {
      const next = { ...prev, [pumpId]: { ...prev[pumpId], [field]: val } }
      meterRef.current = next; return next
    })
    scheduleSave()
  }

  function onBuildup(ft, field, val) {
    setBuildupState(prev => {
      const next = { ...prev, [ft]: { ...prev[ft], [field]: val } }
      buildupRef.current = next; return next
    })
    scheduleSave()
  }

  function onLub(skuId, field, val, sku) {
    setLubState(prev => {
      const cur  = prev[skuId] || { id: null, opening_stock: '', received: '', cash_sales_qty: '', cr_sales_qty: '', unit_price: sku.unit_price }
      const next = { ...prev, [skuId]: { ...cur, [field]: val } }
      lubRef.current = next; return next
    })
    scheduleSave()
  }

  function onSummary(field, val) {
    setSummaryState(prev => {
      const next = { ...prev, [field]: val }
      summaryRef.current = next; return next
    })
    scheduleSave()
  }

  function onReceipt(key, val) {
    setReceipts(prev => {
      const next = { ...prev, [key]: val }
      receiptsRef.current = next; return next
    })
    scheduleSave()
  }

  // ── Submit ────────────────────────────────────────────────────────────────────
  function handleSubmitClick() {
    const m = meterRef.current
    const pmaOut = pumps.filter(p => p.fuel_type === 'PMA')
      .reduce((s, p) => s + n(m[p.id]?.closing_meter) - n(m[p.id]?.opening_meter) - n(m[p.id]?.pump_test), 0)
    const agoOut = pumps.filter(p => p.fuel_type === 'AGO')
      .reduce((s, p) => s + n(m[p.id]?.closing_meter) - n(m[p.id]?.opening_meter) - n(m[p.id]?.pump_test), 0)

    if (pmaOut <= 0 || agoOut <= 0) {
      setSubmitError('Total Out Flow for both Petrol and Diesel must be greater than 0 before submitting.')
      return
    }
    setSubmitError('')
    setShowConfirm(true)
  }

  async function confirmSubmit() {
    setShowConfirm(false)
    setSubmitting(true)
    await performSave()
    const { error } = await supabase.from('daily_sales_forms')
      .update({ status: 'submitted', submitted_at: new Date().toISOString() })
      .eq('id', formId)
    if (!error) {
      setFormStatus('submitted')
      formStatusRef.current = 'submitted'
      setTimeout(() => navigate('/manager'), 2000)
    }
    setSubmitting(false)
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  if (!user) return null

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-teal-500 rounded-full animate-spin" />
      </div>
    )
  }

  const readOnly = formStatus === 'submitted'

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Nav header */}
      <div className="px-5 py-3.5 flex items-center justify-between sticky top-0 z-10" style={{ backgroundColor: '#06476B' }}>
        <div>
          <p className="text-white font-bold leading-tight">Daily Sales Form</p>
          <p className="text-xs" style={{ color: '#89c4d4' }}>{today}</p>
        </div>
        <div className="flex items-center gap-3">
          {saving && <span className="text-xs" style={{ color: '#89c4d4' }}>Saving…</span>}
          <button onClick={() => navigate('/manager')} className="text-sm px-3 py-1.5 rounded-lg text-white border border-white/30 hover:bg-white/10">
            ← Back
          </button>
        </div>
      </div>

      {readOnly && (
        <div className="bg-green-600 text-white text-center py-2 text-sm font-medium">
          Form submitted — read only
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-4 p-4">
        {/* Section 1 */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <SectionTitle>Section 1 — Meter Readings</SectionTitle>
          <PumpBlock pumps={pumps} fuelType="PMA"
            meterState={meterState} onMeter={onMeter}
            dipStock={dipStock} receipts={receipts} onReceipt={onReceipt}
            buildupState={buildupState} onBuildup={onBuildup} disabled={readOnly} />
          <div className="border-t border-gray-100" />
          <PumpBlock pumps={pumps} fuelType="AGO"
            meterState={meterState} onMeter={onMeter}
            dipStock={dipStock} receipts={receipts} onReceipt={onReceipt}
            buildupState={buildupState} onBuildup={onBuildup} disabled={readOnly} />
        </div>

        {/* Section 2 */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <SectionTitle>Section 2 — Lubricants Stock &amp; Sales</SectionTitle>
          <LubricantSection skus={skus} lubState={lubState} onLub={onLub} disabled={readOnly} />
        </div>

        {/* Section 3 */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <SectionTitle>Section 3 — Daily Summary &amp; TNM Airtime</SectionTitle>
          <SummarySection buildupState={buildupState} lubState={lubState} skus={skus}
            summaryState={summaryState} onSummary={onSummary} disabled={readOnly} />
          {/* Footer */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-5 pb-5 border-t border-gray-100 pt-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Form Completed By</label>
              <Txt value={summaryState.form_completed_by} onChange={v => onSummary('form_completed_by', v)} disabled={readOnly} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Form Checked By</label>
              <Txt value={summaryState.form_checked_by} onChange={v => onSummary('form_checked_by', v)} disabled={readOnly} />
            </div>
          </div>
        </div>

        {/* Submit */}
        {!readOnly && (
          <div>
            {submitError && <p className="text-sm text-red-600 mb-2">{submitError}</p>}
            <button
              onClick={handleSubmitClick}
              disabled={submitting}
              className="w-full py-4 rounded-xl text-white font-semibold text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: '#06476B' }}
            >
              {submitting ? 'Submitting…' : 'Submit Daily Sales'}
            </button>
          </div>
        )}
      </div>

      {/* Confirm dialog */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="font-bold text-gray-900 mb-2">Submit Daily Sales Form?</h3>
            <p className="text-sm text-gray-500 mb-6">
              Once submitted, the form cannot be edited. Confirm all entries are correct.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={confirmSubmit}
                className="flex-1 py-2.5 rounded-lg text-sm text-white font-medium"
                style={{ backgroundColor: '#06476B' }}>
                Yes, Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
