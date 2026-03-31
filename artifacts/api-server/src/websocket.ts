import { Server as HttpServer } from "http";
import { Server as SocketIOServer, type Socket } from "socket.io";

let io: SocketIOServer | null = null;

export function initWebSocket(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) { callback(null, true); return; }
        if (
          origin.endsWith(".replit.dev") ||
          origin.endsWith(".repl.co") ||
          origin.endsWith(".replit.app") ||
          origin === "http://localhost" ||
          origin.startsWith("http://localhost:")
        ) {
          callback(null, true);
          return;
        }
        callback(new Error("Not allowed by CORS"));
      },
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket: Socket) => {
    const merchantId = socket.handshake.auth?.merchantId;
    if (merchantId) {
      socket.join(`merchant:${merchantId}`);
    }

    socket.on("join:merchant", (id: number) => {
      socket.join(`merchant:${id}`);
    });

    socket.on("disconnect", () => {});
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) throw new Error("WebSocket not initialized");
  return io;
}

// ── Event Emitters ─────────────────────────────────────────────────────────────

export type WSEventType =
  | "price:updated"
  | "csv:import:started"
  | "csv:import:progress"
  | "csv:import:complete"
  | "csv:import:error"
  | "plan:changed"
  | "session:invalidated"
  | "bi:refresh";

export interface WSEvent {
  type: WSEventType;
  payload: Record<string, unknown>;
  timestamp: number;
}

function emit(room: string, event: WSEvent) {
  if (!io) return;
  io.to(room).emit("event", event);
}

function broadcast(event: WSEvent) {
  if (!io) return;
  io.emit("event", event);
}

export function emitToMerchant(merchantId: number, type: WSEventType, payload: Record<string, unknown>) {
  emit(`merchant:${merchantId}`, {
    type,
    payload,
    timestamp: Date.now(),
  });
}

export function emitPriceUpdated(merchantId: number, data: {
  ean: string;
  placeId: string;
  storeName?: string;
  newPrice: number;
  oldPrice?: number;
}) {
  emitToMerchant(merchantId, "price:updated", data);
  emitToMerchant(merchantId, "bi:refresh", { reason: "price_update" });
}

export function emitCSVProgress(merchantId: number, data: {
  status: "started" | "progress" | "complete" | "error";
  processed?: number;
  total?: number;
  errors?: number;
  message?: string;
}) {
  const typeMap = {
    started: "csv:import:started",
    progress: "csv:import:progress",
    complete: "csv:import:complete",
    error: "csv:import:error",
  } as const;
  emitToMerchant(merchantId, typeMap[data.status], data as Record<string, unknown>);
  if (data.status === "complete") {
    emitToMerchant(merchantId, "bi:refresh", { reason: "csv_import" });
  }
}

export function emitPlanChanged(merchantId: number, newPlan: string) {
  emitToMerchant(merchantId, "plan:changed", { plan: newPlan });
  emitToMerchant(merchantId, "bi:refresh", { reason: "plan_changed" });
}

export function emitSessionInvalidated(merchantId: number) {
  emitToMerchant(merchantId, "session:invalidated", { reason: "password_changed" });
}
