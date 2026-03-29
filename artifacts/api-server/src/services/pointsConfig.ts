/**
 * Points configuration service.
 * Reads from current_points_config table with an in-memory cache (60s TTL).
 * All point-awarding routes must call getPointsConfig() instead of hardcoded values.
 */

import { pool } from "@workspace/db";

export interface PointsConfig {
  store_indication: number;
  referral: number;
  nfce_base: number;
  price_ocr: number;
  price_confirmation: number;
  price_partner: number;
}

export const POINTS_DEFAULTS: PointsConfig = {
  store_indication: 1000,
  referral: 2000,
  nfce_base: 150,
  price_ocr: 30,
  price_confirmation: 15,
  price_partner: 10,
};

let cache: PointsConfig | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 60_000;

export async function getPointsConfig(): Promise<PointsConfig> {
  const now = Date.now();
  if (cache && now < cacheExpiresAt) return cache;

  try {
    const client = await pool.connect();
    try {
      const rows = await client.query<{ action: string; points: number }>(
        `SELECT action, points FROM current_points_config`
      );
      const config: PointsConfig = { ...POINTS_DEFAULTS };
      for (const row of rows.rows) {
        if (row.action in config) {
          (config as Record<string, number>)[row.action] = Number(row.points);
        }
      }
      cache = config;
      cacheExpiresAt = now + CACHE_TTL_MS;
      return config;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("[PointsConfig] Failed to load config, using defaults:", err);
    return { ...POINTS_DEFAULTS };
  }
}

/** Invalidate the in-memory cache — call after promoting pending → current */
export function invalidatePointsConfigCache(): void {
  cache = null;
  cacheExpiresAt = 0;
}
