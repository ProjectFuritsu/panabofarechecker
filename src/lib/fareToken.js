// The fare matrix travels as one string in VITE_FARE_TOKEN (.env):
//   <base64url(JSON fare matrix)>.<base64url(SHA-256 of the first part)>
// No database: the token is the data. The hash makes any hand edit or
// copy/paste damage detectable, and its first bytes double as a short
// Matrix ID people can compare. Runs in browsers (secure contexts) and Node.

import { manilaToday, validateMatrix } from './fareSchema.js'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function toBase64Url(bytes) {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text) {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(text.length / 4) * 4, '=')
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
}

async function sha256(text) {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) throw new Error('Checking fares needs a secure connection. Open this site over HTTPS (or on localhost).')
  return new Uint8Array(await subtle.digest('SHA-256', encoder.encode(text)))
}

function matrixId(hash) {
  const hex = Array.from(hash.slice(0, 4), (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase()
  return `${hex.slice(0, 4)}-${hex.slice(4)}`
}

export async function encodeToken(matrix) {
  const problems = validateMatrix(matrix)
  if (problems.length) throw new Error(problems.join('\n'))
  const payload = toBase64Url(encoder.encode(JSON.stringify(matrix)))
  return `${payload}.${toBase64Url(await sha256(payload))}`
}

// Resolves to { matrix, status, matrixId } where status is 'valid',
// 'expired' or 'pending' (not yet effective). Rejects a damaged token.
export async function decodeToken(token, now = Date.now()) {
  const parts = typeof token === 'string' ? token.trim().split('.') : []
  if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[0])) throw new Error('The fare data is not a valid token.')
  const [payload, hashPart] = parts

  const hash = await sha256(payload)
  if (toBase64Url(hash) !== hashPart) {
    throw new Error('The fare data does not match its hash, so it was edited or damaged.')
  }

  let matrix
  try {
    matrix = JSON.parse(decoder.decode(fromBase64Url(payload)))
  } catch {
    throw new Error('The fare data could not be read.')
  }
  const problems = validateMatrix(matrix)
  if (problems.length) throw new Error(`The fare data is incomplete: ${problems[0]}`)

  const today = manilaToday(now)
  const status =
    matrix.effective && today < matrix.effective ? 'pending'
    : matrix.expires && today > matrix.expires ? 'expired'
    : 'valid'
  return { matrix, status, matrixId: matrixId(hash) }
}
