import { Platform } from "react-native";
import Constants from "expo-constants";

export interface CosmosProduct {
  ean: string;
  description: string;
  brand: string | null;
  category: string | null;
  thumbnailUrl: string | null;
}

export interface EanLookupResult {
  found: boolean;
  source?: "cache" | "cosmos";
  stale?: boolean;
  product?: CosmosProduct;
  ean?: string;
  error?: string;
}

export interface ProductSearchResult {
  products: CosmosProduct[];
}

function getApiBaseUrl(): string {
  const domain = Constants.expoConfig?.extra?.domain
    || process.env.EXPO_PUBLIC_DOMAIN
    || "";

  if (Platform.OS === "web") {
    return "/api";
  }

  if (domain) {
    return `https://${domain}/api`;
  }

  return "http://localhost:80/api";
}

export async function lookupEAN(ean: string): Promise<EanLookupResult> {
  const base = getApiBaseUrl();
  const url = `${base}/products/ean/${ean}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const body: { error?: string } = await res.json().catch(() => ({}));
      return { found: false, ean, error: body.error || `HTTP ${res.status}` };
    }

    return await res.json();
  } catch (err: unknown) {
    clearTimeout(timeout);
    const isAbort = err instanceof Error && err.name === "AbortError";
    if (isAbort) {
      return { found: false, ean, error: "Tempo esgotado. Tente novamente." };
    }
    return { found: false, ean, error: "Erro de conexão com o servidor." };
  }
}

export async function searchProducts(query: string): Promise<CosmosProduct[]> {
  if (!query || query.trim().length < 2) return [];

  const base = getApiBaseUrl();
  const url = `${base}/products/search?q=${encodeURIComponent(query.trim())}`;

  try {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return [];

    const data: ProductSearchResult = await res.json();
    return data.products || [];
  } catch {
    return [];
  }
}
