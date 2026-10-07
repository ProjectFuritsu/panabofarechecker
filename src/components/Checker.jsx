import { Fragment, use, useState } from 'react'
import { bracketIndex, computeGroupFare, isWithin } from '../lib/fareCalc.js'
import { loadFareMatrix } from '../lib/fareSource.js'
import { formatKm, longDate, peso, pesoCents, timeRanges } from '../lib/format.js'
import { useRoute } from '../lib/useRoute.js'
import { Alert, Fuel, ShieldCheck } from './Icons.jsx'
import Layout from './Layout.jsx'
import TripPicker from './TripPicker.jsx'

const MAX_KM = 200
const MAX_PASSENGERS = 6
const STATUS_TITLE = {
  valid: 'Official fare matrix',
  pending: 'These rates are not in effect yet',
  expired: 'These rates have expired',
}

function bracketRange(fares, i) {
  const next = fares[i + 1]
  return next ? `${peso(fares[i].fuelFrom)} – ${peso(next.fuelFrom - 0.01)}` : `${peso(fares[i].fuelFrom)} and up`
}

export default function Checker() {
  const { active, error } = use(loadFareMatrix())

  if (!active) {
    return (
      <Layout>
        <section className="card empty">
          <Alert width={32} height={32} />
          <h1>Fares are not available</h1>
          <p>{error.message}</p>
          <p className="muted">
            Site setup: edit <code>fares.json</code>, run <code>npm run token</code> to save{' '}
            <code>VITE_FARE_TOKEN</code> in <code>.env</code>, then restart or rebuild.
          </p>
        </section>
      </Layout>
    )
  }

  return (
    <Layout footer={<MatrixFooter active={active} />}>
      <MatrixStatus active={active} />
      <FuelBaseline fuel={active.matrix.fuel} />
      <Calculator matrix={active.matrix} />
    </Layout>
  )
}

function MatrixStatus({ active }) {
  const { matrix, status, matrixId } = active
  const ok = status === 'valid'
  const meta = [
    matrix.ref || matrix.iss,
    matrix.effective && `${status === 'pending' ? 'Takes effect' : 'Effective'} ${longDate(matrix.effective)}`,
    matrix.expires && `${status === 'expired' ? 'Expired' : 'Valid until'} ${longDate(matrix.expires)}`,
  ]
  return (
    <section className={`status ${ok ? 'is-ok' : 'is-warn'}`}>
      {ok ? <ShieldCheck /> : <Alert />}
      <div className="status-body">
        <p className="status-title">{STATUS_TITLE[status]}</p>
        <p className="status-meta">{meta.filter(Boolean).join(' · ')}</p>
      </div>
      <span className="matrix-id" title="A SHA-256 hash of the fare data. It changes whenever any rate changes.">
        <small>Matrix ID</small>
        {matrixId}
      </span>
    </section>
  )
}

function FuelBaseline({ fuel }) {
  return (
    <section className="fuel">
      <Fuel />
      <p>
        Average fuel price: <strong>{peso(fuel.price)} per liter</strong>
        {fuel.asOf && <span className="muted"> as of {longDate(fuel.asOf)}</span>}
        <span className="fuel-note">Fares follow the fuel price bracket set by the ordinance.</span>
      </p>
    </section>
  )
}

function Calculator({ matrix }) {
  const [vehicleId, setVehicleId] = useState(matrix.vehicles[0].id)
  const [trip, setTrip] = useState({ origin: null, destination: null })
  const [typing, setTyping] = useState(false)
  const [distance, setDistance] = useState('')
  const [riders, setRiders] = useState({ regular: 1, discounted: 0 })
  const [night, setNight] = useState(() => isWithin(matrix.night))
  const route = useRoute(trip.origin, trip.destination)

  const vehicle = matrix.vehicles.find((v) => v.id === vehicleId) ?? matrix.vehicles[0]
  const current = bracketIndex(vehicle, matrix.fuel.price)
  const typedKm = Number(distance)
  const entered = distance.trim() !== ''
  const typedValid = entered && Number.isFinite(typedKm) && typedKm > 0 && typedKm <= MAX_KM
  const km = typing ? (typedValid ? typedKm : null) : (route.km ?? null)
  const straightLine = !typing && route.status === 'approx'
  const passengers = riders.regular + riders.discounted
  const solo = passengers === 1
  const fare = computeGroupFare(matrix, vehicle, { km: km ?? 0, ...riders, night })
  const typeName = (discounted) => (discounted ? matrix.discountLabel : 'Regular')
  const hasNight = matrix.night && vehicle.addAtNight > 0

  return (
    <>
      <div className="grid">
        <form className="card form" onSubmit={(e) => e.preventDefault()}>
          {matrix.vehicles.length > 1 && (
            <fieldset className="field">
              <legend className="label">Vehicle</legend>
              <div className="segmented">
                {matrix.vehicles.map((v) => (
                  <label key={v.id} className="segment">
                    <input
                      type="radio"
                      name="vehicle"
                      checked={v.id === vehicle.id}
                      onChange={() => setVehicleId(v.id)}
                    />
                    <span>{v.name}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <fieldset className="field">
            <legend className="label">Passengers</legend>
            <div className="steppers">
              {['regular', 'discounted'].map((type) => (
                <Stepper
                  key={type}
                  label={typeName(type === 'discounted')}
                  value={riders[type]}
                  min={passengers - riders[type] > 0 ? 0 : 1}
                  max={riders[type] + MAX_PASSENGERS - passengers}
                  onChange={(count) => setRiders((r) => ({ ...r, [type]: count }))}
                />
              ))}
            </div>
            {solo && vehicle.addIfAlone > 0 && (
              <p className="hint">One passenger rides alone, which adds {peso(vehicle.addIfAlone)}.</p>
            )}
            {riders.discounted > 0 && <p className="hint">Show a valid ID to get the discounted fare.</p>}
          </fieldset>

          <div className="field">
            <div className="field-head">
              {typing ? (
                <label className="label" htmlFor="distance">
                  Distance
                </label>
              ) : (
                <span className="label">Pick-up and drop-off</span>
              )}
              <button type="button" className="link-btn" onClick={() => setTyping((t) => !t)}>
                {typing ? 'Use the map instead' : 'Type the distance instead'}
              </button>
            </div>
            {typing ? (
              <>
                <div className="input-unit">
                  <input
                    id="distance"
                    className="input"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max={MAX_KM}
                    step="any"
                    placeholder="0.0"
                    value={distance}
                    onChange={(e) => setDistance(e.target.value)}
                    aria-describedby="distance-hint"
                    aria-invalid={entered && !typedValid}
                  />
                  <span aria-hidden="true">km</span>
                </div>
                {entered && !typedValid ? (
                  <p className="field-error">Enter a distance between 0 and {MAX_KM} km.</p>
                ) : (
                  <p id="distance-hint" className="hint">
                    The {vehicle.name.toLowerCase()} fare covers the first {formatKm(vehicle.baseKm)}.
                  </p>
                )}
              </>
            ) : (
              <TripPicker trip={trip} setTrip={setTrip} route={route} />
            )}
          </div>

          {hasNight && (
            <label className="toggle">
              <input type="checkbox" checked={night} onChange={(e) => setNight(e.target.checked)} />
              <span className="toggle-text">
                <strong>Night trip</strong>
                <small>
                  {timeRanges(matrix.night)}, adds {peso(vehicle.addAtNight)}
                </small>
              </span>
            </label>
          )}
        </form>

        <section className="card result" aria-live="polite" aria-labelledby="fare-heading">
          <p className="eyebrow" id="fare-heading">
            {km != null
              ? solo
                ? 'Your fare'
                : 'Total fare'
              : `${solo ? 'Fare' : 'Total'} for the first ${formatKm(vehicle.baseKm)}`}
          </p>
          <p className="total">
            {(fare.uncoveredKm > 0 || straightLine) && <span className="total-prefix">At least </span>}
            {pesoCents(fare.total)}
          </p>
          <p className="result-sub">
            {[
              vehicle.name,
              km != null &&
                `${formatKm(km)} trip${fare.billedKm !== km ? `, charged as ${formatKm(fare.billedKm)}` : ''}`,
              solo ? typeName(fare.groups[0].discounted) : `${passengers} passengers`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <dl className="breakdown">
            {fare.groups.map((group) => (
              <Fragment key={group.discounted ? 'discounted' : 'regular'}>
                {!solo && (
                  <div className="breakdown-group">
                    <dt>
                      {group.count} × {typeName(group.discounted)}{' '}
                      <span className="muted">({pesoCents(group.fare.total)} each)</span>
                    </dt>
                    <dd>{pesoCents(group.fare.total * group.count)}</dd>
                  </div>
                )}
                {group.fare.lines.map((line, i) => (
                  <div
                    key={line.label}
                    className={
                      [
                        line.muted && 'is-muted',
                        !solo && 'is-sub',
                        !solo && i === group.fare.lines.length - 1 && 'is-last',
                      ]
                        .filter(Boolean)
                        .join(' ') || undefined
                    }
                  >
                    <dt>{line.label}</dt>
                    <dd>{pesoCents(line.amount)}</dd>
                  </div>
                ))}
              </Fragment>
            ))}
            <div className="breakdown-total">
              <dt>{solo ? 'Total' : `Total for ${passengers} passengers`}</dt>
              <dd>{pesoCents(fare.total)}</dd>
            </div>
          </dl>
          {fare.uncoveredKm > 0 && (
            <p className="result-note">
              <Alert />
              The published rates cover only the first {formatKm(vehicle.baseKm)}. Ask the driver or the city about
              the fare for the other {formatKm(fare.uncoveredKm)}.
            </p>
          )}
          {straightLine && (
            <p className="result-note">
              <Alert />
              This uses the straight-line distance, so the real fare is likely higher. Try again later or type the
              road distance.
            </p>
          )}
          <p className="hint">Fuel price bracket: {bracketRange(vehicle.fares, current)} per liter.</p>
        </section>
      </div>

      <FareTable matrix={matrix} vehicle={vehicle} current={current} />
    </>
  )
}

function Stepper({ label, value, min, max, onChange }) {
  return (
    <div className="stepper-row">
      <span className="stepper-label">{label}</span>
      <div className="stepper">
        <button
          type="button"
          onClick={() => onChange(value - 1)}
          disabled={value <= min}
          aria-label={`One less ${label} passenger`}
        >
          −
        </button>
        <output aria-live="polite" aria-label={`${value} ${label}`}>
          {value}
        </output>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          disabled={value >= max}
          aria-label={`One more ${label} passenger`}
        >
          +
        </button>
      </div>
    </div>
  )
}

function FareTable({ matrix, vehicle, current }) {
  return (
    <section className="card">
      <div className="card-head">
        <h2>{vehicle.name} fares by fuel price</h2>
        <p className="muted">Per passenger, first {formatKm(vehicle.baseKm)}</p>
      </div>
      <div className="table-scroll">
        <table className="fare-table">
          <thead>
            <tr>
              <th scope="col">Fuel price per liter</th>
              <th scope="col">Regular</th>
              <th scope="col">{matrix.discountLabel}</th>
            </tr>
          </thead>
          <tbody>
            {vehicle.fares.map((row, i) => (
              <tr
                key={row.fuelFrom}
                className={i === current ? 'is-current' : undefined}
                aria-current={i === current ? 'true' : undefined}
              >
                <th scope="row">
                  {bracketRange(vehicle.fares, i)}
                  {i === current && <span className="tag">Now</span>}
                </th>
                <td>{peso(row.regular)}</td>
                <td>{peso(row.discounted)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="addons">
        {vehicle.addPerKm && (
          <li>
            Each succeeding km after the first {formatKm(vehicle.baseKm)}: add {peso(vehicle.addPerKm.regular)}
            {vehicle.addPerKm.discounted !== vehicle.addPerKm.regular &&
              ` (${peso(vehicle.addPerKm.discounted)} for ${matrix.discountLabel})`}
            .
          </li>
        )}
        {matrix.notes?.map((note) => (
          <li key={note}>{note}</li>
        ))}
        {vehicle.addIfAlone > 0 && <li>Riding alone (1 passenger): add {peso(vehicle.addIfAlone)}.</li>}
        {matrix.night && vehicle.addAtNight > 0 && (
          <li>
            Night trip ({timeRanges(matrix.night)}): add {peso(vehicle.addAtNight)}.
          </li>
        )}
        {matrix.rounding > 0 && <li>Totals are rounded to the nearest {peso(matrix.rounding)}.</li>}
      </ul>
    </section>
  )
}

function MatrixFooter({ active }) {
  const { matrix, matrixId } = active
  return (
    <div className="footer-text">
      <p>
        <strong>{matrix.iss}</strong>
        {matrix.ref && (
          <>
            {' · '}
            <span className="nowrap">{matrix.ref}</span>
          </>
        )}
      </p>
      {matrix.contact && <p>{matrix.contact}</p>}
      <p className="muted">
        {matrix.issued && `Updated ${longDate(matrix.issued)} · `}Matrix ID {matrixId}
      </p>
    </div>
  )
}
