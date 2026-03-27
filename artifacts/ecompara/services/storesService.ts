import { getApiBaseUrl } from "@/lib/apiBaseUrl";

export interface NearbyStore {
  googlePlaceId: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  phone: string | null;
  website: string | null;
  photoUrl: string | null;
  rating: number | null;
  status: "shadow" | "verified";
  is_partner: boolean;
  is_shadow: boolean;
  distanceKm: number;
  syncedAt: string;
}

export interface ClaimRequest {
  googlePlaceId: string;
  placeName: string;
  requesterName: string;
  requesterEmail: string;
  message?: string;
}

export interface FetchStoresResult {
  stores: NearbyStore[];
  success: boolean;
}

export async function fetchNearbyStores(
  lat: number,
  lng: number,
  radiusKm = 10,
): Promise<FetchStoresResult> {
  const base = getApiBaseUrl();
  const url = `${base}/stores/nearby?lat=${lat}&lng=${lng}&radius_km=${radiusKm}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) {
      return { stores: [], success: false };
    }
    const data = await res.json() as { stores?: NearbyStore[] };
    return { stores: data.stores ?? [], success: true };
  } catch {
    clearTimeout(timeout);
    return { stores: [], success: false };
  }
}

export async function submitPartnershipClaim(
  claim: ClaimRequest,
): Promise<{ ok: boolean; error?: string }> {
  const base = getApiBaseUrl();
  const url = `${base}/stores/claim`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        google_place_id: claim.googlePlaceId,
        place_name: claim.placeName,
        requester_name: claim.requesterName,
        requester_email: claim.requesterEmail,
        message: claim.message ?? "",
      }),
    });
    const data = await res.json() as { ok?: boolean; error?: string };
    return { ok: !!data.ok, error: data.error };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erro de conexão.",
    };
  }
}
