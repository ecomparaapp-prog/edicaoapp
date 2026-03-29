import { Router } from "express";
import { db, pool } from "@workspace/db";
import {
  searchZonesTable,
  partnershipRequestsTable,
  merchantRegistrationsTable,
} from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { syncZone, getCreditStatus } from "../services/placesSync";
import {
  getAllConfigStatus,
  setConfig,
  deleteConfig,
  CONFIGURABLE_KEYS,
  type ConfigKey,
} from "../services/configService";

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

// ── Merchant Registrations ────────────────────────────────────────────────────

adminRouter.get("/admin/merchant-registrations", async (req, res) => {
  const { status } = req.query as { status?: string };
  try {
    const rows = await db
      .select()
      .from(merchantRegistrationsTable)
      .orderBy(desc(merchantRegistrationsTable.createdAt));

    const filtered = status
      ? rows.filter((r) => r.status === status)
      : rows;

    res.json({ registrations: filtered });
  } catch (err) {
    console.error("GET /admin/merchant-registrations error:", err);
    res.status(500).json({ error: "Erro ao listar cadastros." });
  }
});

adminRouter.post("/admin/merchant-registrations/:id/approve", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido." }); return; }

  try {
    await db
      .update(merchantRegistrationsTable)
      .set({ status: "approved", adminNote: req.body.note ?? null, updatedAt: new Date() })
      .where(eq(merchantRegistrationsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    console.error("POST /admin/merchant-registrations/:id/approve error:", err);
    res.status(500).json({ error: "Erro ao aprovar cadastro." });
  }
});

adminRouter.post("/admin/merchant-registrations/:id/reject", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido." }); return; }

  try {
    await db
      .update(merchantRegistrationsTable)
      .set({ status: "rejected", adminNote: req.body.note ?? null, updatedAt: new Date() })
      .where(eq(merchantRegistrationsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    console.error("POST /admin/merchant-registrations/:id/reject error:", err);
    res.status(500).json({ error: "Erro ao rejeitar cadastro." });
  }
});

// ── App Config / Secrets ─────────────────────────────────────────────────────

adminRouter.get("/admin/config", async (_req, res) => {
  try {
    const configs = await getAllConfigStatus();
    res.json({ configs });
  } catch (err) {
    console.error("GET /admin/config error:", err);
    res.status(500).json({ error: "Erro ao obter configurações." });
  }
});

adminRouter.put("/admin/config/:key", async (req, res) => {
  const key = req.params.key as ConfigKey;
  if (!(CONFIGURABLE_KEYS as readonly string[]).includes(key)) {
    res.status(400).json({ error: "Chave de configuração inválida." });
    return;
  }
  const { value } = req.body as { value?: string };
  if (!value || !value.trim()) {
    res.status(400).json({ error: "Valor não pode ser vazio." });
    return;
  }
  try {
    await setConfig(key, value.trim());
    res.json({ ok: true });
  } catch (err) {
    console.error(`PUT /admin/config/${key} error:`, err);
    res.status(500).json({ error: "Erro ao salvar configuração." });
  }
});

adminRouter.delete("/admin/config/:key", async (req, res) => {
  const key = req.params.key as ConfigKey;
  if (!(CONFIGURABLE_KEYS as readonly string[]).includes(key)) {
    res.status(400).json({ error: "Chave de configuração inválida." });
    return;
  }
  try {
    await deleteConfig(key);
    res.json({ ok: true });
  } catch (err) {
    console.error(`DELETE /admin/config/${key} error:`, err);
    res.status(500).json({ error: "Erro ao remover configuração do banco." });
  }
});

// ── Points Config ─────────────────────────────────────────────────────────────

adminRouter.get("/admin/points-config", async (_req, res) => {
  const client = await pool.connect();
  try {
    const current = await client.query(
      `SELECT action AS key, points AS value, label FROM current_points_config ORDER BY action`
    );
    const pending = await client.query(
      `SELECT action AS key, points AS value, label FROM pending_points_config ORDER BY action`
    );
    // Only return pending rows that differ from current
    const currentMap: Record<string, number> = {};
    for (const row of current.rows) currentMap[row.key] = Number(row.value);
    const pendingFiltered = pending.rows.filter(
      (p) => Number(p.value) !== currentMap[p.key]
    );
    res.json({ current: current.rows, pending: pendingFiltered });
  } catch (err) {
    console.error("GET /admin/points-config error:", err);
    res.status(500).json({ error: "Erro ao carregar configuração de pontos." });
  } finally {
    client.release();
  }
});

adminRouter.put("/admin/points-config", async (req, res) => {
  const { key, value, applyNow } = req.body as { key?: string; value?: number; applyNow?: boolean };
  if (!key || value == null || typeof value !== "number" || value < 0) {
    res.status(400).json({ error: "Parâmetros inválidos." });
    return;
  }
  const client = await pool.connect();
  try {
    if (applyNow) {
      await client.query(
        `UPDATE current_points_config SET points = $1, updated_at = NOW() WHERE action = $2`,
        [value, key]
      );
      // Also update pending so they stay in sync
      await client.query(
        `UPDATE pending_points_config SET points = $1, updated_at = NOW() WHERE action = $2`,
        [value, key]
      );
    } else {
      await client.query(
        `INSERT INTO pending_points_config (action, points, label, updated_by, updated_at)
         SELECT action, $1, label, 'admin', NOW() FROM current_points_config WHERE action = $2
         ON CONFLICT (action) DO UPDATE SET points = $1, updated_at = NOW(), updated_by = 'admin'`,
        [value, key]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("PUT /admin/points-config error:", err);
    res.status(500).json({ error: "Erro ao salvar configuração de pontos." });
  } finally {
    client.release();
  }
});

adminRouter.delete("/admin/points-config/pending/:key", async (req, res) => {
  const key = req.params.key;
  const client = await pool.connect();
  try {
    // Reset pending to match current (cancel the pending change)
    await client.query(
      `UPDATE pending_points_config p
         SET points = c.points, updated_at = NOW(), updated_by = 'admin'
         FROM current_points_config c
         WHERE p.action = c.action AND p.action = $1`,
      [key]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(`DELETE /admin/points-config/pending/${key} error:`, err);
    res.status(500).json({ error: "Erro ao cancelar alteração pendente." });
  } finally {
    client.release();
  }
});

export default adminRouter;
