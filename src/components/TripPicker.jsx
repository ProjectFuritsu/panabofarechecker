import { lazy, Suspense, useState } from 'react'
import { formatKm } from '../lib/format.js'
import { toPoint } from '../lib/geo.js'

// Leaflet is only downloaded when the map is shown.
const RouteMap = lazy(() => import('./RouteMap.jsx'))

export default function TripPicker({ trip, setTrip, route }) {
  const [locating, setLocating] = useState(false)
  const [geoError, setGeoError] = useState(null)

  // First tap drops A, later taps place (or move) B.
  const pick = (point) => setTrip((t) => (t.origin ? { ...t, destination: point } : { ...t, origin: point }))
  const move = (which, point) => setTrip((t) => ({ ...t, [which]: point }))

  function locate() {
    if (!navigator.geolocation) {
      setGeoError('This device cannot share its location. Tap the map instead.')
      return
    }
    setLocating(true)
    setGeoError(null)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false)
        move('origin', toPoint(coords.latitude, coords.longitude))
      },
      () => {
        setLocating(false)
        setGeoError('Could not get your location. Tap the map instead.')
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }

  return (
    <div className="trip">
      <Suspense fallback={<div className="map map-loading">Loading map…</div>}>
        <RouteMap
          trip={trip}
          path={route.path}
          approximate={route.status === 'approx'}
          onPick={pick}
          onMove={move}
        />
      </Suspense>
      <div className="trip-actions">
        <button type="button" className="btn-small" onClick={locate} disabled={locating}>
          {locating ? 'Finding you…' : 'Use my location for A'}
        </button>
        {trip.origin && (
          <button type="button" className="btn-small" onClick={() => setTrip({ origin: null, destination: null })}>
            Clear pins
          </button>
        )}
      </div>
      <p className={`trip-status${route.status === 'approx' ? ' is-warn' : ''}`} aria-live="polite">
        <TripStatus trip={trip} route={route} />
      </p>
      {geoError && <p className="field-error">{geoError}</p>}
    </div>
  )
}

function TripStatus({ trip, route }) {
  if (!trip.origin) return 'Tap the map where you get on (pin A).'
  if (!trip.destination) return 'Now tap where you get off (pin B).'
  if (route.status === 'loading') return 'Measuring the road distance…'
  if (route.status === 'ok') {
    return (
      <>
        Road distance: <strong>{formatKm(route.km)}</strong>. Drag a pin to adjust.
      </>
    )
  }
  return (
    <>
      Straight-line distance: <strong>{formatKm(route.km)}</strong>. The route service did not respond, so the road
      trip is likely longer.
    </>
  )
}
