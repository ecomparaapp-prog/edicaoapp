import { getApiBaseUrl } from "@/lib/apiBaseUrl";

const BASE = getApiBaseUrl();

export interface PriceEntry {
  reportId: number;
  ean: string;
  placeId: string;
  price: number;
  reportedAt: string;
  isVerified: boolean;
  upvotes: number;
  downvotes: number;
  reportType: string | null;
  pointsAwarded: number | null;
  storeName: string;
  storeAddress: string | null;
  lat: number | null;
  lng: number | null;
  photoUrl: string | null;
  rating: number | null;
  storeStatus: string | null;
}

export interface StorePriceEntry {
  reportId: number;
  ean: string;
  price: number;
  reportedAt: string;
  isVerified: boolean;
  upvotes: number;
  downvotes: number;
  reportType: string | null;
  productName: string;
  brand: string | null;
  thumbnailUrl: string | null;
}

export type ReportType =
  | "product_registration"
  | "price_validation"
  | "price_submission"
  | "conflict_pending"
  | "auto_validated"
  | "conflict_rejected";

export interface SubmitPriceResult {
  ok: boolean;
  reportId?: number;
  pointsAwarded?: number;
  reportType?: ReportType;
  conflictStatus?: string | null;
  autoValidated?: boolean;
  autoValidatedUsers?: string[];
  storeType?: "partner" | "shadow";
  hasFreshPrice?: boolean;
  latestPrice?: number | null;
  message?: string;
  error?: string;
  bonusPoints?: number;
}

export async function submitPrice(
  ean: string,
  placeId: string,
  userId: string,
  price: number,
  productName?: string,
): Promise<SubmitPriceResult> {
  try {
    const res = await fetch(`${BASE}/prices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ean, placeId, userId, price, productName }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error ?? "Erro ao enviar preço." };
    return {
      ok: true,
      reportId: data.reportId,
      pointsAwarded: data.pointsAwarded,
      reportType: data.reportType,
      conflictStatus: data.conflictStatus,
      autoValidated: data.autoValidated,
      autoValidatedUsers: data.autoValidatedUsers,
      storeType: data.storeType,
      hasFreshPrice: data.hasFreshPrice,
      latestPrice: data.latestPrice,
      message: data.message,
      bonusPoints: data.pointsAwarded,
    };
  } catch {
    return { ok: false, error: "Sem conexão com o servidor." };
  }
}

export async function fetchProductPrices(ean: string): Promise<PriceEntry[]> {
  try {
    const res = await fetch(`${BASE}/products/${ean}/prices`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.prices ?? [];
  } catch {
    return [];
  }
}

export async function fetchStorePrices(placeId: string): Promise<StorePriceEntry[]> {
  try {
    const res = await fetch(`${BASE}/stores/${placeId}/prices`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.prices ?? [];
  } catch {
    return [];
  }
}

export async function voteOnPrice(
  reportId: number,
  vote: "up" | "down"
): Promise<{ ok: boolean; upvotes?: number; downvotes?: number }> {
  try {
    const res = await fetch(`${BASE}/prices/${reportId}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vote }),
    });
    const data = await res.json();
    return res.ok ? { ok: true, ...data } : { ok: false };
  } catch {
    return { ok: false };
  }
}
