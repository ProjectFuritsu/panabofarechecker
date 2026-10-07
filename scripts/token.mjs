// Turns fares.json into a hashed token and saves it as VITE_FARE_TOKEN in .env.
// Usage: npm run token

import { readFile, writeFile } from 'node:fs/promises'
import { decodeToken, encodeToken } from '../src/lib/fareToken.js'

const envUrl = new URL('../.env', import.meta.url)
const { $comment, ...fares } = JSON.parse(await readFile(new URL('../fares.json', import.meta.url), 'utf8'))

let token
try {
  token = await encodeToken({ ...fares, issued: new Date().toISOString() })
} catch (err) {
  console.error(`fares.json has problems:\n${err.message}`)
  process.exit(1)
}
const { matrixId, status } = await decodeToken(token)

// Replace the VITE_FARE_TOKEN line in .env, or append one.
const env = await readFile(envUrl, 'utf8').catch((err) => (err.code === 'ENOENT' ? '' : Promise.reject(err)))
const line = `VITE_FARE_TOKEN=${token}`
const updated = /^VITE_FARE_TOKEN=.*$/m.test(env)
  ? env.replace(/^VITE_FARE_TOKEN=.*$/m, () => line)
  : `${env}${env && !env.endsWith('\n') ? '\n' : ''}${line}\n`
await writeFile(envUrl, updated)

console.log(`Saved VITE_FARE_TOKEN in .env (Matrix ID ${matrixId}, ${status}).`)
console.log('Restart `npm run dev` or rebuild the site to use it.')
