import { useRef, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'

const ENDPOINT = '/api/password'
const GENERIC_ERROR = 'Something went wrong. Please try again shortly.'
const CONNECTION_ERROR = 'Unable to connect. Please check your connection and try again.'
const EMPTY_FORM = { staffid: '', storeid: '', staffpass: '' }

function Spinner({ className = 'h-5 w-5' }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}

function Icon({ name, className = 'h-5 w-5' }) {
  const common = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  }

  if (name === 'user') {
    return (
      <svg {...common}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    )
  }
  if (name === 'store') {
    return (
      <svg {...common}>
        <path d="M3 9l1.5-5h15L21 9" />
        <path d="M3 9a3 3 0 006 0 3 3 0 006 0 3 3 0 006 0" />
        <path d="M5 12v8h14v-8" />
        <path d="M10 20v-5h4v5" />
      </svg>
    )
  }
  if (name === 'key') {
    return (
      <svg {...common}>
        <circle cx="8" cy="15" r="4" />
        <path d="M11 12l9-9" />
        <path d="M16 7l3 3" />
        <path d="M14 9l2 2" />
      </svg>
    )
  }
  if (name === 'eye') {
    return (
      <svg {...common}>
        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    )
  }
  if (name === 'eye-off') {
    return (
      <svg {...common}>
        <path d="M3 3l18 18" />
        <path d="M10.6 5.1A10.7 10.7 0 0112 5c6.4 0 10 7 10 7a17.6 17.6 0 01-3.2 4.1" />
        <path d="M6.6 6.6A17.4 17.4 0 002 12s3.6 7 10 7a10 10 0 004.4-1" />
        <path d="M9.9 9.9a3 3 0 004.2 4.2" />
      </svg>
    )
  }
  if (name === 'download') {
    return (
      <svg {...common}>
        <path d="M12 4v11" />
        <path d="M7 11l5 5 5-5" />
        <path d="M5 20h14" />
      </svg>
    )
  }
  if (name === 'check') {
    return (
      <svg {...common} strokeWidth={2.4}>
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    )
  }
  if (name === 'refresh') {
    return (
      <svg {...common}>
        <path d="M20 11a8 8 0 10-2.3 5.7" />
        <path d="M20 4v7h-7" />
      </svg>
    )
  }
  if (name === 'arrow') {
    return (
      <svg {...common} strokeWidth={2.4}>
        <path d="M5 12h14" />
        <path d="M13 6l6 6-6 6" />
      </svg>
    )
  }
  if (name === 'lock') {
    return (
      <svg {...common}>
        <rect x="4" y="11" width="16" height="10" rx="2" />
        <path d="M8 11V8a4 4 0 018 0v3" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16.5v.01" />
    </svg>
  )
}

function SecretField({ label, name, value, onChange, icon, maxLength = 20 }) {
  const [visible, setVisible] = useState(false)

  return (
    <label className="group block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-0 flex w-14 items-center justify-center text-slate-400 transition group-focus-within:text-blue-600">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 transition group-focus-within:bg-blue-50">
            <Icon name={icon} className="h-5 w-5" />
          </span>
        </span>
        <input
          type={visible ? 'text' : 'password'}
          name={name}
          value={value}
          onChange={onChange}
          required
          maxLength={maxLength}
          autoComplete="new-password"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="h-15 w-full rounded-2xl border-2 border-slate-100 bg-slate-50/80 pl-16 pr-14 text-lg font-semibold tracking-widest text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:shadow-lg focus:shadow-blue-500/10"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? `Hide ${label}` : `Show ${label}`}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-14 items-center justify-center text-slate-400 transition hover:text-blue-600 focus:outline-none focus-visible:text-blue-600"
        >
          <Icon name={visible ? 'eye-off' : 'eye'} className="h-5 w-5" />
        </button>
      </div>
    </label>
  )
}

export default function App() {
  const [form, setForm] = useState(EMPTY_FORM)
  const [status, setStatus] = useState('idle')
  const [qr, setQr] = useState('')
  const [error, setError] = useState('')
  const qrWrap = useRef(null)

  const onChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: name === 'storeid' ? value.toUpperCase() : value }))
  }

  const submit = async (e) => {
    e.preventDefault()
    setStatus('loading')
    setError('')

    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffid: form.staffid.trim(),
          storeid: form.storeid.trim(),
          staffpass: form.staffpass,
        }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok || !data.qr) {
        setError(typeof data.error === 'string' && data.error ? data.error : GENERIC_ERROR)
        setStatus('error')
        return
      }

      setQr(data.qr)
      setForm(EMPTY_FORM)
      setStatus('success')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      setError(CONNECTION_ERROR)
      setStatus('error')
    }
  }

  const download = () => {
    const canvas = qrWrap.current?.querySelector('canvas')
    if (!canvas) return
    const link = document.createElement('a')
    link.download = 'login-qr.png'
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  const reset = () => {
    setStatus('idle')
    setQr('')
    setError('')
    setForm(EMPTY_FORM)
  }

  const loading = status === 'loading'
  const success = status === 'success' && qr

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#f2f7ff] text-slate-900">
      <div className="absolute inset-x-0 top-0 h-[23rem] overflow-hidden rounded-b-[2.75rem] bg-gradient-to-br from-blue-700 via-blue-600 to-sky-500 sm:h-[25rem] sm:rounded-b-[4rem]">
        <div className="absolute -left-20 -top-20 h-72 w-72 animate-float rounded-full bg-white/15 blur-2xl" />
        <div className="absolute -right-16 top-10 h-80 w-80 animate-float-slow rounded-full bg-sky-300/30 blur-3xl" />
        <div className="absolute -bottom-10 left-1/3 h-52 w-52 animate-float rounded-full bg-amber-300/30 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, white 1.2px, transparent 0)',
            backgroundSize: '22px 22px',
          }}
        />
      </div>

      <main className="relative mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))] sm:px-6 sm:pt-14">
        <header className="animate-fade-up text-center text-white">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-white p-3 shadow-xl shadow-blue-900/25 ring-4 ring-white/30 sm:h-24 sm:w-24">
            <img src="/jaza.png" alt="Jaza" className="h-full w-full object-contain" />
          </div>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight sm:text-4xl">Supervisor QR</h1>
          <span className="mx-auto mt-3 block h-1 w-12 rounded-full bg-amber-300" />
          <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-white/85 sm:text-base">
            Sign in to generate your login QR code.
          </p>
        </header>

        <div
          className="relative mt-8 animate-fade-up rounded-[2rem] border border-white/70 bg-white p-5 shadow-2xl shadow-blue-900/15 sm:p-8"
          style={{ animationDelay: '0.1s' }}
        >
          {success ? (
            <div className="flex flex-col items-center">
              <div className="animate-pop grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-lg shadow-emerald-500/30">
                <Icon name="check" className="h-6 w-6" />
              </div>
              <h2 className="mt-4 text-xl font-bold text-slate-900">Verified</h2>
              <p className="mt-1 text-sm text-slate-500">Scan it at the POS or save it as an image.</p>

              <div className="animate-pop mt-6 w-full max-w-[18rem] rounded-[2rem] bg-gradient-to-br from-blue-600 via-sky-400 to-amber-300 p-1.5 shadow-xl shadow-blue-500/25">
                <div ref={qrWrap} className="rounded-[1.6rem] bg-white p-4">
                  <QRCodeCanvas
                    value={qr}
                    size={720}
                    level="M"
                    marginSize={1}
                    style={{ width: '100%', height: 'auto', display: 'block' }}
                  />
                </div>
              </div>

              <div className="mt-6 flex w-full items-center gap-2.5 rounded-2xl bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">
                <Icon name="lock" className="h-4 w-4 shrink-0" />
                This code holds a login. Keep it private.
              </div>

              <button
                onClick={download}
                className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-sky-500 text-base font-semibold text-white shadow-lg shadow-blue-600/30 transition hover:brightness-110 active:scale-[0.98]"
              >
                <Icon name="download" />
                Download
              </button>

              <button
                onClick={reset}
                className="mt-3 flex h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-blue-600 transition hover:bg-blue-50"
              >
                <Icon name="refresh" className="h-4 w-4" />
                Generate another
              </button>
            </div>
          ) : (
            <form onSubmit={submit} autoComplete="off">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-900">Your details</h2>
                <p className="mt-1 text-sm text-slate-500">Enter your credentials to verify and generate the code.</p>
              </div>

              <div className="space-y-5">
                <SecretField label="Staff ID" name="staffid" value={form.staffid} onChange={onChange} icon="user" />
                <SecretField label="Store ID" name="storeid" value={form.storeid} onChange={onChange} icon="store" />
                <SecretField
                  label="Password"
                  name="staffpass"
                  value={form.staffpass}
                  onChange={onChange}
                  icon="key"
                  maxLength={64}
                />
              </div>

              {status === 'error' && (
                <div className="animate-fade-up mt-5 flex items-start gap-3 rounded-2xl border border-rose-200 bg-gradient-to-r from-rose-50 to-orange-50 p-4 text-sm text-rose-700">
                  <Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0" />
                  <p className="break-words">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="group mt-7 flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-blue-700 via-blue-600 to-sky-500 text-base font-semibold text-white shadow-xl shadow-blue-600/30 transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-80"
              >
                {loading ? (
                  <>
                    <Spinner />
                    Verifying…
                  </>
                ) : (
                  <>
                    Verify and generate
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-amber-300 text-blue-900 transition group-hover:translate-x-1">
                      <Icon name="arrow" className="h-4 w-4" />
                    </span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  )
}