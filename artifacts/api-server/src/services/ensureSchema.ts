import { pool } from "@workspace/db";

export async function ensureSchema(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("CREATE EXTENSION IF NOT EXISTS postgis;");

    await client.query(`
      CREATE TABLE IF NOT EXISTS app_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS api_credit_usage (
        id SERIAL PRIMARY KEY,
        month_key TEXT NOT NULL UNIQUE,
        calls_count INTEGER NOT NULL DEFAULT 0,
        suspended_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS ean_cache (
        ean TEXT PRIMARY KEY,
        description TEXT NOT NULL,
        brand TEXT,
        category TEXT,
        thumbnail_url TEXT,
        raw_json JSONB,
        cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS search_zones (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        lat DOUBLE PRECISION NOT NULL,
        lng DOUBLE PRECISION NOT NULL,
        radius_km DOUBLE PRECISION NOT NULL DEFAULT 5,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        last_synced_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS places_cache (
        google_place_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        address TEXT,
        lat DOUBLE PRECISION NOT NULL,
        lng DOUBLE PRECISION NOT NULL,
        phone TEXT,
        website TEXT,
        photo_url TEXT,
        rating DOUBLE PRECISION,
        status TEXT NOT NULL DEFAULT 'shadow',
        is_shadow BOOLEAN NOT NULL DEFAULT TRUE,
        is_partner BOOLEAN NOT NULL DEFAULT FALSE,
        geom geography(Point, 4326),
        synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      ALTER TABLE places_cache
        ADD COLUMN IF NOT EXISTS is_shadow BOOLEAN NOT NULL DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS is_partner BOOLEAN NOT NULL DEFAULT FALSE;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_places_cache_geom ON places_cache USING GIST (geom);
    `);

    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_name = 'places_cache' AND constraint_name = 'chk_places_cache_status'
        ) THEN
          ALTER TABLE places_cache
            ADD CONSTRAINT chk_places_cache_status CHECK (status IN ('shadow', 'verified'));
        END IF;
      END $$;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS partnership_requests (
        id SERIAL PRIMARY KEY,
        google_place_id TEXT NOT NULL,
        place_name TEXT NOT NULL,
        requester_name TEXT NOT NULL,
        requester_email TEXT NOT NULL,
        message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        nickname TEXT NOT NULL UNIQUE,
        full_name TEXT,
        cpf TEXT,
        phone TEXT,
        address TEXT,
        pix_key TEXT,
        full_name_locked BOOLEAN NOT NULL DEFAULT FALSE,
        cpf_locked BOOLEAN NOT NULL DEFAULT FALSE,
        profile_bonus_awarded BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS price_reports (
        id SERIAL PRIMARY KEY,
        product_ean TEXT NOT NULL,
        product_name TEXT NOT NULL,
        place_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        price NUMERIC(10, 2) NOT NULL,
        reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        is_verified BOOLEAN NOT NULL DEFAULT FALSE,
        upvotes INTEGER NOT NULL DEFAULT 0,
        downvotes INTEGER NOT NULL DEFAULT 0
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS merchant_registrations (
        id SERIAL PRIMARY KEY,
        google_place_id TEXT,
        cnpj TEXT NOT NULL,
        razao_social TEXT NOT NULL,
        nome_fantasia TEXT NOT NULL,
        inscricao_estadual TEXT,
        cep TEXT,
        address TEXT,
        lat NUMERIC(10, 7),
        lng NUMERIC(10, 7),
        operating_hours JSON,
        phone TEXT,
        whatsapp TEXT,
        parking TEXT DEFAULT 'none',
        card_brands JSON DEFAULT '[]',
        delivery TEXT DEFAULT 'none',
        logo_url TEXT,
        verification_method TEXT,
        verification_contact TEXT,
        verification_code TEXT,
        verified_at TIMESTAMPTZ,
        status TEXT NOT NULL DEFAULT 'pending_verification',
        admin_note TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS nfce_records (
        id SERIAL PRIMARY KEY,
        chave_acesso TEXT NOT NULL UNIQUE,
        cnpj TEXT,
        store_name TEXT,
        place_id TEXT,
        user_id TEXT NOT NULL,
        total_value NUMERIC(10, 2),
        item_count INTEGER DEFAULT 0,
        items JSONB,
        points_awarded INTEGER DEFAULT 0,
        processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        source TEXT DEFAULT 'manual',
        state_code TEXT,
        doc_number TEXT
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS store_indications (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        google_place_id TEXT NOT NULL,
        store_name TEXT NOT NULL,
        points_awarded INTEGER NOT NULL DEFAULT 1000,
        reports_count INTEGER NOT NULL DEFAULT 0,
        points_deducted BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, google_place_id)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS store_indication_reports (
        id SERIAL PRIMARY KEY,
        google_place_id TEXT NOT NULL,
        reporter_user_id TEXT NOT NULL,
        reason TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(reporter_user_id, google_place_id)
      );
    `);

    await client.query(`
      ALTER TABLE places_cache ADD COLUMN IF NOT EXISTS indicated_by TEXT;
      ALTER TABLE places_cache ADD COLUMN IF NOT EXISTS favorites_count INTEGER NOT NULL DEFAULT 0;
    `);

    await client.query(`
      ALTER TABLE user_profiles
        ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
        ADD COLUMN IF NOT EXISTS referral_count INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS device_id TEXT;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS referrals (
        id SERIAL PRIMARY KEY,
        referrer_user_id TEXT NOT NULL,
        referred_user_id TEXT NOT NULL UNIQUE,
        referred_cpf TEXT NOT NULL,
        referred_device_id TEXT,
        points_awarded INTEGER NOT NULL DEFAULT 2000,
        status TEXT NOT NULL DEFAULT 'completed',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals (referrer_user_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_referrals_referred_cpf ON referrals (referred_cpf);
    `);

    console.log("[Schema] All tables verified/created.");
  } catch (err) {
    console.error("[Schema] Setup error:", err);
    throw err;
  } finally {
    client.release();
  }
}
