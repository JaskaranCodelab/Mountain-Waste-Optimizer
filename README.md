# Himalaya Route

**AI-assisted mountain waste collection & truck route optimizer for Uttarakhand**

An interactive React dashboard for simulated waste pickups across Mussoorie. It compares a plain nearest-neighbour route with a capacity-aware optimized route, supports separate admin and driver portals, shares driver pickup updates and active GPS positions through a tracking API, and estimates operating cost from transparent, configurable assumptions.

![Stack](https://img.shields.io/badge/React-18-149eca) ![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178c6) ![Vite](https://img.shields.io/badge/Vite-5.4-646cff) ![Tailwind](https://img.shields.io/badge/Tailwind-3.4-38bdf8)

## Important disclaimer

This is a demo application, not a live municipal service.

- All pickup stops, quantities, priorities and statuses are **simulated demo records**.
- No truck is shown as active until a driver starts navigation. Driver coordinates use device GPS when the browser grants permission on HTTPS; otherwise, the driver portal labels its route movement as simulated.
- No live traffic, fuel-price or government collection feeds are connected.
- The route optimizer is a **transparent heuristic**, not a trained machine-learning model.
- Road geometry comes from public OpenStreetMap routing services where available (Valhalla first, OSRM fallback). If both are unavailable or rate-limited, the app falls back to clearly-labelled **simulated geometry**.
- Operating costs are estimates based on configurable assumptions.

## Quick start

Requires Node.js 18+ (developed with Node 26) and npm.

```bash
npm install
npm run dev
```

Open the printed local URL (default `http://localhost:5173`).

### Access from another device on the same network

`localhost` only works on the computer running the server. From a phone or another computer:

1. Keep both devices on the same Wi-Fi/LAN.
2. Run `npm run dev` and use the **Network** URL printed by Vite, for example `http://192.168.1.20:5173`.
3. Use the current IP of the active Wi-Fi adapter. Check it with `ipconfig`; the address changes when the network changes.
4. If it still does not connect, allow inbound TCP 5173 (and 4173 for `npm run preview`) in Windows Firewall. The dev server binds to all interfaces by default.

Corporate/guest Wi-Fi may enable client isolation, which blocks device-to-device access. Many Android phone hotspots also isolate their clients, so connected devices get IP addresses but still cannot reach each other. In that case use a normal Wi-Fi router, not a phone hotspot. The LAN address changes whenever the network changes, so always use the current Wi-Fi adapter IP.

`npm run dev` starts both Vite and the shared tracking API. When both devices open the same laptop-hosted Network URL, they share that API automatically. If frontends are hosted on different computers, run one shared tracking API and set `VITE_TRACKING_API_URL` on every frontend to that server (see `.env.example`); use `npm run dev:frontend` for a frontend that connects to an already-running shared API. Allow inbound TCP 8787 to the API host for this separate-frontend setup. Dashboard pages refresh shared driver coordinates from the tracking API every 1.5 seconds. Plain HTTP on a LAN can synchronize simulated positions, but browsers usually block live GPS there; serve the app over HTTPS and allow location access on the driver's device for accurate GPS. The development tracking service is a local demo service, not production-secure fleet infrastructure.

### Shared live tracking on Vercel

Vercel deploys the frontend and `/api/tracking` function. To share locations between every Vercel deployment/device, connect one Upstash Redis database to the Vercel project from **Storage → Marketplace**, then make sure these environment variables are available to the deployment:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Redeploy after adding the database/variables. Leave `VITE_TRACKING_API_URL` unset in Vercel so every page calls the same-origin `/api/tracking` function. Driver locations are shared through Redis, refreshed by dashboard clients every 1.5 seconds, and removed from the active map when the driver ends the route or stops sending updates for 90 seconds. Pickup statuses and issue notes are shared through Redis and refreshed every 2.5 seconds, so driver updates appear in admin sessions on other devices. Keep the driver page open during navigation. Browser GPS requires HTTPS and location permission; simulated positions also synchronize through the same service.

Without the Redis variables, the Vercel API responds as offline and devices cannot share locations. The driver's current sign-in is a demo UI, not production authentication; secure driver accounts should be added before using this endpoint for an operational fleet.

### Production build

```bash
npm run build
npm run preview
```

### Verification

```bash
npm run typecheck
npm run build
```

There is no separate test suite; TypeScript and the production build are the automated checks. The app was also exercised in headless Chrome across all six views, stop CRUD, mode switching, simulation controls, road routing and simulated-route fallback, and mobile layout.

## Features

- **Operations overview** â€” fleet/route KPIs, live Leaflet map, truck panel, route comparison and compact analytics.
- **Live map** â€” depot, 10 seeded stops, active route, optional baseline overlay, device-reference dot, full-screen mode, simulation controls and explicit geometry-source labels.
- **Route planner** â€” baseline vs optimized comparison, capacity feasibility, depot-return logic, savings and active-plan switching.
- **Pickup stops** â€” search, filters, sorting, add/edit/delete, validation and a selected-stop map preview.
- **Analytics** â€” waste by stop and category, collection progress, baseline vs optimized distance and cost breakdowns (Recharts).
- **Settings** â€” routing provider, cost assumptions, simulation speed, browser geolocation, persisted state and demo reset.
- **Three demo profiles** â€” household waste, pine needles and fruit peels, each with independent stop loads and priorities.
- **Responsive layout** â€” fixed forest-green sidebar on desktop, drawer navigation on mobile.

## Routing behaviour

With `routingProvider: 'osrm'` (default road-routing mode), the app requests multi-leg driving routes from:

```
https://valhalla1.openstreetmap.de/route
```

- Valhalla is requested first with `costing: 'auto'`; requests are split into overlapping chunks of at most 10 locations, and polyline6 shapes are decoded and stitched together.
- If Valhalla fails, the app retries the same stops against `https://router.project-osrm.org/route/v1/driving/{lng},{lat};...` with GeoJSON geometry.
- Requests use a 12-second timeout. Successful routes are cached for 5 minutes; failures for 45 seconds.
- Changing the provider to **Simulated only** makes no external routing requests.
- If both routing services fail, the interface switches to curved simulated legs and labels them **Simulated route** / **Simulated fallback**. It never presents invented geometry as real road data.
- `Retry routing` clears the cache and refetches.

The public Valhalla and OSRM demo servers are not intended for production traffic. For a real deployment, self-host Valhalla or OSRM with an appropriate extract and change the base URL in `src/lib/routingService.ts`.

Map tiles and attribution: Â© OpenStreetMap contributors.

## Optimizer

Implemented locally in `src/lib/routeOptimizer.ts` with no external optimization service.

1. **Baseline** â€” plain nearest-neighbour order from the depot, ignoring capacity and mountain penalties.
2. **Candidates** â€” capacity-aware greedy nearest neighbour with optional priority bias, plus the baseline order with depot returns inserted.
3. **Improvement** â€” per-trip 2-opt segment reversal for up to 12 passes.
4. **Selection** â€” capacity-feasible candidates are preferred, then the shortest estimated distance.

Scoring uses haversine distance Ã— a road factor of 1.32, multiplied by accessibility penalties:

- restricted access: `1 + steepPenaltyPct / 100`
- moderate access: `1 + narrowPenaltyPct / 100`
- priority bias: scales distance by `max(0.5, 1 - weight Ã— priorityValue)`

If a pickup would exceed truck capacity, the optimized order inserts a return to the Mussoorie Collection Depot before/after the overloaded leg. The baseline deliberately ignores capacity so the trade-off is visible when capacity is constrained.

The heuristic is deterministic for a given stop set and settings, but is **not** a globally optimal solver.

## Cost model

```
fuelCost        = distanceKm / fuelEfficiencyKmPerL Ã— fuelPricePerL
maintenanceCost = distanceKm Ã— maintenanceCostPerKm
total           = fuelCost + maintenanceCost
```

Defaults: 6 km/L, â‚¹96.72/L, â‚¹9/km, 1,500 kg capacity, 15% restricted-access penalty, 22% moderate-access penalty and 12% priority weighting. All values are editable in Settings and persisted locally.

## Route simulation and driver tracking

- The baseline route is shown first; the optimized plan becomes active when **Optimize Route** is selected.
- Driver trucks appear on maps only after a driver starts navigation. Device GPS is used when available and permitted; otherwise, the driver portal labels its route movement as simulated.
- Admin and driver maps refresh active driver positions from the tracking API. Shared multi-device tracking on Vercel requires the Upstash Redis environment variables described above.
- The **Baseline vs optimized route** page continues to compare both route plans and their capacity-aware stop sequences.

## Persistence

State is stored in LocalStorage under `himalaya-route-state-v5`:

- all three stop datasets,
- active waste profile,
- settings and assumptions.

Reset the demo from **Settings â†’ Reset demo data**. The app remains fully usable without granting browser location.

## Project structure

```
src/
  components/   map, truck panel, tables, charts, modals, UI primitives
  data/         depot, stop seeds and waste-profile metadata
  lib/          geo maths, cost model, routing service, optimizer
  pages/        Overview, Live Map, Route Planner, Comparison, Stops, Analytics, Settings
  store/        AppStore context (state, routing effects, simulation, persistence)
  types/        shared TypeScript interfaces
  App.tsx       app shell, responsive navigation and page routing
  main.tsx      entry point and Leaflet CSS
```

## Notes for production

- Replace the public OSRM demo with a self-hosted instance and add caching/backoff.
- Replace simulated records with a validated backend and authentication.
- Treat fuel prices, maintenance rates and mountain penalties as operational inputs that need real data.
- Do not label the heuristic as AI/ML; if a learned model is added, document training data and evaluation.

