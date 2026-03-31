import { Router } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import { merchantUsersTable, merchantRegistrationsTable, priceReportsTable, placesCacheTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { merchantAuthMiddleware } from "./merchant-auth";
import { emitCSVProgress, emitPlanChanged, emitSessionInvalidated } from "../websocket";
import bcrypt from "bcryptjs";

const router = Router();
router.use(merchantAuthMiddleware);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "text/csv" || file.originalname.endsWith(".csv")) {
      cb(null, true);
    } else {
      cb(new Error("Apenas arquivos CSV são aceitos."));
    }
  },
});

// ── POST /api/merchant/bi/import-csv ──────────────────────────────────────────
router.post("/merchant/bi/import-csv", upload.single("file"), async (req: any, res) => {
  const merchantUserId: number = req.merchantUserId;

  if (!req.file) {
    res.status(400).json({ error: "Arquivo CSV não enviado." });
    return;
  }

  try {
    const raw = req.file.buffer.toString("utf-8");
    const lines = raw.split(/\r?\n/).filter((l) => l.trim());

    if (lines.length < 2) {
      res.status(400).json({ error: "CSV deve conter cabeçalho e pelo menos uma linha de dados." });
      return;
    }

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
    const eanIdx = headers.findIndex((h) => h === "ean" || h === "codigo" || h === "codigo_ean");
    const priceIdx = headers.findIndex((h) => h === "preco" || h === "price" || h === "valor" || h === "preço");
    const placeIdx = headers.findIndex((h) => h === "place_id" || h === "loja" || h === "store_id");

    if (eanIdx === -1 || priceIdx === -1) {
      res.status(400).json({
        error: "Colunas obrigatórias não encontradas. O CSV deve ter: ean, preco (e opcionalmente place_id).",
      });
      return;
    }

    const dataLines = lines.slice(1);
    const total = dataLines.length;

    emitCSVProgress(merchantUserId, { status: "started", total, processed: 0 });
    res.json({ ok: true, total, message: "Importação iniciada. Acompanhe o progresso em tempo real." });

    let processed = 0;
    let errors = 0;

    const [merchantUser] = await db
      .select({ merchantRegistrationId: merchantUsersTable.merchantRegistrationId })
      .from(merchantUsersTable)
      .where(eq(merchantUsersTable.id, merchantUserId));

    let defaultPlaceId: string | null = null;
    if (merchantUser?.merchantRegistrationId) {
      const [reg] = await db
        .select({ googlePlaceId: merchantRegistrationsTable.googlePlaceId })
        .from(merchantRegistrationsTable)
        .where(eq(merchantRegistrationsTable.id, merchantUser.merchantRegistrationId));
      defaultPlaceId = reg?.googlePlaceId ?? null;
    }

    for (const line of dataLines) {
      if (!line.trim()) continue;

      const cols = line.split(",").map((c) => c.trim().replace(/"/g, ""));
      const ean = cols[eanIdx]?.replace(/\D/g, "");
      const rawPrice = cols[priceIdx]?.replace(",", ".");
      const price = parseFloat(rawPrice);
      const placeId = placeIdx >= 0 ? (cols[placeIdx] ?? defaultPlaceId) : defaultPlaceId;

      if (!ean || isNaN(price) || price <= 0 || !placeId) {
        errors++;
        processed++;
        continue;
      }

      try {
        await db.execute(sql`
          INSERT INTO price_reports (product_ean, place_id, price, user_id, report_type, is_verified, reported_at, created_at)
          VALUES (${ean}, ${placeId}, ${price}, ${"csv_import_" + merchantUserId}, 'partner', true, NOW(), NOW())
          ON CONFLICT DO NOTHING
        `);
        processed++;
      } catch {
        errors++;
        processed++;
      }

      if (processed % 10 === 0) {
        emitCSVProgress(merchantUserId, { status: "progress", processed, total, errors });
      }
    }

    emitCSVProgress(merchantUserId, {
      status: "complete",
      processed,
      total,
      errors,
      message: `${processed - errors} preços importados com sucesso. ${errors > 0 ? `${errors} linha(s) com erro.` : ""}`,
    });
  } catch (err) {
    console.error("CSV import error:", err);
    emitCSVProgress(merchantUserId, {
      status: "error",
      message: "Erro interno ao processar CSV.",
    });
  }
});

// ── POST /api/merchant/plan/upgrade ──────────────────────────────────────────
router.post("/merchant/plan/upgrade", async (req: any, res) => {
  const merchantUserId: number = req.merchantUserId;
  const { plan } = req.body as { plan?: string };

  if (!plan || !["normal", "plus"].includes(plan)) {
    res.status(400).json({ error: "Plano inválido. Valores aceitos: normal, plus." });
    return;
  }

  try {
    const [user] = await db
      .select({ plan: merchantUsersTable.plan })
      .from(merchantUsersTable)
      .where(eq(merchantUsersTable.id, merchantUserId));

    if (!user) {
      res.status(404).json({ error: "Usuário não encontrado." });
      return;
    }

    if (user.plan === plan) {
      res.json({ ok: true, plan, message: "Plano já ativo." });
      return;
    }

    await db
      .update(merchantUsersTable)
      .set({ plan: plan as "normal" | "plus", updatedAt: new Date() })
      .where(eq(merchantUsersTable.id, merchantUserId));

    emitPlanChanged(merchantUserId, plan);

    res.json({
      ok: true,
      plan,
      message: plan === "plus"
        ? "Plano Plus ativado com sucesso. Recursos desbloqueados em todas as plataformas."
        : "Plano Normal ativado.",
    });
  } catch (err) {
    console.error("Plan upgrade error:", err);
    res.status(500).json({ error: "Erro interno." });
  }
});

// ── POST /api/merchant/auth/reset-password-session ────────────────────────────
// Called after password reset to invalidate sessions on all devices
router.post("/merchant/session/invalidate", async (req: any, res) => {
  const merchantUserId: number = req.merchantUserId;
  emitSessionInvalidated(merchantUserId);
  res.json({ ok: true });
});

export default router;
