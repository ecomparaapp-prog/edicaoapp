import { Router } from "express";
import { db } from "@workspace/db";
import { priceReportsTable, placesCacheTable } from "@workspace/db/schema";
import { eq, sql, and, desc } from "drizzle-orm";
import { isValidUserId } from "../utils/requireUser";

const pricesRouter = Router();

const POINTS = {
  product_registration: 30,
  price_validation: 15,
  price_submission: 10,
  auto_validated: 30,
  conflict_pending: 0,
};

const CONFLICT_THRESHOLD = 0.05; // 5% difference is considered a conflict
const STALENESS_DAYS = 5;
const AUTO_VALIDATE_THRESHOLD = 3;
const AUTO_VALIDATE_WINDOW_HOURS = 24;

interface LatestPriceRow {
  id: number;
  price: string;
  reported_at: Date;
  user_id: string;
  is_verified: boolean;
  report_type: string | null;
}

interface StoreRow {
  status: string | null;
  is_partner: boolean;
}

async function getLatestPrice(ean: string, placeId: string): Promise<LatestPriceRow | null> {
  const rows = await db.execute(sql`
    SELECT id, price::text, reported_at, user_id, is_verified, report_type
    FROM price_reports
    WHERE product_ean = ${ean} AND place_id = ${placeId}
    ORDER BY reported_at DESC
    LIMIT 1
  `);
  if (!rows.rows.length) return null;
  return rows.rows[0] as LatestPriceRow;
}

async function getStoreInfo(placeId: string): Promise<StoreRow | null> {
  const rows = await db
    .select({ status: placesCacheTable.status })
    .from(placesCacheTable)
    .where(eq(placesCacheTable.googlePlaceId, placeId))
    .limit(1);
  if (!rows.length) return null;
  return {
    status: rows[0].status,
    is_partner: rows[0].status === "verified",
  };
}

async function countRecentSamePrice(
  ean: string,
  placeId: string,
  price: number,
  excludeUserId: string,
): Promise<{ count: number; userIds: string[] }> {
  const windowStart = new Date(Date.now() - AUTO_VALIDATE_WINDOW_HOURS * 3600 * 1000);
  const rows = await db.execute(sql`
    SELECT user_id, price::float
    FROM price_reports
    WHERE product_ean = ${ean}
      AND place_id = ${placeId}
      AND reported_at >= ${windowStart}
      AND ABS(price::float - ${price}) / GREATEST(price::float, 0.01) <= ${CONFLICT_THRESHOLD}
  `);
  const userIds = (rows.rows as any[]).map((r) => String(r.user_id));
  const uniqueUsers = [...new Set([...userIds, excludeUserId])];
  return { count: uniqueUsers.length, userIds: uniqueUsers };
}

async function autoValidateReports(ean: string, placeId: string, price: number, pointsEach: number) {
  const windowStart = new Date(Date.now() - AUTO_VALIDATE_WINDOW_HOURS * 3600 * 1000);
  await db.execute(sql`
    UPDATE price_reports
    SET is_verified = true,
        conflict_status = 'auto_validated',
        report_type = 'auto_validated',
        points_awarded = ${pointsEach}
    WHERE product_ean = ${ean}
      AND place_id = ${placeId}
      AND reported_at >= ${windowStart}
      AND ABS(price::float - ${price}) / GREATEST(price::float, 0.01) <= ${CONFLICT_THRESHOLD}
  `);
}

// POST /api/prices — submit a price report with smart validation logic
pricesRouter.post("/prices", async (req, res) => {
  const { ean, placeId, userId, price, productName } = req.body as {
    ean?: string;
    placeId?: string;
    userId?: string;
    price?: number;
    productName?: string;
  };

  if (!ean || !placeId || price == null) {
    res.status(400).json({ error: "ean, placeId e price são obrigatórios." });
    return;
  }
  if (!isValidUserId(userId)) {
    res.status(401).json({ error: "Login necessário para registrar preços." });
    return;
  }

  const priceNum = parseFloat(String(price));
  if (isNaN(priceNum) || priceNum <= 0 || priceNum > 99999) {
    res.status(400).json({ error: "Preço inválido." });
    return;
  }

  try {
    // Fetch store info and latest price in parallel
    const [storeInfo, latestPrice] = await Promise.all([
      getStoreInfo(placeId),
      getLatestPrice(ean, placeId),
    ]);

    const isPartner = storeInfo?.is_partner ?? false;
    const isShadow = !isPartner;

    // Check freshness: is the last price within STALENESS_DAYS?
    const fiveDaysAgo = new Date(Date.now() - STALENESS_DAYS * 24 * 3600 * 1000);
    const hasFreshPrice =
      latestPrice != null &&
      new Date(latestPrice.reported_at) >= fiveDaysAgo;

    // Determine conflict: price differs by more than CONFLICT_THRESHOLD from latest
    const latestPriceNum = latestPrice ? parseFloat(latestPrice.price) : null;
    const isConflicting =
      hasFreshPrice &&
      latestPriceNum != null &&
      Math.abs(priceNum - latestPriceNum) / Math.max(latestPriceNum, 0.01) > CONFLICT_THRESHOLD;

    let reportType: string;
    let pointsAwarded: number;
    let conflictStatus: string | null = null;
    let autoValidated = false;
    let autoValidatedUsers: string[] = [];

    if (isShadow) {
      if (!hasFreshPrice) {
        // Shadow + no fresh price → product registration
        reportType = "product_registration";
        pointsAwarded = POINTS.product_registration;
      } else {
        // Shadow + fresh price → price validation
        reportType = "price_validation";
        pointsAwarded = POINTS.price_validation;
      }
    } else {
      // Partner store
      if (!isConflicting) {
        // No conflict → normal price submission
        reportType = "price_submission";
        pointsAwarded = POINTS.price_submission;
      } else {
        // Conflicting price at partner store
        // Check if 3 users reported same price in last 24h
        const { count, userIds } = await countRecentSamePrice(ean, placeId, priceNum, userId);

        if (count >= AUTO_VALIDATE_THRESHOLD) {
          // Auto-validate! All matching reporters get full points
          reportType = "auto_validated";
          pointsAwarded = POINTS.auto_validated;
          conflictStatus = "auto_validated";
          autoValidated = true;
          autoValidatedUsers = userIds;
          // Mark previous conflicting reports as auto-validated
          await autoValidateReports(ean, placeId, priceNum, POINTS.auto_validated);
        } else {
          // Notify partner (mark as pending)
          reportType = "conflict_pending";
          pointsAwarded = POINTS.conflict_pending;
          conflictStatus = "pending";
          console.log(`[Prices] Conflict detected for EAN=${ean} at place=${placeId}. ` +
            `Reported: R$${priceNum}, Latest: R$${latestPriceNum}. Notifying partner...`);
        }
      }
    }

    // Insert the new price report
    const [report] = await db
      .insert(priceReportsTable)
      .values({
        ean,
        productName: productName ?? "",
        placeId,
        userId,
        price: String(priceNum),
        reportedAt: new Date(),
        isVerified: reportType === "price_validation" || reportType === "auto_validated",
        upvotes: 0,
        downvotes: 0,
        reportType,
        pointsAwarded,
        conflictStatus,
      })
      .returning();

    res.status(201).json({
      ok: true,
      reportId: report.id,
      pointsAwarded,
      reportType,
      conflictStatus,
      autoValidated,
      autoValidatedUsers: autoValidated ? autoValidatedUsers : undefined,
      storeType: isPartner ? "partner" : "shadow",
      hasFreshPrice,
      latestPrice: latestPriceNum,
      message: buildResultMessage(reportType, pointsAwarded, autoValidated),
    });
  } catch (err) {
    console.error("POST /prices error:", err);
    res.status(500).json({ error: "Erro ao registrar preço." });
  }
});

function buildResultMessage(reportType: string, points: number, autoValidated: boolean): string {
  if (autoValidated) return `Preço validado automaticamente por 3 usuários! +${points} pts 🎉`;
  switch (reportType) {
    case "product_registration":
      return `Produto cadastrado com sucesso! +${points} pts`;
    case "price_validation":
      return `Preço confirmado! +${points} pts`;
    case "price_submission":
      return `Preço registrado! +${points} pts`;
    case "conflict_pending":
      return `Preço enviado para validação pelo parceiro.`;
    default:
      return `Enviado com sucesso! +${points} pts`;
  }
}

// POST /api/prices/:id/partner-validate — partner validates a conflicting price
pricesRouter.post("/prices/:id/partner-validate", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { approved } = req.body as { approved?: boolean };

  if (isNaN(id)) {
    res.status(400).json({ error: "id inválido." });
    return;
  }

  try {
    const updated = await db
      .update(priceReportsTable)
      .set({
        conflictStatus: approved ? "partner_validated" : "partner_rejected",
        isVerified: approved ?? false,
        pointsAwarded: approved ? POINTS.product_registration : 0,
        reportType: approved ? "product_registration" : "conflict_rejected",
      })
      .where(eq(priceReportsTable.id, id))
      .returning();

    if (!updated.length) {
      res.status(404).json({ error: "Registro não encontrado." });
      return;
    }

    res.json({
      ok: true,
      conflictStatus: updated[0].conflictStatus,
      pointsAwarded: updated[0].pointsAwarded,
    });
  } catch (err) {
    console.error("POST /prices/:id/partner-validate error:", err);
    res.status(500).json({ error: "Erro ao validar preço." });
  }
});

// GET /api/products/:ean/prices  — all prices for a product, grouped by store (latest per store)
pricesRouter.get("/products/:ean/prices", async (req, res) => {
  const { ean } = req.params;

  if (!ean || !/^\d{8,14}$/.test(ean)) {
    res.status(400).json({ error: "EAN inválido." });
    return;
  }

  try {
    const rows = await db.execute(sql`
      SELECT DISTINCT ON (pr.place_id)
        pr.id,
        pr.product_ean AS ean,
        pr.place_id,
        pr.user_id,
        pr.price::float AS price,
        pr.reported_at,
        pr.is_verified,
        pr.upvotes,
        pr.downvotes,
        pr.report_type,
        pr.points_awarded,
        pc.name AS store_name,
        pc.address AS store_address,
        pc.lat,
        pc.lng,
        pc.photo_url,
        pc.rating,
        pc.status AS store_status
      FROM price_reports pr
      LEFT JOIN places_cache pc ON pc.google_place_id = pr.place_id
      WHERE pr.product_ean = ${ean}
      ORDER BY pr.place_id, pr.reported_at DESC
    `);

    const prices = (rows.rows as any[]).map((r) => ({
      reportId: r.id,
      ean: r.ean,
      placeId: r.place_id,
      price: Number(r.price),
      reportedAt: r.reported_at,
      isVerified: r.is_verified,
      upvotes: r.upvotes,
      downvotes: r.downvotes,
      reportType: r.report_type,
      pointsAwarded: r.points_awarded,
      storeName: r.store_name ?? r.place_id,
      storeAddress: r.store_address,
      lat: r.lat ? Number(r.lat) : null,
      lng: r.lng ? Number(r.lng) : null,
      photoUrl: r.photo_url,
      rating: r.rating ? Number(r.rating) : null,
      storeStatus: r.store_status,
    }));

    res.json({ ean, prices });
  } catch (err) {
    console.error("GET /products/:ean/prices error:", err);
    res.status(500).json({ error: "Erro ao buscar preços." });
  }
});

// GET /api/stores/:placeId/prices  — latest prices at a specific store
pricesRouter.get("/stores/:placeId/prices", async (req, res) => {
  const { placeId } = req.params;

  try {
    const rows = await db.execute(sql`
      SELECT DISTINCT ON (pr.product_ean)
        pr.id,
        pr.product_ean AS ean,
        pr.price::float AS price,
        pr.reported_at,
        pr.is_verified,
        pr.upvotes,
        pr.downvotes,
        pr.report_type,
        ec.description AS product_name,
        ec.brand,
        ec.thumbnail_url
      FROM price_reports pr
      LEFT JOIN ean_cache ec ON ec.ean = pr.product_ean
      WHERE pr.place_id = ${placeId}
        AND ec.description IS NOT NULL
        AND ec.description <> '__not_found__'
      ORDER BY pr.product_ean, pr.reported_at DESC
    `);

    const prices = (rows.rows as any[]).map((r) => ({
      reportId: r.id,
      ean: r.ean,
      price: Number(r.price),
      reportedAt: r.reported_at,
      isVerified: r.is_verified,
      upvotes: r.upvotes,
      downvotes: r.downvotes,
      reportType: r.report_type,
      productName: r.product_name,
      brand: r.brand,
      thumbnailUrl: r.thumbnail_url,
    }));

    res.json({ placeId, prices });
  } catch (err) {
    console.error("GET /stores/:placeId/prices error:", err);
    res.status(500).json({ error: "Erro ao buscar preços da loja." });
  }
});

// POST /api/prices/:id/vote  — upvote or downvote a price report
pricesRouter.post("/prices/:id/vote", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { vote } = req.body as { vote?: "up" | "down" };

  if (isNaN(id) || (vote !== "up" && vote !== "down")) {
    res.status(400).json({ error: "id inválido ou vote deve ser 'up' ou 'down'." });
    return;
  }

  try {
    const updated = await db
      .update(priceReportsTable)
      .set(
        vote === "up"
          ? { upvotes: sql`upvotes + 1` }
          : { downvotes: sql`downvotes + 1` }
      )
      .where(eq(priceReportsTable.id, id))
      .returning({ upvotes: priceReportsTable.upvotes, downvotes: priceReportsTable.downvotes });

    if (!updated.length) {
      res.status(404).json({ error: "Registro não encontrado." });
      return;
    }

    res.json({ ok: true, ...updated[0] });
  } catch (err) {
    console.error("POST /prices/:id/vote error:", err);
    res.status(500).json({ error: "Erro ao registrar voto." });
  }
});

export default pricesRouter;
