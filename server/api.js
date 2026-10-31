let cache = { token: null, expires: 0 }

const GENERIC = 'Something went wrong. Please try again shortly.'
const INVALID = 'Invalid credentials. Please check your details and try again.'
const TOO_MANY = 'Too many attempts. Please wait a few minutes and try again.'
const ID_PATTERN = /^[A-Za-z0-9_-]{1,20}$/
const MAX_PASSWORD = 64
const MAX_BODY = 4096
const WINDOW_MS = 60_000
const MAX_REQUESTS = 10
const FAIL_WINDOW_MS = 15 * 60_000
const MAX_FAILS = 8
const BC_TIMEOUT_MS = 20_000

const hits = new Map()
const fails = new Map()

class ClientError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function prune(map, windowMs) {
  const now = Date.now()
  for (const [key, list] of map) {
    const fresh = list.filter((t) => now - t < windowMs)
    if (fresh.length) map.set(key, fresh)
    else map.delete(key)
  }
}

setInterval(() => {
  prune(hits, WINDOW_MS)
  prune(fails, FAIL_WINDOW_MS)
}, 60_000).unref()

function count(map, key, windowMs) {
  const now = Date.now()
  const list = (map.get(key) || []).filter((t) => now - t < windowMs)
  map.set(key, list)
  return list.length
}

function add(map, key) {
  const list = map.get(key) || []
  list.push(Date.now())
  map.set(key, list)
}

function clientIp(req, env) {
  if (env.TRUST_PROXY === 'true') {
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    if (forwarded) return forwarded
  }
  return req.socket.remoteAddress || 'unknown'
}

function usesBasic(env) {
  return String(env.BC_AUTH || 'oauth').toLowerCase() === 'basic'
}

async function getToken(env) {
  if (cache.token && Date.now() < cache.expires) return cache.token

  if (!env.CLIENT_ID || !env.CLIENT_SECRET) {
    throw new Error('CLIENT_ID or CLIENT_SECRET is missing in .env (restart the server after editing it)')
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: env.CLIENT_ID.trim(),
    client_secret: env.CLIENT_SECRET.trim(),
    scope: env.BC_SCOPE,
  })

  const res = await fetch(env.TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(BC_TIMEOUT_MS),
  })
  const data = await res.json().catch(() => ({}))

  if (!res.ok || !data.access_token) {
    const code = (data.error_description || '').match(/AADSTS\d+/)?.[0]
    throw new Error(`Token request failed: ${[res.status, data.error, code].filter(Boolean).join(' ')}`)
  }

  cache = {
    token: data.access_token,
    expires: Date.now() + (Number(data.expires_in || 3600) - 120) * 1000,
  }
  return cache.token
}

async function getAuthorization(env) {
  if (usesBasic(env)) {
    if (!env.BC_USER || !env.BC_PASSWORD) {
      throw new Error('BC_USER or BC_PASSWORD is missing in .env (restart the server after editing it)')
    }
    return `Basic ${Buffer.from(`${env.BC_USER}:${env.BC_PASSWORD}`).toString('base64')}`
  }
  return `Bearer ${await getToken(env)}`
}

async function readJson(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY) throw new ClientError(413, INVALID)
    chunks.push(chunk)
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    throw new ClientError(400, INVALID)
  }
}

function send(res, status, payload) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.end(JSON.stringify(payload))
}

function pick(obj, name) {
  const key = Object.keys(obj || {}).find((k) => k.toLowerCase() === name.toLowerCase())
  return key === undefined ? undefined : obj[key]
}

function buildQr(template, staffid, password) {
  return template
    .replace(/\\t/g, '\t')
    .replace(/\{staffid\}/gi, () => staffid)
    .replace(/\{password\}/gi, () => password)
}

export function createApiHandler(env) {
  return async (req, res, next) => {
    if (req.url.split('?')[0] !== '/api/password') return next()

    if (req.method !== 'POST') return send(res, 405, { error: GENERIC })

    const ip = clientIp(req, env)

    try {
      if (count(fails, ip, FAIL_WINDOW_MS) >= MAX_FAILS || count(hits, ip, WINDOW_MS) >= MAX_REQUESTS) {
        return send(res, 429, { error: TOO_MANY })
      }
      add(hits, ip)

      const input = await readJson(req)
      const staffid = String(input.staffid || '').trim()
      const storeid = String(input.storeid || '').trim()
      const staffpass = String(input.staffpass || '')

      if (
        !ID_PATTERN.test(staffid) ||
        !ID_PATTERN.test(storeid) ||
        staffpass.length < 1 ||
        staffpass.length > MAX_PASSWORD
      ) {
        add(fails, ip)
        return send(res, 401, { error: INVALID })
      }

      const authorization = await getAuthorization(env)

      const bcRes = await fetch(env.BC_URL, {
        method: 'POST',
        headers: {
          Authorization: authorization,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ request: JSON.stringify({ staffid, storeid, staffpass }) }),
        signal: AbortSignal.timeout(BC_TIMEOUT_MS),
      })

      const text = await bcRes.text()

      if (bcRes.status === 401 && !usesBasic(env)) cache = { token: null, expires: 0 }

      if (!bcRes.ok) {
        console.error(`BC error ${bcRes.status} for staff ${staffid} store ${storeid}:`, text.slice(0, 500))
        if (bcRes.status === 400) {
          add(fails, ip)
          return send(res, 401, { error: INVALID })
        }
        return send(res, 502, { error: GENERIC })
      }

      let data = {}
      let inner = {}
      try {
        data = JSON.parse(text)
        inner = typeof data.value === 'string' ? JSON.parse(data.value) : data.value || {}
      } catch {
        console.error('Unexpected BC response shape for staff', staffid, 'store', storeid, text.slice(0, 300))
        return send(res, 502, { error: GENERIC })
      }

      const status = String(pick(inner, 'Status') || '').toLowerCase()

      if (status !== 'success') {
        console.error(`Login rejected for staff ${staffid} store ${storeid}:`, pick(inner, 'Message') || pick(inner, 'Error') || status || 'no status')
        add(fails, ip)
        return send(res, 401, { error: INVALID })
      }

      const returnedStaff = pick(inner, 'StaffID')
      const returnedStore = pick(inner, 'StoreID')

      if (
        (returnedStaff !== undefined && String(returnedStaff).trim().toLowerCase() !== staffid.toLowerCase()) ||
        (returnedStore !== undefined && String(returnedStore).trim().toLowerCase() !== storeid.toLowerCase())
      ) {
        console.error('Identity mismatch:', { staffid, storeid, returnedStaff, returnedStore })
        add(fails, ip)
        return send(res, 401, { error: INVALID })
      }

      const template = env.QR_FORMAT || '{staffid};{password}'

      return send(res, 200, {
        qr: buildQr(template, staffid, staffpass),
      })
    } catch (err) {
      if (err instanceof ClientError) return send(res, err.status, { error: err.message })
      console.error('Server error:', err.message, err.cause?.code || err.name || '')
      return send(res, 500, { error: GENERIC })
    }
  }
}