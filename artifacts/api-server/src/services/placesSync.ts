import { db } from "@workspace/db";
import {
  placesCacheTable,
  apiCreditUsageTable,
  searchZonesTable,
  type SearchZone,
} from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";

// Places API (New) endpoints
const PLACES_NEW_BASE = "https://places.googleapis.com/v1";
const MONTHLY_CALL_LIMIT = parseInt(process.env.PLACES_MONTHLY_CALL_LIMIT ?? "200", 10);
const THROTTLE_THRESHOLD = 0.8;
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

interface CreditStatus {
  monthKey: string;
  callsCount: number;
  suspended: boolean;
  limitReached: boolean;
  suspendedAt: Date | null;
}

export async function getCreditStatus(): Promise<CreditStatus> {
  const monthKey = currentMonthKey();
  const rows = await db
    .select()
    .from(apiCreditUsageTable)
    .where(eq(apiCreditUsageTable.monthKey, monthKey))
    .limit(1);

  if (rows.length === 0) {
    return { monthKey, callsCount: 0, suspended: false, limitReached: false, suspendedAt: null };
  }

  const row = rows[0];
  return {
    monthKey,
    callsCount: row.callsCount,
    suspended: row.suspendedAt !== null,
    limitReached: row.callsCount >= MONTHLY_CALL_LIMIT,
    suspendedAt: row.suspendedAt,
  };
}

async function recordCall(): Promise<void> {
  const monthKey = currentMonthKey();
  const threshold = Math.floor(MONTHLY_CALL_LIMIT * THROTTLE_THRESHOLD);

  await db
    .insert(apiCreditUsageTable)
    .values({ monthKey, callsCount: 1, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: apiCreditUsageTable.monthKey,
      set: {
        callsCount: sql`${apiCreditUsageTable.callsCount} + 1`,
        updatedAt: new Date(),
      },
    });

  const updated = await db
    .select()
    .from(apiCreditUsageTable)
    .where(eq(apiCreditUsageTable.monthKey, monthKey))
    .limit(1);

  if (updated.length > 0 && updated[0].callsCount >= threshold && !updated[0].suspendedAt) {
    await db
      .update(apiCreditUsageTable)
      .set({ suspendedAt: new Date() })
      .where(eq(apiCreditUsageTable.monthKey, monthKey));
    console.warn(`[PlacesSync] Throttle ativado: ${updated[0].callsCount}/${MONTHLY_CALL_LIMIT} chamadas este mês.`);
  }
}

// --- Places API (New) types ---

interface PlacesNewLocation {
  latitude: number;
  longitude: number;
}

interface PlacesNewPlace {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: PlacesNewLocation;
  rating?: number;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  photos?: { name: string }[];
}

interface PlacesNewNearbyResponse {
  places?: PlacesNewPlace[];
  nextPageToken?: string;
  error?: { message?: string; status?: string };
}

function buildPhotoUrl(photoName: string, apiKey: string): string {
  // Places API (New) photo URL format
  return `${PLACES_NEW_BASE}/${photoName}/media?maxWidthPx=400&key=${apiKey}`;
}

async function fetchNearbyPage(
  lat: number,
  lng: number,
  radiusM: number,
  pageToken: string | null,
  apiKey: string,
): Promise<{ places: PlacesNewPlace[]; nextPageToken?: string }> {
  const url = `${PLACES_NEW_BASE}/places:searchNearby`;

  const body: Record<string, unknown> = {
    includedTypes: ["supermarket", "grocery_store"],
    maxResultCount: 20,
    locationRestriction: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: radiusM,
      },
    },
  };

  if (pageToken) {
    (body as Record<string, unknown>).pageToken = pageToken;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.nationalPhoneNumber,places.websiteUri,places.photos",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12000),
    });
  } finally {
    await recordCall();
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Places API (New) HTTP ${res.status}: ${text}`);
  }

  const data = await res.json() as PlacesNewNearbyResponse;
  if (data.error) {
    throw new Error(`Places API (New) error: ${data.error.status ?? ""} — ${data.error.message ?? ""}`);
  }

  return { places: data.places ?? [], nextPageToken: data.nextPageToken };
}

export interface SyncResult {
  synced: number;
  skipped: number;
  throttled: boolean;
  error?: string;
}

export async function syncZone(zone: SearchZone): Promise<SyncResult> {
  const apiKey = process.env.GOOGLE_PLACES_KEY;
  if (!apiKey) {
    return { synced: 0, skipped: 0, throttled: false, error: "GOOGLE_PLACES_KEY não configurada." };
  }

  const credit = await getCreditStatus();
  if (credit.suspended || credit.limitReached) {
    console.warn(`[PlacesSync] Sync bloqueado por throttle para zona "${zone.name}"`);
    return { synced: 0, skipped: 0, throttled: true };
  }

  const radiusM = Math.round(zone.radiusKm * 1000);
  let pageToken: string | null = null;
  let synced = 0;
  let skipped = 0;
  let page = 0;

  try {
    do {
      if (page > 0) await new Promise((r) => setTimeout(r, 2000));

      const freshCredit = await getCreditStatus();
      if (freshCredit.suspended || freshCredit.limitReached) {
        console.warn("[PlacesSync] Throttle ativado durante sync — interrompendo.");
        break;
      }

      const { places, nextPageToken } = await fetchNearbyPage(
        zone.lat, zone.lng, radiusM, pageToken, apiKey
      );

      for (const place of places) {
        if (!place.id || !place.location) continue;

        const existing = await db
          .select({ syncedAt: placesCacheTable.syncedAt })
          .from(placesCacheTable)
          .where(eq(placesCacheTable.googlePlaceId, place.id))
          .limit(1);

        if (existing.length > 0) {
          const age = Date.now() - new Date(existing[0].syncedAt).getTime();
          if (age < CACHE_TTL_MS) {
            skipped++;
            continue;
          }
        }

        const photoUrl =
          place.photos?.[0]?.name
            ? buildPhotoUrl(place.photos[0].name, apiKey)
            : null;

        const lng = place.location.longitude;
        const lat = place.location.latitude;
        const geomSql = sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography`;

        await db.execute(sql`
          INSERT INTO places_cache (google_place_id, name, address, lat, lng, phone, website, photo_url, rating, status, geom, synced_at)
          VALUES (
            ${place.id},
            ${place.displayName?.text ?? "Supermercado"},
            ${place.formattedAddress ?? null},
            ${lat},
            ${lng},
            ${place.nationalPhoneNumber ?? null},
            ${place.websiteUri ?? null},
            ${photoUrl},
            ${place.rating ?? null},
            'shadow',
            ${geomSql},
            NOW()
          )
          ON CONFLICT (google_place_id) DO UPDATE SET
            name = EXCLUDED.name,
            address = EXCLUDED.address,
            lat = EXCLUDED.lat,
            lng = EXCLUDED.lng,
            phone = EXCLUDED.phone,
            website = EXCLUDED.website,
            photo_url = EXCLUDED.photo_url,
            rating = EXCLUDED.rating,
            geom = EXCLUDED.geom,
            synced_at = NOW()
          WHERE places_cache.status = 'shadow'
        `);

        synced++;
      }

      pageToken = nextPageToken ?? null;
      page++;
    } while (pageToken && page < 3);

    await db
      .update(searchZonesTable)
      .set({ lastSyncedAt: new Date() })
      .where(eq(searchZonesTable.id, zone.id));

    console.log(`[PlacesSync] Zona "${zone.name}": ${synced} salvas, ${skipped} já atualizadas.`);
    return { synced, skipped, throttled: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[PlacesSync] Erro durante sync:", msg);
    return { synced, skipped, throttled: false, error: msg };
  }
}
