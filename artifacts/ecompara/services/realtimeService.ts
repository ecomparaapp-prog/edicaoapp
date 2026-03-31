import { io, type Socket } from "socket.io-client";
import { getApiBaseUrl } from "@/lib/apiBaseUrl";

export type RealtimeEventType =
  | "price:updated"
  | "csv:import:started"
  | "csv:import:progress"
  | "csv:import:complete"
  | "csv:import:error"
  | "plan:changed"
  | "session:invalidated"
  | "bi:refresh";

export interface RealtimeEvent {
  type: RealtimeEventType;
  payload: Record<string, unknown>;
  timestamp: number;
}

type EventListener = (event: RealtimeEvent) => void;

class RealtimeService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<EventListener>> = new Map();
  private merchantId: number | null = null;

  connect(merchantId: number, token: string) {
    if (this.socket?.connected && this.merchantId === merchantId) return;

    this.disconnect();
    this.merchantId = merchantId;

    const baseUrl = getApiBaseUrl().replace("/api", "");

    this.socket = io(baseUrl, {
      auth: { merchantId, token },
      transports: ["websocket", "polling"],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    this.socket.on("connect", () => {
      this.socket?.emit("join:merchant", merchantId);
      this.emit("connected", { merchantId } as unknown as RealtimeEvent);
    });

    this.socket.on("disconnect", () => {
      this.emit("disconnected", {} as unknown as RealtimeEvent);
    });

    this.socket.on("event", (event: RealtimeEvent) => {
      this.emit(event.type, event);
      this.emit("*", event);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
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
    return this.socket?.connected ?? false;
  }
}

export const realtimeService = new RealtimeService();
