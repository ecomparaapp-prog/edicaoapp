import { Router } from "express";
import { pool } from "@workspace/db";
import { isValidUserId } from "../utils/requireUser";
import { runWeeklySnapshot } from "../services/weeklyReset";
import { getPointsConfig, invalidatePointsConfigCache } from "../services/pointsConfig";

const prizesRouter = Router();

// ── Public: check if user has a claimable prize ────────────────────────────

prizesRouter.get("/prizes/my-prizes", async (req, res) => {
  const userId = req.query.userId as string | undefined;
  if (!isValidUserId(userId)) {
    res.status(401).json({ error: "userId inválido." });
    return;
  }

  try {
    const client = await pool.connect();
    try {
      // Most recent unclaimed/pending prize for this user
      const row = await client.query<{
        id: number;
        week_start: string;
        rank: number;
        weekly_points: number;
        prize_amount: string;
        status: string;
        claimed_at: string | null;
      }>(`
        SELECT id, week_start, rank, weekly_points, prize_amount, status, claimed_at
        FROM weekly_winners
        WHERE user_id = $1
        ORDER BY week_start DESC
        LIMIT 1
      `, [userId]);

      if (!row.rows.length) {
        res.json({ hasPrize: false, winner: null });
        return;
      }

      const w = row.rows[0]!;
      res.json({
        hasPrize: w.status === "pending",
        winner: {
          id: w.id,
          weekStart: w.week_start,
          rank: w.rank,
          weeklyPoints: w.weekly_points,
          prizeAmount: parseFloat(w.prize_amount),
          status: w.status,
          claimedAt: w.claimed_at,
        },
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("GET /prizes/my-prizes error:", err);
    res.status(500).json({ error: "Erro ao verificar prêmios." });
  }
});

// ── Public: redeem a prize ──────────────────────────────────────────────────

prizesRouter.post("/prizes/redeem", async (req, res) => {
  const { userId, winnerId, pixKey } = req.body as {
    userId?: string;
    winnerId?: number;
    pixKey?: string;
  };

  if (!isValidUserId(userId)) {
    res.status(401).json({ error: "Login necessário para resgatar prêmios." });
    return;
  }
  if (!winnerId || !pixKey?.trim()) {
    res.status(400).json({ error: "winnerId e pixKey são obrigatórios." });
    return;
  }

  try {
    const client = await pool.connect();
    try {
      // Verify ownership + status
      const check = await client.query<{ id: number; status: string; prize_amount: string }>(
        `SELECT id, status, prize_amount FROM weekly_winners WHERE id = $1 AND user_id = $2`,
        [winnerId, userId]
      );

      if (!check.rows.length) {
        res.status(404).json({ error: "Prêmio não encontrado." });
        return;
      }
      const winner = check.rows[0]!;
      if (winner.status === "claimed" || winner.status === "paid") {
        res.status(409).json({ error: "Prêmio já resgatado." });
        return;
      }
      if (winner.status === "expired") {
        res.status(410).json({ error: "Prazo de resgate expirado (7 dias)." });
        return;
      }

      await client.query(
        `UPDATE weekly_winners SET status = 'claimed', pix_key = $1, claimed_at = NOW() WHERE id = $2`,
        [pixKey.trim(), winnerId]
      );

      res.json({ ok: true, prizeAmount: parseFloat(winner.prize_amount), message: "Resgate solicitado! O pagamento via PIX será realizado em até 48h." });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("POST /prizes/redeem error:", err);
    res.status(500).json({ error: "Erro ao processar resgate." });
  }
});

// ── Admin: manage prize tiers ───────────────────────────────────────────────

prizesRouter.get("/admin/prize-tiers", async (_req, res) => {
  try {
    const client = await pool.connect();
    try {
      const rows = await client.query(
        `SELECT position, prize_amount::float, label, updated_at FROM prize_tiers ORDER BY position ASC`
      );
      res.json({ tiers: rows.rows });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("GET /admin/prize-tiers error:", err);
    res.status(500).json({ error: "Erro ao carregar tiers." });
  }
});

prizesRouter.put("/admin/prize-tiers", async (req, res) => {
  const { tiers } = req.body as { tiers?: { position: number; amount: number; label?: string }[] };

  if (!Array.isArray(tiers) || tiers.length === 0) {
    res.status(400).json({ error: "tiers deve ser um array não-vazio." });
    return;
  }

  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const t of tiers) {
        if (!t.position || t.amount == null || t.amount < 0) continue;
        await client.query(
          `UPDATE prize_tiers SET prize_amount = $1, label = COALESCE($2, label), updated_at = NOW() WHERE position = $3`,
          [t.amount, t.label ?? null, t.position]
        );
      }
      await client.query("COMMIT");
      res.json({ ok: true });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("PUT /admin/prize-tiers error:", err);
    res.status(500).json({ error: "Erro ao atualizar tiers." });
  }
});

// ── Admin: list weekly winners ──────────────────────────────────────────────

prizesRouter.get("/admin/weekly-winners", async (req, res) => {
  const weekFilter = req.query.week as string | undefined;

  try {
    const client = await pool.connect();
    try {
      let query: string;
      let params: string[];

      if (weekFilter) {
        query = `
          SELECT ww.id, ww.week_start, ww.user_id, ww.rank, ww.weekly_points,
                 ww.prize_amount::float, ww.status, ww.pix_key, ww.claimed_at, ww.paid_at, ww.admin_note,
                 up.nickname, up.full_name
          FROM weekly_winners ww
          LEFT JOIN user_profiles up ON up.user_id = ww.user_id
          WHERE ww.week_start = $1
          ORDER BY ww.rank ASC
        `;
        params = [weekFilter];
      } else {
        query = `
          SELECT ww.id, ww.week_start, ww.user_id, ww.rank, ww.weekly_points,
                 ww.prize_amount::float, ww.status, ww.pix_key, ww.claimed_at, ww.paid_at, ww.admin_note,
                 up.nickname, up.full_name
          FROM weekly_winners ww
          LEFT JOIN user_profiles up ON up.user_id = ww.user_id
          ORDER BY ww.week_start DESC, ww.rank ASC
          LIMIT 100
        `;
        params = [];
      }

      const rows = await client.query(query, params);

      // Also return distinct weeks for filtering
      const weeks = await client.query(
        `SELECT DISTINCT week_start FROM weekly_winners ORDER BY week_start DESC LIMIT 12`
      );

      res.json({ winners: rows.rows, availableWeeks: weeks.rows.map((r: any) => r.week_start) });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("GET /admin/weekly-winners error:", err);
    res.status(500).json({ error: "Erro ao carregar vencedores." });
  }
});

// ── Admin: mark winner as paid ──────────────────────────────────────────────

prizesRouter.post("/admin/weekly-winners/:id/mark-paid", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { note } = req.body as { note?: string };

  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido." });
    return;
  }

  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `UPDATE weekly_winners SET status = 'paid', paid_at = NOW(), admin_note = COALESCE($1, admin_note) WHERE id = $2 RETURNING id, user_id, prize_amount`,
        [note ?? null, id]
      );
      if (!result.rows.length) {
        res.status(404).json({ error: "Vencedor não encontrado." });
        return;
      }
      res.json({ ok: true, winner: result.rows[0] });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("POST /admin/weekly-winners/:id/mark-paid error:", err);
    res.status(500).json({ error: "Erro ao marcar pagamento." });
  }
});

// ── Admin: manual snapshot trigger (for testing) ───────────────────────────

prizesRouter.post("/admin/weekly-snapshot", async (_req, res) => {
  try {
    const result = await runWeeklySnapshot();
    res.json(result);
  } catch (err) {
    console.error("POST /admin/weekly-snapshot error:", err);
    res.status(500).json({ error: "Erro ao executar snapshot." });
  }
});

// ── Admin: ban/unban user from ranking ─────────────────────────────────────

prizesRouter.post("/admin/ranking/ban/:userId", async (req, res) => {
  const { userId } = req.params;
  const { ban = true } = req.body as { ban?: boolean };

  try {
    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO user_profiles (user_id, is_banned) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET is_banned = $2`,
        [userId, ban]
      );

      // If banning, remove from current week's pending winners
      if (ban) {
        await client.query(
          `UPDATE weekly_winners SET status = 'expired', admin_note = 'Removido por fraude'
           WHERE user_id = $1 AND status = 'pending'`,
          [userId]
        );
      }
      res.json({ ok: true, banned: ban });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("POST /admin/ranking/ban error:", err);
    res.status(500).json({ error: "Erro ao atualizar status de banimento." });
  }
});

// ── Admin: points config ────────────────────────────────────────────────────

// GET /api/admin/points-config — returns current + pending config
prizesRouter.get("/admin/points-config", async (_req, res) => {
  try {
    const client = await pool.connect();
    try {
      const current = await client.query<{ key: string; value: string; updated_at: string }>(
        `SELECT key, value, updated_at FROM current_points_config ORDER BY key`
      );
      const pending = await client.query<{ key: string; value: string; queued_at: string }>(
        `SELECT key, value, queued_at FROM pending_points_config ORDER BY key`
      );
      res.json({
        current: current.rows,
        pending: pending.rows,
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("GET /admin/points-config error:", err);
    res.status(500).json({ error: "Erro ao carregar configuração de pontos." });
  }
});

// PUT /api/admin/points-config — queue a config change (applied at next weekly reset)
prizesRouter.put("/admin/points-config", async (req, res) => {
  const { key, value, applyNow } = req.body as { key?: string; value?: unknown; applyNow?: boolean };

  const ALLOWED_KEYS = ["store_indication", "referral", "nfce_base", "price_ocr", "price_confirmation", "price_partner"];

  if (!key || !ALLOWED_KEYS.includes(key)) {
    res.status(400).json({ error: `Chave inválida. Permitidas: ${ALLOWED_KEYS.join(", ")}` });
    return;
  }
  const numVal = Number(value);
  if (!Number.isInteger(numVal) || numVal < 0) {
    res.status(400).json({ error: "Valor deve ser um inteiro não-negativo." });
    return;
  }

  try {
    const client = await pool.connect();
    try {
      if (applyNow) {
        // Apply immediately to current config + log
        const oldRow = await client.query<{ value: string }>(
          `SELECT value FROM current_points_config WHERE key = $1`,
          [key]
        );
        const oldValue = oldRow.rows[0]?.value ?? null;
        await client.query(
          `INSERT INTO current_points_config (key, value, updated_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
          [key, String(numVal)]
        );
        await client.query(
          `INSERT INTO points_config_log (key, old_value, new_value, changed_at, changed_by)
           VALUES ($1, $2, $3, NOW(), 'admin_immediate')`,
          [key, oldValue, String(numVal)]
        );
        // Remove from pending if it was there
        await client.query(`DELETE FROM pending_points_config WHERE key = $1`, [key]);
        // Bust the in-memory cache
        invalidatePointsConfigCache();
        res.json({ ok: true, applied: "immediate", key, value: numVal });
      } else {
        // Queue for next weekly reset
        await client.query(
          `INSERT INTO pending_points_config (key, value, queued_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, queued_at = NOW()`,
          [key, String(numVal)]
        );
        res.json({ ok: true, applied: "pending", key, value: numVal });
      }
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("PUT /admin/points-config error:", err);
    res.status(500).json({ error: "Erro ao atualizar configuração de pontos." });
  }
});

// DELETE /api/admin/points-config/pending/:key — cancel a pending change
prizesRouter.delete("/admin/points-config/pending/:key", async (req, res) => {
  const { key } = req.params;
  try {
    const client = await pool.connect();
    try {
      await client.query(`DELETE FROM pending_points_config WHERE key = $1`, [key]);
      res.json({ ok: true, cancelled: key });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("DELETE /admin/points-config/pending error:", err);
    res.status(500).json({ error: "Erro ao cancelar configuração pendente." });
  }
});

export default prizesRouter;
