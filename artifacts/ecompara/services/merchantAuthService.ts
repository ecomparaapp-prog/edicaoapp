import { getApiBaseUrl } from "@/lib/apiBaseUrl";

export interface MerchantUser {
  id: number;
  email: string;
  name: string;
  registrationId: number;
  mustChangePassword: boolean;
}

export interface MerchantRegistration {
  id: number;
  cnpj: string;
  storeName: string;
  address: string;
  phone: string;
  plan: "normal" | "plus";
  status: string;
}

export interface MerchantSession {
  token: string;
  merchantUser: MerchantUser;
  registration: MerchantRegistration;
}

export async function apiMerchantLogin(
  email: string,
  password: string
): Promise<{ ok: boolean; session?: MerchantSession; error?: string }> {
  const base = getApiBaseUrl();
  try {
    const r = await fetch(`${base}/merchant/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await r.json();
    if (!r.ok) return { ok: false, error: data.error || "Credenciais inválidas." };
    return {
      ok: true,
      session: {
        token: data.token,
        merchantUser: data.merchantUser,
        registration: data.registration,
      },
    };
  } catch {
    return { ok: false, error: "Erro de conexão. Tente novamente." };
  }
}

export async function apiMerchantMe(token: string): Promise<MerchantSession | null> {
  const base = getApiBaseUrl();
  try {
    const r = await fetch(`${base}/merchant/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    const data = await r.json();
    return { token, merchantUser: data.merchantUser, registration: data.registration };
  } catch {
    return null;
  }
}
