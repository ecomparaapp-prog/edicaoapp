import { Router } from "express";
import { pool } from "@workspace/db";

const pointsRouter = Router();

const ACTION_LABELS: Record<string, string> = {
  store_indication: "Indicação de Mercado",
  referral: "Indicação de Amigo",
  nfce: "Nota Fiscal (NFC-e)",
  price_report: "Registro/Confirmação de Preço",
  profile_bonus: "Cadastro Completo",
};

const ACTION_ICONS: Record<string, string> = {
  store_indication: "map-pin",
  referral: "users",
  nfce: "file-text",
  price_report: "tag",
  profile_bonus: "user-check",
};

// GET /api/points/history/:userId — last 50 transactions
pointsRouter.get("/points/history/:userId", async (req, res) => {
  const { userId } = req.params;
  if (!userId) {
    res.status(400).json({ error: "userId obrigatório." });
    return;
  }

  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT id, action_type, points_amount, reference_id, metadata, created_at
         FROM points_history
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 50`,
        [userId],
      );

      const history = result.rows.map((row) => ({
        id: String(row.id),
        action: ACTION_LABELS[row.action_type] ?? row.action_type,
        actionType: row.action_type,
        points: row.points_amount,
        icon: ACTION_ICONS[row.action_type] ?? "zap",
        referenceId: row.reference_id,
        metadata: row.metadata,
        date: formatDate(new Date(row.created_at)),
        rawDate: row.created_at,
      }));

      res.json({ history });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("GET /points/history error:", err);
    res.status(500).json({ error: "Erro ao buscar histórico de pontos." });
  }
});

// GET /api/points/total/:userId — sum of all points
pointsRouter.get("/points/total/:userId", async (req, res) => {
  const { userId } = req.params;
  if (!userId) {
    res.status(400).json({ error: "userId obrigatório." });
    return;
  }

  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT
           COALESCE(SUM(points_amount), 0) AS total_points,
           COALESCE(SUM(CASE WHEN created_at >= date_trunc('week', NOW()) THEN points_amount ELSE 0 END), 0) AS weekly_points,
           COUNT(*) AS transaction_count
         FROM points_history
         WHERE user_id = $1`,
        [userId],
      );

      const row = result.rows[0];
      res.json({
        totalPoints: Number(row.total_points),
        weeklyPoints: Number(row.weekly_points),
        transactionCount: Number(row.transaction_count),
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("GET /points/total error:", err);
    res.status(500).json({ error: "Erro ao calcular pontos." });
  }
});

function formatDate(d: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = diffMs / 3600000;
  const diffD = diffMs / 86400000;

  if (diffH < 24 && d.getDate() === now.getDate()) {
    return `Hoje, ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  }
  if (diffD < 2) {
    return `Ontem, ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  }
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) +
    `, ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

export default pointsRouter;
