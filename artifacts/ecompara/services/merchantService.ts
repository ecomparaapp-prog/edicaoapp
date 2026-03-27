import { getApiBaseUrl } from "@/lib/apiBaseUrl";

export interface CnpjLookupResult {
  cnpj: string;
  situacao: string;
  razaoSocial: string;
  nomeFantasia: string;
  cep: string;
  address: string;
  phone: string;
}

export async function lookupCNPJ(
  cnpj: string,
): Promise<{ data?: CnpjLookupResult; error?: string }> {
  const clean = cnpj.replace(/\D/g, "");
  const base = getApiBaseUrl();
  try {
    const res = await fetch(`${base}/merchants/cnpj/${clean}`, {
      signal: AbortSignal.timeout(12000),
    });
    const json = await res.json() as CnpjLookupResult & { error?: string };
    if (!res.ok) return { error: json.error ?? "Erro ao consultar CNPJ." };
    return { data: json };
  } catch {
    return { error: "Sem conexão. Verifique sua internet." };
  }
}

export interface DayHours {
  open: string;
  close: string;
  closed: boolean;
}

export interface OperatingHours {
  monday: DayHours;
  tuesday: DayHours;
  wednesday: DayHours;
  thursday: DayHours;
  friday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
  holidays: DayHours;
}

export interface MerchantRegistrationPayload {
  googlePlaceId?: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  inscricaoEstadual?: string;
  cep?: string;
  address?: string;
  lat?: number;
  lng?: number;
  operatingHours?: OperatingHours;
  phone?: string;
  whatsapp?: string;
  parking?: "none" | "free" | "paid";
  cardBrands?: string[];
  delivery?: "none" | "own" | "app";
  logoUrl?: string;
  verificationMethod: "email" | "phone";
  verificationContact: string;
}

export async function registerMerchant(
  payload: MerchantRegistrationPayload,
): Promise<{ registrationId?: number; devCode?: string; error?: string }> {
  const base = getApiBaseUrl();
  try {
    const res = await fetch(`${base}/merchants/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
    const json = await res.json() as {
      ok?: boolean;
      registrationId?: number;
      _devCode?: string;
      error?: string;
    };
    if (!res.ok) return { error: json.error ?? "Erro ao enviar cadastro." };
    return { registrationId: json.registrationId, devCode: json._devCode };
  } catch {
    return { error: "Sem conexão. Verifique sua internet." };
  }
}

export async function verifyMerchantCode(
  registrationId: number,
  code: string,
): Promise<{ ok?: boolean; message?: string; error?: string }> {
  const base = getApiBaseUrl();
  try {
    const res = await fetch(`${base}/merchants/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ registrationId, code }),
      signal: AbortSignal.timeout(10000),
    });
    const json = await res.json() as { ok?: boolean; message?: string; error?: string };
    if (!res.ok) return { error: json.error ?? "Erro ao verificar código." };
    return { ok: true, message: json.message };
  } catch {
    return { error: "Sem conexão. Verifique sua internet." };
  }
}

export async function resendVerificationCode(
  registrationId: number,
): Promise<{ ok?: boolean; devCode?: string; error?: string }> {
  const base = getApiBaseUrl();
  try {
    const res = await fetch(`${base}/merchants/resend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ registrationId }),
      signal: AbortSignal.timeout(10000),
    });
    const json = await res.json() as { ok?: boolean; _devCode?: string; error?: string };
    if (!res.ok) return { error: json.error ?? "Erro ao reenviar código." };
    return { ok: true, devCode: json._devCode };
  } catch {
    return { error: "Sem conexão. Verifique sua internet." };
  }
}
