import { useEffect, useRef, useState, useCallback } from "react";
import { realtimeService, type RealtimeEventType, type RealtimeEvent } from "@/services/realtimeService";

export function useRealtimeStatus() {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const offConn = realtimeService.on("connected", () => setIsConnected(true));
    const offDisc = realtimeService.on("disconnected", () => setIsConnected(false));
    setIsConnected(realtimeService.isConnected);
    return () => { offConn(); offDisc(); };
  }, []);

  return isConnected;
}

export function useRealtimeEvent(
  eventType: RealtimeEventType | "*",
  handler: (event: RealtimeEvent) => void,
  deps: unknown[] = []
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const off = realtimeService.on(eventType, (evt) => handlerRef.current(evt));
    return off;
  }, [eventType, ...deps]);
}

export function useCSVImportProgress() {
  const [progress, setProgress] = useState<{
    status: "idle" | "started" | "running" | "complete" | "error";
    processed: number;
    total: number;
    errors: number;
    message: string;
  }>({ status: "idle", processed: 0, total: 0, errors: 0, message: "" });

  useRealtimeEvent("csv:import:started", (evt) => {
    setProgress({ status: "started", processed: 0, total: Number(evt.payload.total) || 0, errors: 0, message: "Iniciando importacao..." });
  });

  useRealtimeEvent("csv:import:progress", (evt) => {
    setProgress((p) => ({
      ...p,
      status: "running",
      processed: Number(evt.payload.processed) || 0,
      total: Number(evt.payload.total) || p.total,
      errors: Number(evt.payload.errors) || 0,
      message: `Processando ${evt.payload.processed}/${evt.payload.total}...`,
    }));
  });

  useRealtimeEvent("csv:import:complete", (evt) => {
    setProgress((p) => ({
      ...p,
      status: "complete",
      processed: Number(evt.payload.processed) || p.total,
      message: String(evt.payload.message) || "Importacao concluida!",
    }));
  });

  useRealtimeEvent("csv:import:error", (evt) => {
    setProgress((p) => ({
      ...p,
      status: "error",
      message: String(evt.payload.message) || "Erro na importacao.",
    }));
  });

  const reset = useCallback(() => {
    setProgress({ status: "idle", processed: 0, total: 0, errors: 0, message: "" });
  }, []);

  return { progress, reset };
}
