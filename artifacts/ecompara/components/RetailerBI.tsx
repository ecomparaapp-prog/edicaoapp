import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Ionicons } from "@expo/vector-icons";
import { getApiBaseUrl } from "@/lib/apiBaseUrl";
import type { MerchantSession } from "@/services/merchantAuthService";
import { realtimeService } from "@/services/realtimeService";

// ── Types ─────────────────────────────────────────────────────────────────────

type Period = "day" | "week" | "month" | "year";

interface BIConversions {
  fromBanners: number;
  fromBestDeal: number;
  fromProximity: number;
  total: number;
  conversionRate: number;
  prevConversionRate: number;
}

interface BIFlow {
  avgTimeInStore: number;
  purchaseConfirmations: number;
  totalVisits: number;
  peakHour: number;
  peakDay: string;
  prevPurchaseConfirmations: number;
  prevTotalVisits: number;
}

interface BILoyalty {
  avgTicket: number;
  prevAvgTicket: number;
  purchaseFrequency: number;
  churnRate: number;
  prevChurnRate: number;
  npsScore: number;
  npsResponses: number;
  detractors: number;
  passives: number;
  promoters: number;
  npsBreakdown: { label: string; score: number }[];
}

interface BICompetition {
  ip: number;
  competitorCount: number;
  cheaperCount: number;
  expensiveCount: number;
  categories: { name: string; ip: number; diff: number }[];
}

interface BIElasticity {
  shareOfPromo: number;
  prevShareOfPromo: number;
  products: { name: string; elasticity: number; sensitivity: "Alta" | "Média" | "Baixa"; revenueImpact: number }[];
}

interface ABCItem {
  ean: string;
  name: string;
  quantity: number;
  unitPrice: number;
  revenue: number;
  pct: number;
  cumulativePct: number;
  category: "A" | "B" | "C";
}

interface MarketShareCat {
  category: string;
  brands: { brand: string; share: number }[];
}

interface BIData {
  plan: "normal" | "plus";
  period: string;
  conversions: BIConversions;
  flow: BIFlow;
  loyalty?: BILoyalty;
  heatmap?: number[][];
  heatmapMax?: number;
  heatmapHours?: string[];
  heatmapDays?: string[];
  competition?: BICompetition;
  elasticity?: BIElasticity;
  abcCurve?: ABCItem[];
  abcInsight?: string;
  marketShare?: MarketShareCat[];
  cashbackAvailable?: number;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ text, C }: { text: string; C: any }) {
  return (
    <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: C.textMuted, letterSpacing: 0.8, marginBottom: 2 }}>
      {text}
    </Text>
  );
}

function TrendBadge({ value, inverted = false }: { value: number; inverted?: boolean }) {
  const positive = inverted ? value < 0 : value >= 0;
  const color = positive ? "#22C55E" : "#F44336";
  const icon = value >= 0 ? "trending-up" : "trending-down";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
      <Feather name={icon as any} size={10} color={color} />
      <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color }}>
        {value > 0 ? "+" : ""}{value.toFixed(1)}%
      </Text>
    </View>
  );
}

function KPICard({ label, value, sub, color, icon, trend, C }: {
  label: string; value: string; sub?: string; color: string; icon: string; trend?: number; inverted?: boolean; C: any;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: C.surfaceElevated, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border, gap: 6 }}>
      <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: color + "18", alignItems: "center", justifyContent: "center" }}>
        <Feather name={icon as any} size={14} color={color} />
      </View>
      <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: C.text }}>{value}</Text>
      <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: C.textMuted, lineHeight: 13 }}>{label}</Text>
      {sub && <Text style={{ fontSize: 10, fontFamily: "Inter_500Medium", color: C.textSecondary }}>{sub}</Text>}
      {trend !== undefined && <TrendBadge value={trend} />}
    </View>
  );
}

function PlusLock({ onUpgrade, C, isDark }: { onUpgrade: () => void; C: any; isDark: boolean }) {
  return (
    <View style={{ backgroundColor: C.surfaceElevated, borderRadius: 18, borderWidth: 1, borderColor: C.border, overflow: "hidden", marginTop: 4 }}>
      <View style={{ padding: 20, gap: 8, opacity: 0.25 }}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1, height: 64, backgroundColor: C.backgroundTertiary, borderRadius: 10 }} />
          <View style={{ flex: 1, height: 64, backgroundColor: C.backgroundTertiary, borderRadius: 10 }} />
          <View style={{ flex: 1, height: 64, backgroundColor: C.backgroundTertiary, borderRadius: 10 }} />
        </View>
        <View style={{ height: 120, backgroundColor: C.backgroundTertiary, borderRadius: 10 }} />
        <View style={{ height: 48, backgroundColor: C.backgroundTertiary, borderRadius: 8, width: "80%" }} />
      </View>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: isDark ? "rgba(0,0,0,0.72)" : "rgba(255,255,255,0.88)", padding: 24, gap: 12 }}>
        <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: "#FFD70020", alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="star" size={22} color="#8B6914" />
        </View>
        <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: C.text, textAlign: "center" }}>Módulo Exclusivo Plus</Text>
        <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: C.textMuted, textAlign: "center", lineHeight: 18, maxWidth: 260 }}>
          Inteligência de mercado, análise de comportamento, curva ABC e gestão estratégica de preços disponíveis no Plano Plus.
        </Text>
        <Pressable onPress={onUpgrade} style={{ backgroundColor: "#CC0000", borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, marginTop: 4 }}>
          <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 13 }}>Fazer Upgrade — R$ 599,90/mês</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ConversionsCard({ data, C }: { data: BIData; C: any }) {
  const c = data.conversions;
  const diffRate = parseFloat((c.conversionRate - c.prevConversionRate).toFixed(1));
  return (
    <View style={{ backgroundColor: C.surfaceElevated, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 16, gap: 14 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: C.text }}>Indicações Convertidas</Text>
        <View style={{ backgroundColor: "#CC000015", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: "#CC0000" }}>{c.total}</Text>
          <TrendBadge value={diffRate} />
        </View>
      </View>
      <View style={{ gap: 10 }}>
        {([
          { label: "Via Banner Patrocinado", value: c.fromBanners, icon: "image", color: "#CC0000" },
          { label: "Card Melhor Compra", value: c.fromBestDeal, icon: "award", color: "#2196F3" },
          { label: "Proximidade Geográfica", value: c.fromProximity, icon: "map-pin", color: "#4CAF50" },
        ] as const).map((row) => {
          const pct = c.total > 0 ? (row.value / c.total) * 100 : 0;
          return (
            <View key={row.label} style={{ gap: 6 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: row.color + "18", alignItems: "center", justifyContent: "center" }}>
                    <Feather name={row.icon as any} size={12} color={row.color} />
                  </View>
                  <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: C.text }}>{row.label}</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: C.text }}>{row.value}</Text>
                  <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: C.textMuted }}>{pct.toFixed(0)}%</Text>
                </View>
              </View>
              <View style={{ height: 5, borderRadius: 3, backgroundColor: C.backgroundTertiary }}>
                <View style={{ height: 5, borderRadius: 3, backgroundColor: row.color, width: `${Math.max(pct, 2)}%` as any }} />
              </View>
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border }}>
        <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: C.textMuted }}>Taxa de Conversão</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: "#CC0000" }}>{c.conversionRate.toFixed(1)}%</Text>
          <TrendBadge value={diffRate} />
        </View>
      </View>
    </View>
  );
}

function FlowCard({ data, C }: { data: BIData; C: any }) {
  const f = data.flow;
  const visitsDiff = f.prevTotalVisits > 0 ? ((f.totalVisits - f.prevTotalVisits) / f.prevTotalVisits) * 100 : 0;
  const confirmDiff = f.prevPurchaseConfirmations > 0 ? ((f.purchaseConfirmations - f.prevPurchaseConfirmations) / f.prevPurchaseConfirmations) * 100 : 0;
  return (
    <View style={{ backgroundColor: C.surfaceElevated, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 16, gap: 14 }}>
      <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: C.text }}>Performance de Fluxo</Text>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1, backgroundColor: C.backgroundSecondary, borderRadius: 14, padding: 14, gap: 4, alignItems: "center" }}>
          <Feather name="clock" size={18} color="#2196F3" />
          <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: C.text }}>{f.avgTimeInStore}<Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: C.textMuted }}>min</Text></Text>
          <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: C.textMuted, textAlign: "center" }}>Tempo Médio em Loja</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: C.backgroundSecondary, borderRadius: 14, padding: 14, gap: 4, alignItems: "center" }}>
          <Feather name="check-circle" size={18} color="#4CAF50" />
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 4 }}>
            <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: C.text }}>{f.purchaseConfirmations}</Text>
          </View>
          <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: C.textMuted, textAlign: "center" }}>Confirmações de Compra</Text>
          <TrendBadge value={parseFloat(confirmDiff.toFixed(1))} />
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1, backgroundColor: C.backgroundSecondary, borderRadius: 14, padding: 14, gap: 4, alignItems: "center" }}>
          <Feather name="users" size={18} color="#FF9800" />
          <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: C.text }}>{f.totalVisits.toLocaleString("pt-BR")}</Text>
          <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: C.textMuted, textAlign: "center" }}>Total de Visitas</Text>
          <TrendBadge value={parseFloat(visitsDiff.toFixed(1))} />
        </View>
        <View style={{ flex: 1, backgroundColor: C.backgroundSecondary, borderRadius: 14, padding: 14, gap: 4, alignItems: "center" }}>
          <Feather name="zap" size={18} color="#9C27B0" />
          <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: C.text }}>{f.peakHour}h</Text>
          <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: C.textMuted, textAlign: "center" }}>Pico de Movimento</Text>
          <Text style={{ fontSize: 10, fontFamily: "Inter_500Medium", color: C.textSecondary }}>{f.peakDay}</Text>
        </View>
      </View>
    </View>
  );
}

function LoyaltyCard({ data, C }: { data: BIData; C: any }) {
  const l = data.loyalty!;
  const ticketDiff = l.prevAvgTicket > 0 ? ((l.avgTicket - l.prevAvgTicket) / l.prevAvgTicket) * 100 : 0;
  const churnDiff = l.prevChurnRate > 0 ? ((l.churnRate - l.prevChurnRate) / l.prevChurnRate) * 100 : 0;
  const npsColor = l.npsScore >= 75 ? "#22C55E" : l.npsScore >= 50 ? "#FFC107" : "#F44336";
  const npsLabel = l.npsScore >= 75 ? "Excelente" : l.npsScore >= 50 ? "Bom" : "A melhorar";

  return (
    <View style={{ backgroundColor: C.surfaceElevated, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 16, gap: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: C.text }}>Comportamento e Fidelidade</Text>
        <PlusTag />
      </View>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <KPICard label="Ticket Médio" value={`R$ ${l.avgTicket}`} color="#2196F3" icon="shopping-cart" trend={parseFloat(ticketDiff.toFixed(1))} C={C} />
        <KPICard label="Freq. de Compra" value={`${l.purchaseFrequency}x`} sub="por mês" color="#4CAF50" icon="repeat" C={C} />
        <KPICard label="Taxa de Churn" value={`${l.churnRate}%`} color="#F44336" icon="user-minus" trend={parseFloat(churnDiff.toFixed(1))} inverted C={C} />
      </View>

      {/* NPS */}
      <View style={{ gap: 10, paddingTop: 4, borderTopWidth: 1, borderTopColor: C.border }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: C.text }}>Net Promoter Score (NPS)</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: npsColor }}>{l.npsScore}</Text>
            <View style={{ backgroundColor: npsColor + "20", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: npsColor }}>{npsLabel}</Text>
            </View>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 6 }}>
          {([
            { label: "Detratores", pct: l.detractors, color: "#F44336" },
            { label: "Passivos", pct: l.passives, color: "#FFC107" },
            { label: "Promotores", pct: l.promoters, color: "#22C55E" },
          ] as const).map((seg) => (
            <View key={seg.label} style={{ flex: seg.pct, backgroundColor: seg.color, height: 10, borderRadius: 3, minWidth: 4 }} />
          ))}
        </View>
        <View style={{ flexDirection: "row", gap: 12 }}>
          {([
            { label: "Detratores", pct: l.detractors, color: "#F44336" },
            { label: "Passivos", pct: l.passives, color: "#FFC107" },
            { label: "Promotores", pct: l.promoters, color: "#22C55E" },
          ] as const).map((seg) => (
            <View key={seg.label} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: seg.color }} />
              <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: C.textMuted }}>{seg.label} {seg.pct}%</Text>
            </View>
          ))}
        </View>

        <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: C.textMuted, letterSpacing: 0.6, marginTop: 4 }}>AVALIAÇÃO POR CATEGORIA</Text>
        {l.npsBreakdown.map((item) => (
          <View key={item.label} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: C.text, width: 140 }}>{item.label}</Text>
            <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: C.backgroundTertiary }}>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: item.score >= 75 ? "#22C55E" : item.score >= 50 ? "#FFC107" : "#F44336", width: `${item.score}%` as any }} />
            </View>
            <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: C.text, width: 28, textAlign: "right" }}>{item.score}</Text>
          </View>
        ))}

        <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: C.textMuted }}>{l.npsResponses} respostas coletadas neste período</Text>
      </View>
    </View>
  );
}

function HeatmapCard({ data, C }: { data: BIData; C: any }) {
  const hm = data.heatmap!;
  const max = data.heatmapMax!;
  const hours = data.heatmapHours!;
  const days = data.heatmapDays!;

  function cellColor(value: number): string {
    const intensity = max > 0 ? value / max : 0;
    const r = Math.round(204 * intensity);
    const g = Math.round(10 * intensity);
    const b = Math.round(10 * intensity);
    const a = 0.1 + 0.9 * intensity;
    return `rgba(${r},${g},${b},${a})`;
  }

  return (
    <View style={{ backgroundColor: C.surfaceElevated, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 16, gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: C.text }}>Fluxo de Clientes por Hora</Text>
        <PlusTag />
      </View>
      <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: C.textMuted }}>Intensidade de visitas por dia e horário</Text>

      <View style={{ gap: 2 }}>
        <View style={{ flexDirection: "row", gap: 2, paddingLeft: 22 }}>
          {days.map((d) => (
            <Text key={d} style={{ flex: 1, fontSize: 8, fontFamily: "Inter_600SemiBold", color: C.textMuted, textAlign: "center" }}>{d}</Text>
          ))}
        </View>
        {hours.map((hour, h) => (
          <View key={hour} style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
            <Text style={{ width: 22, fontSize: 8, fontFamily: "Inter_400Regular", color: C.textMuted, textAlign: "right" }}>{hour}</Text>
            {days.map((_, d) => (
              <View
                key={d}
                style={{
                  flex: 1,
                  height: 18,
                  borderRadius: 3,
                  backgroundColor: cellColor(hm[d][h]),
                }}
              />
            ))}
          </View>
        ))}
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Text style={{ fontSize: 9, fontFamily: "Inter_400Regular", color: C.textMuted }}>Baixo</Text>
        {[0.1, 0.25, 0.4, 0.6, 0.8, 1.0].map((v) => (
          <View key={v} style={{ flex: 1, height: 8, borderRadius: 2, backgroundColor: `rgba(204,10,10,${v})` }} />
        ))}
        <Text style={{ fontSize: 9, fontFamily: "Inter_400Regular", color: C.textMuted }}>Alto</Text>
      </View>
    </View>
  );
}

function CompetitionCard({ data, C }: { data: BIData; C: any }) {
  const comp = data.competition!;
  const ipColor = comp.ip <= 0.95 ? "#22C55E" : comp.ip <= 1.05 ? "#FFC107" : "#F44336";
  const ipLabel = comp.ip <= 0.95 ? "Competitivo" : comp.ip <= 1.05 ? "Na Média" : "Acima do Mercado";

  return (
    <View style={{ backgroundColor: C.surfaceElevated, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 16, gap: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: C.text }}>Índice de Competitividade (IP)</Text>
        <PlusTag />
      </View>
      <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: C.textMuted }}>Comparativo com {comp.competitorCount} concorrentes em raio de 10km</Text>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.backgroundSecondary, borderRadius: 14, padding: 16 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 36, fontFamily: "Inter_700Bold", color: ipColor }}>{comp.ip.toFixed(2)}</Text>
          <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: ipColor }}>{ipLabel}</Text>
          <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: C.textMuted, marginTop: 4 }}>
            {comp.cheaperCount} categorias mais baratas · {comp.expensiveCount} mais caras
          </Text>
        </View>
        <View style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 3, borderColor: ipColor, alignItems: "center", justifyContent: "center" }}>
          <Feather name="target" size={24} color={ipColor} />
        </View>
      </View>

      <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: C.textMuted, letterSpacing: 0.6 }}>IP POR CATEGORIA</Text>
      {comp.categories.map((cat) => {
        const catColor = cat.ip <= 0.98 ? "#22C55E" : cat.ip <= 1.05 ? "#FFC107" : "#F44336";
        return (
          <View key={cat.name} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: C.text, width: 100 }}>{cat.name}</Text>
            <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: C.backgroundTertiary }}>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: catColor, width: `${Math.min(cat.ip * 50, 100)}%` as any }} />
            </View>
            <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: catColor, width: 40, textAlign: "right" }}>{cat.ip.toFixed(2)}</Text>
            <Text style={{ fontSize: 10, fontFamily: "Inter_500Medium", color: cat.diff >= 0 ? "#F44336" : "#22C55E", width: 44, textAlign: "right" }}>
              {cat.diff >= 0 ? "+" : ""}{cat.diff.toFixed(1)}%
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function ElasticityCard({ data, C }: { data: BIData; C: any }) {
  const el = data.elasticity!;
  const shareDiff = el.shareOfPromo - el.prevShareOfPromo;
  return (
    <View style={{ backgroundColor: C.surfaceElevated, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 16, gap: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: C.text }}>Análise de Elasticidade de Preço</Text>
        <PlusTag />
      </View>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1, backgroundColor: "#9C27B018", borderRadius: 14, padding: 14, alignItems: "center", gap: 4 }}>
          <Feather name="percent" size={18} color="#9C27B0" />
          <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: C.text }}>{el.shareOfPromo}%</Text>
          <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: C.textMuted, textAlign: "center" }}>Share de Ofertas</Text>
          <TrendBadge value={parseFloat(shareDiff.toFixed(1))} />
        </View>
        <View style={{ flex: 2, backgroundColor: C.backgroundSecondary, borderRadius: 14, padding: 14, gap: 4 }}>
          <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: C.textMuted }}>Produtos mais sensíveis a preço têm maior impacto no volume de vendas.</Text>
          <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: C.textMuted, lineHeight: 15 }}>
            Elasticidade {">"} 1.5 = Alta sensibilidade. Redução de 1% no preço gera {">"} 1.5% de aumento em vendas.
          </Text>
        </View>
      </View>

      <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: C.textMuted, letterSpacing: 0.6 }}>ELASTICIDADE POR PRODUTO</Text>
      {el.products.map((p) => {
        const absEl = Math.abs(p.elasticity);
        const barWidth = Math.min((absEl / 4) * 100, 100);
        const elColor = absEl >= 2.0 ? "#F44336" : absEl >= 1.5 ? "#FF9800" : "#4CAF50";
        return (
          <View key={p.name} style={{ gap: 4 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: C.text, flex: 1 }}>{p.name}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={{ backgroundColor: elColor + "20", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: elColor }}>{p.sensitivity}</Text>
                </View>
                <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: C.text }}>{p.elasticity.toFixed(1)}</Text>
              </View>
            </View>
            <View style={{ height: 5, borderRadius: 3, backgroundColor: C.backgroundTertiary }}>
              <View style={{ height: 5, borderRadius: 3, backgroundColor: elColor, width: `${barWidth}%` as any }} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

function ABCCard({ data, C, isDark }: { data: BIData; C: any; isDark: boolean }) {
  const items = data.abcCurve!;
  const insight = data.abcInsight!;
  const catColors: Record<"A" | "B" | "C", string> = { A: "#22C55E", B: "#FFC107", C: "#F44336" };
  const catCounts = { A: 0, B: 0, C: 0 };
  items.forEach((i) => catCounts[i.category]++);

  return (
    <View style={{ backgroundColor: C.surfaceElevated, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 16, gap: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: C.text }}>Curva ABC — Sortimento e Giro</Text>
        <PlusTag />
      </View>

      <View style={{ flexDirection: "row", gap: 8 }}>
        {(["A", "B", "C"] as const).map((cat) => (
          <View key={cat} style={{ flex: 1, backgroundColor: catColors[cat] + "15", borderRadius: 12, padding: 12, alignItems: "center", gap: 2 }}>
            <Text style={{ fontSize: 20, fontFamily: "Inter_700Bold", color: catColors[cat] }}>{catCounts[cat]}</Text>
            <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: catColors[cat] }}>Cat. {cat}</Text>
            <Text style={{ fontSize: 9, fontFamily: "Inter_400Regular", color: C.textMuted, textAlign: "center" }}>
              {cat === "A" ? "80% fat." : cat === "B" ? "15% fat." : "5% fat."}
            </Text>
          </View>
        ))}
      </View>

      {/* Insight */}
      <LinearGradient colors={isDark ? ["#1a2744", "#0f172a"] : ["#EFF6FF", "#DBEAFE"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 12, padding: 14, gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: "#2196F320", alignItems: "center", justifyContent: "center" }}>
            <Feather name="trending-up" size={14} color="#2196F3" />
          </View>
          <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: isDark ? "#93C5FD" : "#1D4ED8" }}>Recomendação Estratégica</Text>
        </View>
        <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: isDark ? "#BFDBFE" : "#1E40AF", lineHeight: 18 }}>{insight}</Text>
      </LinearGradient>

      <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: C.textMuted, letterSpacing: 0.6 }}>CLASSIFICAÇÃO COMPLETA</Text>
      <View style={{ gap: 2 }}>
        <View style={{ flexDirection: "row", paddingVertical: 6, paddingHorizontal: 8, backgroundColor: C.backgroundTertiary, borderRadius: 8 }}>
          <Text style={{ flex: 3, fontSize: 10, fontFamily: "Inter_600SemiBold", color: C.textMuted }}>Produto</Text>
          <Text style={{ flex: 1, fontSize: 10, fontFamily: "Inter_600SemiBold", color: C.textMuted, textAlign: "right" }}>Faturamento</Text>
          <Text style={{ flex: 1, fontSize: 10, fontFamily: "Inter_600SemiBold", color: C.textMuted, textAlign: "right" }}>% Fat.</Text>
          <Text style={{ width: 32, fontSize: 10, fontFamily: "Inter_600SemiBold", color: C.textMuted, textAlign: "center" }}>Cat.</Text>
        </View>
        {items.map((item) => (
          <View key={item.ean} style={{ flexDirection: "row", paddingVertical: 8, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: C.border, alignItems: "center" }}>
            <Text style={{ flex: 3, fontSize: 11, fontFamily: "Inter_500Medium", color: C.text }} numberOfLines={1}>{item.name}</Text>
            <Text style={{ flex: 1, fontSize: 11, fontFamily: "Inter_600SemiBold", color: C.text, textAlign: "right" }}>
              R$ {item.revenue.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </Text>
            <Text style={{ flex: 1, fontSize: 11, fontFamily: "Inter_400Regular", color: C.textMuted, textAlign: "right" }}>{item.pct}%</Text>
            <View style={{ width: 32, alignItems: "center" }}>
              <View style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: catColors[item.category] + "20", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: catColors[item.category] }}>{item.category}</Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function MarketShareCard({ data, C }: { data: BIData; C: any }) {
  const brands = data.marketShare!;
  const COLORS = ["#CC0000", "#2196F3", "#4CAF50", "#9E9E9E"];

  return (
    <View style={{ backgroundColor: C.surfaceElevated, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 16, gap: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: C.text }}>Market Share Interno por Marca</Text>
        <PlusTag />
      </View>
      {brands.map((cat) => (
        <View key={cat.category} style={{ gap: 8 }}>
          <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: C.text }}>{cat.category}</Text>
          <View style={{ flexDirection: "row", height: 20, borderRadius: 6, overflow: "hidden", gap: 1 }}>
            {cat.brands.map((b, i) => (
              <View key={b.brand} style={{ flex: b.share, backgroundColor: COLORS[i % COLORS.length], minWidth: b.share > 0 ? 1 : 0 }} />
            ))}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {cat.brands.filter((b) => b.share > 0).map((b, i) => (
              <View key={b.brand} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: COLORS[i % COLORS.length] }} />
                <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: C.textMuted }}>{b.brand} {b.share}%</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function CashbackBanner({ amount, C }: { amount: number; C: any }) {
  return (
    <LinearGradient colors={["#78350F", "#92400E"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: "rgba(255,215,0,0.2)", alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="star" size={22} color="#FFD700" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: "rgba(255,215,0,0.8)", letterSpacing: 0.6 }}>BENEFÍCIO PLUS ATIVO</Text>
        <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: "#FFD700" }}>
          R$ {amount.toFixed(2).replace(".", ",")} de cashback disponível
        </Text>
        <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)", lineHeight: 16 }}>
          Utilize para o lançamento da sua próxima campanha
        </Text>
      </View>
    </LinearGradient>
  );
}

function PlusTag() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#FFD70020", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
      <Ionicons name="star" size={9} color="#8B6914" />
      <Text style={{ fontSize: 9, fontFamily: "Inter_600SemiBold", color: "#8B6914" }}>Plus</Text>
    </View>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface Props {
  C: any;
  isDark: boolean;
  merchantSession: MerchantSession;
  bottomPad: number;
  onUpgrade: () => void;
}

export default function RetailerBI({ C, isDark, merchantSession, bottomPad, onUpgrade }: Props) {
  const [period, setPeriod] = useState<Period>("week");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BIData | null>(null);

  const fetchBI = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const base = getApiBaseUrl();
      const res = await fetch(`${base}/merchant/bi/dashboard?period=${period}`, {
        headers: { Authorization: `Bearer ${merchantSession.token}` },
      });
      if (!res.ok) throw new Error("Falha ao carregar dados.");
      const json = await res.json();
      setData(json);
    } catch {
      setError("Não foi possível carregar os dados de BI. Verifique a conexão.");
    } finally {
      setLoading(false);
    }
  }, [period, merchantSession.token]);

  useEffect(() => {
    fetchBI();
  }, [fetchBI]);

  // Atualiza BI automaticamente quando o Portal emite bi:refresh via WebSocket
  useEffect(() => {
    const off = realtimeService.on("bi:refresh", () => {
      fetchBI();
    });
    return off;
  }, [fetchBI]);

  const isPlus = data?.plan === "plus";

  const PERIODS: { id: Period; label: string }[] = [
    { id: "day", label: "Dia" },
    { id: "week", label: "Semana" },
    { id: "month", label: "Mês" },
    { id: "year", label: "Ano" },
  ];

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPad, gap: 14 }}>
      {/* Period filter */}
      <View style={{ backgroundColor: C.surfaceElevated, borderRadius: 14, padding: 4, flexDirection: "row", borderWidth: 1, borderColor: C.border }}>
        {PERIODS.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => setPeriod(p.id)}
            style={{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center", backgroundColor: period === p.id ? C.primary : "transparent" }}
          >
            <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: period === p.id ? "#fff" : C.textMuted }}>{p.label}</Text>
          </Pressable>
        ))}
      </View>

      {loading && (
        <View style={{ alignItems: "center", paddingVertical: 48, gap: 12 }}>
          <ActivityIndicator color={C.primary} size="large" />
          <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: C.textMuted }}>Carregando indicadores...</Text>
        </View>
      )}

      {error && !loading && (
        <View style={{ backgroundColor: "#F4433615", borderRadius: 14, padding: 16, alignItems: "center", gap: 12, borderWidth: 1, borderColor: "#F4433640" }}>
          <Feather name="wifi-off" size={28} color="#F44336" />
          <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: C.text, textAlign: "center" }}>{error}</Text>
          <TouchableOpacity onPress={fetchBI} style={{ backgroundColor: "#F44336", borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 }}>
            <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>Tentar Novamente</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && !error && data && (
        <>
          {/* ─ Plano Normal ─ */}
          <View style={{ gap: 4, marginBottom: 2 }}>
            <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: C.textMuted, letterSpacing: 0.8 }}>INDICADORES DE EXPOSIÇÃO E CONVERSÃO</Text>
          </View>

          <ConversionsCard data={data} C={C} />
          <FlowCard data={data} C={C} />

          {/* ─ Plano Plus ─ */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
            <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: C.textMuted, letterSpacing: 0.8 }}>INTELIGÊNCIA DE MERCADO</Text>
            <PlusTag />
          </View>

          {isPlus ? (
            <>
              {data.cashbackAvailable != null && data.cashbackAvailable > 0 && (
                <CashbackBanner amount={data.cashbackAvailable} C={C} />
              )}
              <LoyaltyCard data={data} C={C} />
              <HeatmapCard data={data} C={C} />
              <CompetitionCard data={data} C={C} />
              <ElasticityCard data={data} C={C} />
              <ABCCard data={data} C={C} isDark={isDark} />
              <MarketShareCard data={data} C={C} />
            </>
          ) : (
            <PlusLock onUpgrade={onUpgrade} C={C} isDark={isDark} />
          )}
        </>
      )}
    </ScrollView>
  );
}
