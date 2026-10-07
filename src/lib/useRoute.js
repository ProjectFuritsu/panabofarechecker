// Measures the road distance between two pins with an OSRM route service
// (VITE_ROUTING_URL, or the public OSRM demo server). If the service fails or
// is slow, it falls back to the straight-line distance, marked 'approx',
// so the fare still shows a lower bound.

import { useEffect, useState } from 'react'
import { straightLineKm } from './geo.js'

const ROUTER = (import.meta.env.VITE_ROUTING_URL || 'https://router.project-osrm.org/route/v1/driving').replace(/\/+$/, '')
const TIMEOUT_MS = 8000

const routeKey = (from, to) => (from && to ? `${from.lng},${from.lat};${to.lng},${to.lat}` : null)

async function fetchRoute(key, signal) {
  const response = await fetch(`${ROUTER}/${key}?overview=full&geometries=geojson`, { signal })
  if (!response.ok) throw new Error(`Route service answered ${response.status}`)
  const data = await response.json()
  const route = data.routes?.[0]
  if (data.code !== 'Ok' || !route) throw new Error('No route found')
  return {
    status: 'ok',
    km: route.distance / 1000,
    path: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
  }
}

// Returns { status: 'none' | 'loading' | 'ok' | 'approx', km?, path? }.
export function useRoute(from, to) {
  const key = routeKey(from, to)
  const [result, setResult] = useState({ key: null })

  useEffect(() => {
    if (!from || !to) return
    const thisKey = routeKey(from, to)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    let cancelled = false
    fetchRoute(thisKey, controller.signal)
      .catch(() => ({
        status: 'approx',
        km: straightLineKm(from, to),
        path: [
          [from.lat, from.lng],
          [to.lat, to.lng],
        ],
      }))
      .then((route) => {
        if (!cancelled) setResult({ key: thisKey, ...route })
      })
      .finally(() => clearTimeout(timer))
    return () => {
      cancelled = true
      controller.abort()
      clearTimeout(timer)
    }
  }, [from, to])

  if (!key) return { status: 'none' }
  return result.key === key ? result : { status: 'loading' }
}
