import { getApiBaseUrl } from "@/lib/apiBaseUrl";

const BASE = getApiBaseUrl();

export interface UserProfile {
  userId: string;
  nickname: string;
  fullName: string | null;
  cpf: string | null;
  phone: string | null;
  address: string | null;
  pixKey: string | null;
  fullNameLocked: boolean;
  cpfLocked: boolean;
  profileBonusAwarded: boolean;
  isComplete: boolean;
}

export interface SaveProfileResult extends UserProfile {
  bonusAwarded: boolean;
  bonusPoints: number;
}

export async function fetchProfile(userId: string): Promise<UserProfile | null> {
  try {
    const res = await fetch(`${BASE}/profile/${userId}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    return null;
  }
}

export async function checkNickname(
  nickname: string,
  userId: string,
): Promise<{ available: boolean; suggestion: string | null }> {
  try {
    const params = new URLSearchParams({ nickname, userId });
    const res = await fetch(`${BASE}/profile/check-nickname?${params}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { available: false, suggestion: null };
    return await res.json();
  } catch {
    return { available: true, suggestion: null };
  }
}

export async function saveProfile(
  userId: string,
  data: Omit<UserProfile, "userId" | "fullNameLocked" | "cpfLocked" | "profileBonusAwarded" | "isComplete">,
): Promise<{ ok: true; profile: SaveProfileResult } | { ok: false; error: string; suggestion?: string }> {
  try {
    const res = await fetch(`${BASE}/profile/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(10000),
    });
    const json = await res.json();
    if (res.status === 409) {
      return { ok: false, error: json.error, suggestion: json.suggestion };
    }
    if (!res.ok) {
      return { ok: false, error: json.error ?? "Erro ao salvar." };
    }
    return { ok: true, profile: json };
  } catch {
    return { ok: false, error: "Sem conexão com o servidor." };
  }
}
