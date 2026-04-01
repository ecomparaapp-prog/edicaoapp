import { getApiBaseUrl } from "@/lib/apiBaseUrl";

export type AlertType =
  | "price_divergence"
  | "ranking_drop"
  | "price_report"
  | "plan_expiry"
  | "nps_negative"
  | "stock_rupture"
  | "competitiveness"
  | "new_follower"
  | "nfce_validated";

export type AlertStatus = "PENDING" | "IN_PROGRESS" | "RESOLVED";
export type AlertPriority = "high" | "medium" | "low";

export interface MerchantAlert {
  id: number;
  merchant_user_id: number;
  type: AlertType;
  status: AlertStatus;
  priority: AlertPriority;
  title: string;
  description: string;
  metadata: Record<string, unknown>;
  resolved_by: string | null;
  resolved_at: string | null;
  action_note: string | null;
  created_at: string;
  updated_at: string;
}

const base = () => `${getApiBaseUrl()}api`;

export async function fetchAlerts(token: string, status?: string): Promise<{ alerts: MerchantAlert[]; pendingCount: number }> {
  const url = status ? `${base()}/merchant/alerts?status=${status}` : `${base()}/merchant/alerts`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error("Erro ao buscar alertas");
  return r.json();
}

export async function fetchAlertCount(token: string): Promise<number> {
  const r = await fetch(`${base()}/merchant/alerts/count`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return 0;
  const data = await r.json();
  return data.count ?? 0;
}

export async function updateAlertStatus(
  token: string,
  alertId: number,
  status: AlertStatus
): Promise<{ alert: MerchantAlert; pendingCount: number }> {
  const r = await fetch(`${base()}/merchant/alerts/${alertId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.error || "Erro ao atualizar status");
  }
  return r.json();
}

export async function resolveAlert(
  token: string,
  alertId: number,
  body: { actionNote?: string; newPrice?: number; ean?: string }
): Promise<{ alert: MerchantAlert; pendingCount: number }> {
  const r = await fetch(`${base()}/merchant/alerts/${alertId}/resolve`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.error || "Erro ao resolver alerta");
  }
  return r.json();
}

export async function seedAlerts(token: string): Promise<void> {
  await fetch(`${base()}/merchant/alerts/seed`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {});
}
