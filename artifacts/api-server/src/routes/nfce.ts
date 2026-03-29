import { Router } from "express";
import { db } from "@workspace/db";
import { nfceRecordsTable, priceReportsTable, eanCacheTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { isValidUserId } from "../utils/requireUser";
import { logPoints } from "../services/pointsLogger";

const nfceRouter = Router();

// Brazilian state codes from the NF-e access key
const STATE_CODES: Record<string, string> = {
  "11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO",
  "21": "MA", "22": "PI", "23": "CE", "24": "RN", "25": "PB", "26": "PE",
  "27": "AL", "28": "SE", "29": "BA",
  "31": "MG", "32": "ES", "33": "RJ", "35": "SP",
  "41": "PR", "42": "SC", "43": "RS",
  "50": "MS", "51": "MT", "52": "GO", "53": "DF",
};

// Points logic
const BASE_POINTS = 150;
function calcPoints(itemCount: number, isWeekend: boolean): number {
  const multiplier = itemCount > 10 ? 2 : isWeekend ? 1.2 : 1;
  return Math.round(BASE_POINTS * multiplier);
}

// Parse 44-digit NF-e access key into its structural fields
function parseChaveAcesso(chave: string) {
  if (chave.length !== 44) return null;
  return {
    stateCode: chave.slice(0, 2),
    stateName: STATE_CODES[chave.slice(0, 2)] ?? "??",
    aamm: chave.slice(2, 6),
    year: "20" + chave.slice(2, 4),
    month: chave.slice(4, 6),
    cnpj: chave.slice(6, 20),
    cnpjFormatted: chave.slice(6, 20).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5"),
    model: chave.slice(20, 22),
    modelName: chave.slice(20, 22) === "65" ? "NFC-e" : "NF-e",
    serie: chave.slice(22, 25),
    docNumber: chave.slice(25, 34),
    emissionType: chave.slice(34, 35),
    randomCode: chave.slice(35, 43),
    verDigit: chave.slice(43, 44),
  };
}

// Look up CNPJ via ReceitaWS (free, no auth required)
async function lookupCNPJ(cnpj: string): Promise<{ name: string | null; ok: boolean }> {
  try {
    const res = await fetch(`https://www.receitaws.com.br/v1/cnpj/${cnpj}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { name: null, ok: false };
    const data = await res.json() as { nome?: string; status?: string };
    if (data.status === "ERROR" || !data.nome) return { name: null, ok: false };
    return { name: data.nome, ok: true };
  } catch {
    return { name: null, ok: false };
  }
}

// Try to fetch items from SEFAZ public portal (best-effort, HTML parsing)
async function fetchItemsFromSefaz(
  chave: string,
  stateCode: string,
): Promise<{ ean: string; name: string; qty: number; unit: string; price: number }[]> {
  // State-specific public NFC-e consultation URLs
  const urlMap: Record<string, string> = {
    "53": `https://dec.fazenda.df.gov.br/nfce/consulta?p=${chave}|2|1|||`,
    "35": `https://www.nfce.fazenda.sp.gov.br/NFCEConsultaPublica/Paginas/ConsultaNFCe.aspx?chNFe=${chave}`,
    "33": `https://www.nfce.fazenda.rj.gov.br/consulta?chNFe=${chave}`,
    "41": `https://www.fazenda.pr.gov.br/nfce/qrcode?chNFe=${chave}`,
  };

  const url = urlMap[stateCode];
  if (!url) return [];

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; eCompara/1.0)",
        "Accept": "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) return [];
    const html = await res.text();

    // DF NFC-e HTML typically has item rows in a table with columns:
    // Descrição | Qtd | UN | Vl Unit | Vl Total | EAN (sometimes hidden)
    const items: { ean: string; name: string; qty: number; unit: string; price: number }[] = [];

    // Try to extract items from common HTML patterns in SEFAZ portals
    // Pattern 1: <span class="txtTit"> or <td class="col-left Itens">
    const nameMatches = [...html.matchAll(/class=["']txtTit2?["'][^>]*>([^<]+)<\/span>/gi)];
    const qtyMatches = [...html.matchAll(/class=["']Qcom["'][^>]*>([\d,.]+)<\/span>/gi)];
    const unitMatches = [...html.matchAll(/class=["']Ucom["'][^>]*>([A-Z]+)<\/span>/gi)];
    const priceMatches = [...html.matchAll(/class=["']vItem2Bt["'][^>]*>([\d.,]+)<\/span>/gi)];
    const eanMatches = [...html.matchAll(/(?:EAN|GTIN|C[oó]d\.?\s*Bar)[^>]*>[^<]*(\d{8,14})/gi)];

    if (nameMatches.length > 0) {
      for (let i = 0; i < nameMatches.length; i++) {
        const name = nameMatches[i][1]?.trim() ?? "";
        const qty = parseFloat((qtyMatches[i]?.[1] ?? "1").replace(",", ".")) || 1;
        const unit = unitMatches[i]?.[1]?.trim() ?? "UN";
        const price = parseFloat((priceMatches[i]?.[1] ?? "0").replace(/\./g, "").replace(",", ".")) || 0;
        const ean = eanMatches[i]?.[1]?.trim() ?? "";

        if (name && price > 0) {
          items.push({ ean, name, qty, unit, price: price / qty });
        }
      }
    }

    console.log(`[SEFAZ] Parsed ${items.length} items for chave ${chave.slice(0, 10)}... (state ${stateCode})`);
    return items;
  } catch (err) {
    console.warn(`[SEFAZ] Fetch failed for state ${stateCode}:`, (err as Error).message);
    return [];
  }
}

// Enrich items with product names from our EAN cache
async function enrichItems(items: { ean: string; name: string; qty: number; unit: string; price: number }[]) {
  const eans = items.map((i) => i.ean).filter((e) => /^\d{8,14}$/.test(e));
  if (!eans.length) return items;

  try {
    const cached = await db
      .select({ ean: eanCacheTable.ean, description: eanCacheTable.description })
      .from(eanCacheTable)
      .where(sql`${eanCacheTable.ean} = ANY(${eans})`);

    const nameMap = Object.fromEntries(cached.map((c) => [c.ean, c.description]));
    return items.map((i) => ({
      ...i,
      name: nameMap[i.ean] && nameMap[i.ean] !== "__not_found__" ? nameMap[i.ean] : i.name,
    }));
  } catch {
    return items;
  }
}

// Batch-insert price reports for all items from the NF-e
async function insertPriceReports(
  items: { ean: string; price: number }[],
  placeId: string,
  userId: string,
) {
  const validItems = items.filter(
    (i) => /^\d{8,14}$/.test(i.ean) && i.price > 0,
  );
  if (!validItems.length) return [];

  try {
    const inserted = await db
      .insert(priceReportsTable)
      .values(
        validItems.map((i) => ({
          ean: i.ean,
          placeId,
          userId,
          price: String(i.price),
          reportedAt: new Date(),
          isVerified: true,
          upvotes: 0,
          downvotes: 0,
        })),
      )
      .returning({ id: priceReportsTable.id, ean: priceReportsTable.ean });

    return inserted;
  } catch {
    return [];
  }
}

/**
 * POST /api/nfce/validate
 *
 * Body:
 *   chaveAcesso  — 44-digit NF-e access key (required)
 *   userId       — authenticated user ID (required)
 *   placeId      — Google Place ID of the store (optional, used for price indexing)
 *   items        — array of items if available from QR scan (optional)
 *
 * Response:
 *   ok           — whether processing succeeded
 *   duplicate    — whether this key was already processed
 *   customer     — { points, itemCount, storeName, cnpj, totalValue, bonus }
 *   system       — { priceReports: [{ id, ean }], placeId }
 *   merchant     — { cnpj, storeName, docNumber, items, totalValue, processedAt }
 */
nfceRouter.post("/nfce/validate", async (req, res) => {
  const { chaveAcesso, userId, placeId, items: clientItems } = req.body as {
    chaveAcesso?: string;
    userId?: string;
    placeId?: string;
    items?: { ean: string; name: string; qty: number; unit: string; price: number }[];
  };

  // ── Validation ───────────────────────────────────────────────────────────
  const chave = (chaveAcesso ?? "").trim().replace(/\D/g, "");
  if (chave.length !== 44) {
    res.status(400).json({ ok: false, error: "chaveAcesso deve ter 44 dígitos." });
    return;
  }
  if (!isValidUserId(userId)) {
    res.status(401).json({ ok: false, error: "Login necessário para processar notas fiscais." });
    return;
  }

  const parsed = parseChaveAcesso(chave);
  if (!parsed) {
    res.status(400).json({ ok: false, error: "Chave de acesso inválida." });
    return;
  }

  // ── Duplicate check ──────────────────────────────────────────────────────
  try {
    const existing = await db
      .select()
      .from(nfceRecordsTable)
      .where(eq(nfceRecordsTable.chaveAcesso, chave))
      .limit(1);

    if (existing.length > 0) {
      const rec = existing[0];
      res.json({
        ok: false,
        duplicate: true,
        customer: {
          points: 0,
          itemCount: rec.itemCount ?? 0,
          storeName: rec.storeName ?? "—",
          cnpj: rec.cnpj ?? parsed.cnpjFormatted,
          totalValue: rec.totalValue ? Number(rec.totalValue) : 0,
          bonus: false,
        },
        merchant: {
          cnpj: rec.cnpj ?? parsed.cnpjFormatted,
          storeName: rec.storeName ?? "—",
          docNumber: rec.docNumber ?? parsed.docNumber,
          items: rec.items ?? [],
          totalValue: rec.totalValue ? Number(rec.totalValue) : 0,
          processedAt: rec.processedAt,
          alreadyProcessed: true,
        },
      });
      return;
    }
  } catch (err) {
    console.error("nfce duplicate check error:", err);
    res.status(500).json({ ok: false, error: "Erro interno ao verificar duplicidade." });
    return;
  }

  // ── CNPJ lookup via ReceitaWS ────────────────────────────────────────────
  const cnpjResult = await lookupCNPJ(parsed.cnpj);
  const storeName = cnpjResult.name ?? `Estabelecimento ${parsed.cnpjFormatted}`;

  // ── Items: use client-provided items or try to fetch from SEFAZ ───────────
  const hasClientItems = Array.isArray(clientItems) && clientItems.length > 0;
  let rawItems: { ean: string; name: string; qty: number; unit: string; price: number }[] =
    hasClientItems ? clientItems! : [];

  let itemsSource: "client" | "sefaz" | "unavailable" = hasClientItems ? "client" : "unavailable";

  // Try SEFAZ XML lookup when no items provided (best-effort, 6s timeout)
  if (!hasClientItems) {
    const sefazItems = await fetchItemsFromSefaz(chave, parsed.stateCode);
    if (sefazItems.length > 0) {
      rawItems = sefazItems;
      itemsSource = "sefaz";
    }
  }

  const enrichedItems = await enrichItems(rawItems);
  const totalValue = enrichedItems.reduce((s, i) => s + i.price * i.qty, 0);
  const itemCount = enrichedItems.length;

  // ── Points calculation ───────────────────────────────────────────────────
  const now = new Date();
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;
  const points = calcPoints(itemCount, isWeekend);
  const bonus = itemCount > 10;

  // ── Persist NF-e record FIRST (atomicity: points only awarded if this succeeds) ──
  const effectivePlaceId = placeId ?? `cnpj:${parsed.cnpj}`;
  try {
    await db.insert(nfceRecordsTable).values({
      chaveAcesso: chave,
      cnpj: parsed.cnpjFormatted,
      storeName,
      placeId: effectivePlaceId,
      userId,
      totalValue: String(totalValue.toFixed(2)),
      itemCount,
      items: enrichedItems as any,
      pointsAwarded: points,
      processedAt: now,
      source: "nfce_api",
      stateCode: parsed.stateCode,
      docNumber: parsed.docNumber,
    });
  } catch (err) {
    console.error("nfce insert error:", err);
    res.status(500).json({ ok: false, error: "Erro ao registrar nota fiscal." });
    return;
  }

  // ── Insert price reports AFTER NF-e record (safe: NF-e already committed) ──
  const priceReports = await insertPriceReports(enrichedItems, effectivePlaceId, userId);

  // ── Log to central points_history ────────────────────────────────────────
  await logPoints({
    userId,
    actionType: "nfce",
    pointsAmount: points,
    referenceId: chave,
    metadata: {
      storeName,
      cnpj: parsed.cnpjFormatted,
      itemCount,
      totalValue,
      bonus: bonus ? "2x (>10 itens)" : isWeekend ? "1.2x (fim de semana)" : null,
    },
  });

  res.status(201).json({
    ok: true,
    duplicate: false,
    itemsSource,

    // ── For the customer ────────────────────────────────────────────────────
    customer: {
      points,
      itemCount,
      storeName,
      cnpj: parsed.cnpjFormatted,
      totalValue,
      bonus,
      stateCode: parsed.stateCode,
      stateName: parsed.stateName,
      model: parsed.modelName,
      itemsSource,
    },

    // ── For the system (price indexing) ────────────────────────────────────
    system: {
      priceReports,
      placeId: effectivePlaceId,
      cnpj: parsed.cnpj,
      docNumber: parsed.docNumber,
    },

    // ── For the merchant (purchase analytics) ──────────────────────────────
    merchant: {
      cnpj: parsed.cnpjFormatted,
      storeName,
      docNumber: parsed.docNumber,
      serie: parsed.serie,
      year: parsed.year,
      month: parsed.month,
      items: enrichedItems,
      totalValue,
      itemCount,
      processedAt: now,
      priceReportsCount: priceReports.length,
    },
  });
});

/**
 * GET /api/nfce/:chave
 * Check if an access key was already processed and retrieve its record.
 */
nfceRouter.get("/nfce/:chave", async (req, res) => {
  const chave = req.params.chave.trim().replace(/\D/g, "");
  if (chave.length !== 44) {
    res.status(400).json({ error: "Chave inválida." });
    return;
  }

  try {
    const rows = await db
      .select()
      .from(nfceRecordsTable)
      .where(eq(nfceRecordsTable.chaveAcesso, chave))
      .limit(1);

    if (!rows.length) {
      res.json({ found: false });
      return;
    }

    res.json({ found: true, record: rows[0] });
  } catch (err) {
    console.error("GET /nfce/:chave error:", err);
    res.status(500).json({ error: "Erro interno." });
  }
});

/**
 * GET /api/nfce/merchant/:cnpj
 * Return all NF-e records for a specific merchant CNPJ (merchant dashboard).
 */
nfceRouter.get("/nfce/merchant/:cnpj", async (req, res) => {
  const cnpj = req.params.cnpj.replace(/\D/g, "");
  if (cnpj.length !== 14) {
    res.status(400).json({ error: "CNPJ inválido." });
    return;
  }
  const formatted = cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");

  try {
    const rows = await db
      .select()
      .from(nfceRecordsTable)
      .where(eq(nfceRecordsTable.cnpj, formatted))
      .limit(100);

    const totalPurchases = rows.length;
    const totalItemsIndexed = rows.reduce((s, r) => s + (r.itemCount ?? 0), 0);
    const totalRevenue = rows.reduce((s, r) => s + Number(r.totalValue ?? 0), 0);

    res.json({
      cnpj: formatted,
      totalPurchases,
      totalItemsIndexed,
      totalRevenue: totalRevenue.toFixed(2),
      records: rows.map((r) => ({
        id: r.id,
        docNumber: r.docNumber,
        itemCount: r.itemCount,
        totalValue: r.totalValue,
        processedAt: r.processedAt,
      })),
    });
  } catch (err) {
    console.error("GET /nfce/merchant/:cnpj error:", err);
    res.status(500).json({ error: "Erro interno." });
  }
});

export default nfceRouter;
