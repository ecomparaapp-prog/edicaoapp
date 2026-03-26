import { Platform } from "react-native";
import Constants from "expo-constants";

function getApiBaseUrl(): string {
  const domain =
    Constants.expoConfig?.extra?.domain ?? process.env.EXPO_PUBLIC_DOMAIN ?? "";
  if (Platform.OS === "web") return "/api";
  if (domain) return `https://${domain}/api`;
  return "http://localhost:80/api";
}

export interface NfceItem {
  ean: string;
  name: string;
  qty: number;
  unit: string;
  price: number;
}

export interface NfceCustomerResult {
  points: number;
  itemCount: number;
  storeName: string;
  cnpj: string;
  totalValue: number;
  bonus: boolean;
  stateCode?: string;
  stateName?: string;
  model?: string;
}

export interface NfceMerchantResult {
  cnpj: string;
  storeName: string;
  docNumber: string;
  items: NfceItem[];
  totalValue: number;
  itemCount: number;
  processedAt: string;
  alreadyProcessed?: boolean;
}

export interface NfceValidateResult {
  ok: boolean;
  duplicate: boolean;
  error?: string;
  customer?: NfceCustomerResult;
  merchant?: NfceMerchantResult;
  system?: {
    priceReports: { id: number; ean: string }[];
    placeId: string;
  };
}

/**
 * Validate an NF-e / NFC-e access key against the backend.
 * The backend handles:
 *  - Duplicate detection (DB-backed, cross-user)
 *  - CNPJ lookup via ReceitaWS
 *  - Price report insertion per item
 *  - Points calculation (150 pts base, 2x if >10 items, 1.2x on weekends)
 *
 * @param chaveAcesso  44-digit access key
 * @param userId       Authenticated user ID
 * @param placeId      Google Place ID of the store (optional)
 * @param items        Items array from QR code scan (optional)
 */
export async function validateNfce(
  chaveAcesso: string,
  userId: string,
  placeId?: string,
  items?: NfceItem[],
): Promise<NfceValidateResult> {
  const base = getApiBaseUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(`${base}/nfce/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({ chaveAcesso, userId, placeId, items }),
    });

    clearTimeout(timeout);
    const data = await res.json() as NfceValidateResult;

    if (!res.ok) {
      return {
        ok: false,
        duplicate: false,
        error: data.error ?? `Erro ${res.status}`,
      };
    }

    return data;
  } catch (err: unknown) {
    clearTimeout(timeout);
    const isAbort = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      duplicate: false,
      error: isAbort
        ? "Tempo esgotado. Verifique sua conexão."
        : "Sem conexão com o servidor.",
    };
  }
}

/**
 * Check if an access key was already processed (quick pre-check).
 */
export async function checkNfceDuplicate(chaveAcesso: string): Promise<boolean> {
  const base = getApiBaseUrl();
  try {
    const res = await fetch(`${base}/nfce/${chaveAcesso}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return false;
    const data = await res.json() as { found: boolean };
    return data.found;
  } catch {
    return false;
  }
}

/**
 * Fetch purchase analytics for a merchant by CNPJ (for the merchant dashboard).
 */
export async function fetchMerchantNfceStats(cnpj: string): Promise<{
  totalPurchases: number;
  totalItemsIndexed: number;
  totalRevenue: string;
  records: { id: number; docNumber: string | null; itemCount: number | null; totalValue: string | null; processedAt: string }[];
} | null> {
  const base = getApiBaseUrl();
  const cleanCnpj = cnpj.replace(/\D/g, "");
  try {
    const res = await fetch(`${base}/nfce/merchant/${cleanCnpj}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
