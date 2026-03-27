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
- App setup: `src/app.ts` — CORS restricted to `*.replit.dev`, `*.repl.co`, `*.replit.app`, localhost; JSON/urlencoded parsing; admin login returns SHA-256 hash of ADMIN_PASSWORD (not the raw password) as bearer token; routes at `/api`
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
  - `places_cache` — Google Places results (google_place_id PK, name, address, lat, lng, phone, website, photo_url, rating, status text 'shadow'|'verified', synced_at; 30-day TTL; `geom geography(Point,4326)` generated stored column + GIST index for fast spatial queries)
  - `partnership_requests` — "Este é meu negócio" claim requests (google_place_id, requester_name, requester_email, message)
  - `api_credit_usage` — monthly Google Places API call counter with throttle state (month_key unique, calls_count, suspended_at)
  - `price_reports` — user-submitted price observations (ean, place_id → places_cache.google_place_id, user_id, price numeric(10,2), reported_at, is_verified bool, upvotes int, downvotes int); indexes on ean, place_id, user_id, (ean,place_id)
  - `user_profiles` — user profile data (user_id PK, nickname unique, full_name, cpf, phone, address, pix_key, full_name_locked bool, cpf_locked bool, profile_bonus_awarded bool)
- PostGIS enabled; `geom` column with GIST index used for ST_DWithin queries in `/api/stores/nearby`
- Note: `geom` column and `spatial_ref_sys` table are managed outside Drizzle (via raw SQL); do NOT run `drizzle-kit push` without `--force` or it will try to drop them
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, use `pnpm --filter @workspace/db run push` or `push-force`.

### `artifacts/ecompara` (`@workspace/ecompara`)

Expo React Native mobile app (the main eCompara app).

- **Shared utility**: `lib/apiBaseUrl.ts` — single `getApiBaseUrl()` implementation used by all service files (avoids duplication; handles web vs. native + `EXPO_PUBLIC_DOMAIN` vs. localhost)
- **Services**:
  - `services/cosmosService.ts` — calls `/api/products/ean/:ean` and `/api/products/search?q=` with AbortController timeout
  - `services/storesService.ts` — calls `/api/stores/nearby` and `POST /api/stores/claim`
  - `services/profileService.ts` — calls `/api/profile/:userId` (GET/PUT) and `/api/profile/check-nickname` (GET)
  - `services/priceService.ts` — calls `POST /api/prices`, `GET /api/products/:ean/prices`, `GET /api/stores/:placeId/prices`, `POST /api/prices/:id/vote`; URL built via `getApiBaseUrl()` from shared lib
  - `services/authService.ts` — Google OAuth stub; exports `useGoogleSignIn` hook (must be called at component top-level) and `isGoogleAuthConfigured()`; requires `expo-auth-session` package + Google Client ID env vars to activate
- **Context** (`context/AppContext.tsx`):
  - `cosmosCache` — in-memory Cosmos product cache
  - `stores` / `storesLoading` — backend-loaded stores (fallback: MOCK_STORES)
  - `loadNearbyStores(lat, lng, radiusKm)` — fetches from backend, maps to Store[], updates state
  - `submitStoreClaim(claim)` — calls `/api/stores/claim`
  - `submitPriceUpdate(ean, price, placeId, bonusPoints?)` — async; calls `priceService.submitPrice()`, awards points locally; returns `{ok, reportId, bonusPoints, error}`
- **UI**:
  - Shadow stores (status='shadow'): gray overlay (0.45 opacity) + "Este é meu negócio" claim CTA button → claim modal
  - Verified stores (status='verified'): highlighted card with primary border, "Verificado" badge, clickable phone/website metadata
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

### `lib/db/src/schema/merchantRegistrations.ts`

New table `merchant_registrations` — full merchant onboarding records:
- Bloco A: `cnpj`, `razao_social`, `nome_fantasia`, `inscricao_estadual`
- Bloco B: `cep`, `address`, `lat`, `lng`, `operating_hours` (JSONB with per-day open/close/closed + holidays), `phone`, `whatsapp`
- Bloco C: `parking` (none/free/paid), `card_brands` (JSONB array), `delivery` (none/own/app), `logo_url`
- Verification: `verification_method` (email/phone), `verification_contact`, `verification_code`, `verified_at`
- Lifecycle: `status` (pending_verification → pending_approval → approved/rejected), `admin_note`

### `artifacts/api-server/src/routes/merchants.ts`

Merchant registration API:
- `GET /api/merchants/cnpj/:cnpj` — proxies to ReceitaWS, validates CNPJ status (blocks BAIXADA/INAPTA), returns auto-fill data
- `POST /api/merchants/register` — creates registration with generated 4-digit verification code (returned as `_devCode` in dev mode)
- `POST /api/merchants/verify` — confirms ownership code, advances status to `pending_approval`
- `POST /api/merchants/resend` — resends verification code

### `artifacts/api-server/src/routes/admin.ts` (updated)

New admin endpoints:
- `GET /api/admin/merchant-registrations?status=` — list registrations with optional status filter
- `POST /api/admin/merchant-registrations/:id/approve` — approve with optional note
- `POST /api/admin/merchant-registrations/:id/reject` — reject with mandatory note

### `artifacts/ecompara/app/merchant-register.tsx`

4-step merchant registration wizard:
1. **Bloco A** — CNPJ lookup (auto-fills razão social, nome fantasia, CEP, address, phone), IE
2. **Bloco B** — CEP, address, draggable map pin (react-native-maps), per-day operating hours with Fechado toggle, phone/WhatsApp
3. **Bloco C** — Parking (none/free/paid), card brands checkboxes, delivery type, logo image picker (expo-image-picker, 1:1 crop)
4. **Verificação** — choose email or phone verification → submits registration → enter 4-digit code → success screen

Entry point: "Este é meu negócio" button on shadow store cards (map screen), passing `googlePlaceId`, `placeName`, `placeLat`, `placeLng` as route params.

### `artifacts/api-server/src/routes/missions.ts`

Price validation mission system backend:
- `GET /api/prices/missions?lat=&lng=&radius_km=&limit=` — stores near user with stale (>24h) or disputed (downvotes > upvotes) prices; returns `xpMultiplier` (2.0 for disputed, 1.5 for stale), `staleCount`, `disputedCount`, `distanceM`
- `GET /api/prices/missions/:placeId/queue` — ordered list of price reports needing validation at a store; cesta básica items sorted first; reason: `stale` | `disputed`
- `POST /api/prices/:id/validate` — upvote/downvote a price report; `fromMission: true` flag doubles XP (20 XP vs 10 XP); marks `is_verified = true` when upvotes ≥ 3

### `artifacts/ecompara/services/missionService.ts`

Typed API service for missions:
- `fetchNearbyMissions(lat, lng, radiusKm)` → `NearbyMission[]`
- `fetchMissionQueue(placeId)` → `MissionQueueItem[]`
- `validatePrice(reportId, vote, fromMission)` → `ValidateResult` with `xpEarned`, `justVerified`

### `artifacts/ecompara/services/geofenceService.ts`

Background geofencing + local push notifications:
- `startBackgroundGeofencing()` — starts `expo-location` background updates (5min / 150m intervals)
- `checkGeofenceAndNotify(lat, lng)` — fetches missions in 300m radius, fires local notification for closest unnotified store
- Night mode guard: no notifications 22:00–07:00
- 30-min cooldown per store (`lastNotifiedStore` map)
- Android "missions" notification channel
- Background task: `ECOMPARA_BACKGROUND_LOCATION`

### `artifacts/ecompara/app/missions/[placeId].tsx`

Mission detail screen — swipe-to-validate UI:
- Loads mission queue for a store (stale + disputed prices)
- Card-by-card swipe: ✓ Correto / ✗ Errado / Pular
- XP popup animation (+20 XP with 2x multiplier)
- "Missão Cumprida!" trophy celebration overlay on completion
- `fromMission: true` on all validation API calls for 2x XP

### Home screen missions features (`app/(tabs)/index.tsx`)

- "Missões Relâmpago" horizontal scrollable section (after banners) with mission cards showing XP multiplier, distance, stale/disputed counts, "Iniciar Missão" CTA
- Coral `!` badge (orange-red circle) on store cards in the stores horizontal list when that store has pending missions
- Missions fetched on mount via `fetchNearbyMissions(DEFAULT_LAT, DEFAULT_LNG, 2)` (2km radius)

### `artifacts/ecompara/app/_layout.tsx`

Updated root layout:
- Registers `missions/[placeId]` stack screen
- Sets up notification channel + push handler on mount
- Listens for notification taps → navigates to mission detail screen

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.
