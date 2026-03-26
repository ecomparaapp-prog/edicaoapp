import { Router } from "express";
import { db } from "@workspace/db";
import {
  placesCacheTable,
  partnershipRequestsTable,
} from "@workspace/db/schema";
import { sql } from "drizzle-orm";

const storesRouter = Router();

storesRouter.get("/stores/nearby", async (req, res) => {
  const lat = parseFloat(req.query.lat as string);
  const lng = parseFloat(req.query.lng as string);
  const radiusKm = parseFloat((req.query.radius_km as string) ?? "10");

  if (isNaN(lat) || isNaN(lng)) {
    res.status(400).json({ error: "Parâmetros lat e lng obrigatórios." });
    return;
  }

  if (isNaN(radiusKm) || radiusKm <= 0 || radiusKm > 50) {
    res.status(400).json({ error: "radius_km deve ser entre 0 e 50." });
    return;
  }

  const radiusM = radiusKm * 1000;

  try {
    const rows = await db
      .select({
        googlePlaceId: placesCacheTable.googlePlaceId,
        name: placesCacheTable.name,
        address: placesCacheTable.address,
        lat: placesCacheTable.lat,
        lng: placesCacheTable.lng,
        phone: placesCacheTable.phone,
        website: placesCacheTable.website,
        photoUrl: placesCacheTable.photoUrl,
        rating: placesCacheTable.rating,
        status: placesCacheTable.status,
        syncedAt: placesCacheTable.syncedAt,
        distanceM: sql<number>`ST_Distance(
          geom,
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
        )`.as("distance_m"),
      })
      .from(placesCacheTable)
      .where(
        sql`ST_DWithin(
          geom,
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
          ${radiusM}
        )`
      )
      .orderBy(sql`distance_m ASC`)
      .limit(50);

    const stores = rows.map((r) => ({
      googlePlaceId: r.googlePlaceId,
      name: r.name,
      address: r.address,
      lat: r.lat,
      lng: r.lng,
      phone: r.phone,
      website: r.website,
      photoUrl: r.photoUrl,
      rating: r.rating,
      status: r.status,
      is_partner: r.status === "verified",
      is_shadow: r.status === "shadow",
      distanceKm: Math.round((r.distanceM / 1000) * 10) / 10,
      syncedAt: r.syncedAt,
    }));

    res.json({ stores });
  } catch (err) {
    console.error("GET /stores/nearby error:", err);
    res.status(500).json({ error: "Erro ao buscar lojas próximas." });
  }
});

storesRouter.post("/stores/claim", async (req, res) => {
  const { google_place_id, place_name, requester_name, requester_email, message } = req.body as {
    google_place_id?: string;
    place_name?: string;
    requester_name?: string;
    requester_email?: string;
    message?: string;
  };

  if (!google_place_id || !requester_name || !requester_email) {
    res.status(400).json({
      error: "Campos obrigatórios: google_place_id, requester_name, requester_email.",
    });
    return;
  }

  try {
    const [request] = await db
      .insert(partnershipRequestsTable)
      .values({
        googlePlaceId: google_place_id,
        placeName: place_name ?? "",
        requesterName: requester_name,
        requesterEmail: requester_email,
        message: message ?? null,
      })
      .returning();

    res.status(201).json({ ok: true, request });
  } catch (err) {
    console.error("POST /stores/claim error:", err);
    res.status(500).json({ error: "Erro ao registrar pedido." });
  }
});

storesRouter.post("/stores/favorite", async (req, res) => {
  const { google_place_id, action } = req.body as { google_place_id?: string; action?: string };
  if (!google_place_id) {
    res.status(400).json({ error: "google_place_id obrigatório." });
    return;
  }
  try {
    if (action === "add") {
      await db.execute(sql`
        UPDATE places_cache SET favorites_count = COALESCE(favorites_count, 0) + 1
        WHERE google_place_id = ${google_place_id}
      `);
    } else if (action === "remove") {
      await db.execute(sql`
        UPDATE places_cache SET favorites_count = GREATEST(COALESCE(favorites_count, 0) - 1, 0)
        WHERE google_place_id = ${google_place_id}
      `);
    }
  } catch {
    // coluna pode não existir ainda — ignorar silenciosamente
  }
  res.json({ ok: true });
});

storesRouter.post("/stores/suggest", async (req, res) => {
  const { google_place_id, original_name, suggested_name, note } = req.body as {
    google_place_id?: string;
    original_name?: string;
    suggested_name?: string;
    note?: string;
  };
  if (!google_place_id || !suggested_name) {
    res.status(400).json({ error: "google_place_id e suggested_name obrigatórios." });
    return;
  }
  try {
    await db.execute(sql`
      INSERT INTO store_suggestions (google_place_id, original_name, suggested_name, note, created_at)
      VALUES (${google_place_id}, ${original_name ?? ""}, ${suggested_name}, ${note ?? ""}, NOW())
    `);
  } catch {
    // tabela pode não existir ainda — apenas loga
    console.log(`[StoreSuggest] ${google_place_id}: "${original_name}" → "${suggested_name}" (${note})`);
  }
  res.json({ ok: true });
});

export default storesRouter;
