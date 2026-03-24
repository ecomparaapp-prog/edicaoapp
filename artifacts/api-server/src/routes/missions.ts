import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const missionsRouter = Router();

const CESTA_BASICA_KEYWORDS = [
  "leite",
  "arroz",
  "feijão",
  "feijao",
  "óleo",
  "oleo",
  "pão",
  "pao",
  "açúcar",
  "acucar",
  "manteiga",
  "café",
  "cafe",
  "farinha",
  "macarrão",
  "macarrao",
  "frango",
  "ovo",
  "ovos",
  "sal",
];

function isCestaBasica(name: string | null): boolean {
  if (!name) return false;
  const lower = name.toLowerCase();
  return CESTA_BASICA_KEYWORDS.some((k) => lower.includes(k));
}

/**
 * GET /api/prices/missions?lat=&lng=&radius_km=&limit=
 * Returns stores near the user that have stale or disputed prices.
 * Stale = latest price_report for that EAN at that store is > 24h old.
 * Disputed = downvotes > upvotes on the latest report.
 */
missionsRouter.get("/prices/missions", async (req, res) => {
  const lat = parseFloat(req.query.lat as string);
  const lng = parseFloat(req.query.lng as string);
  const radiusKm = parseFloat((req.query.radius_km as string) ?? "0.3");
  const limit = parseInt((req.query.limit as string) ?? "10", 10);

  if (isNaN(lat) || isNaN(lng)) {
    res.status(400).json({ error: "lat e lng são obrigatórios." });
    return;
  }

  const radiusM = radiusKm * 1000;

  try {
    // Find stores within radius that have stale or disputed prices
    const rows = await db.execute(sql`
      WITH latest_per_ean AS (
        SELECT DISTINCT ON (place_id, ean)
          id,
          ean,
          place_id,
          price::float AS price,
          reported_at,
          is_verified,
          upvotes,
          downvotes
        FROM price_reports
        ORDER BY place_id, ean, reported_at DESC
      ),
      needy AS (
        SELECT
          lp.place_id,
          COUNT(*) AS total_needy,
          SUM(CASE WHEN lp.reported_at < NOW() - INTERVAL '24 hours' THEN 1 ELSE 0 END) AS stale_count,
          SUM(CASE WHEN lp.downvotes > lp.upvotes THEN 1 ELSE 0 END) AS disputed_count
        FROM latest_per_ean lp
        WHERE
          (lp.reported_at < NOW() - INTERVAL '24 hours')
          OR (lp.downvotes > lp.upvotes AND lp.is_verified = false)
        GROUP BY lp.place_id
        HAVING COUNT(*) > 0
      )
      SELECT
        pc.google_place_id,
        pc.name,
        pc.address,
        pc.lat::float,
        pc.lng::float,
        pc.photo_url,
        pc.rating::float,
        pc.status AS store_status,
        n.total_needy,
        n.stale_count,
        n.disputed_count,
        ST_Distance(
          pc.geom,
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
        )::int AS distance_m
      FROM needy n
      JOIN places_cache pc ON pc.google_place_id = n.place_id
      WHERE ST_DWithin(
        pc.geom,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
        ${radiusM}
      )
      ORDER BY n.total_needy DESC, distance_m ASC
      LIMIT ${limit}
    `);

    const missions = (rows.rows as any[]).map((r) => ({
      googlePlaceId: r.google_place_id,
      name: r.name,
      address: r.address,
      lat: Number(r.lat),
      lng: Number(r.lng),
      photoUrl: r.photo_url,
      rating: r.rating ? Number(r.rating) : null,
      storeStatus: r.store_status,
      totalNeedy: Number(r.total_needy),
      staleCount: Number(r.stale_count),
      disputedCount: Number(r.disputed_count),
      distanceM: Number(r.distance_m),
      xpMultiplier: Number(r.disputed_count) > 0 ? 2 : 1.5,
    }));

    res.json({ missions, totalMissions: missions.length });
  } catch (err) {
    console.error("GET /prices/missions error:", err);
    res.status(500).json({ error: "Erro ao buscar missões." });
  }
});

/**
 * GET /api/prices/missions/:placeId/queue
 * Returns the price reports at this store that need validation,
 * with product names for display, sorted by priority (cesta básica first).
 */
missionsRouter.get("/prices/missions/:placeId/queue", async (req, res) => {
  const { placeId } = req.params;

  try {
    const rows = await db.execute(sql`
      SELECT DISTINCT ON (pr.ean)
        pr.id AS report_id,
        pr.ean,
        pr.price::float AS price,
        pr.reported_at,
        pr.is_verified,
        pr.upvotes,
        pr.downvotes,
        ec.description AS product_name,
        ec.brand,
        ec.thumbnail_url,
        CASE
          WHEN pr.reported_at < NOW() - INTERVAL '24 hours' THEN 'stale'
          WHEN pr.downvotes > pr.upvotes THEN 'disputed'
          ELSE 'ok'
        END AS reason
      FROM price_reports pr
      LEFT JOIN ean_cache ec ON ec.ean = pr.ean
      WHERE pr.place_id = ${placeId}
        AND (
          pr.reported_at < NOW() - INTERVAL '24 hours'
          OR (pr.downvotes > pr.upvotes AND pr.is_verified = false)
        )
      ORDER BY pr.ean, pr.reported_at DESC
    `);

    type QueueRow = {
      report_id: number;
      ean: string;
      price: number;
      reported_at: string;
      is_verified: boolean;
      upvotes: number;
      downvotes: number;
      product_name: string | null;
      brand: string | null;
      thumbnail_url: string | null;
      reason: string;
    };

    const queue = (rows.rows as QueueRow[])
      .filter((r) => r.product_name && r.product_name !== "__not_found__")
      .map((r) => ({
        reportId: r.report_id,
        ean: r.ean,
        price: Number(r.price),
        reportedAt: r.reported_at,
        isVerified: r.is_verified,
        upvotes: r.upvotes,
        downvotes: r.downvotes,
        productName: r.product_name ?? r.ean,
        brand: r.brand,
        thumbnailUrl: r.thumbnail_url,
        reason: r.reason,
        isPriority: isCestaBasica(r.product_name),
      }))
      .sort((a, b) => (b.isPriority ? 1 : 0) - (a.isPriority ? 1 : 0));

    res.json({ placeId, queue });
  } catch (err) {
    console.error("GET /prices/missions/:placeId/queue error:", err);
    res.status(500).json({ error: "Erro ao buscar fila de validação." });
  }
});

/**
 * POST /api/prices/:id/validate
 * Validates (upvote) or disputes (downvote) a price.
 * Supports fromMission flag for 2x XP.
 */
missionsRouter.post("/prices/:id/validate", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { vote, fromMission } = req.body as {
    vote?: "confirm" | "dispute";
    fromMission?: boolean;
  };

  if (isNaN(id) || (vote !== "confirm" && vote !== "dispute")) {
    res.status(400).json({ error: "vote deve ser 'confirm' ou 'dispute'." });
    return;
  }

  try {
    const updated = await db.execute(sql`
      UPDATE price_reports
      SET
        ${vote === "confirm" ? sql`upvotes = upvotes + 1` : sql`downvotes = downvotes + 1`},
        is_verified = CASE WHEN upvotes + 1 >= 3 THEN true ELSE is_verified END
      WHERE id = ${id}
      RETURNING id, upvotes, downvotes, is_verified
    `);

    if (!updated.rows.length) {
      res.status(404).json({ error: "Relatório não encontrado." });
      return;
    }

    const row = updated.rows[0] as any;
    const baseXP = 10;
    const xpEarned = fromMission ? baseXP * 2 : baseXP;
    const justVerified = row.is_verified && row.upvotes === 3;

    res.json({
      ok: true,
      upvotes: row.upvotes,
      downvotes: row.downvotes,
      isVerified: row.is_verified,
      xpEarned,
      fromMission: !!fromMission,
      justVerified,
    });
  } catch (err) {
    console.error("POST /prices/:id/validate error:", err);
    res.status(500).json({ error: "Erro ao validar preço." });
  }
});

export default missionsRouter;
