// The shape every fare matrix must have. Tokens are checked again on load,
// so a malformed matrix can never reach the calculator. Messages use the
// field names from fares.json so they point straight at the fix.

export const MANILA = 'Asia/Manila'
const ROUNDING_STEPS = [0, 0.25, 0.5, 1]
const MAX_VEHICLES = 12
const MAX_BRACKETS = 30

const isNumber = (v) => typeof v === 'number' && Number.isFinite(v)
const isText = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max
const isTime = (v) => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v)
const isWindow = (w) => isTime(w?.from) && isTime(w?.to) && w.from !== w.to
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))

export function validateMatrix(m) {
  if (!m || typeof m !== 'object') return ['The fare matrix is missing.']
  const problems = []
  const amount = (v, what, max = 10000) => {
    if (!isNumber(v) || v < 0 || v > max) problems.push(`${what} must be a number from 0 to ${max}.`)
  }
  const optionalText = (v, max, what) => {
    if (v != null && (typeof v !== 'string' || v.length > max)) problems.push(`${what} must be at most ${max} characters.`)
  }
  const optionalDate = (v, what) => {
    if (v != null && !isDate(v)) problems.push(`${what} must be a date like 2026-10-07.`)
  }

  if (!isText(m.iss, 120)) problems.push('iss (who issues the fares) is required, at most 120 characters.')
  optionalText(m.ref, 160, 'ref')
  optionalText(m.contact, 160, 'contact')
  if (m.issued != null && Number.isNaN(Date.parse(m.issued))) problems.push('issued must be a date and time.')
  optionalDate(m.effective, 'effective')
  optionalDate(m.expires, 'expires')
  if (isDate(m.effective) && isDate(m.expires) && m.expires < m.effective) {
    problems.push('expires must not be before effective.')
  }

  const fuelPrice = m.fuel?.price
  if (!isNumber(fuelPrice) || fuelPrice <= 0 || fuelPrice > 1000) {
    problems.push('fuel.price must be the average fuel price per liter, e.g. 65.50.')
  }
  optionalDate(m.fuel?.asOf, 'fuel.asOf')

  if (!isText(m.discountLabel, 60)) problems.push('discountLabel is required, e.g. "Student / Senior / PWD".')
  if (m.rounding != null && !ROUNDING_STEPS.includes(m.rounding)) problems.push('rounding must be 0, 0.25, 0.5 or 1.')
  if (m.roundUpKm != null && typeof m.roundUpKm !== 'boolean') problems.push('roundUpKm must be true or false.')
  if (m.night != null && !isWindow(m.night)) {
    problems.push('night needs different "from" and "to" times, e.g. "22:00" and "05:00".')
  }
  if (m.notes != null && !(Array.isArray(m.notes) && m.notes.length <= 6 && m.notes.every((n) => isText(n, 240)))) {
    problems.push('notes must be a list of up to 6 short texts.')
  }

  if (!Array.isArray(m.vehicles) || m.vehicles.length === 0 || m.vehicles.length > MAX_VEHICLES) {
    problems.push(`vehicles must list 1 to ${MAX_VEHICLES} vehicle types.`)
    return problems
  }
  const ids = new Set()
  m.vehicles.forEach((v, i) => {
    const named = isText(v?.name, 40)
    const name = named ? v.name : `vehicles[${i}]`
    if (!named) problems.push(`vehicles[${i}] needs a name (at most 40 characters).`)
    if (typeof v?.id !== 'string' || !/^[a-z0-9-]{1,40}$/.test(v.id)) {
      problems.push(`${name}: id must use lowercase letters, digits and dashes.`)
    } else if (ids.has(v.id)) {
      problems.push(`${name}: id "${v.id}" is used twice.`)
    } else {
      ids.add(v.id)
    }
    amount(v?.baseKm, `${name}: baseKm`, 100)

    if (!Array.isArray(v?.fares) || v.fares.length === 0 || v.fares.length > MAX_BRACKETS) {
      problems.push(`${name}: fares must list 1 to ${MAX_BRACKETS} fuel price brackets.`)
    } else {
      v.fares.forEach((b, j) => {
        const row = `${name}: fares row ${j + 1}`
        amount(b?.fuelFrom, `${row} fuelFrom`, 1000)
        amount(b?.regular, `${row} regular`)
        amount(b?.discounted, `${row} discounted`)
        if (j > 0 && isNumber(b?.fuelFrom) && !(b.fuelFrom > v.fares[j - 1]?.fuelFrom)) {
          problems.push(`${row}: fuelFrom must be higher than the row above.`)
        }
      })
      if (isNumber(fuelPrice) && fuelPrice < v.fares[0]?.fuelFrom) {
        problems.push(`${name}: no fare row covers a fuel price of ${fuelPrice}.`)
      }
    }
    if (v?.addPerKm != null) {
      amount(v.addPerKm.regular, `${name}: addPerKm.regular`)
      amount(v.addPerKm.discounted, `${name}: addPerKm.discounted`)
    }
    if (v?.addIfAlone != null) amount(v.addIfAlone, `${name}: addIfAlone`)
    if (v?.addAtNight != null) amount(v.addAtNight, `${name}: addAtNight`)
  })
  return problems
}

// Today's date (YYYY-MM-DD) in Philippine time, whatever the device's zone.
export const manilaToday = (now = Date.now()) => new Date(now).toLocaleDateString('en-CA', { timeZone: MANILA })
