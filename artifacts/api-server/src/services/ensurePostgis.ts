import { pool } from "@workspace/db";

export async function ensurePostgis(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("CREATE EXTENSION IF NOT EXISTS postgis;");

    const chk = await client.query(`
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_name = 'places_cache' AND constraint_name = 'chk_places_cache_status'
    `);
    if (chk.rows.length === 0) {
      await client.query(`
        ALTER TABLE places_cache
        ADD CONSTRAINT chk_places_cache_status CHECK (status IN ('shadow', 'verified'));
      `).catch(() => {});
    }

    console.log("[PostGIS] Extension and constraints verified.");
  } catch (err) {
    console.error("[PostGIS] Setup error:", err);
    throw err;
  } finally {
    client.release();
  }
}
