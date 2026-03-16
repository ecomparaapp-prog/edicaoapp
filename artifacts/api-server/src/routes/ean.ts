import { Router } from "express";
import { db } from "@workspace/db";
import { eanCacheTable } from "@workspace/db/schema";
import { and, eq, ilike, ne, or, sql } from "drizzle-orm";

interface CosmosResponse {
  description?: string;
  commercial_unit?: { type_packaging?: string };
  brand?: { name?: string };
  gpc?: { description?: string };
  ncm?: { description?: string };
  thumbnail?: string;
}

const eanRouter = Router();

const COSMOS_BASE = "https://api.cosmos.bluesoft.com.br/gtins";
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const NEGATIVE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const NOT_FOUND_SENTINEL = "__not_found__";

eanRouter.get("/products/ean/:ean", async (req, res) => {
  const { ean } = req.params;

  if (!ean || !/^\d{8,14}$/.test(ean)) {
    res.status(400).json({ error: "EAN inválido. Deve conter 8-14 dígitos." });
    return;
  }

  try {
    const cached = await db
      .select()
      .from(eanCacheTable)
      .where(eq(eanCacheTable.ean, ean))
      .limit(1);

    if (cached.length > 0) {
      const entry = cached[0];
      const age = Date.now() - new Date(entry.cachedAt).getTime();
      // Negative cache hit (sentinel for EAN not found)
      if (entry.description === NOT_FOUND_SENTINEL) {
        if (age < NEGATIVE_CACHE_TTL_MS) {
          res.json({ found: false, ean, source: "cache" });
          return;
        }
      } else if (age < CACHE_TTL_MS) {
        // Positive cache hit
        res.json({
          found: true,
          source: "cache",
          product: {
            ean: entry.ean,
            description: entry.description,
            brand: entry.brand,
            category: entry.category,
            thumbnailUrl: entry.thumbnailUrl,
          },
        });
        return;
      }
    }

    // Only use as stale fallback if it's a real product (not a sentinel)
    const staleEntry = cached.length > 0 && cached[0].description !== NOT_FOUND_SENTINEL
      ? cached[0]
      : null;

    const token = process.env.COSMOS_TOKEN;
    if (!token) {
      if (staleEntry) {
        res.json({
          found: true,
          source: "cache",
          stale: true,
          product: {
            ean: staleEntry.ean,
            description: staleEntry.description,
            brand: staleEntry.brand,
            category: staleEntry.category,
            thumbnailUrl: staleEntry.thumbnailUrl,
          },
        });
        return;
      }
      res.status(503).json({ error: "Serviço de catálogo não configurado." });
      return;
    }

    let cosmosRes: Response;
    try {
      cosmosRes = await fetch(`${COSMOS_BASE}/${ean}`, {
        headers: {
          "X-Cosmos-Token": token,
          "Content-Type": "application/json",
          "User-Agent": "eCompara/1.0",
        },
        signal: AbortSignal.timeout(8000),
      });
    } catch (fetchErr) {
      console.error("Cosmos fetch error:", fetchErr);
      if (staleEntry) {
        res.json({
          found: true,
          source: "cache",
          stale: true,
          product: {
            ean: staleEntry.ean,
            description: staleEntry.description,
            brand: staleEntry.brand,
            category: staleEntry.category,
            thumbnailUrl: staleEntry.thumbnailUrl,
          },
        });
        return;
      }
      res.status(502).json({ error: "Erro ao consultar catálogo externo." });
      return;
    }

    if (cosmosRes.status === 404) {
      // Write negative cache sentinel so we don't re-query Cosmos for this EAN
      await db
        .insert(eanCacheTable)
        .values({
          ean,
          description: NOT_FOUND_SENTINEL,
          brand: null,
          category: null,
          thumbnailUrl: null,
          rawJson: null,
          cachedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: eanCacheTable.ean,
          set: { description: NOT_FOUND_SENTINEL, brand: null, category: null, thumbnailUrl: null, rawJson: null, cachedAt: new Date() },
        });
      res.json({ found: false, ean });
      return;
    }

    if (!cosmosRes.ok) {
      const text = await cosmosRes.text();
      console.error(`Cosmos API error ${cosmosRes.status}: ${text}`);
      if (staleEntry) {
        res.json({
          found: true,
          source: "cache",
          stale: true,
          product: {
            ean: staleEntry.ean,
            description: staleEntry.description,
            brand: staleEntry.brand,
            category: staleEntry.category,
            thumbnailUrl: staleEntry.thumbnailUrl,
          },
        });
        return;
      }
      res.status(502).json({ error: "Erro ao consultar catálogo externo." });
      return;
    }

    const data = await cosmosRes.json() as CosmosResponse;

    const description = data.description || data.commercial_unit?.type_packaging || "Produto sem nome";
    const brand = data.brand?.name || null;
    const category = data.gpc?.description || data.ncm?.description || null;
    const thumbnailUrl = data.thumbnail || null;

    await db
      .insert(eanCacheTable)
      .values({
        ean,
        description,
        brand,
        category,
        thumbnailUrl,
        rawJson: data,
        cachedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: eanCacheTable.ean,
        set: {
          description,
          brand,
          category,
          thumbnailUrl,
          rawJson: data,
          cachedAt: new Date(),
        },
      });

    res.json({
      found: true,
      source: "cosmos",
      product: {
        ean,
        description,
        brand,
        category,
        thumbnailUrl,
      },
    });
  } catch (err) {
    console.error("EAN lookup error:", err);
    res.status(500).json({ error: "Erro interno ao buscar produto." });
  }
});

eanRouter.get("/products/search", async (req, res) => {
  const query = (req.query.q as string || "").trim();
  if (!query || query.length < 2) {
    res.json({ products: [] });
    return;
  }

  try {
    const pattern = `%${query}%`;
    const results = await db
      .select({
        ean: eanCacheTable.ean,
        description: eanCacheTable.description,
        brand: eanCacheTable.brand,
        category: eanCacheTable.category,
        thumbnailUrl: eanCacheTable.thumbnailUrl,
      })
      .from(eanCacheTable)
      .where(
        and(
          ne(eanCacheTable.description, NOT_FOUND_SENTINEL),
          or(
            ilike(eanCacheTable.description, pattern),
            ilike(eanCacheTable.brand, pattern),
            ilike(eanCacheTable.category, pattern),
            sql`${eanCacheTable.ean} LIKE ${pattern}`
          )
        )
      )
      .limit(20);

    res.json({ products: results });
  } catch (err) {
    console.error("Product search error:", err);
    res.status(500).json({ error: "Erro ao buscar produtos." });
  }
});

export default eanRouter;
