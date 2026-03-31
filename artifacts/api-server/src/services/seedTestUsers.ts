import { pool } from "@workspace/db";
import bcrypt from "bcryptjs";
import crypto from "crypto";

function hashAdvertiserPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "ecompara_salt").digest("hex");
}

export async function seedTestUsers(): Promise<void> {
  if (process.env.NODE_ENV === "production") return;

  const emailSuper = process.env.TEST_USER_SUPERMERCADO ?? "teste@supermercado.com.br";
  const passSuper  = process.env.TEST_PASS_SUPERMERCADO  ?? "super123";
  const emailMarcas = process.env.TEST_USER_MARCAS ?? "teste@marcas.com.br";
  const passMarcas  = process.env.TEST_PASS_MARCAS  ?? "marca123";

  const client = await pool.connect();
  try {
    // ── Supermercado de Teste ─────────────────────────────────────────────────
    const existingMerchant = await client.query(
      "SELECT id FROM merchant_users WHERE email = $1",
      [emailSuper]
    );

    if (existingMerchant.rowCount === 0) {
      const passwordHash = await bcrypt.hash(passSuper, 12);

      // Cria o registro da loja (merchant_registrations)
      const regResult = await client.query(
        `INSERT INTO merchant_registrations
           (nome_fantasia, razao_social, status, created_at, updated_at)
         VALUES ('Supermercado Teste', 'Supermercado Teste Ltda', 'approved', NOW(), NOW())
         RETURNING id`,
      );
      const registrationId: number = regResult.rows[0].id;

      // Cria o usuário do portal (merchant_users)
      await client.query(
        `INSERT INTO merchant_users
           (merchant_registration_id, email, password_hash, must_change_password, plan, created_at, updated_at)
         VALUES ($1, $2, $3, FALSE, 'plus', NOW(), NOW())`,
        [registrationId, emailSuper, passwordHash]
      );

      console.log(`[seed] Supermercado de teste criado: ${emailSuper}`);
    }

    // ── Portal Marcas de Teste ────────────────────────────────────────────────
    const existingAdvertiser = await client.query(
      "SELECT id FROM advertisers WHERE email = $1",
      [emailMarcas]
    );

    if (existingAdvertiser.rowCount === 0) {
      const passwordHash = hashAdvertiserPassword(passMarcas);

      await client.query(
        `INSERT INTO advertisers
           (company_name, cnpj, email, status, password_hash, created_at, updated_at)
         VALUES ('Marca Teste', '00000000000001', $1, 'active', $2, NOW(), NOW())`,
        [emailMarcas, passwordHash]
      );

      console.log(`[seed] Anunciante de teste criado: ${emailMarcas}`);
    }
  } catch (err) {
    console.error("[seed] Erro ao criar usuários de teste:", err);
  } finally {
    client.release();
  }
}
