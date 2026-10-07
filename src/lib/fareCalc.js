// Fare arithmetic, done in whole centavos so ₱0.25 steps never drift.

import { MANILA } from './fareSchema.js'
import { formatKm, peso } from './format.js'

const centavos = (pesos) => Math.round(pesos * 100)
const total = (lines) => lines.reduce((sum, line) => sum + line.amount, 0)

function roundToStep(amount, step) {
  if (!step) return amount
  const stepCentavos = centavos(step)
  return Math.round(amount / stepCentavos) * stepCentavos
}

// The fuel price bracket in effect: the last row whose fuelFrom is at or
// below the price. validateMatrix guarantees there is one.
export const bracketIndex = (vehicle, fuelPrice) => vehicle.fares.findLastIndex((row) => fuelPrice >= row.fuelFrom)

// Returns { billedKm, total, lines, uncoveredKm } with amounts in centavos.
// uncoveredKm is the distance past baseKm that has no published per-km rate.
export function computeFare(matrix, vehicle, { km = 0, discounted = false, alone = false, night = false }) {
  const bracket = vehicle.fares[bracketIndex(vehicle, matrix.fuel.price)]
  const billedKm = matrix.roundUpKm === false ? km : Math.ceil(km - 1e-9)
  const extraKm = Math.max(0, billedKm - vehicle.baseKm)

  const lines = [
    {
      label: `${discounted ? matrix.discountLabel : 'Regular'} fare${vehicle.baseKm > 0 ? `, first ${formatKm(vehicle.baseKm)}` : ''}`,
      amount: centavos(discounted ? bracket.discounted : bracket.regular),
    },
  ]
  const perKm = vehicle.addPerKm && (discounted ? vehicle.addPerKm.discounted : vehicle.addPerKm.regular)
  if (extraKm > 0 && perKm > 0) {
    lines.push({ label: `Additional ${formatKm(extraKm)} × ${peso(perKm)}`, amount: Math.round(extraKm * perKm * 100) })
  }
  if (alone && vehicle.addIfAlone > 0) lines.push({ label: 'Riding alone', amount: centavos(vehicle.addIfAlone) })
  if (night && vehicle.addAtNight > 0) lines.push({ label: 'Night trip', amount: centavos(vehicle.addAtNight) })

  const subtotal = total(lines)
  const rounded = roundToStep(subtotal, matrix.rounding)
  if (rounded !== subtotal) {
    lines.push({ label: `Rounded to the nearest ${peso(matrix.rounding)}`, amount: rounded - subtotal, muted: true })
  }
  return { billedKm, total: rounded, lines, uncoveredKm: vehicle.addPerKm ? 0 : extraKm }
}

// A group's fare: every passenger pays their own fare, so the total is the
// sum per passenger type. A single passenger is riding alone, so the
// add-if-alone charge applies automatically.
// Returns { total, groups, billedKm, uncoveredKm } with groups =
// [{ discounted, count, fare }] and amounts in centavos.
export function computeGroupFare(matrix, vehicle, { km = 0, regular = 1, discounted = 0, night = false }) {
  const alone = regular + discounted === 1
  const groups = [
    [false, regular],
    [true, discounted],
  ]
    .filter(([, count]) => count > 0)
    .map(([isDiscounted, count]) => ({
      discounted: isDiscounted,
      count,
      fare: computeFare(matrix, vehicle, { km, discounted: isDiscounted, alone, night }),
    }))
  const { billedKm, uncoveredKm } = computeFare(matrix, vehicle, { km })
  return { total: groups.reduce((sum, g) => sum + g.fare.total * g.count, 0), groups, billedKm, uncoveredKm }
}

const manilaClock = new Intl.DateTimeFormat('en-GB', {
  timeZone: MANILA,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

// True when Philippine time falls inside any of the { from, to } windows
// (one window or a list). A window may cross midnight, e.g. 22:00 to 05:00.
export function isWithin(windows, date = new Date()) {
  if (!windows) return false
  const now = manilaClock.format(date)
  return [].concat(windows).some(({ from, to }) => (from < to ? now >= from && now < to : now >= from || now < to))
}
