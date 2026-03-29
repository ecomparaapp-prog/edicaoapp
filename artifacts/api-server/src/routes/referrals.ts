import { Router } from "express";
import crypto from "crypto";
import { db } from "@workspace/db";
import { userProfilesTable, referralsTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { logPoints } from "../services/pointsLogger";

const referralsRouter = Router();

const REFERRAL_POINTS = 2000;
const MAX_REFERRALS = 5;
const APP_DOMAIN = "ecompara.com.br";

function generateReferralCode(userId: string): string {
  const hash = crypto
    .createHmac("sha256", process.env.REFERRAL_SECRET || "ecompara_referral_secret")
    .update(userId + Date.now().toString())
    .digest("base64url")
    .slice(0, 8)
    .toUpperCase();
  return hash;
}

// GET /api/referral/code/:userId — get or create referral code
referralsRouter.get("/referral/code/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const rows = await db
      .select({
        referralCode: userProfilesTable.referralCode,
        referralCount: userProfilesTable.referralCount,
        nickname: userProfilesTable.nickname,
      })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.userId, userId))
      .limit(1);

    if (rows.length === 0) {
      res.status(404).json({ error: "Perfil não encontrado." });
      return;
    }

    let { referralCode, referralCount, nickname } = rows[0];

    if (!referralCode) {
      let code = generateReferralCode(userId);
      let attempts = 0;
      while (attempts < 5) {
        const conflict = await db
          .select({ id: userProfilesTable.id })
          .from(userProfilesTable)
          .where(eq(userProfilesTable.referralCode, code))
          .limit(1);
        if (conflict.length === 0) break;
        code = generateReferralCode(userId + attempts);
        attempts++;
      }

      const [updated] = await db
        .update(userProfilesTable)
        .set({ referralCode: code, updatedAt: new Date() })
        .where(eq(userProfilesTable.userId, userId))
        .returning({ referralCode: userProfilesTable.referralCode });
      referralCode = updated.referralCode;
    }

    res.json({
      referralCode,
      referralCount,
      maxReferrals: MAX_REFERRALS,
      canEarnMore: (referralCount || 0) < MAX_REFERRALS,
      referralLink: `https://${APP_DOMAIN}/invite/${referralCode}`,
      pointsPerReferral: REFERRAL_POINTS,
    });
  } catch (err) {
    console.error("GET /referral/code error:", err);
    res.status(500).json({ error: "Erro ao buscar código de indicação." });
  }
});

// GET /api/referral/stats/:userId — list successful referrals
referralsRouter.get("/referral/stats/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const referrals = await db
      .select()
      .from(referralsTable)
      .where(eq(referralsTable.referrerUserId, userId));

    const profile = await db
      .select({ referralCount: userProfilesTable.referralCount, referralCode: userProfilesTable.referralCode })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.userId, userId))
      .limit(1);

    if (profile.length === 0) {
      res.status(404).json({ error: "Perfil não encontrado." });
      return;
    }

    const successful = referrals.filter((r) => r.status === "completed").length;
    const totalPoints = successful * REFERRAL_POINTS;

    res.json({
      referralCode: profile[0].referralCode,
      referralCount: profile[0].referralCount ?? 0,
      maxReferrals: MAX_REFERRALS,
      canEarnMore: (profile[0].referralCount ?? 0) < MAX_REFERRALS,
      successful,
      totalPoints,
      pointsPerReferral: REFERRAL_POINTS,
      referralLink: profile[0].referralCode
        ? `https://${APP_DOMAIN}/invite/${profile[0].referralCode}`
        : null,
    });
  } catch (err) {
    console.error("GET /referral/stats error:", err);
    res.status(500).json({ error: "Erro ao buscar estatísticas." });
  }
});

// POST /api/referral/activate — called when new user completes CPF registration
referralsRouter.post("/referral/activate", async (req, res) => {
  const { referralCode, newUserId, cpf, deviceId } = req.body as {
    referralCode?: string;
    newUserId?: string;
    cpf?: string;
    deviceId?: string;
  };

  if (!referralCode || !newUserId || !cpf) {
    res.status(400).json({ error: "referralCode, newUserId e cpf são obrigatórios." });
    return;
  }

  const cleanCpf = cpf.replace(/\D/g, "");
  if (cleanCpf.length !== 11) {
    res.status(400).json({ error: "CPF inválido." });
    return;
  }

  try {
    // Find referrer by code
    const referrerRows = await db
      .select({
        userId: userProfilesTable.userId,
        referralCount: userProfilesTable.referralCount,
      })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.referralCode, referralCode))
      .limit(1);

    if (referrerRows.length === 0) {
      res.status(404).json({ error: "Código de indicação inválido." });
      return;
    }

    const referrer = referrerRows[0];

    // Self-referral guard
    if (referrer.userId === newUserId) {
      res.status(409).json({ error: "Você não pode se auto-indicar." });
      return;
    }

    // CPF already referred
    const cpfConflict = await db
      .select({ id: referralsTable.id })
      .from(referralsTable)
      .where(eq(referralsTable.referredCpf, cleanCpf))
      .limit(1);

    if (cpfConflict.length > 0) {
      res.status(409).json({ error: "Este CPF já foi utilizado em uma indicação." });
      return;
    }

    // CPF already exists in another profile
    const cpfInProfile = await db
      .select({ userId: userProfilesTable.userId })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.cpf, cleanCpf))
      .limit(1);

    if (cpfInProfile.length > 0 && cpfInProfile[0].userId !== newUserId) {
      res.status(409).json({ error: "Este CPF já está cadastrado no sistema." });
      return;
    }

    // Device ID check — prevent multiple referrals from same device
    if (deviceId) {
      const deviceConflict = await db
        .select({ id: referralsTable.id })
        .from(referralsTable)
        .where(eq(referralsTable.referredDeviceId, deviceId))
        .limit(1);

      if (deviceConflict.length > 0) {
        res.status(409).json({ error: "Este dispositivo já foi utilizado em uma indicação." });
        return;
      }
    }

    // New user already referred by someone
    const alreadyReferred = await db
      .select({ id: referralsTable.id })
      .from(referralsTable)
      .where(eq(referralsTable.referredUserId, newUserId))
      .limit(1);

    if (alreadyReferred.length > 0) {
      res.status(409).json({ error: "Usuário já foi indicado anteriormente." });
      return;
    }

    const currentCount = referrer.referralCount ?? 0;
    const canEarnPoints = currentCount < MAX_REFERRALS;

    // Register referral record
    await db.insert(referralsTable).values({
      referrerUserId: referrer.userId,
      referredUserId: newUserId,
      referredCpf: cleanCpf,
      referredDeviceId: deviceId || null,
      pointsAwarded: canEarnPoints ? REFERRAL_POINTS : 0,
      status: "completed",
    });

    // Increment referral_count on referrer profile (always increment for tracking)
    await db
      .update(userProfilesTable)
      .set({
        referralCount: sql`${userProfilesTable.referralCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(userProfilesTable.userId, referrer.userId));

    // Log to central points_history (only if points were actually awarded)
    if (canEarnPoints) {
      await logPoints({
        userId: referrer.userId,
        actionType: "referral",
        pointsAmount: REFERRAL_POINTS,
        referenceId: newUserId,
        metadata: { referredCpf: cleanCpf.slice(0, 3) + "***" + cleanCpf.slice(-2), referralCount: currentCount + 1 },
      });
    }

    res.json({
      ok: true,
      pointsAwarded: canEarnPoints ? REFERRAL_POINTS : 0,
      canEarnMore: currentCount + 1 < MAX_REFERRALS,
      referrerUserId: referrer.userId,
      message: canEarnPoints
        ? `Indicação validada! ${REFERRAL_POINTS.toLocaleString("pt-BR")} pontos creditados ao indicador.`
        : "Indicação registrada. O indicador já atingiu o limite de recompensas.",
    });
  } catch (err) {
    console.error("POST /referral/activate error:", err);
    res.status(500).json({ error: "Erro ao ativar indicação." });
  }
});

export default referralsRouter;
