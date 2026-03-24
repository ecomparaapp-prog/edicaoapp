import { Router } from "express";
import { db } from "@workspace/db";
import { priceReportsTable } from "@workspace/db/schema";
import { placesCacheTable } from "@workspace/db/schema";
import { eq, sql, and, desc } from "drizzle-orm";

const pricesRouter = Router();

// POST /api/prices  — submit a price report
pricesRouter.post("/prices", async (req, res) => {
  const { ean, placeId, userId, price } = req.body as {
    ean?: string;
    placeId?: string;
    userId?: string;
    price?: number;
  };

  if (!ean || !placeId || !userId || price == null) {
    res.status(400).json({ error: "ean, placeId, userId e price são obrigatórios." });
    return;
  }

  const priceNum = parseFloat(String(price));
  if (isNaN(priceNum) || priceNum <= 0 || priceNum > 99999) {
    res.status(400).json({ error: "Preço inválido." });
    return;
  }

  try {
    const [report] = await db
      .insert(priceReportsTable)
      .values({
        ean,
        placeId,
        userId,
        price: String(priceNum),
        reportedAt: new Date(),
        isVerified: false,
        upvotes: 0,
        downvotes: 0,
      })
      .returning();

    res.status(201).json({ ok: true, reportId: report.id, bonusPoints: 10 });
  } catch (err) {
    console.error("POST /prices error:", err);
    res.status(500).json({ error: "Erro ao registrar preço." });
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
    // Latest price per store for this EAN, joined with places_cache for store info
    const rows = await db.execute(sql`
      SELECT DISTINCT ON (pr.place_id)
        pr.id,
        pr.ean,
        pr.place_id,
        pr.user_id,
        pr.price::float AS price,
        pr.reported_at,
        pr.is_verified,
        pr.upvotes,
        pr.downvotes,
        pc.name AS store_name,
        pc.address AS store_address,
        pc.lat,
        pc.lng,
        pc.photo_url,
        pc.rating,
        pc.status AS store_status
      FROM price_reports pr
      LEFT JOIN places_cache pc ON pc.google_place_id = pr.place_id
      WHERE pr.ean = ${ean}
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
      SELECT DISTINCT ON (pr.ean)
        pr.id,
        pr.ean,
        pr.price::float AS price,
        pr.reported_at,
        pr.is_verified,
        pr.upvotes,
        pr.downvotes,
        ec.description AS product_name,
        ec.brand,
        ec.thumbnail_url
      FROM price_reports pr
      LEFT JOIN ean_cache ec ON ec.ean = pr.ean
      WHERE pr.place_id = ${placeId}
        AND ec.description IS NOT NULL
        AND ec.description <> '__not_found__'
      ORDER BY pr.ean, pr.reported_at DESC
    `);

    const prices = (rows.rows as any[]).map((r) => ({
      reportId: r.id,
      ean: r.ean,
      price: Number(r.price),
      reportedAt: r.reported_at,
      isVerified: r.is_verified,
      upvotes: r.upvotes,
      downvotes: r.downvotes,
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
