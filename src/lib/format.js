import { MANILA } from './fareSchema.js'

const pesoFormat = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })

export const peso = (pesos) => pesoFormat.format(pesos)
export const pesoCents = (centavos) => pesoFormat.format(centavos / 100)
export const formatKm = (km) => `${Number(km.toFixed(2))} km`

// Accepts a plain date ("2026-10-07", read as Philippine time) or a full ISO timestamp.
export function longDate(value) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00+08:00`) : new Date(value)
  return date.toLocaleDateString('en-PH', { timeZone: MANILA, dateStyle: 'medium' })
}

export function clock(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

const listFormat = new Intl.ListFormat('en', { type: 'conjunction' })

// One { from, to } window or a list of them, e.g. "6:00 AM to 9:00 AM and 4:00 PM to 7:00 PM".
export const timeRanges = (windows) =>
  listFormat.format([].concat(windows).map(({ from, to }) => `${clock(from)} to ${clock(to)}`))
