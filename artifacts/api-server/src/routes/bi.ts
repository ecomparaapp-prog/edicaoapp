import { Router } from "express";
import { db } from "@workspace/db";
import { merchantUsersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { merchantAuthMiddleware } from "./merchant-auth";

const biRouter = Router();

biRouter.use("/merchant/bi", merchantAuthMiddleware);

// ── Seeded PRNG ────────────────────────────────────────────────────────────────
function lcg(seed: number): number {
  const a = 1664525;
  const c = 1013904223;
  const m = 2 ** 32;
  return ((a * Math.abs(Math.round(seed)) + c) % m) / m;
}

function sr(seed: number, min: number, max: number): number {
  return Math.round(min + lcg(seed) * (max - min));
}

function sf(seed: number, min: number, max: number, decimals = 1): number {
  const v = min + lcg(seed) * (max - min);
  return Math.round(v * 10 ** decimals) / 10 ** decimals;
}

// ── ABC Curve Algorithm ────────────────────────────────────────────────────────
interface ABCProduct {
  ean: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

function calcABC(products: ABCProduct[]) {
  const withRevenue = products.map((p) => ({
    ...p,
    revenue: Math.round(p.quantity * p.unitPrice * 100) / 100,
  }));
  withRevenue.sort((a, b) => b.revenue - a.revenue);
  const totalRevenue = withRevenue.reduce((s, p) => s + p.revenue, 0);
  let cumulative = 0;
  return withRevenue.map((p) => {
    cumulative += p.revenue;
    const pct = totalRevenue > 0 ? (p.revenue / totalRevenue) * 100 : 0;
    const cumulativePct = totalRevenue > 0 ? (cumulative / totalRevenue) * 100 : 0;
    const category: "A" | "B" | "C" = cumulativePct <= 80 ? "A" : cumulativePct <= 95 ? "B" : "C";
    return {
      ...p,
      pct: Math.round(pct * 10) / 10,
      cumulativePct: Math.round(cumulativePct * 10) / 10,
      category,
    };
  });
}

// ── Period multiplier ──────────────────────────────────────────────────────────
function periodSeed(period: string): number {
  return period === "day" ? 1 : period === "week" ? 7 : period === "month" ? 30 : 365;
}

// ── GET /api/merchant/bi/dashboard ─────────────────────────────────────────────
biRouter.get("/merchant/bi/dashboard", async (req, res) => {
  const merchantUserId: number = (req as any).merchantUserId;
  const period = (req.query.period as string) ?? "week";

  const [merchantUser] = await db
    .select({ plan: merchantUsersTable.plan })
    .from(merchantUsersTable)
    .where(eq(merchantUsersTable.id, merchantUserId));

  if (!merchantUser) {
    res.status(404).json({ error: "Comerciante não encontrado." });
    return;
  }

  const isPlus = merchantUser.plan === "plus";
  const s = merchantUserId * 137 + periodSeed(period);

  // ── Plan Normal Metrics ──────────────────────────────────────────────────────
  const conversions = {
    fromBanners: sr(s + 1, 120, 580),
    fromBestDeal: sr(s + 2, 80, 320),
    fromProximity: sr(s + 3, 40, 180),
    total: 0,
    conversionRate: sf(s + 4, 4.5, 12.8),
    prevConversionRate: sf(s + 104, 4.0, 11.5),
  };
  conversions.total = conversions.fromBanners + conversions.fromBestDeal + conversions.fromProximity;

  const flow = {
    avgTimeInStore: sr(s + 5, 18, 52),
    purchaseConfirmations: sr(s + 6, 45, 190),
    totalVisits: sr(s + 8, 300, 1200),
    peakHour: sr(s + 7, 10, 18),
    peakDay: ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"][sr(s + 9, 4, 6)],
    prevPurchaseConfirmations: sr(s + 106, 40, 170),
    prevTotalVisits: sr(s + 108, 280, 1100),
  };

  const response: Record<string, unknown> = {
    plan: isPlus ? "plus" : "normal",
    period,
    conversions,
    flow,
  };

  // ── Plan Plus Metrics ────────────────────────────────────────────────────────
  if (isPlus) {
    const loyalty = {
      avgTicket: sr(s + 10, 85, 280),
      prevAvgTicket: sr(s + 110, 80, 260),
      purchaseFrequency: sf(s + 11, 1.8, 4.5),
      churnRate: sf(s + 12, 5.0, 28.0),
      prevChurnRate: sf(s + 112, 5.5, 30.0),
      npsScore: sr(s + 13, 62, 91),
      npsResponses: sr(s + 14, 45, 230),
      detractors: sr(s + 15, 5, 25),
      passives: sr(s + 16, 15, 35),
      promoters: 0,
      npsBreakdown: [
        { label: "Atendimento", score: sr(s + 20, 55, 95) },
        { label: "Agilidade nos Caixas", score: sr(s + 21, 50, 90) },
        { label: "Preço", score: sr(s + 22, 48, 88) },
        { label: "Estrutura", score: sr(s + 23, 60, 95) },
        { label: "Limpeza", score: sr(s + 24, 65, 98) },
        { label: "Variedade", score: sr(s + 25, 55, 92) },
        { label: "Estacionamento", score: sr(s + 26, 40, 85) },
      ],
    };
    loyalty.promoters = Math.max(0, 100 - loyalty.detractors - loyalty.passives);

    // Heatmap: 7 days (Mon-Sun) x 14 hours (8h-21h)
    const dayMultipliers = [0.7, 0.75, 0.8, 0.85, 1.2, 1.4, 1.1];
    const hourMultipliers = [0.4, 0.5, 0.9, 1.3, 1.0, 0.8, 1.2, 1.5, 1.1, 0.8, 0.6, 0.5, 0.4, 0.3];
    const heatmap: number[][] = Array.from({ length: 7 }, (_, d) =>
      Array.from({ length: 14 }, (_, h) => {
        const base = sr(s + d * 14 + h + 200, 10, 100);
        return Math.round(base * dayMultipliers[d] * hourMultipliers[h]);
      })
    );
    const heatmapMax = Math.max(...heatmap.flat());

    const competition = {
      ip: sf(s + 30, 0.88, 1.15, 2),
      competitorCount: sr(s + 31, 3, 12),
      cheaperCount: sr(s + 32, 2, 8),
      expensiveCount: sr(s + 33, 1, 5),
      categories: [
        { name: "Hortifruti", ip: sf(s + 34, 0.85, 1.20, 2), diff: sf(s + 35, -12, 15, 1) },
        { name: "Carnes", ip: sf(s + 36, 0.90, 1.18, 2), diff: sf(s + 37, -8, 12, 1) },
        { name: "Laticínios", ip: sf(s + 38, 0.88, 1.12, 2), diff: sf(s + 39, -5, 10, 1) },
        { name: "Mercearia", ip: sf(s + 40, 0.92, 1.15, 2), diff: sf(s + 41, -6, 8, 1) },
        { name: "Bebidas", ip: sf(s + 42, 0.87, 1.22, 2), diff: sf(s + 43, -10, 18, 1) },
      ],
    };

    const elasticity = {
      shareOfPromo: sr(s + 45, 22, 48),
      prevShareOfPromo: sr(s + 145, 20, 45),
      products: [
        { name: "Arroz 5kg", elasticity: -sf(s + 50, 1.2, 2.8, 1), sensitivity: "Alta" as const, revenueImpact: sf(s + 51, 3.5, 12.0, 1) },
        { name: "Frango Peito 1kg", elasticity: -sf(s + 52, 0.8, 1.8, 1), sensitivity: "Média" as const, revenueImpact: sf(s + 53, 2.0, 8.5, 1) },
        { name: "Leite Integral 1L", elasticity: -sf(s + 54, 1.5, 3.2, 1), sensitivity: "Alta" as const, revenueImpact: sf(s + 55, 4.0, 14.0, 1) },
        { name: "Feijão Carioca 1kg", elasticity: -sf(s + 56, 1.0, 2.2, 1), sensitivity: "Média" as const, revenueImpact: sf(s + 57, 2.5, 9.0, 1) },
        { name: "Óleo de Soja 900ml", elasticity: -sf(s + 58, 1.8, 3.5, 1), sensitivity: "Alta" as const, revenueImpact: sf(s + 59, 5.0, 16.0, 1) },
      ],
    };

    const abcRaw: ABCProduct[] = [
      { ean: "7891000100103", name: "Arroz Tio João 5kg", quantity: sr(s + 60, 200, 800), unitPrice: 24.9 },
      { ean: "7891000315507", name: "Feijão Carioca 1kg", quantity: sr(s + 61, 150, 600), unitPrice: 7.5 },
      { ean: "7891149103309", name: "Leite Integral 1L", quantity: sr(s + 62, 300, 1200), unitPrice: 4.9 },
      { ean: "7896036093085", name: "Óleo de Soja 900ml", quantity: sr(s + 63, 100, 450), unitPrice: 8.9 },
      { ean: "7896085081018", name: "Açúcar Cristal 1kg", quantity: sr(s + 64, 120, 500), unitPrice: 5.5 },
      { ean: "7896004004001", name: "Frango Peito 1kg", quantity: sr(s + 65, 80, 350), unitPrice: 18.9 },
      { ean: "7891910000197", name: "Macarrão Espaguete 500g", quantity: sr(s + 66, 90, 400), unitPrice: 4.5 },
      { ean: "7898226400028", name: "Café Pilão 500g", quantity: sr(s + 67, 60, 280), unitPrice: 16.9 },
      { ean: "7891055310011", name: "Biscoito Maizena 400g", quantity: sr(s + 68, 50, 200), unitPrice: 6.9 },
      { ean: "7891000055007", name: "Farinha de Trigo 1kg", quantity: sr(s + 69, 40, 180), unitPrice: 4.2 },
    ];
    const abcCurve = calcABC(abcRaw);
    const topA = abcCurve.find((p) => p.category === "A");
    const abcInsight = topA
      ? `O produto "${topA.name}" representa ${topA.pct.toFixed(1)}% do seu faturamento (Categoria A). Considere negociar melhores condições com o fornecedor ou destacar em nova campanha.`
      : "Todos os produtos contribuem de forma equilibrada para o faturamento.";

    const marketShare = [
      {
        category: "Arroz",
        brands: normalizeShares([
          { brand: "Tio João", share: sr(s + 70, 30, 55) },
          { brand: "Camil", share: sr(s + 71, 15, 35) },
          { brand: "Prato Fino", share: sr(s + 72, 10, 20) },
        ]),
      },
      {
        category: "Leite",
        brands: normalizeShares([
          { brand: "Itambé", share: sr(s + 73, 25, 50) },
          { brand: "Ninho", share: sr(s + 74, 20, 40) },
          { brand: "Piracanjuba", share: sr(s + 75, 10, 25) },
        ]),
      },
      {
        category: "Café",
        brands: normalizeShares([
          { brand: "Pilão", share: sr(s + 76, 35, 60) },
          { brand: "Melitta", share: sr(s + 77, 20, 35) },
          { brand: "3 Corações", share: sr(s + 78, 10, 25) },
        ]),
      },
    ];

    response.loyalty = loyalty;
    response.heatmap = heatmap;
    response.heatmapMax = heatmapMax;
    response.heatmapHours = ["08h", "09h", "10h", "11h", "12h", "13h", "14h", "15h", "16h", "17h", "18h", "19h", "20h", "21h"];
    response.heatmapDays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
    response.competition = competition;
    response.elasticity = elasticity;
    response.abcCurve = abcCurve;
    response.abcInsight = abcInsight;
    response.marketShare = marketShare;
    response.cashbackAvailable = 100.0;
  }

  res.json(response);
});

// ── POST /api/merchant/bi/event — ingest behavioral event ──────────────────────
biRouter.post("/merchant/bi/event", async (req, res) => {
  res.json({ ok: true });
});

// ── Helpers ────────────────────────────────────────────────────────────────────
function normalizeShares(brands: { brand: string; share: number }[]) {
  const total = brands.reduce((s, b) => s + b.share, 0);
  const outros = Math.max(0, 100 - total);
  return [...brands.map((b) => ({ ...b, share: Math.round((b.share / total) * (100 - outros)) })), { brand: "Outros", share: outros }];
}

export default biRouter;
