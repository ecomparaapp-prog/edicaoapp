import { getApiBaseUrl } from "@/lib/apiBaseUrl";

const BASE = getApiBaseUrl();

export interface PointsHistoryEntry {
  id: string;
  action: string;
  actionType: string;
  points: number;
  icon: string;
  referenceId: string | null;
  metadata: Record<string, unknown> | null;
  date: string;
  rawDate: string;
}

export interface PointsTotals {
  totalPoints: number;
  weeklyPoints: number;
  transactionCount: number;
}

export async function fetchPointsHistory(userId: string): Promise<PointsHistoryEntry[]> {
  try {
    const res = await fetch(`${BASE}/points/history/${encodeURIComponent(userId)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.history ?? []).map((h: PointsHistoryEntry) => ({
      ...h,
      multiplier: buildMultiplier(h),
    }));
  } catch {
    return [];
  }
}

export async function fetchPointsTotal(userId: string): Promise<PointsTotals | null> {
  try {
    const res = await fetch(`${BASE}/points/total/${encodeURIComponent(userId)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function buildMultiplier(entry: PointsHistoryEntry): string | undefined {
  if (entry.actionType === "nfce" && entry.metadata) {
    return (entry.metadata.bonus as string | null) ?? undefined;
  }
  return undefined;
}
