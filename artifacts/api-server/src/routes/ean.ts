import { Router } from "express";
import { db } from "@workspace/db";
import { eanCacheTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const eanRouter = Router();

const COSMOS_BASE = "https://api.cosmos.bluesoft.com.br/gtins";
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

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
      const age = Date.now() - new Date(cached[0].cachedAt).getTime();
      if (age < CACHE_TTL_MS) {
        res.json({
          found: true,
          source: "cache",
          product: {
            ean: cached[0].ean,
            description: cached[0].description,
            brand: cached[0].brand,
            category: cached[0].category,
            thumbnailUrl: cached[0].thumbnailUrl,
          },
        });
        return;
      }
    }

    const staleEntry = cached.length > 0 ? cached[0] : null;

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

    const data: any = await cosmosRes.json();

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

export default eanRouter;
