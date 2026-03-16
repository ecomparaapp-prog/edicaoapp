import { pool } from "@workspace/db";

export async function ensurePostgis(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("CREATE EXTENSION IF NOT EXISTS postgis;");

    const colCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'places_cache' AND column_name = 'geom'
    `);

    if (colCheck.rows.length === 0) {
      await client.query(`
        ALTER TABLE places_cache ADD COLUMN geom geography(Point, 4326)
          GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography) STORED;
      `);
    }

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_places_cache_geom ON places_cache USING GIST(geom);
    `);

    console.log("[PostGIS] Extension and geom column verified.");
  } catch (err) {
    console.error("[PostGIS] Setup error:", err);
    throw err;
  } finally {
    client.release();
  }
}
