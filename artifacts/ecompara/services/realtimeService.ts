import { getApiBaseUrl } from "@/lib/apiBaseUrl";

export type RealtimeEventType =
  | "price:updated"
  | "csv:import:started"
  | "csv:import:progress"
  | "csv:import:complete"
  | "csv:import:error"
  | "plan:changed"
  | "session:invalidated"
  | "bi:refresh"
  | "campaign:changed";

export interface RealtimeEvent {
  type: RealtimeEventType;
  payload: Record<string, unknown>;
  timestamp: number;
}

type EventListener = (event: RealtimeEvent) => void;

class RealtimeService {
  private listeners: Map<string, Set<EventListener>> = new Map();
  private merchantId: number | null = null;
  private _connected = false;
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  connect(merchantId: number, token: string) {
    if (this._connected && this.merchantId === merchantId) return;
    this.disconnect();
    this.merchantId = merchantId;
    this._connected = true;
    this.emit("connected", { type: "price:updated", payload: { merchantId }, timestamp: Date.now() });

    this.pollInterval = setInterval(() => {
      this.poll(merchantId, token);
    }, 30_000);
  }

  private async poll(merchantId: number, token: string) {
    try {
      const base = getApiBaseUrl();
      const res = await fetch(`${base}/realtime/events?merchantId=${merchantId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const events: RealtimeEvent[] = await res.json();
      events.forEach((e) => { this.emit(e.type, e); this.emit("*", e); });
    } catch {
      // silent — network unavailable or endpoint not implemented
    }
  }

  disconnect() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this._connected) {
      this._connected = false;
      this.emit("disconnected", { type: "price:updated", payload: {}, timestamp: Date.now() });
    }
    this.merchantId = null;
  }

  on(eventType: RealtimeEventType | "connected" | "disconnected" | "*", listener: EventListener) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener);
    return () => this.off(eventType, listener);
  }

  off(eventType: string, listener: EventListener) {
    this.listeners.get(eventType)?.delete(listener);
  }

  private emit(eventType: string, event: RealtimeEvent) {
    this.listeners.get(eventType)?.forEach((l) => {
      try { l(event); } catch {}
    });
  }

  get isConnected() {
    return this._connected;
  }
}

export const realtimeService = new RealtimeService();
