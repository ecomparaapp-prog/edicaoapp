import { getApiBaseUrl } from "@/lib/apiBaseUrl";

export interface NearbyMission {
  googlePlaceId: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  photoUrl: string | null;
  rating: number | null;
  storeStatus: string;
  totalNeedy: number;
  staleCount: number;
  disputedCount: number;
  distanceM: number;
  xpMultiplier: number;
}

export interface MissionQueueItem {
  reportId: number;
  ean: string;
  price: number;
  reportedAt: string;
  isVerified: boolean;
  upvotes: number;
  downvotes: number;
  productName: string;
  brand: string | null;
  thumbnailUrl: string | null;
  reason: "stale" | "disputed";
  isPriority: boolean;
}

export interface ValidateResult {
  ok: boolean;
  upvotes?: number;
  downvotes?: number;
  isVerified?: boolean;
  xpEarned?: number;
  fromMission?: boolean;
  justVerified?: boolean;
  error?: string;
}

export async function fetchNearbyMissions(
  lat: number,
  lng: number,
  radiusKm = 0.3,
): Promise<NearbyMission[]> {
  const base = getApiBaseUrl();
  try {
    const res = await fetch(
      `${base}/prices/missions?lat=${lat}&lng=${lng}&radius_km=${radiusKm}&limit=10`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { missions?: NearbyMission[] };
    return data.missions ?? [];
  } catch {
    return [];
  }
}

export async function fetchMissionQueue(
  placeId: string,
): Promise<MissionQueueItem[]> {
  const base = getApiBaseUrl();
  try {
    const res = await fetch(`${base}/prices/missions/${placeId}/queue`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { queue?: MissionQueueItem[] };
    return data.queue ?? [];
  } catch {
    return [];
  }
}

export async function validatePrice(
  reportId: number,
  vote: "confirm" | "dispute",
  fromMission = true,
): Promise<ValidateResult> {
  const base = getApiBaseUrl();
  try {
    const res = await fetch(`${base}/prices/${reportId}/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vote, fromMission }),
      signal: AbortSignal.timeout(8000),
    });
    const json = (await res.json()) as ValidateResult;
    if (!res.ok) return { ok: false, error: (json as any).error ?? "Erro ao validar." };
    return json;
  } catch {
    return { ok: false, error: "Sem conexão." };
  }
}
