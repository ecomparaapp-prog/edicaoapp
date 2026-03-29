import { Router } from "express";
import { db } from "@workspace/db";
import { merchantRegistrationsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { sendVerificationCode } from "../services/emailService";

const merchantsRouter = Router();

// CNPJ validation helper
function normalizeCNPJ(cnpj: string): string {
  return cnpj.replace(/\D/g, "");
}

function isValidCNPJ(cnpj: string): boolean {
  const c = normalizeCNPJ(cnpj);
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;

  const calc = (len: number) => {
    const weights =
      len === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = c
      .slice(0, len)
      .split("")
      .reduce((acc, d, i) => acc + parseInt(d) * weights[i], 0);
    const rem = sum % 11;
    return rem < 2 ? 0 : 11 - rem;
  };

  return calc(12) === parseInt(c[12]) && calc(13) === parseInt(c[13]);
}

// GET /api/merchants/cnpj/:cnpj — proxy to ReceitaWS
merchantsRouter.get("/merchants/cnpj/:cnpj", async (req, res) => {
  const raw = req.params.cnpj;
  const cnpj = normalizeCNPJ(raw);

  if (!isValidCNPJ(cnpj)) {
    res.status(400).json({ error: "CNPJ inválido." });
    return;
  }

  try {
    const response = await fetch(`https://receitaws.com.br/v1/cnpj/${cnpj}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });

    if (response.status === 429) {
      res.status(429).json({ error: "Limite de consultas CNPJ atingido. Tente novamente em 1 minuto." });
      return;
    }

    if (!response.ok) {
      res.status(502).json({ error: "Erro ao consultar CNPJ. Tente novamente." });
      return;
    }

    const data = (await response.json()) as {
      status?: string;
      situacao?: string;
      nome?: string;
      fantasia?: string;
      logradouro?: string;
      numero?: string;
      complemento?: string;
      municipio?: string;
      uf?: string;
      cep?: string;
      telefone?: string;
      email?: string;
      message?: string;
    };

    if (data.status === "ERROR") {
      res.status(404).json({ error: data.message ?? "CNPJ não encontrado." });
      return;
    }

    const situacao = (data.situacao ?? "").toUpperCase();
    if (situacao === "BAIXADA" || situacao === "INAPTA") {
      res.status(422).json({
        error: `CNPJ com situação "${situacao}". Apenas CNPJs ativos podem ser cadastrados.`,
        situacao,
      });
      return;
    }

    const cepClean = (data.cep ?? "").replace(/\D/g, "");
    const addressParts = [
      data.logradouro,
      data.numero,
      data.complemento,
      data.municipio,
      data.uf,
    ]
      .filter(Boolean)
      .join(", ");

    res.json({
      cnpj,
      situacao,
      razaoSocial: data.nome ?? "",
      nomeFantasia: data.fantasia || data.nome || "",
      cep: cepClean,
      address: addressParts,
      phone: data.telefone ?? "",
    });
  } catch (err: any) {
    if (err?.name === "TimeoutError") {
      res.status(504).json({ error: "Tempo esgotado ao consultar CNPJ." });
      return;
    }
    console.error("CNPJ lookup error:", err);
    res.status(500).json({ error: "Erro interno ao consultar CNPJ." });
  }
});

// GET /api/merchants/registration/:id — fetch pre-filled registration (pending_completion)
merchantsRouter.get("/merchants/registration/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido." });
    return;
  }

  try {
    const rows = await db
      .select()
      .from(merchantRegistrationsTable)
      .where(eq(merchantRegistrationsTable.id, id))
      .limit(1);

    if (rows.length === 0) {
      res.status(404).json({ error: "Cadastro não encontrado." });
      return;
    }

    const reg = rows[0];

    if (reg.status !== "pending_completion") {
      res.status(410).json({ error: "Este cadastro não está aguardando conclusão." });
      return;
    }

    res.json({
      id: reg.id,
      googlePlaceId: reg.googlePlaceId,
      nomeFantasia: reg.nomeFantasia,
      ownerName: reg.ownerName,
      verificationContact: reg.verificationContact,
      status: reg.status,
    });
  } catch (err) {
    console.error("GET /merchants/registration/:id error:", err);
    res.status(500).json({ error: "Erro ao buscar cadastro." });
  }
});

// POST /api/merchants/register — create or complete registration
merchantsRouter.post("/merchants/register", async (req, res) => {
  const {
    registrationId,
    googlePlaceId,
    cnpj,
    razaoSocial,
    nomeFantasia,
    inscricaoEstadual,
    cep,
    address,
    lat,
    lng,
    operatingHours,
    phone,
    whatsapp,
    parking,
    cardBrands,
    delivery,
    logoUrl,
    verificationMethod,
    verificationContact,
  } = req.body as Record<string, any>;

  if (!cnpj || !razaoSocial || !nomeFantasia) {
    res.status(400).json({ error: "Campos obrigatórios: cnpj, razaoSocial, nomeFantasia." });
    return;
  }

  const cnpjNorm = normalizeCNPJ(cnpj);
  if (!isValidCNPJ(cnpjNorm)) {
    res.status(400).json({ error: "CNPJ inválido." });
    return;
  }

  if (!verificationMethod || !verificationContact) {
    res.status(400).json({ error: "Método e contato de verificação são obrigatórios." });
    return;
  }

  if (verificationMethod === "email" && !verificationContact.includes("@")) {
    res.status(400).json({ error: "E-mail de verificação inválido." });
    return;
  }

  const code = Math.floor(1000 + Math.random() * 9000).toString();
  const isDev = process.env.NODE_ENV === "development";

  try {
    let registration;

    // Se vier um registrationId, completar cadastro pré-aprovado (pending_completion)
    if (registrationId) {
      const existing = await db
        .select()
        .from(merchantRegistrationsTable)
        .where(eq(merchantRegistrationsTable.id, Number(registrationId)))
        .limit(1);

      if (existing.length === 0) {
        res.status(404).json({ error: "Cadastro pré-aprovado não encontrado." });
        return;
      }

      if (existing[0].status !== "pending_completion") {
        res.status(409).json({ error: "Este cadastro não está aguardando conclusão." });
        return;
      }

      const [updated] = await db
        .update(merchantRegistrationsTable)
        .set({
          cnpj: cnpjNorm,
          razaoSocial,
          nomeFantasia,
          inscricaoEstadual: inscricaoEstadual ?? null,
          cep: cep ?? null,
          address: address ?? null,
          lat: lat != null ? String(lat) : null,
          lng: lng != null ? String(lng) : null,
          operatingHours: operatingHours ?? null,
          phone: phone ?? null,
          whatsapp: whatsapp ?? null,
          parking: parking ?? "none",
          cardBrands: cardBrands ?? [],
          delivery: delivery ?? "none",
          logoUrl: logoUrl ?? null,
          verificationMethod,
          verificationContact,
          verificationCode: code,
          status: "pending_verification",
          updatedAt: new Date(),
        })
        .where(eq(merchantRegistrationsTable.id, Number(registrationId)))
        .returning();

      registration = updated;
      console.log(`[Merchant] Claim concluído → registration #${registration.id} atualizado para pending_verification`);
    } else {
      // Novo cadastro padrão
      const [inserted] = await db
        .insert(merchantRegistrationsTable)
        .values({
          googlePlaceId: googlePlaceId ?? null,
          cnpj: cnpjNorm,
          razaoSocial,
          nomeFantasia,
          inscricaoEstadual: inscricaoEstadual ?? null,
          cep: cep ?? null,
          address: address ?? null,
          lat: lat != null ? String(lat) : null,
          lng: lng != null ? String(lng) : null,
          operatingHours: operatingHours ?? null,
          phone: phone ?? null,
          whatsapp: whatsapp ?? null,
          parking: parking ?? "none",
          cardBrands: cardBrands ?? [],
          delivery: delivery ?? "none",
          logoUrl: logoUrl ?? null,
          verificationMethod,
          verificationContact,
          verificationCode: code,
          status: "pending_verification",
        })
        .returning();

      registration = inserted;
    }

    console.log(`[Merchant] Verification code for registration #${registration.id}: ${code}`);

    let emailPreviewUrl: string | undefined;
    if (verificationMethod === "email") {
      const emailResult = await sendVerificationCode({
        to: verificationContact,
        storeName: nomeFantasia,
        code,
        registrationId: registration.id,
      });
      emailPreviewUrl = emailResult.previewUrl;
    }

    res.status(201).json({
      ok: true,
      registrationId: registration.id,
      ...(isDev ? { _devCode: code } : {}),
      ...(emailPreviewUrl ? { _emailPreviewUrl: emailPreviewUrl } : {}),
    });
  } catch (err) {
    console.error("POST /merchants/register error:", err);
    res.status(500).json({ error: "Erro ao criar cadastro." });
  }
});

// POST /api/merchants/verify — confirm ownership code
merchantsRouter.post("/merchants/verify", async (req, res) => {
  const { registrationId, code } = req.body as {
    registrationId?: number;
    code?: string;
  };

  if (!registrationId || !code) {
    res.status(400).json({ error: "registrationId e code são obrigatórios." });
    return;
  }

  try {
    const [reg] = await db
      .select()
      .from(merchantRegistrationsTable)
      .where(eq(merchantRegistrationsTable.id, registrationId))
      .limit(1);

    if (!reg) {
      res.status(404).json({ error: "Cadastro não encontrado." });
      return;
    }

    if (reg.status !== "pending_verification") {
      res.status(409).json({ error: "Este cadastro já foi verificado ou processado." });
      return;
    }

    if (reg.verificationCode !== code.trim()) {
      res.status(422).json({ error: "Código incorreto. Verifique e tente novamente." });
      return;
    }

    await db
      .update(merchantRegistrationsTable)
      .set({
        status: "pending_approval",
        verifiedAt: new Date(),
        verificationCode: null,
        updatedAt: new Date(),
      })
      .where(eq(merchantRegistrationsTable.id, registrationId));

    res.json({ ok: true, message: "Verificação concluída! Seu cadastro está em análise." });
  } catch (err) {
    console.error("POST /merchants/verify error:", err);
    res.status(500).json({ error: "Erro ao verificar código." });
  }
});

// POST /api/merchants/resend — resend verification code
merchantsRouter.post("/merchants/resend", async (req, res) => {
  const { registrationId } = req.body as { registrationId?: number };

  if (!registrationId) {
    res.status(400).json({ error: "registrationId é obrigatório." });
    return;
  }

  try {
    const [reg] = await db
      .select()
      .from(merchantRegistrationsTable)
      .where(eq(merchantRegistrationsTable.id, registrationId))
      .limit(1);

    if (!reg) {
      res.status(404).json({ error: "Cadastro não encontrado." });
      return;
    }

    if (reg.status !== "pending_verification") {
      res.status(409).json({ error: "Este cadastro já foi verificado." });
      return;
    }

    const newCode = Math.floor(1000 + Math.random() * 9000).toString();
    await db
      .update(merchantRegistrationsTable)
      .set({ verificationCode: newCode, updatedAt: new Date() })
      .where(eq(merchantRegistrationsTable.id, registrationId));

    console.log(`[Merchant] Resent verification code for registration #${registrationId}: ${newCode}`);

    // Reenviar por e-mail se o método de verificação for e-mail
    let resendPreviewUrl: string | undefined;
    if (reg.verificationMethod === "email" && reg.verificationContact) {
      const emailResult = await sendVerificationCode({
        to: reg.verificationContact,
        storeName: reg.nomeFantasia,
        code: newCode,
        registrationId,
      });
      resendPreviewUrl = emailResult.previewUrl;
    }

    const isDev = process.env.NODE_ENV === "development";
    res.json({
      ok: true,
      ...(isDev ? { _devCode: newCode } : {}),
      ...(resendPreviewUrl ? { _emailPreviewUrl: resendPreviewUrl } : {}),
    });
  } catch (err) {
    console.error("POST /merchants/resend error:", err);
    res.status(500).json({ error: "Erro ao reenviar código." });
  }
});

export default merchantsRouter;
