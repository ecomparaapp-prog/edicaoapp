import { getApiBaseUrl } from "@/lib/apiBaseUrl";

const BASE = getApiBaseUrl();

export interface WeeklyWinnerEntry {
  id: number;
  weekStart: string;
  rank: number;
  weeklyPoints: number;
  prizeAmount: number;
  status: "pending" | "claimed" | "paid" | "expired";
  claimedAt: string | null;
}

export interface MyPrizesResult {
  hasPrize: boolean;
  winner: WeeklyWinnerEntry | null;
}

export async function fetchMyPrizes(userId: string): Promise<MyPrizesResult> {
  try {
    const res = await fetch(`${BASE}/prizes/my-prizes?userId=${encodeURIComponent(userId)}`);
    if (!res.ok) return { hasPrize: false, winner: null };
    return await res.json();
  } catch {
    return { hasPrize: false, winner: null };
  }
}

export async function redeemPrize(userId: string, winnerId: number, pixKey: string): Promise<{ ok: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch(`${BASE}/prizes/redeem`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, winnerId, pixKey }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error ?? "Erro ao resgatar prêmio." };
    return { ok: true, message: data.message };
  } catch {
    return { ok: false, error: "Erro de conexão. Tente novamente." };
  }
}

/** Returns { days, hours, minutes } until next Friday 00:00 BRT (UTC-3) */
export function getCountdownToFriday(): { days: number; hours: number; minutes: number } {
  const now = new Date();
  // Convert to BRT (UTC-3)
  const brtOffset = -3 * 60;
  const brtNow = new Date(now.getTime() + (brtOffset - (-now.getTimezoneOffset())) * 60000);

  const day = brtNow.getDay(); // 0=Sun, 5=Fri
  const daysUntilFriday = (5 - day + 7) % 7 || 7; // days until next Friday (never 0)

  const nextFriday = new Date(brtNow);
  nextFriday.setDate(brtNow.getDate() + daysUntilFriday);
  nextFriday.setHours(0, 0, 0, 0);

  const diff = nextFriday.getTime() - brtNow.getTime();
  const totalMins = Math.floor(diff / 60000);
  const days = Math.floor(totalMins / (60 * 24));
  const hours = Math.floor((totalMins % (60 * 24)) / 60);
  const minutes = totalMins % 60;

  return { days, hours, minutes };
}
