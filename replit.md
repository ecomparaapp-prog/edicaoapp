# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM + **PostGIS 3.5.3** (geography queries)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── ecompara/           # Expo React Native mobile app
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.
- **After any `lib/db` schema change**: run `tsc -b --force` in `lib/db` to regenerate `.d.ts` declarations before typechecking the api-server.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing; serves admin panel at `GET /admin`; routes at `/api`
- Routes:
  - `src/routes/health.ts` — `GET /api/health`
  - `src/routes/ean.ts` — `GET /api/products/ean/:ean`, `GET /api/products/search?q=` — Cosmos API proxy with cache-aside pattern (negative cache sentinel `__not_found__`)
  - `src/routes/admin.ts` — admin endpoints: `GET|POST|DELETE /api/admin/zones`, `POST /api/admin/zones/:id/sync`, `GET /api/admin/credit`, `GET /api/admin/partnerships`
  - `src/routes/stores.ts` — `GET /api/stores/nearby?lat=&lng=&radius_km=` (PostGIS ST_DWithin), `POST /api/stores/claim`
- Services:
  - `src/services/placesSync.ts` — Google Places Nearby Search sync, throttle logic (80% of monthly limit), upsert to `places_cache`
- Admin panel: `src/admin.html` — served at `GET /admin`; zone management, credit meter, partnership requests list
- Depends on: `@workspace/db`, `@workspace/api-zod`
- Environment secrets:
  - `COSMOS_TOKEN` — Cosmos Bluesoft EAN lookup
  - `GOOGLE_PLACES_KEY` — Google Places API key (server-side only, required for zone sync)
- Env vars:
  - `PLACES_MONTHLY_CALL_LIMIT` — optional, default 200; sync suspends at 80%

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL + PostGIS. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- Tables:
  - `ean_cache` — EAN product cache from Cosmos API (30-day TTL, negative cache sentinel)
  - `search_zones` — geographic zones for Google Places bulk search (name, lat, lng, radius_km, active, last_synced_at)
  - `places_cache` — Google Places results (google_place_id PK, name, address, lat, lng, phone, website, photo_url, rating, is_partner, synced_at; 30-day TTL)
  - `partnership_requests` — "Este é meu negócio" claim requests (google_place_id, requester_name, requester_email, message)
  - `api_credit_usage` — monthly Google Places API call counter with throttle state (month_key unique, calls_count, suspended_at)
- PostGIS enabled; ST_DWithin + ST_MakePoint used in `/api/stores/nearby` for geographic proximity queries
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, use `pnpm --filter @workspace/db run push` or `push-force`.

### `artifacts/ecompara` (`@workspace/ecompara`)

Expo React Native mobile app (the main eCompara app).

- **Services**:
  - `services/cosmosService.ts` — calls `/api/products/ean/:ean` and `/api/products/search?q=` with AbortController timeout
  - `services/storesService.ts` — calls `/api/stores/nearby` and `POST /api/stores/claim`
- **Context** (`context/AppContext.tsx`):
  - `cosmosCache` — in-memory Cosmos product cache
  - `stores` / `storesLoading` — backend-loaded stores (fallback: MOCK_STORES)
  - `loadNearbyStores(lat, lng, radiusKm)` — fetches from backend, maps to Store[], updates state
  - `submitStoreClaim(claim)` — calls `/api/stores/claim`
- **UI**:
  - Shadow stores (is_shadow=true): opacity 0.55 + "Este é meu negócio" button → claim modal
  - Verified/partner stores: full card (logo photo, rating, PLUS badge)
  - Claim modal: requester_name, requester_email, message → POST /api/stores/claim
- **Maps**: react-native-maps pinned at 1.18.0 (do NOT change)
- **UUID**: `Date.now().toString() + Math.random()` (no uuid package)
- **Tab bar**: solid red (#CC0000), white active/inactive icons
- **Retailer panel**: only accessible from Profile tab when isLoggedIn === true

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.
