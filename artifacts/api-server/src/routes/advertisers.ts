import { Router } from "express";
import { pool } from "@workspace/db";

const router = Router();

router.post("/advertisers/register", async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      companyName,
      cnpj,
      segment,
      website,
      contactName,
      role,
      email,
      whatsapp,
      reach,
      adFormat,
      budget,
    } = req.body;

    if (!companyName || !cnpj || !email) {
      return res.status(400).json({ error: "Campos obrigatórios: companyName, cnpj, email." });
    }

    const cnpjClean = String(cnpj).replace(/\D/g, "");

    await client.query(
      `INSERT INTO advertisers
        (company_name, cnpj, segment, website, contact_name, role, email, whatsapp,
         reach, ad_format, budget, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', NOW(), NOW())
       ON CONFLICT (cnpj) DO UPDATE SET
         contact_name = EXCLUDED.contact_name,
         email        = EXCLUDED.email,
         updated_at   = NOW()`,
      [companyName, cnpjClean, segment ?? null, website ?? null,
       contactName ?? null, role ?? null, email, whatsapp ?? null,
       reach ?? null, adFormat ?? null, budget ?? null],
    );

    return res.json({ ok: true, message: "Solicitação recebida. Análise em até 24h úteis." });
  } catch (err: any) {
    console.error("[advertisers] register error:", err);
    return res.status(500).json({ error: "Erro interno ao registrar anunciante." });
  } finally {
    client.release();
  }
});

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
    return res.json(result.rows[0]);
  } catch (err) {
    console.error("[advertisers] status error:", err);
    return res.status(500).json({ error: "Erro interno." });
  } finally {
    client.release();
  }
});

export default router;
