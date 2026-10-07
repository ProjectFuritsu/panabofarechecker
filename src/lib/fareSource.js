// Loads the fare matrix from VITE_FARE_TOKEN (set in .env and built into the
// site) and checks its hash once per page load.

import { decodeToken } from './fareToken.js'

const TOKEN = import.meta.env.VITE_FARE_TOKEN?.trim()

async function load() {
  if (!TOKEN) return { active: null, error: new Error('No fare matrix has been published yet.') }
  try {
    return { active: await decodeToken(TOKEN), error: null }
  } catch (error) {
    return { active: null, error }
  }
}

let pending
export const loadFareMatrix = () => (pending ??= load())
