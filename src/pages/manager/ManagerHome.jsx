import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { todayISO } from '../../lib/shiftUtils'

export default function ManagerHome() {
  const { user, signOut } = useAuth()
  const [stationName, setStationName] = useState('')
  const [formStatus, setFormStatus] = useState(null)
  const [openingRecorded, setOpeningRecorded] = useState(false)
  const [closingRecorded, setClosingRecorded] = useState(false)
  const [pendingDeposit, setPendingDeposit] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.station_id) return
    supabase
      .from('stations')
      .select('name')
      .eq('id', user.station_id)
      .single()
      .then(({ data }) => { if (data) setStationName(data.name) })
  }, [user?.station_id])

  useEffect(() => {
    if (!user?.station_id) return
    async function load() {
      setLoading(true)
      const [{ data: todayData }, { data: submittedForms, error: sfErr }] = await Promise.all([
        supabase
          .from('daily_sales_forms')
          .select('status, opening_dip_petrol_cm, opening_dip_diesel_cm, closing_dip_petrol_cm, closing_dip_diesel_cm')
          .eq('station_id', user.station_id)
          .eq('form_date', todayISO())
          .maybeSingle(),
        supabase
          .from('daily_sales_forms')
          .select('id, form_date, deposit_slips(id)')
          .eq('station_id', user.station_id)
          .eq('status', 'submitted')
          .order('form_date', { ascending: false })
          .limit(5),
      ])

      setFormStatus(todayData?.status ?? null)
      setOpeningRecorded((todayData?.opening_dip_petrol_cm ?? 0) > 0 || (todayData?.opening_dip_diesel_cm ?? 0) > 0)
      setClosingRecorded((todayData?.closing_dip_petrol_cm ?? 0) > 0 || (todayData?.closing_dip_diesel_cm ?? 0) > 0)

      const pending = sfErr
        ? null
        : (submittedForms ?? []).find(f => !f.deposit_slips || f.deposit_slips.length === 0) ?? null
      setPendingDeposit(pending)
      setLoading(false)
    }
    load()
  }, [user?.station_id])

  if (!user) return null

  const statusLabel = formStatus === null ? 'No form yet' : formStatus === 'draft' ? 'Draft' : 'Submitted'
  const statusColor =
    formStatus === null ? 'text-gray-400' :
    formStatus === 'draft' ? 'text-amber-600' : 'text-green-600'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-6 py-4 flex items-center justify-between" style={{ backgroundColor: '#06476B' }}>
        <div>
          <p className="text-white font-bold text-lg tracking-tight">Petroda</p>
          <p className="text-sm" style={{ color: '#89c4d4' }}>{stationName || 'Loading…'}</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-white text-sm hidden sm:block">{user.full_name}</span>
          <button
            onClick={signOut}
            className="text-sm px-3 py-1.5 rounded-lg text-white hover:bg-white/10 transition-colors border border-white/30"
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-6 py-8">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Today's Form</p>
          {loading ? (
            <div className="h-6 w-32 bg-gray-100 rounded animate-pulse" />
          ) : (
            <p className={`text-xl font-semibold ${statusColor}`}>{statusLabel}</p>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Today's Dips</p>
          {loading ? (
            <div className="space-y-2">
              <div className="h-4 w-48 bg-gray-100 rounded animate-pulse" />
              <div className="h-4 w-48 bg-gray-100 rounded animate-pulse" />
            </div>
          ) : (
            <div className="space-y-1.5">
              <DipStatusRow label="Opening Dip" recorded={openingRecorded} />
              <DipStatusRow label="Closing Dip"  recorded={closingRecorded} />
            </div>
          )}
        </div>

        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Quick Actions</p>
        <div className="space-y-3">
          <ActionLink to="/manager/daily-sales" label="Daily Sales Form" primary />
          <ActionLink to="/manager/delivery" label="Record Delivery" navy />
          <ActionLink to="/manager/dip" label="Record Dip" outline />
          {pendingDeposit && (
            <ActionLink
              to="/manager/deposit"
              label="Submit Deposit Slip"
              sublabel={`For ${fmtDateShort(pendingDeposit.form_date)}`}
              primary
            />
          )}
        </div>
      </div>
    </div>
  )
}

function fmtDateShort(isoDate) {
  return new Date(isoDate + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function DipStatusRow({ label, recorded }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`text-sm font-semibold ${recorded ? 'text-green-600' : 'text-gray-300'}`}>
        {recorded ? '✓' : '○'}
      </span>
      <span className="text-sm text-gray-700 flex-1">{label}</span>
      <span className={`text-xs ${recorded ? 'text-green-600' : 'text-gray-400'}`}>
        {recorded ? 'recorded' : 'not yet'}
      </span>
    </div>
  )
}

function ActionLink({ to, label, sublabel, primary, navy, outline }) {
  const base = 'flex items-center justify-between w-full px-5 py-4 rounded-xl font-medium transition-opacity'
  const left = (
    <span>
      {label}
      {sublabel && <span className="block text-xs font-normal opacity-70 mt-0.5">{sublabel}</span>}
    </span>
  )
  if (primary) return (
    <Link to={to} className={`${base} text-white hover:opacity-90`} style={{ backgroundColor: '#1988A3' }}>
      {left}<span className="text-white/60">→</span>
    </Link>
  )
  if (navy) return (
    <Link to={to} className={`${base} text-white hover:opacity-90`} style={{ backgroundColor: '#06476B' }}>
      {left}<span className="text-white/60">→</span>
    </Link>
  )
  return (
    <Link to={to} className={`${base} bg-white border border-gray-200 text-gray-800 hover:bg-gray-50`}>
      {left}<span className="text-gray-400">→</span>
    </Link>
  )
}
