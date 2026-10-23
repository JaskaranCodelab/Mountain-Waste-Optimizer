# Himalaya Route

**AI-assisted mountain waste collection & truck route optimizer for Uttarakhand**

An interactive React dashboard that simulates 10 municipal waste pickups across Mussoorie, compares a plain nearest-neighbour route with a capacity-aware optimized route, tracks a slowly moving four-truck demo fleet, and estimates operating cost from transparent, configurable assumptions.

![Stack](https://img.shields.io/badge/React-18-149eca) ![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178c6) ![Vite](https://img.shields.io/badge/Vite-5.4-646cff) ![Tailwind](https://img.shields.io/badge/Tailwind-3.4-38bdf8)

## Important disclaimer

This is a demo application, not a live municipal service.

- All pickup stops, quantities, priorities and statuses are **simulated demo records**.
- Truck movement, progress, ETAs and telemetry are a **browser animation**, not live GPS or fleet tracking.
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
2. Run `npm run dev -- --host 0.0.0.0` and use the **Network** URL printed by Vite, for example `http://172.168.11.21:5173`.
3. Use the current IP of the active Wi-Fi adapter. Check it with `ipconfig`; the address changes when the network changes.
4. If it still does not connect, allow inbound TCP 5173 (and 4173 for `npm run preview`) in Windows Firewall. The dev server binds to all interfaces by default.

Corporate/guest Wi-Fi may enable client isolation, which blocks device-to-device access. Many Android phone hotspots also isolate their clients, so connected devices get IP addresses but still cannot reach each other. In that case use a normal Wi-Fi router, not a phone hotspot. The LAN address changes whenever the network changes, so always use the current Wi-Fi adapter IP.

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

## Simulation

- The baseline route is shown first; the optimized plan becomes active when **Optimize Route** is selected.
- Four simulated trucks seed automatically when the app opens. They are assigned to the baseline or optimized geometry with independent starting positions, colours and slow random speeds.
- Trucks advance every `simulationIntervalMs`; the **Step per tick** setting scales their speed. Movement continues while the app is open but is still a browser simulation, not live GPS.
- Click a truck to show its own status, progress, covered stop count, next stop and route. The selected truck's covered route is drawn in **green** and its pending route in **blue**.
- Controls: Start/Resume fleet, Pause fleet, Next Stop, Reset and Optimize Route.
- Pickup statuses follow the focused fleet truck; completed and pending KPIs recalculate live.
- The **Basline vs optimized route** page shows both plans on separate maps, with the trucks assigned to each plan.

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

