import 'leaflet/dist/leaflet.css'
import { divIcon, latLngBounds, map as createMap, marker, polyline, tileLayer } from 'leaflet'
import { useEffect, useEffectEvent, useRef } from 'react'
import { toPoint } from '../lib/geo.js'

// Roughly the centre of Panabo City proper.
const PANABO = [7.3075, 125.6839]

const PINS = [
  ['origin', 'A', 'from', 'Pick-up point (A)'],
  ['destination', 'B', 'to', 'Drop-off point (B)'],
]

const pinIcon = (label, tone) =>
  divIcon({
    className: `pin pin-${tone}`,
    html: `<span><b>${label}</b></span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 36],
  })

// A Leaflet map driven by props: it draws the pins and route it is given and
// reports taps and pin drags back up.
export default function RouteMap({ trip, path, approximate, onPick, onMove }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const pick = useEffectEvent((latlng) => onPick(toPoint(latlng.lat, latlng.lng)))
  const move = useEffectEvent((which, latlng) => onMove(which, toPoint(latlng.lat, latlng.lng)))

  useEffect(() => {
    const map = createMap(containerRef.current, { center: PANABO, zoom: 14 })
    tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)
    map.attributionControl.addAttribution('Routes: <a href="https://project-osrm.org/">OSRM</a>')
    map.on('click', (e) => pick(e.latlng))
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const layers = []
    for (const [which, label, tone, title] of PINS) {
      const point = trip[which]
      if (!point) continue
      const pin = marker(point, { icon: pinIcon(label, tone), draggable: true, autoPan: true, title, alt: title })
      pin.on('dragend', () => move(which, pin.getLatLng()))
      layers.push(pin.addTo(map))
    }
    if (path) {
      const line = polyline(path, { color: '#0e6b3d', weight: 5, opacity: 0.8, dashArray: approximate ? '6 8' : null })
      layers.push(line.addTo(map))
    }

    // Bring the trip into view, but leave the map alone if it already is.
    const points = path ?? [trip.origin, trip.destination].filter(Boolean)
    if (points.length) {
      const bounds = latLngBounds(points)
      if (!map.getBounds().contains(bounds)) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 })
    }
    return () => layers.forEach((layer) => layer.remove())
  }, [trip, path, approximate])

  return <div ref={containerRef} className="map" />
}
