import { Router } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { merchantUsersTable, merchantRegistrationsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { sendPasswordReset } from "../services/emailService";

const merchantAuthRouter = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function generateTempPassword(len = 10): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export { generateTempPassword };

// Simples JWT-like: base64(payload).signature(sha256)
function signSession(merchantUserId: number): string {
  const payload = Buffer.from(JSON.stringify({ id: merchantUserId, iat: Date.now() })).toString("base64url");
  const secret = process.env.MERCHANT_JWT_SECRET ?? "ecompara-merchant-secret-2026";
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySession(token: string): { id: number } | null {
  try {
    const [payload, sig] = token.split(".");
    const secret = process.env.MERCHANT_JWT_SECRET ?? "ecompara-merchant-secret-2026";
    const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
    if (sig !== expected) return null;
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
  } catch {
    return null;
  }
}

export function merchantAuthMiddleware(req: any, res: any, next: any) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Autenticacao necessaria." });
    return;
  }
  const payload = verifySession(auth.slice(7));
  if (!payload) {
    res.status(401).json({ error: "Sessao invalida ou expirada." });
    return;
  }
  req.merchantUserId = payload.id;
  next();
}

// ── POST /merchant/auth/login ─────────────────────────────────────────────────

merchantAuthRouter.post("/merchant/auth/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: "E-mail e senha sao obrigatorios." });
    return;
  }

  try {
    const rows = await db
      .select()
      .from(merchantUsersTable)
      .where(eq(merchantUsersTable.email, email.toLowerCase().trim()))
      .limit(1);

    if (rows.length === 0) {
      res.status(401).json({ error: "Credenciais invalidas." });
      return;
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Credenciais invalidas." });
      return;
    }

    await db
      .update(merchantUsersTable)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(merchantUsersTable.id, user.id));

    const token = signSession(user.id);

    const registrations = await db
      .select()
      .from(merchantRegistrationsTable)
      .where(eq(merchantRegistrationsTable.id, user.merchantRegistrationId))
      .limit(1);

    res.json({
      token,
      mustChangePassword: user.mustChangePassword,
      plan: user.plan,
      merchantUser: {
        id: user.id,
        email: user.email,
        plan: user.plan,
        mustChangePassword: user.mustChangePassword,
        merchantRegistrationId: user.merchantRegistrationId,
      },
      registration: registrations[0] ?? null,
    });
  } catch (err) {
    console.error("POST /merchant/auth/login error:", err);
    res.status(500).json({ error: "Erro interno." });
  }
});

// ── POST /merchant/auth/change-password ──────────────────────────────────────

merchantAuthRouter.post("/merchant/auth/change-password", merchantAuthMiddleware, async (req: any, res) => {
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "Senha atual e nova senha sao obrigatorias." });
    return;
  }
  if (newPassword.length < 8) {
    res.status(400).json({ error: "A nova senha deve ter pelo menos 8 caracteres." });
    return;
  }

  try {
    const rows = await db
      .select()
      .from(merchantUsersTable)
      .where(eq(merchantUsersTable.id, req.merchantUserId))
      .limit(1);

    if (rows.length === 0) { res.status(404).json({ error: "Usuario nao encontrado." }); return; }

    const user = rows[0];
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) { res.status(401).json({ error: "Senha atual incorreta." }); return; }

    const hash = await bcrypt.hash(newPassword, 12);
    await db
      .update(merchantUsersTable)
      .set({ passwordHash: hash, mustChangePassword: false, updatedAt: new Date() })
      .where(eq(merchantUsersTable.id, user.id));

    res.json({ ok: true });
  } catch (err) {
    console.error("POST /merchant/auth/change-password error:", err);
    res.status(500).json({ error: "Erro interno." });
  }
});

// ── POST /merchant/auth/forgot-password ──────────────────────────────────────

merchantAuthRouter.post("/merchant/auth/forgot-password", async (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email) { res.status(400).json({ error: "E-mail obrigatorio." }); return; }

  try {
    const rows = await db
      .select()
      .from(merchantUsersTable)
      .where(eq(merchantUsersTable.email, email.toLowerCase().trim()))
      .limit(1);

    // Sempre retorna 200 para não vazar se e-mail existe
    if (rows.length === 0) { res.json({ ok: true }); return; }

    const user = rows[0];
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await db
      .update(merchantUsersTable)
      .set({ resetToken: token, resetTokenExpiresAt: expiresAt, updatedAt: new Date() })
      .where(eq(merchantUsersTable.id, user.id));

    const baseUrl = process.env.MERCHANT_PORTAL_URL ?? `https://${process.env.REPLIT_DEV_DOMAIN}/api/merchant-portal`;
    const resetLink = `${baseUrl}?reset=${token}`;

    const registrations = await db
      .select()
      .from(merchantRegistrationsTable)
      .where(eq(merchantRegistrationsTable.id, user.merchantRegistrationId))
      .limit(1);

    const emailResult = await sendPasswordReset({
      to: user.email,
      ownerName: registrations[0]?.ownerName ?? "Lojista",
      resetLink,
    });

    res.json({ ok: true, ...(emailResult.previewUrl ? { emailPreviewUrl: emailResult.previewUrl } : {}) });
  } catch (err) {
    console.error("POST /merchant/auth/forgot-password error:", err);
    res.status(500).json({ error: "Erro interno." });
  }
});

// ── POST /merchant/auth/reset-password ───────────────────────────────────────

merchantAuthRouter.post("/merchant/auth/reset-password", async (req, res) => {
  const { token, newPassword } = req.body as { token?: string; newPassword?: string };
  if (!token || !newPassword) {
    res.status(400).json({ error: "Token e nova senha sao obrigatorios." });
    return;
  }
  if (newPassword.length < 8) {
    res.status(400).json({ error: "A senha deve ter pelo menos 8 caracteres." });
    return;
  }

  try {
    const rows = await db
      .select()
      .from(merchantUsersTable)
      .where(eq(merchantUsersTable.resetToken, token))
      .limit(1);

    if (rows.length === 0) {
      res.status(400).json({ error: "Token invalido ou expirado." });
      return;
    }

    const user = rows[0];
    if (!user.resetTokenExpiresAt || user.resetTokenExpiresAt < new Date()) {
      res.status(400).json({ error: "Token expirado. Solicite um novo link." });
      return;
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await db
      .update(merchantUsersTable)
      .set({ passwordHash: hash, mustChangePassword: false, resetToken: null, resetTokenExpiresAt: null, updatedAt: new Date() })
      .where(eq(merchantUsersTable.id, user.id));

    res.json({ ok: true });
  } catch (err) {
    console.error("POST /merchant/auth/reset-password error:", err);
    res.status(500).json({ error: "Erro interno." });
  }
});

// ── GET /merchant/auth/me ─────────────────────────────────────────────────────

merchantAuthRouter.get("/merchant/auth/me", merchantAuthMiddleware, async (req: any, res) => {
  try {
    const rows = await db
      .select()
      .from(merchantUsersTable)
      .where(eq(merchantUsersTable.id, req.merchantUserId))
      .limit(1);

    if (rows.length === 0) { res.status(404).json({ error: "Usuario nao encontrado." }); return; }

    const user = rows[0];
    const registrations = await db
      .select()
      .from(merchantRegistrationsTable)
      .where(eq(merchantRegistrationsTable.id, user.merchantRegistrationId))
      .limit(1);

    res.json({
      merchantUser: {
        id: user.id,
        email: user.email,
        plan: user.plan,
        mustChangePassword: user.mustChangePassword,
        merchantRegistrationId: user.merchantRegistrationId,
        lastLoginAt: user.lastLoginAt,
      },
      registration: registrations[0] ?? null,
    });
  } catch (err) {
    console.error("GET /merchant/auth/me error:", err);
    res.status(500).json({ error: "Erro interno." });
  }
});

export default merchantAuthRouter;
