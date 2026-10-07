# Fare Checker · Panabo City

Commuters see the official tricycle fare under **City Ordinance No. 43-2023**. The fare depends on the
average fuel price per liter: each price bracket has a Regular fare and a Student / Senior / PWD fare
for the first 3 km, plus ₱2.00 for each succeeding km. Commuters drop pin A (pick-up) and pin B (drop-off)
on a map, or type the distance, and set how many regular and discounted passengers are riding (up to 6).
Each passenger pays their own fare, so the page shows the fare per passenger and the group total, plus the
ordinance's full bracket table with the current row highlighted.

There is no database. All fare data lives in one hashed token in `.env`.

## Updating fares or the fuel price

1. Edit `fares.json`. Usually only `fuel.price` and `fuel.asOf` change.
2. Run `npm run token`. This writes `VITE_FARE_TOKEN` to `.env`.
3. Restart `npm run dev`, or run `npm run build` and deploy `dist/`.

When hosting on Vercel or Netlify, you can set `VITE_FARE_TOKEN` in the dashboard instead of `.env`.
The token is public data (it is built into the site's JavaScript), so committing `.env` is fine.

## fares.json fields

| Field | Meaning |
| --- | --- |
| `iss`, `ref`, `contact` | Issuer, ordinance reference, complaint hotline (optional) |
| `fuel.price`, `fuel.asOf` | Current average fuel price per liter, and the date it was taken. This picks the fare row |
| `discountLabel` | Name of the discounted passenger group |
| `notes` | Up to 6 short notes shown under the fare table |
| `effective`, `expires` | Optional dates (`YYYY-MM-DD`, Philippine time). The page warns before and after |
| `vehicles[].baseKm` | Kilometers covered by the bracket fare (3 for tricycles) |
| `vehicles[].fares` | Brackets in ascending order: `{ "fuelFrom": 60, "regular": 15, "discounted": 13 }` covers ₱60.00–69.99. The last row has no upper limit |
| `vehicles[].addPerKm` | Optional `{ "regular": …, "discounted": … }` per km beyond `baseKm`. Without it, longer trips show "At least ₱…" and a note that the rates only cover the first `baseKm` |
| `vehicles[].addIfAlone`, `addAtNight` | Optional flat add-ons (the discount does not apply to them). `addIfAlone` is added automatically when there is only 1 passenger. `addAtNight` also needs a top-level `"night": { "from": "22:00", "to": "05:00" }` in Philippine time; the night switch turns on automatically during those hours |
| `rounding`, `roundUpKm` | Optional. Round totals to the nearest `0.25`, `0.5` or `1`. `roundUpKm` defaults to `true` (part of a km counts as a full km) |

A vehicle with a fixed fare that ignores fuel prices needs just one row: `"fares": [{ "fuelFrom": 0, … }]`.

## The map

- Tiles come from OpenStreetMap (free, no key). Their [usage policy](https://operations.osmfoundation.org/policies/tiles/)
  is fine for a city site with normal traffic. If traffic grows, switch to a tile provider in `src/components/RouteMap.jsx`.
- The road distance comes from an OSRM route service. By default this is the free public demo server
  (`router.project-osrm.org`), which has no uptime guarantee. For production, self-host OSRM or use another
  OSRM-compatible service and set `VITE_ROUTING_URL` in `.env`.
- The two pin locations are sent to that service to measure the route. Nothing else is sent.
- If the service fails or takes over 8 seconds, the page uses the straight-line distance, draws a dashed line,
  and labels the fare "At least". Commuters can always switch to "Type the distance instead".
- "Use my location" needs HTTPS (or localhost) and the visitor's permission.

## How the token works

```
VITE_FARE_TOKEN = base64url(fare JSON) . base64url(SHA-256 of the first part)
```

On load, the site recomputes the hash. If anyone hand-edits the token, or it gets cut off when pasted,
the hash no longer matches and the site shows "Fares are not available" instead of wrong prices.
The first 8 hex digits of the hash are shown as the **Matrix ID**. It changes whenever any value changes.

The hash detects edits and damage. It does not stop a person who can run `npm run token` and deploy
from publishing new fares, so control who can deploy.

Checking the hash uses the browser's Web Crypto, which works only on HTTPS or `localhost`.

## Code map

- `src/lib/fareToken.js`: encode and decode the token, check the hash
- `src/lib/fareSchema.js`: rules every fare matrix must pass
- `src/lib/fareCalc.js`: bracket lookup, fare arithmetic (in centavos), and the night-time check
- `src/components/Checker.jsx`: the page
- `src/components/TripPicker.jsx`, `RouteMap.jsx`: the pick-up/drop-off map (Leaflet, loaded on demand)
- `src/lib/useRoute.js`: road distance from OSRM, with the straight-line fallback
- `scripts/token.mjs`: `fares.json` → `.env`
