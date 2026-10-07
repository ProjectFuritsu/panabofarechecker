// Small geometry helpers for the trip map.

const EARTH_RADIUS_KM = 6371

// Pins are kept to 6 decimals (about 10 cm), plenty for a fare.
export const toPoint = (lat, lng) => ({ lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) })

// Great-circle ("as the crow flies") distance in km.
export function straightLineKm(a, b) {
  const rad = (deg) => (deg * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}
