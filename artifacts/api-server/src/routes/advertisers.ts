import { Router } from "express";
import { pool } from "@workspace/db";
import crypto from "crypto";
import { sendAdvertiserApproval } from "../services/emailService";

const router = Router();

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "ecompara_salt").digest("hex");
}

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// POST /api/advertisers/register — cadastro inicial (status: pending)
router.post("/advertisers/register", async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      companyName, cnpj, segment, website,
      contactName, role, email, whatsapp,
      reach, adFormat, budget,
    } = req.body;

    if (!companyName || !cnpj || !email) {
      return res.status(400).json({ error: "Campos obrigatórios: companyName, cnpj, email." });
    }

    const cnpjClean = String(cnpj).replace(/\D/g, "");

    await client.query(
      `INSERT INTO advertisers
        (company_name, cnpj, segment, website, contact_name, role, email, whatsapp,
         reach, ad_format, budget, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending',NOW(),NOW())
       ON CONFLICT (cnpj) DO UPDATE SET
         contact_name = EXCLUDED.contact_name,
         email        = EXCLUDED.email,
         updated_at   = NOW()`,
      [companyName, cnpjClean, segment ?? null, website ?? null,
       contactName ?? null, role ?? null, email, whatsapp ?? null,
       reach ?? null, adFormat ?? null, budget ?? null],
    );

    console.log(`[Advertisers] Nova solicitação: ${companyName} <${email}>`);
    return res.json({ ok: true, message: "Solicitação recebida. Análise em até 24h úteis." });
  } catch (err: any) {
    console.error("[advertisers] register error:", err);
    return res.status(500).json({ error: "Erro interno ao registrar anunciante." });
  } finally {
    client.release();
  }
});

// GET /api/advertisers/:cnpj/status — consulta status pelo CNPJ
router.get("/advertisers/:cnpj/status", async (req, res) => {
  const client = await pool.connect();
  try {
    const cnpjClean = req.params.cnpj.replace(/\D/g, "");
    const result = await client.query(
      "SELECT id, company_name, status, created_at FROM advertisers WHERE cnpj = $1 LIMIT 1",
      [cnpjClean],
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: "Anunciante não encontrado." });
    }
    const row = result.rows[0];
    if (row.status === "pending") {
      return res.json({ ...row, message: "Cadastro em análise. Aguarde contato em até 24h úteis." });
    }
    return res.json(row);
  } catch (err) {
    console.error("[advertisers] status error:", err);
    return res.status(500).json({ error: "Erro interno." });
  } finally {
    client.release();
  }
});

// POST /api/advertisers/login — login do anunciante
router.post("/advertisers/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    return res.status(400).json({ error: "E-mail e senha são obrigatórios." });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      "SELECT id, company_name, contact_name, email, status, password_hash FROM advertisers WHERE email = $1 LIMIT 1",
      [email.toLowerCase().trim()],
    );

    if (!result.rows.length) {
      return res.status(401).json({ error: "E-mail ou senha inválidos." });
    }

    const adv = result.rows[0];

    if (adv.status === "pending") {
      return res.status(403).json({ error: "Cadastro em análise. Você receberá um e-mail quando for aprovado." });
    }

    if (adv.status === "rejected") {
      return res.status(403).json({ error: "Cadastro não aprovado. Entre em contato com suporte@ecompara.com.br." });
    }

    if (!adv.password_hash) {
      return res.status(403).json({ error: "Acesso não configurado. Entre em contato com o suporte." });
    }

    if (adv.password_hash !== hashPassword(password)) {
      return res.status(401).json({ error: "E-mail ou senha inválidos." });
    }

    console.log(`[Advertisers] Login OK: ${adv.company_name} (id=${adv.id})`);
    return res.json({
      ok: true,
      advertiser: {
        id: adv.id,
        companyName: adv.company_name,
        contactName: adv.contact_name,
        email: adv.email,
        status: adv.status,
        role: "ROLE_ADVERTISER",
      },
    });
  } catch (err) {
    console.error("[advertisers] login error:", err);
    return res.status(500).json({ error: "Erro interno." });
  } finally {
    client.release();
  }
});

// GET /api/admin/advertisers — lista todos os anunciantes (admin), suporta ?status=
router.get("/admin/advertisers", async (req, res) => {
  const client = await pool.connect();
  try {
    const { status } = req.query as { status?: string };
    const params: string[] = [];
    let where = "";
    if (status) {
      params.push(status);
      where = `WHERE status = $1`;
    }
    const result = await client.query(
      `SELECT id, company_name, cnpj, segment, website, contact_name, role, email,
              whatsapp, reach, ad_format, budget, status, admin_note, created_at
       FROM advertisers ${where} ORDER BY created_at DESC`,
      params,
    );
    return res.json({ advertisers: result.rows });
  } catch (err) {
    console.error("[advertisers] admin list error:", err);
    return res.status(500).json({ error: "Erro interno." });
  } finally {
    client.release();
  }
});

// POST /api/admin/advertisers/:id/approve — aprova e envia credenciais por e-mail
router.post("/admin/advertisers/:id/approve", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido." });

  const client = await pool.connect();
  try {
    const lookup = await client.query(
      "SELECT id, company_name, contact_name, email, status FROM advertisers WHERE id = $1 LIMIT 1",
      [id],
    );

    if (!lookup.rows.length) {
      return res.status(404).json({ error: "Anunciante não encontrado." });
    }

    const adv = lookup.rows[0];

    if (adv.status === "active") {
      return res.status(409).json({ error: "Anunciante já está ativo." });
    }

    const { note } = req.body as { note?: string };
    const tempPassword = generateTempPassword();
    const passwordHash = hashPassword(tempPassword);

    await client.query(
      "UPDATE advertisers SET status='active', password_hash=$1, admin_note=$3, updated_at=NOW() WHERE id=$2",
      [passwordHash, id, note ?? null],
    );

    const emailResult = await sendAdvertiserApproval({
      to: adv.email,
      contactName: adv.contact_name ?? adv.company_name,
      companyName: adv.company_name,
      tempPassword,
    });

    console.log(`[Advertisers] ✅ Aprovado: ${adv.company_name} (id=${id}) — senha temporária gerada`);

    return res.json({
      ok: true,
      message: `Anunciante "${adv.company_name}" aprovado com sucesso.`,
      email: adv.email,
      emailSent: emailResult.sent,
      emailPreviewUrl: emailResult.previewUrl ?? null,
      _devTempPassword: process.env.NODE_ENV === "development" ? tempPassword : undefined,
    });
  } catch (err) {
    console.error("[advertisers] approve error:", err);
    return res.status(500).json({ error: "Erro interno ao aprovar anunciante." });
  } finally {
    client.release();
  }
});

// POST /api/admin/advertisers/:id/reject — rejeita cadastro
router.post("/admin/advertisers/:id/reject", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido." });

  const { note } = req.body as { note?: string };
  const client = await pool.connect();
  try {
    const result = await client.query(
      "UPDATE advertisers SET status='rejected', admin_note=$2, updated_at=NOW() WHERE id=$1 RETURNING id, company_name",
      [id, note ?? null],
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: "Anunciante não encontrado." });
    }
    return res.json({ ok: true, message: `Cadastro de "${result.rows[0].company_name}" rejeitado.` });
  } catch (err) {
    console.error("[advertisers] reject error:", err);
    return res.status(500).json({ error: "Erro interno." });
  } finally {
    client.release();
  }
});

export default router;
