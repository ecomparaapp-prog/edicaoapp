import { db } from "@workspace/db";
import {
  placesCacheTable,
  apiCreditUsageTable,
  searchZonesTable,
  type SearchZone,
} from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";

const PLACES_BASE = "https://maps.googleapis.com/maps/api/place";
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

interface PlacesNearbyResult {
  place_id: string;
  name: string;
  vicinity?: string;
  geometry: { location: { lat: number; lng: number } };
  rating?: number;
  photos?: { photo_reference: string }[];
}

interface PlacesNearbyResponse {
  results: PlacesNearbyResult[];
  next_page_token?: string;
  status: string;
  error_message?: string;
}

async function fetchNearbyPage(
  lat: number,
  lng: number,
  radiusM: number,
  pageToken: string | null,
  apiKey: string,
): Promise<PlacesNearbyResponse> {
  let url = `${PLACES_BASE}/nearbysearch/json?location=${lat},${lng}&radius=${radiusM}&type=supermarket&key=${apiKey}`;
  if (pageToken) url += `&pagetoken=${encodeURIComponent(pageToken)}`;

  await recordCall();
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Places API HTTP ${res.status}`);
  return res.json() as Promise<PlacesNearbyResponse>;
}

async function fetchPlaceDetails(
  placeId: string,
  apiKey: string,
): Promise<{ phone?: string; website?: string } | null> {
  try {
    const url = `${PLACES_BASE}/details/json?place_id=${placeId}&fields=formatted_phone_number,website&key=${apiKey}`;
    await recordCall();
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json() as { result?: { formatted_phone_number?: string; website?: string } };
    return {
      phone: data.result?.formatted_phone_number ?? undefined,
      website: data.result?.website ?? undefined,
    };
  } catch {
    return null;
  }
}

function buildPhotoUrl(photoRef: string, apiKey: string): string {
  return `${PLACES_BASE}/photo?maxwidth=400&photo_reference=${photoRef}&key=${apiKey}`;
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
    console.warn(`[PlacesSync] Sync bloqueado por throttle para zona ${zone.name}`);
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

      const response = await fetchNearbyPage(zone.lat, zone.lng, radiusM, pageToken, apiKey);

      if (response.status !== "OK" && response.status !== "ZERO_RESULTS") {
        console.error(`[PlacesSync] Erro Places API: ${response.status} — ${response.error_message ?? ""}`);
        break;
      }

      for (const place of response.results) {
        const existing = await db
          .select({ syncedAt: placesCacheTable.syncedAt })
          .from(placesCacheTable)
          .where(eq(placesCacheTable.googlePlaceId, place.place_id))
          .limit(1);

        if (existing.length > 0) {
          const age = Date.now() - new Date(existing[0].syncedAt).getTime();
          if (age < CACHE_TTL_MS) {
            skipped++;
            continue;
          }
        }

        const photoUrl =
          place.photos?.[0]?.photo_reference
            ? buildPhotoUrl(place.photos[0].photo_reference, apiKey)
            : null;

        const freshCredit2 = await getCreditStatus();
        let phone: string | null = null;
        let website: string | null = null;
        if (!freshCredit2.suspended && !freshCredit2.limitReached) {
          const details = await fetchPlaceDetails(place.place_id, apiKey);
          phone = details?.phone ?? null;
          website = details?.website ?? null;
        }

        await db
          .insert(placesCacheTable)
          .values({
            googlePlaceId: place.place_id,
            name: place.name,
            address: place.vicinity ?? null,
            lat: place.geometry.location.lat,
            lng: place.geometry.location.lng,
            phone,
            website,
            photoUrl,
            rating: place.rating ?? null,
            isPartner: false,
            syncedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: placesCacheTable.googlePlaceId,
            set: {
              name: place.name,
              address: place.vicinity ?? null,
              lat: place.geometry.location.lat,
              lng: place.geometry.location.lng,
              photoUrl,
              rating: place.rating ?? null,
              syncedAt: new Date(),
            },
          });

        synced++;
      }

      pageToken = response.next_page_token ?? null;
      page++;
    } while (pageToken && page < 3);

    await db
      .update(searchZonesTable)
      .set({ lastSyncedAt: new Date() })
      .where(eq(searchZonesTable.id, zone.id));

    return { synced, skipped, throttled: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[PlacesSync] Erro durante sync:", msg);
    return { synced, skipped, throttled: false, error: msg };
  }
}
