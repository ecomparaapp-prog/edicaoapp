import { Router } from "express";
import { db } from "@workspace/db";
import {
  searchZonesTable,
  partnershipRequestsTable,
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { syncZone, getCreditStatus } from "../services/placesSync";

const adminRouter = Router();

adminRouter.get("/admin/zones", async (_req, res) => {
  try {
    const zones = await db.select().from(searchZonesTable).orderBy(searchZonesTable.id);
    res.json({ zones });
  } catch (err) {
    console.error("GET /admin/zones error:", err);
    res.status(500).json({ error: "Erro ao listar zonas." });
  }
});

adminRouter.post("/admin/zones", async (req, res) => {
  const { name, lat, lng, radius_km } = req.body as {
    name?: string;
    lat?: number;
    lng?: number;
    radius_km?: number;
  };

  if (!name || lat == null || lng == null) {
    res.status(400).json({ error: "Campos obrigatórios: name, lat, lng." });
    return;
  }

  try {
    const [zone] = await db
      .insert(searchZonesTable)
      .values({
        name,
        lat: Number(lat),
        lng: Number(lng),
        radiusKm: Number(radius_km ?? 5),
        active: true,
      })
      .returning();

    let syncResult = null;
    try {
      syncResult = await syncZone(zone);
    } catch (syncErr) {
      console.error("Auto-sync after zone creation failed:", syncErr);
    }

    res.status(201).json({ zone, syncResult });
  } catch (err) {
    console.error("POST /admin/zones error:", err);
    res.status(500).json({ error: "Erro ao criar zona." });
  }
});

adminRouter.delete("/admin/zones/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido." });
    return;
  }

  try {
    await db.delete(searchZonesTable).where(eq(searchZonesTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /admin/zones/:id error:", err);
    res.status(500).json({ error: "Erro ao remover zona." });
  }
});

adminRouter.post("/admin/zones/:id/sync", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido." });
    return;
  }

  try {
    const zones = await db
      .select()
      .from(searchZonesTable)
      .where(eq(searchZonesTable.id, id))
      .limit(1);

    if (zones.length === 0) {
      res.status(404).json({ error: "Zona não encontrada." });
      return;
    }

    const result = await syncZone(zones[0]);
    res.json(result);
  } catch (err) {
    console.error("POST /admin/zones/:id/sync error:", err);
    res.status(500).json({ error: "Erro ao sincronizar zona." });
  }
});

adminRouter.get("/admin/credit", async (_req, res) => {
  try {
    const status = await getCreditStatus();
    const limit = parseInt(process.env.PLACES_MONTHLY_CALL_LIMIT ?? "200", 10);
    const threshold = Math.floor(limit * 0.8);
    res.json({
      ...status,
      limit,
      threshold,
      percentUsed: Math.round((status.callsCount / limit) * 100),
    });
  } catch (err) {
    console.error("GET /admin/credit error:", err);
    res.status(500).json({ error: "Erro ao obter status de crédito." });
  }
});

adminRouter.get("/admin/partnerships", async (_req, res) => {
  try {
    const requests = await db
      .select()
      .from(partnershipRequestsTable)
      .orderBy(partnershipRequestsTable.createdAt);
    res.json({ requests });
  } catch (err) {
    console.error("GET /admin/partnerships error:", err);
    res.status(500).json({ error: "Erro ao listar pedidos." });
  }
});

export default adminRouter;
