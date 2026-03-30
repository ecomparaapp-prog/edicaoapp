import { Router } from "express";
import { db } from "@workspace/db";
import { userProfilesTable, nfceRecordsTable, priceReportsTable } from "@workspace/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { logPoints } from "../services/pointsLogger";

const profileRouter = Router();

const PROFILE_BONUS_POINTS = 250;

function isProfileComplete(profile: typeof userProfilesTable.$inferSelect): boolean {
  return !!(
    profile.nickname &&
    profile.fullName &&
    profile.cpf &&
    profile.phone &&
    profile.address &&
    profile.pixKey
  );
}

function suggestNickname(base: string): string {
  const clean = base.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20);
  const suffix = Math.floor(100 + Math.random() * 900);
  return `${clean}${suffix}`;
}

// GET /api/profile/check-nickname?nickname=xxx&userId=yyy
profileRouter.get("/profile/check-nickname", async (req, res) => {
  const { nickname, userId } = req.query as { nickname?: string; userId?: string };
  if (!nickname) {
    res.status(400).json({ error: "nickname é obrigatório." });
    return;
  }

  try {
    const conditions = userId
      ? and(eq(userProfilesTable.nickname, nickname), ne(userProfilesTable.userId, userId))
      : eq(userProfilesTable.nickname, nickname);

    const rows = await db
      .select({ id: userProfilesTable.id })
      .from(userProfilesTable)
      .where(conditions)
      .limit(1);

    const available = rows.length === 0;
    res.json({
      available,
      suggestion: available ? null : suggestNickname(nickname),
    });
  } catch (err) {
    console.error("GET /profile/check-nickname error:", err);
    res.status(500).json({ error: "Erro ao verificar nickname." });
  }
});

// GET /api/profile/:userId
profileRouter.get("/profile/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const rows = await db
      .select()
      .from(userProfilesTable)
      .where(eq(userProfilesTable.userId, userId))
      .limit(1);

    if (rows.length === 0) {
      res.status(404).json({ error: "Perfil não encontrado." });
      return;
    }

    const p = rows[0];
    res.json({
      userId: p.userId,
      nickname: p.nickname,
      fullName: p.fullName,
      cpf: p.cpf,
      phone: p.phone,
      address: p.address,
      pixKey: p.pixKey,
      fullNameLocked: p.fullNameLocked,
      cpfLocked: p.cpfLocked,
      profileBonusAwarded: p.profileBonusAwarded,
      isComplete: isProfileComplete(p),
    });
  } catch (err) {
    console.error("GET /profile error:", err);
    res.status(500).json({ error: "Erro ao buscar perfil." });
  }
});

// PUT /api/profile/:userId  (create or update)
profileRouter.put("/profile/:userId", async (req, res) => {
  const { userId } = req.params;
  const { nickname, fullName, cpf, phone, address, pixKey } = req.body as {
    nickname?: string;
    fullName?: string;
    cpf?: string;
    phone?: string;
    address?: string;
    pixKey?: string;
  };

  if (!nickname) {
    res.status(400).json({ error: "nickname é obrigatório." });
    return;
  }

  try {
    // Check nickname uniqueness (exclude current user)
    const nickConflict = await db
      .select({ id: userProfilesTable.id })
      .from(userProfilesTable)
      .where(and(eq(userProfilesTable.nickname, nickname), ne(userProfilesTable.userId, userId)))
      .limit(1);

    if (nickConflict.length > 0) {
      res.status(409).json({
        error: "Nickname já em uso.",
        suggestion: suggestNickname(nickname),
      });
      return;
    }

    // Check if profile already exists
    const existing = await db
      .select()
      .from(userProfilesTable)
      .where(eq(userProfilesTable.userId, userId))
      .limit(1);

    let profile: typeof userProfilesTable.$inferSelect;

    if (existing.length === 0) {
      // CREATE
      const [created] = await db
        .insert(userProfilesTable)
        .values({
          userId,
          nickname,
          fullName: fullName || null,
          cpf: cpf || null,
          phone: phone || null,
          address: address || null,
          pixKey: pixKey || null,
          fullNameLocked: !!(fullName && fullName.trim()),
          cpfLocked: !!(cpf && cpf.trim()),
        })
        .returning();
      profile = created;
    } else {
      const current = existing[0];

      // Determine lock states - once set they stay locked
      const newFullNameLocked = current.fullNameLocked || !!(fullName && fullName.trim());
      const newCpfLocked = current.cpfLocked || !!(cpf && cpf.trim());

      const [updated] = await db
        .update(userProfilesTable)
        .set({
          nickname,
          // Locked fields: only update if not yet locked
          fullName: current.fullNameLocked ? current.fullName : (fullName || current.fullName),
          cpf: current.cpfLocked ? current.cpf : (cpf || current.cpf),
          phone: phone || null,
          address: address || null,
          pixKey: pixKey || null,
          fullNameLocked: newFullNameLocked,
          cpfLocked: newCpfLocked,
          updatedAt: new Date(),
        })
        .where(eq(userProfilesTable.userId, userId))
        .returning();
      profile = updated;
    }

    // Award bonus if newly complete and not yet awarded
    let bonusAwarded = false;
    if (!profile.profileBonusAwarded && isProfileComplete(profile)) {
      await db
        .update(userProfilesTable)
        .set({ profileBonusAwarded: true, updatedAt: new Date() })
        .where(eq(userProfilesTable.userId, userId));
      profile.profileBonusAwarded = true;
      bonusAwarded = true;

      // Log to central points_history
      await logPoints({
        userId,
        actionType: "profile_bonus",
        pointsAmount: PROFILE_BONUS_POINTS,
        referenceId: userId,
        metadata: { nickname: profile.nickname },
      });
    }

    res.json({
      userId: profile.userId,
      nickname: profile.nickname,
      fullName: profile.fullName,
      cpf: profile.cpf,
      phone: profile.phone,
      address: profile.address,
      pixKey: profile.pixKey,
      fullNameLocked: profile.fullNameLocked,
      cpfLocked: profile.cpfLocked,
      profileBonusAwarded: profile.profileBonusAwarded,
      isComplete: isProfileComplete(profile),
      bonusAwarded,
      bonusPoints: bonusAwarded ? PROFILE_BONUS_POINTS : 0,
    });
  } catch (err) {
    console.error("PUT /profile error:", err);
    res.status(500).json({ error: "Erro ao salvar perfil." });
  }
});

// GET /api/profile/:userId/export
profileRouter.get("/profile/:userId/export", async (req, res) => {
  const { userId } = req.params;
  try {
    const profileRows = await db
      .select()
      .from(userProfilesTable)
      .where(eq(userProfilesTable.userId, userId))
      .limit(1);

    if (profileRows.length === 0) {
      res.status(404).json({ error: "Perfil não encontrado." });
      return;
    }

    const priceReports = await db
      .select()
      .from(priceReportsTable)
      .where(eq(priceReportsTable.userId, userId));

    const nfceRecords = await db
      .select()
      .from(nfceRecordsTable)
      .where(eq(nfceRecordsTable.userId, userId));

    const p = profileRows[0];
    res.json({
      exportedAt: new Date().toISOString(),
      profile: {
        userId: p.userId,
        nickname: p.nickname,
        fullName: p.fullName,
        cpf: p.cpf,
        phone: p.phone,
        address: p.address,
        pixKey: p.pixKey,
        referralCode: p.referralCode,
        referralCount: p.referralCount,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      },
      priceReports: priceReports.map((r) => ({
        id: r.id,
        ean: r.ean,
        productName: r.productName,
        placeId: r.placeId,
        price: r.price,
        reportedAt: r.reportedAt,
        isVerified: r.isVerified,
        pointsAwarded: r.pointsAwarded,
      })),
      nfceRecords: nfceRecords.map((n) => ({
        id: n.id,
        storeName: n.storeName,
        totalValue: n.totalValue,
        itemCount: n.itemCount,
        pointsAwarded: n.pointsAwarded,
        processedAt: n.processedAt,
      })),
    });
  } catch (err) {
    console.error("GET /profile/export error:", err);
    res.status(500).json({ error: "Erro ao exportar dados." });
  }
});

// DELETE /api/profile/:userId
profileRouter.delete("/profile/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const rows = await db
      .select({ id: userProfilesTable.id })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.userId, userId))
      .limit(1);

    if (rows.length === 0) {
      res.status(404).json({ error: "Perfil não encontrado." });
      return;
    }

    await db.delete(userProfilesTable).where(eq(userProfilesTable.userId, userId));
    await db.delete(priceReportsTable).where(eq(priceReportsTable.userId, userId));
    await db.delete(nfceRecordsTable).where(eq(nfceRecordsTable.userId, userId));

    res.json({ success: true, message: "Conta excluída com sucesso." });
  } catch (err) {
    console.error("DELETE /profile error:", err);
    res.status(500).json({ error: "Erro ao excluir conta." });
  }
});

export default profileRouter;
