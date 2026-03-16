import { pool } from "@workspace/db";

export async function ensurePostgis(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("CREATE EXTENSION IF NOT EXISTS postgis;");
    console.log("[PostGIS] Extension verified.");
  } catch (err) {
    console.error("[PostGIS] Extension setup error:", err);
    throw err;
  } finally {
    client.release();
  }
}
