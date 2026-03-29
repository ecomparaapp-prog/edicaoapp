/**
 * Weekly ranking reset service.
 * Runs every Friday at 00:00 BRT (03:00 UTC).
 * - Takes a snapshot of the top 10 weekly earners.
 * - Saves them to weekly_winners with their prize amounts.
 * - Prizes expire 7 days after the snapshot.
 * - Banned users are excluded.
 */

import cron from "node-cron";
import { pool } from "@workspace/db";

export async function runWeeklySnapshot(): Promise<{ ok: boolean; winnersInserted: number; weekStart: string }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Monday of the current week (UTC)
    const weekStart = await client.query<{ week_start: string }>(
      `SELECT date_trunc('week', NOW() AT TIME ZONE 'UTC')::date AS week_start`
    );
    const ws = weekStart.rows[0]!.week_start;

    // Top 10 earners this week, excluding banned users
    const topEarners = await client.query<{
      user_id: string;
      weekly_points: string;
    }>(`
      SELECT ph.user_id, COALESCE(SUM(ph.points_amount), 0)::integer AS weekly_points
      FROM points_history ph
      LEFT JOIN user_profiles up ON up.user_id = ph.user_id
      WHERE ph.created_at >= date_trunc('week', NOW() AT TIME ZONE 'UTC')
        AND ph.points_amount > 0
        AND (up.is_banned IS NULL OR up.is_banned = FALSE)
      GROUP BY ph.user_id
      ORDER BY weekly_points DESC
      LIMIT 10
    `);

    if (topEarners.rows.length === 0) {
      await client.query("COMMIT");
      return { ok: true, winnersInserted: 0, weekStart: ws };
    }

    // Fetch prize tiers
    const tiers = await client.query<{ position: number; prize_amount: string }>(
      `SELECT position, prize_amount FROM prize_tiers ORDER BY position ASC`
    );
    const tierMap: Record<number, string> = {};
    for (const t of tiers.rows) {
      tierMap[t.position] = t.prize_amount;
    }

    let inserted = 0;
    for (let i = 0; i < topEarners.rows.length; i++) {
      const rank = i + 1;
      const { user_id, weekly_points } = topEarners.rows[i]!;
      const prizeAmount = tierMap[rank] ?? "0";

      await client.query(
        `INSERT INTO weekly_winners (week_start, user_id, rank, weekly_points, prize_amount, status)
         VALUES ($1, $2, $3, $4, $5, 'pending')
         ON CONFLICT (week_start, user_id) DO NOTHING`,
        [ws, user_id, rank, parseInt(weekly_points), prizeAmount]
      );
      inserted++;
    }

    // Mark prizes older than 7 days as expired
    await client.query(`
      UPDATE weekly_winners
      SET status = 'expired'
      WHERE status = 'pending'
        AND created_at < NOW() - INTERVAL '7 days'
    `);

    await client.query("COMMIT");
    console.log(`[WeeklyReset] Snapshot for week ${ws}: ${inserted} winners saved.`);
    return { ok: true, winnersInserted: inserted, weekStart: ws };
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[WeeklyReset] Snapshot failed:", err);
    throw err;
  } finally {
    client.release();
  }
}

export function startWeeklyResetCron() {
  // Every Friday at 03:00 UTC = 00:00 BRT
  cron.schedule("0 3 * * 5", async () => {
    console.log("[WeeklyReset] Running Friday snapshot...");
    try {
      const result = await runWeeklySnapshot();
      console.log(`[WeeklyReset] Done: ${result.winnersInserted} winners for week ${result.weekStart}`);
    } catch (err) {
      console.error("[WeeklyReset] Cron job failed:", err);
    }
  }, { timezone: "UTC" });

  console.log("[WeeklyReset] Cron scheduled: every Friday 03:00 UTC");
}
