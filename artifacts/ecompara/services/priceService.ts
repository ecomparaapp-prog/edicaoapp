import { Platform } from "react-native";
import Constants from "expo-constants";

function getApiBaseUrl(): string {
  const domain =
    Constants.expoConfig?.extra?.domain ?? process.env.EXPO_PUBLIC_DOMAIN ?? "";
  if (Platform.OS === "web") return "/api";
  if (domain) return `https://${domain}/api`;
  return "http://localhost:80/api";
}

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
  productName: string;
  brand: string | null;
  thumbnailUrl: string | null;
}

export interface SubmitPriceResult {
  ok: boolean;
  reportId?: number;
  bonusPoints?: number;
  error?: string;
}

export async function submitPrice(
  ean: string,
  placeId: string,
  userId: string,
  price: number
): Promise<SubmitPriceResult> {
  try {
    const res = await fetch(`${BASE}/prices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ean, placeId, userId, price }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error ?? "Erro ao enviar preço." };
    return { ok: true, reportId: data.reportId, bonusPoints: data.bonusPoints };
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
