import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

function fmtDateLong(isoDate) {
  return new Date(isoDate + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

export default function DepositSlip() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading]       = useState(true)
  const [pendingForm, setPendingForm] = useState(null)
  const [expectedCash, setExpectedCash] = useState(null)
  const [amount, setAmount]         = useState('')
  const [bankName, setBankName]     = useState('')
  const [photoFile, setPhotoFile]   = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)
  const [error, setError]           = useState('')

  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!user?.station_id) return

    async function load() {
      setLoading(true)
      const { data: forms } = await supabase
        .from('daily_sales_forms')
        .select('id, form_date, deposit_slips(id), daily_summary(total_cash)')
        .eq('station_id', user.station_id)
        .eq('status', 'submitted')
        .order('form_date', { ascending: false })
        .limit(10)

      const pending = (forms ?? []).find(f =>
        !f.deposit_slips || f.deposit_slips.length === 0
      ) ?? null

      setPendingForm(pending)

      if (pending) {
        const ds = Array.isArray(pending.daily_summary)
          ? pending.daily_summary[0]
          : pending.daily_summary
        setExpectedCash(ds?.total_cash ?? null)
      }

      setLoading(false)
    }

    load()
  }, [user?.station_id])

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function handleSave() {
    if (!pendingForm) return
    if (!amount || parseFloat(amount) <= 0) {
      setError('Enter a valid deposit amount.')
      return
    }
    if (!bankName.trim()) {
      setError('Enter the bank name.')
      return
    }
    setError('')
    setSaving(true)

    let photoUrl = null

    if (photoFile) {
      const ext = photoFile.name.split('.').pop()
      const path = `${pendingForm.id}/${Date.now()}.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('deposit-slips')
        .upload(path, photoFile, { upsert: true })
      if (uploadErr) {
        setError(
          `Photo upload failed: ${uploadErr.message}. ` +
          'Create the "deposit-slips" storage bucket in Supabase (Storage → New bucket) then try again.'
        )
        setSaving(false)
        return
      }
      const { data: urlData } = supabase.storage.from('deposit-slips').getPublicUrl(path)
      photoUrl = urlData.publicUrl
    }

    const { error: insertErr } = await supabase
      .from('deposit_slips')
      .insert({
        form_id:        pendingForm.id,
        deposit_amount: parseFloat(amount),
        bank_name:      bankName.trim(),
        photo_url:      photoUrl,
        submitted_by:   user.id,
        submitted_at:   new Date().toISOString(),
      })

    if (insertErr) {
      setError(insertErr.message)
      setSaving(false)
      return
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => navigate('/manager'), 2000)
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-5 py-3.5 flex items-center justify-between" style={{ backgroundColor: '#06476B' }}>
        <div>
          <p className="text-white font-bold leading-tight">Deposit Slip</p>
          {!loading && pendingForm && (
            <p className="text-xs" style={{ color: '#89c4d4' }}>
              For sales on {fmtDateLong(pendingForm.form_date)}
            </p>
          )}
        </div>
        <button
          onClick={() => navigate('/manager')}
          className="text-sm px-3 py-1.5 rounded-lg text-white border border-white/30 hover:bg-white/10"
        >
          ← Back
        </button>
      </div>

      <div className="max-w-lg mx-auto px-5 py-6 space-y-4">
        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6 h-40 animate-pulse" />
        ) : !pendingForm ? (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
            <p className="text-gray-500 text-sm mb-4">
              No submitted form awaiting deposit entry.
            </p>
            <button
              onClick={() => navigate('/manager')}
              className="text-sm px-5 py-2.5 rounded-lg text-white hover:opacity-90"
              style={{ backgroundColor: '#1988A3' }}
            >
              Back to Home
            </button>
          </div>
        ) : saved ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
            <p className="text-green-700 font-semibold text-lg mb-1">Deposit recorded</p>
            <p className="text-green-600 text-sm">Returning to home…</p>
          </div>
        ) : (
          <>
            {/* Expected cash — read only */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
                Reference
              </p>
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-sm text-gray-600">Expected Cash (MWK)</span>
                <span className="text-2xl font-bold tabular-nums text-gray-900">
                  {expectedCash != null ? Math.round(expectedCash).toLocaleString() : '—'}
                </span>
              </div>
            </div>

            {/* Deposit fields */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                Deposit Details
              </p>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Deposit Amount (MWK)
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Bank Name
                </label>
                <input
                  type="text"
                  value={bankName}
                  onChange={e => setBankName(e.target.value)}
                  placeholder="e.g. National Bank"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Photo of Deposit Slip
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-gray-200 rounded-lg px-4 py-3 text-sm text-center transition-colors hover:border-teal-300 hover:text-teal-600"
                  style={{ color: photoFile ? '#1988A3' : undefined }}
                >
                  {photoFile ? photoFile.name : 'Tap to attach photo (optional)'}
                </button>
                {photoPreview && (
                  <img
                    src={photoPreview}
                    alt="Deposit slip preview"
                    className="mt-2 max-h-52 w-full object-contain rounded-lg border border-gray-200"
                  />
                )}
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3.5 rounded-xl text-white font-semibold text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: '#06476B' }}
            >
              {saving ? 'Saving…' : 'Record Deposit'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
