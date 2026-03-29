import { pool } from "@workspace/db";

export type PointsActionType =
  | "store_indication"
  | "referral"
  | "nfce"
  | "price_report"
  | "profile_bonus";

export interface LogPointsOptions {
  userId: string;
  actionType: PointsActionType;
  pointsAmount: number;
  referenceId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Appends a row to points_history for audit and display.
 * Fire-and-forget safe — logs errors but never throws.
 */
export async function logPoints(opts: LogPointsOptions): Promise<void> {
  const { userId, actionType, pointsAmount, referenceId, metadata } = opts;
  try {
    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO points_history (user_id, action_type, points_amount, reference_id, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [
          userId,
          actionType,
          pointsAmount,
          referenceId ?? null,
          metadata ? JSON.stringify(metadata) : null,
        ],
      );
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("[PointsLogger] Failed to log points:", err);
  }
}
