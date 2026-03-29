import { Router } from "express";
import { db } from "@workspace/db";
import {
  placesCacheTable,
  partnershipRequestsTable,
} from "@workspace/db/schema";
import { sql } from "drizzle-orm";
import { isValidUserId } from "../utils/requireUser";
import { logPoints } from "../services/pointsLogger";
import { getPointsConfig } from "../services/pointsConfig";

const storesRouter = Router();

interface GooglePlace {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  nationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  photos?: { name?: string }[];
}

async function syncGooglePlaces(lat: number, lng: number, radiusM: number) {
  const apiKey = process.env.GOOGLE_PLACES_KEY;
  if (!apiKey) {
    console.warn("[Places] GOOGLE_PLACES_KEY not set, skipping sync.");
    return;
  }

  const body = {
    includedTypes: ["supermarket", "grocery_store", "hypermarket"],
    maxResultCount: 20,
    locationRestriction: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: Math.min(radiusM, 50000),
      },
    },
  };

  const fieldMask = [
    "places.id",
    "places.displayName",
    "places.formattedAddress",
    "places.location",
    "places.nationalPhoneNumber",
    "places.websiteUri",
    "places.rating",
    "places.photos",
  ].join(",");

  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": fieldMask,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[Places] Google API error:", res.status, errText);
      return;
    }

    const data = await res.json() as { places?: GooglePlace[] };
    const places = data.places ?? [];
    console.log(`[Places] Syncing ${places.length} places near (${lat},${lng})`);

    for (const p of places) {
      const placeLat = p.location?.latitude;
      const placeLng = p.location?.longitude;
      if (!p.id || placeLat == null || placeLng == null) continue;

      const name = p.displayName?.text ?? "Supermercado";
      const photoRef = p.photos?.[0]?.name;
      const photoUrl = photoRef
        ? `https://places.googleapis.com/v1/${photoRef}/media?maxWidthPx=400&key=${apiKey}`
        : null;

      await db.execute(sql`
        INSERT INTO places_cache
          (google_place_id, name, address, lat, lng, phone, website, photo_url, rating, status, is_shadow, is_partner, synced_at, geom)
        VALUES (
          ${p.id},
          ${name},
          ${p.formattedAddress ?? null},
          ${placeLat},
          ${placeLng},
          ${p.nationalPhoneNumber ?? null},
          ${p.websiteUri ?? null},
          ${photoUrl},
          ${p.rating ?? null},
          'shadow',
          true,
          false,
          NOW(),
          ST_SetSRID(ST_MakePoint(${placeLng}, ${placeLat}), 4326)
        )
        ON CONFLICT (google_place_id) DO UPDATE SET
          name = EXCLUDED.name,
          address = EXCLUDED.address,
          lat = EXCLUDED.lat,
          lng = EXCLUDED.lng,
          phone = EXCLUDED.phone,
          website = EXCLUDED.website,
          photo_url = EXCLUDED.photo_url,
          rating = EXCLUDED.rating,
          synced_at = NOW(),
          geom = EXCLUDED.geom
      `);
    }
  } catch (err) {
    console.error("[Places] Sync error:", err);
  }
}

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

  const queryAndReturn = async () => {
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

    return rows.map((r) => ({
      googlePlaceId: r.googlePlaceId,
      name: r.name,
      address: r.address,
      lat: r.lat != null ? Number(r.lat) : null,
      lng: r.lng != null ? Number(r.lng) : null,
      phone: r.phone,
      website: r.website,
      photoUrl: r.photoUrl,
      rating: r.rating != null ? Number(r.rating) : null,
      status: r.status,
      is_partner: r.status === "verified",
      is_shadow: r.status === "shadow",
      distanceKm: Math.round(((r.distanceM as number) / 1000) * 10) / 10,
      syncedAt: r.syncedAt,
    }));
  };

  try {
    let stores = await queryAndReturn();

    if (stores.length === 0) {
      console.log(`[Places] Cache miss for (${lat},${lng}) r=${radiusKm}km — calling Google Places...`);
      await syncGooglePlaces(lat, lng, radiusM);
      stores = await queryAndReturn();
    }

    res.json({ stores });
  } catch (err) {
    console.error("GET /stores/nearby error:", err);
    res.status(500).json({ error: "Erro ao buscar lojas próximas." });
  }
});

storesRouter.post("/stores/sync", async (req, res) => {
  const { lat, lng, radius_km } = req.body as { lat?: number; lng?: number; radius_km?: number };
  if (!lat || !lng) {
    res.status(400).json({ error: "lat e lng obrigatórios." });
    return;
  }
  const radiusM = (radius_km ?? 10) * 1000;
  await syncGooglePlaces(lat, lng, radiusM);
  res.json({ ok: true });
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

const FRAUD_REPORT_THRESHOLD = 3;

storesRouter.post("/stores/indicate", async (req, res) => {
  const { user_id, name, address, lat, lng, google_place_id } = req.body as {
    user_id?: string;
    name?: string;
    address?: string;
    lat?: number;
    lng?: number;
    google_place_id?: string;
  };

  if (!name || lat == null || lng == null) {
    res.status(400).json({ error: "Campos obrigatórios: name, lat, lng." });
    return;
  }
  if (!isValidUserId(user_id)) {
    res.status(401).json({ error: "Login necessário para indicar mercados." });
    return;
  }

  const placeId = google_place_id ?? `user_${user_id}_${Date.now()}`;

  try {
    // Anti-spam: check if this user already indicated this exact place
    if (google_place_id) {
      const existing = await db.execute(sql`
        SELECT id FROM store_indications
        WHERE user_id = ${user_id} AND google_place_id = ${placeId}
        LIMIT 1
      `);
      if ((existing.rows as unknown[]).length > 0) {
        res.status(409).json({ error: "Você já indicou este mercado anteriormente." });
        return;
      }
    }

    // Upsert into places_cache
    await db.execute(sql`
      INSERT INTO places_cache
        (google_place_id, name, address, lat, lng, status, is_shadow, is_partner, indicated_by, synced_at, geom)
      VALUES (
        ${placeId}, ${name}, ${address ?? null}, ${lat}, ${lng},
        'shadow', true, false, ${user_id}, NOW(),
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)
      )
      ON CONFLICT (google_place_id) DO NOTHING
    `);

    // Load dynamic points config
    const cfg = await getPointsConfig();
    const indicationPoints = cfg.store_indication;

    // Record indication and award points
    await db.execute(sql`
      INSERT INTO store_indications (user_id, google_place_id, store_name, points_awarded)
      VALUES (${user_id}, ${placeId}, ${name}, ${indicationPoints})
      ON CONFLICT (user_id, google_place_id) DO NOTHING
    `);

    console.log(`[StoreIndication] User ${user_id} indicated "${name}" (${placeId}) — +${indicationPoints}pts`);

    // Log to central points_history
    await logPoints({
      userId: user_id,
      actionType: "store_indication",
      pointsAmount: indicationPoints,
      referenceId: placeId,
      metadata: { storeName: name, address: address ?? null },
    });

    res.status(201).json({
      ok: true,
      points_awarded: indicationPoints,
      google_place_id: placeId,
      message: "Parabéns, Explorador! Você mapeou um novo mercado para a comunidade.",
    });
  } catch (err) {
    console.error("POST /stores/indicate error:", err);
    res.status(500).json({ error: "Erro ao registrar indicação." });
  }
});

storesRouter.post("/stores/report", async (req, res) => {
  const { google_place_id, reporter_user_id, reason } = req.body as {
    google_place_id?: string;
    reporter_user_id?: string;
    reason?: string;
  };

  if (!google_place_id) {
    res.status(400).json({ error: "google_place_id é obrigatório." });
    return;
  }
  if (!isValidUserId(reporter_user_id)) {
    res.status(401).json({ error: "Login necessário para reportar mercados." });
    return;
  }

  try {
    // Insert report (unique per reporter+place)
    await db.execute(sql`
      INSERT INTO store_indication_reports (google_place_id, reporter_user_id, reason)
      VALUES (${google_place_id}, ${reporter_user_id}, ${reason ?? null})
      ON CONFLICT (reporter_user_id, google_place_id) DO NOTHING
    `);

    // Count total unique reports for this store
    const countResult = await db.execute(sql`
      SELECT COUNT(*) as cnt FROM store_indication_reports
      WHERE google_place_id = ${google_place_id}
    `);
    const reportCount = Number((countResult.rows[0] as { cnt: string }).cnt);

    // Fraud threshold: deduct points from original indicador
    if (reportCount >= FRAUD_REPORT_THRESHOLD) {
      await db.execute(sql`
        UPDATE store_indications
        SET points_deducted = TRUE, reports_count = ${reportCount}
        WHERE google_place_id = ${google_place_id}
          AND points_deducted = FALSE
      `);
      console.log(`[StoreReport] Place ${google_place_id} hit fraud threshold (${reportCount} reports) — points deducted.`);
    } else {
      await db.execute(sql`
        UPDATE store_indications SET reports_count = ${reportCount}
        WHERE google_place_id = ${google_place_id}
      `);
    }

    res.json({ ok: true, report_count: reportCount, fraud_threshold: FRAUD_REPORT_THRESHOLD });
  } catch (err) {
    console.error("POST /stores/report error:", err);
    res.status(500).json({ error: "Erro ao registrar denúncia." });
  }
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
    console.log(`[StoreSuggest] ${google_place_id}: "${original_name}" → "${suggested_name}" (${note})`);
  }
  res.json({ ok: true });
});

export default storesRouter;
