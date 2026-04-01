import { Router } from "express";
import { db } from "@workspace/db";
import { merchantAlertsTable, merchantUsersTable } from "@workspace/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { merchantAuthMiddleware } from "./merchant-auth";
import { emitToMerchant } from "../websocket";

const router = Router();
router.use(merchantAuthMiddleware);

// ── GET /api/merchant/alerts ──────────────────────────────────────────────────
router.get("/merchant/alerts", async (req: any, res) => {
  const merchantUserId: number = req.merchantUserId;
  const { status } = req.query as { status?: string };

  try {
    const conditions = [eq(merchantAlertsTable.merchantUserId, merchantUserId)];
    if (status && ["PENDING", "IN_PROGRESS", "RESOLVED"].includes(status)) {
      conditions.push(eq(merchantAlertsTable.status, status as any));
    }

    const alerts = await db
      .select()
      .from(merchantAlertsTable)
      .where(and(...conditions))
      .orderBy(desc(merchantAlertsTable.createdAt));

    const pendingCount = alerts.filter((a) => a.status !== "RESOLVED").length;

    res.json({ ok: true, alerts, pendingCount });
  } catch (err) {
    console.error("Error fetching alerts:", err);
    res.status(500).json({ error: "Erro ao buscar alertas." });
  }
});

// ── GET /api/merchant/alerts/count ────────────────────────────────────────────
router.get("/merchant/alerts/count", async (req: any, res) => {
  const merchantUserId: number = req.merchantUserId;

  try {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(merchantAlertsTable)
      .where(
        and(
          eq(merchantAlertsTable.merchantUserId, merchantUserId),
          sql`${merchantAlertsTable.status} != 'RESOLVED'`
        )
      );
    res.json({ ok: true, count: row?.count ?? 0 });
  } catch (err) {
    res.status(500).json({ error: "Erro ao contar alertas." });
  }
});

// ── PATCH /api/merchant/alerts/:id/status ─────────────────────────────────────
router.patch("/merchant/alerts/:id/status", async (req: any, res) => {
  const merchantUserId: number = req.merchantUserId;
  const alertId = parseInt(req.params.id, 10);
  const { status } = req.body as { status?: string };

  if (!status || !["PENDING", "IN_PROGRESS", "RESOLVED"].includes(status)) {
    res.status(400).json({ error: "Status invalido. Use: PENDING, IN_PROGRESS, RESOLVED." });
    return;
  }

  try {
    const [alert] = await db
      .select()
      .from(merchantAlertsTable)
      .where(and(eq(merchantAlertsTable.id, alertId), eq(merchantAlertsTable.merchantUserId, merchantUserId)));

    if (!alert) {
      res.status(404).json({ error: "Alerta nao encontrado." });
      return;
    }

    const updateData: Record<string, unknown> = {
      status,
      updatedAt: new Date(),
    };

    if (status === "RESOLVED") {
      const [user] = await db
        .select({ email: merchantUsersTable.email })
        .from(merchantUsersTable)
        .where(eq(merchantUsersTable.id, merchantUserId));
      updateData.resolvedBy = user?.email ?? `merchant_${merchantUserId}`;
      updateData.resolvedAt = new Date();
    }

    const [updated] = await db
      .update(merchantAlertsTable)
      .set(updateData as any)
      .where(eq(merchantAlertsTable.id, alertId))
      .returning();

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(merchantAlertsTable)
      .where(
        and(
          eq(merchantAlertsTable.merchantUserId, merchantUserId),
          sql`${merchantAlertsTable.status} != 'RESOLVED'`
        )
      );

    emitToMerchant(merchantUserId, "alert:updated", {
      alert: updated,
      pendingCount: countRow?.count ?? 0,
    });

    res.json({ ok: true, alert: updated, pendingCount: countRow?.count ?? 0 });
  } catch (err) {
    console.error("Error updating alert status:", err);
    res.status(500).json({ error: "Erro ao atualizar status." });
  }
});

// ── PATCH /api/merchant/alerts/:id/resolve ────────────────────────────────────
router.patch("/merchant/alerts/:id/resolve", async (req: any, res) => {
  const merchantUserId: number = req.merchantUserId;
  const alertId = parseInt(req.params.id, 10);
  const { actionNote, newPrice, ean } = req.body as {
    actionNote?: string;
    newPrice?: number;
    ean?: string;
  };

  try {
    const [alert] = await db
      .select()
      .from(merchantAlertsTable)
      .where(and(eq(merchantAlertsTable.id, alertId), eq(merchantAlertsTable.merchantUserId, merchantUserId)));

    if (!alert) {
      res.status(404).json({ error: "Alerta nao encontrado." });
      return;
    }

    const [user] = await db
      .select({ email: merchantUsersTable.email })
      .from(merchantUsersTable)
      .where(eq(merchantUsersTable.id, merchantUserId));

    if (newPrice && ean) {
      await db.execute(sql`
        UPDATE price_reports
        SET price = ${newPrice}, is_verified = true
        WHERE product_ean = ${ean}
          AND place_id IN (
            SELECT mr.google_place_id FROM merchant_registrations mr
            JOIN merchant_users mu ON mu.merchant_registration_id = mr.id
            WHERE mu.id = ${merchantUserId}
          )
      `);
    }

    const [updated] = await db
      .update(merchantAlertsTable)
      .set({
        status: "RESOLVED",
        resolvedBy: user?.email ?? `merchant_${merchantUserId}`,
        resolvedAt: new Date(),
        actionNote: actionNote ?? null,
        updatedAt: new Date(),
      })
      .where(eq(merchantAlertsTable.id, alertId))
      .returning();

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(merchantAlertsTable)
      .where(
        and(
          eq(merchantAlertsTable.merchantUserId, merchantUserId),
          sql`${merchantAlertsTable.status} != 'RESOLVED'`
        )
      );

    emitToMerchant(merchantUserId, "alert:resolved", {
      alertId,
      alert: updated,
      pendingCount: countRow?.count ?? 0,
    });

    res.json({ ok: true, alert: updated, pendingCount: countRow?.count ?? 0 });
  } catch (err) {
    console.error("Error resolving alert:", err);
    res.status(500).json({ error: "Erro ao resolver alerta." });
  }
});

// ── POST /api/merchant/alerts/seed ────────────────────────────────────────────
// Cria alertas de exemplo para o lojista autenticado (dev/demo)
router.post("/merchant/alerts/seed", async (req: any, res) => {
  const merchantUserId: number = req.merchantUserId;

  // Demo account (id=-1) doesn't exist in DB — return mock success
  if (merchantUserId === -1) {
    res.json({ ok: true, message: "Alertas de demonstracao carregados." });
    return;
  }

  try {
    const existing = await db
      .select({ id: merchantAlertsTable.id })
      .from(merchantAlertsTable)
      .where(eq(merchantAlertsTable.merchantUserId, merchantUserId))
      .limit(1);

    if (existing.length > 0) {
      res.json({ ok: true, message: "Alertas ja existem para este lojista." });
      return;
    }

    const seedAlerts: (typeof merchantAlertsTable.$inferInsert)[] = [
      {
        merchantUserId,
        type: "price_divergence",
        status: "PENDING",
        priority: "high",
        title: "Preco Defasado — Leite Parmalat 1L",
        description: "3 usuarios reportaram preco diferente do cadastrado. Atualize para manter sua posicao no ranking.",
        metadata: { ean: "7891025123417", productName: "Leite Parmalat 1L", currentPrice: 5.49, reportedPrice: 4.99, reportCount: 3 },
      },
      {
        merchantUserId,
        type: "ranking_drop",
        status: "PENDING",
        priority: "high",
        title: "Queda no Ranking de Precos",
        description: "Sua posicao no arroz Tio Joao caiu de #1 para #3. Concorrente atualizou com preco R$ 0,40 menor.",
        metadata: { ean: "7896006716015", productName: "Arroz Tio Joao 5kg", oldRank: 1, newRank: 3, priceDiff: 0.40 },
      },
      {
        merchantUserId,
        type: "price_report",
        status: "PENDING",
        priority: "medium",
        title: "Denuncia de Preco Incorreto",
        description: "1 usuario votou negativamente no preco do Feijao Camil 1kg. Verifique o valor cadastrado.",
        metadata: { ean: "7896006716220", productName: "Feijao Camil 1kg", downvotes: 1 },
      },
      {
        merchantUserId,
        type: "competitiveness",
        status: "PENDING",
        priority: "high",
        title: "Baixa Competitividade — Oleo Liza 900ml",
        description: "Seu preco esta 12% acima da media da regiao. Ajuste para recuperar posicionamento.",
        metadata: { ean: "7891108116007", productName: "Oleo Liza 900ml", yourPrice: 7.49, avgPrice: 6.69, diff: 12 },
      },
      {
        merchantUserId,
        type: "new_follower",
        status: "RESOLVED",
        priority: "low",
        title: "Novo Seguidor do Estabelecimento",
        description: "Seu estabelecimento ganhou 12 novos seguidores esta semana.",
        metadata: { followerCount: 12 },
        resolvedBy: "sistema",
        resolvedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000),
      },
      {
        merchantUserId,
        type: "nfce_validated",
        status: "RESOLVED",
        priority: "low",
        title: "NF-e Validada com Sucesso",
        description: "43 notas fiscais foram validadas e processadas este mes.",
        metadata: { count: 43 },
        resolvedBy: "sistema",
        resolvedAt: new Date(Date.now() - 3 * 24 * 3600 * 1000),
      },
    ];

    await db.insert(merchantAlertsTable).values(seedAlerts);

    res.json({ ok: true, message: `${seedAlerts.length} alertas criados com sucesso.` });
  } catch (err) {
    console.error("Error seeding alerts:", err);
    res.status(500).json({ error: "Erro ao criar alertas de exemplo." });
  }
});

export default router;
