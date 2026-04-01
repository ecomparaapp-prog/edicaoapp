import { Router } from "express";
import { db } from "@workspace/db";
import { campaignsTable, merchantUsersTable } from "@workspace/db/schema";
import { eq, and, count } from "drizzle-orm";
import { merchantAuthMiddleware } from "./merchant-auth";
import { emitCampaignChanged } from "../websocket";

const campaignsRouter = Router();

campaignsRouter.use("/campaigns", merchantAuthMiddleware);

const NORMAL_MAX_ACTIVE = 1;

async function getMerchantPlan(merchantUserId: number): Promise<"normal" | "plus"> {
  const [u] = await db.select({ plan: merchantUsersTable.plan }).from(merchantUsersTable).where(eq(merchantUsersTable.id, merchantUserId));
  return (u?.plan as "normal" | "plus") ?? "normal";
}

// ── GET /api/campaigns ─────────────────────────────────────────────────────────
campaignsRouter.get("/campaigns", async (req, res) => {
  const uid: number = (req as any).merchantUserId;
  const rows = await db
    .select()
    .from(campaignsTable)
    .where(eq(campaignsTable.merchantUserId, uid))
    .orderBy(campaignsTable.createdAt);
  res.json({ campaigns: rows.reverse() });
});

// ── POST /api/campaigns ────────────────────────────────────────────────────────
campaignsRouter.post("/campaigns", async (req, res) => {
  const uid: number = (req as any).merchantUserId;
  const { name, productEan, productName, campaignType, promotionalPrice, radius, budget, startDate, endDate } = req.body;

  if (!name?.trim()) {
    res.status(400).json({ error: "Nome da campanha é obrigatório." });
    return;
  }

  const plan = await getMerchantPlan(uid);

  if (plan === "normal") {
    const [{ value: activeCount }] = await db
      .select({ value: count() })
      .from(campaignsTable)
      .where(and(eq(campaignsTable.merchantUserId, uid), eq(campaignsTable.status, "active")));

    if (Number(activeCount) >= NORMAL_MAX_ACTIVE) {
      res.status(403).json({
        error: "limite_plano",
        message: "Seu plano atual permite 01 campanha ativa por vez. Para campanhas ilimitadas, faça o upgrade para o Plano Plus.",
      });
      return;
    }
  }

  const [created] = await db
    .insert(campaignsTable)
    .values({
      merchantUserId: uid,
      name: name.trim(),
      productEan: productEan || null,
      productName: productName?.trim() || null,
      campaignType: campaignType || "banner",
      promotionalPrice: promotionalPrice || null,
      radius: radius === 10 ? 10 : 5,
      budget: budget || "500",
      status: "active",
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : null,
    })
    .returning();

  emitCampaignChanged(uid, "created", created.id, { campaign: created });
  res.status(201).json({ campaign: created });
});

// ── PATCH /api/campaigns/:id ───────────────────────────────────────────────────
campaignsRouter.patch("/campaigns/:id", async (req, res) => {
  const uid: number = (req as any).merchantUserId;
  const id = parseInt(req.params.id);

  const [existing] = await db.select().from(campaignsTable).where(and(eq(campaignsTable.id, id), eq(campaignsTable.merchantUserId, uid)));
  if (!existing) {
    res.status(404).json({ error: "Campanha não encontrada." });
    return;
  }

  const { status, name, promotionalPrice, budget, endDate } = req.body;
  const updates: Partial<typeof campaignsTable.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (status && ["active", "paused", "ended"].includes(status)) {
    if (status === "active" && existing.status !== "active") {
      const plan = await getMerchantPlan(uid);
      if (plan === "normal") {
        const [{ value: activeCount }] = await db
          .select({ value: count() })
          .from(campaignsTable)
          .where(and(eq(campaignsTable.merchantUserId, uid), eq(campaignsTable.status, "active")));
        if (Number(activeCount) >= NORMAL_MAX_ACTIVE) {
          res.status(403).json({
            error: "limite_plano",
            message: "Seu plano atual permite 01 campanha ativa por vez. Para campanhas ilimitadas, faça o upgrade para o Plano Plus.",
          });
          return;
        }
      }
    }
    updates.status = status;
  }
  if (name?.trim()) updates.name = name.trim();
  if (promotionalPrice != null) updates.promotionalPrice = promotionalPrice;
  if (budget != null) updates.budget = budget;
  if (endDate != null) updates.endDate = endDate ? new Date(endDate) : null;

  const [updated] = await db.update(campaignsTable).set(updates).where(eq(campaignsTable.id, id)).returning();
  emitCampaignChanged(uid, "updated", id, { campaign: updated, status: updated.status });
  res.json({ campaign: updated });
});

// ── DELETE /api/campaigns/:id ──────────────────────────────────────────────────
campaignsRouter.delete("/campaigns/:id", async (req, res) => {
  const uid: number = (req as any).merchantUserId;
  const id = parseInt(req.params.id);

  const [existing] = await db.select({ id: campaignsTable.id }).from(campaignsTable).where(and(eq(campaignsTable.id, id), eq(campaignsTable.merchantUserId, uid)));
  if (!existing) {
    res.status(404).json({ error: "Campanha não encontrada." });
    return;
  }

  await db.delete(campaignsTable).where(eq(campaignsTable.id, id));
  emitCampaignChanged(uid, "deleted", id);
  res.json({ ok: true });
});

// ── GET /api/campaigns/stats ───────────────────────────────────────────────────
campaignsRouter.get("/campaigns/stats", async (req, res) => {
  const uid: number = (req as any).merchantUserId;
  const plan = await getMerchantPlan(uid);

  const [{ value: totalActive }] = await db
    .select({ value: count() })
    .from(campaignsTable)
    .where(and(eq(campaignsTable.merchantUserId, uid), eq(campaignsTable.status, "active")));

  const [{ value: totalAll }] = await db
    .select({ value: count() })
    .from(campaignsTable)
    .where(eq(campaignsTable.merchantUserId, uid));

  const canCreate = plan === "plus" || Number(totalActive) < NORMAL_MAX_ACTIVE;

  res.json({
    plan,
    totalActive: Number(totalActive),
    totalAll: Number(totalAll),
    canCreate,
    limit: plan === "plus" ? null : NORMAL_MAX_ACTIVE,
    cashbackAvailable: plan === "plus" ? 100.0 : null,
  });
});

export default campaignsRouter;
