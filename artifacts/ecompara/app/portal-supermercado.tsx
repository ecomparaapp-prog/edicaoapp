import { Feather, MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { useApp } from "@/context/AppContext";

const SECTIONS = [
  { id: "overview", label: "Visão Geral", icon: "bar-chart-2" },
  { id: "products", label: "Produtos", icon: "package" },
  { id: "alerts", label: "Alertas", icon: "bell" },
  { id: "campaigns", label: "Campanhas", icon: "zap" },
] as const;

type Section = (typeof SECTIONS)[number]["id"];

const MOCK_ALERTS = [
  { id: "a1", product: "Leite Parmalat 1L", reported: "R$ 4,89", current: "R$ 5,49", reporter: "Ana S.", time: "Há 12 min", urgent: true },
  { id: "a2", product: "Arroz Tio João 5kg", reported: "R$ 21,90", current: "R$ 24,90", reporter: "Carlos R.", time: "Há 38 min", urgent: true },
  { id: "a3", product: "Coca-Cola 2L", reported: "R$ 8,49", current: "R$ 9,99", reporter: "Pedro L.", time: "Há 1h", urgent: false },
  { id: "a4", product: "Feijão Camil 1kg", reported: "R$ 7,90", current: "R$ 8,99", reporter: "Maria T.", time: "Há 3h", urgent: false },
];

const MOCK_ACTIVITY = [
  { id: "r1", icon: "eye", text: "48 novos usuários viram sua loja", time: "Hoje, 14:32", color: "#2196F3" },
  { id: "r2", icon: "mouse-pointer", text: "12 cliques no banner de promoção", time: "Hoje, 11:15", color: "#9C27B0" },
  { id: "r3", icon: "star", text: "Nova avaliação recebida: ★★★★★", time: "Ontem, 18:44", color: "#FFC107" },
  { id: "r4", icon: "users", text: "3 novos seguidores da sua loja", time: "Ontem, 15:20", color: "#4CAF50" },
  { id: "r5", icon: "alert-circle", text: "2 preços marcados como desatualizados", time: "Ontem, 09:12", color: "#FF5722" },
  { id: "r6", icon: "trending-up", text: "Leite Parmalat 1L em alta — +38% de buscas", time: "Sex, 22:00", color: "#00BCD4" },
];

const MOCK_CAMPAIGNS = [
  { id: "c1", name: "Promoção Segunda e Terça", type: "Banner", status: "active", budget: "R$ 500", reach: "4.200", clicks: "312", start: "01/03", end: "31/03" },
  { id: "c2", name: "Filé Mignon até 40% off", type: "Oferta", status: "active", budget: "R$ 300", reach: "2.100", clicks: "189", start: "15/03", end: "15/04" },
  { id: "c3", name: "Semana do Arroz e Feijão", type: "Destaque", status: "paused", budget: "R$ 200", reach: "980", clicks: "74", start: "01/02", end: "28/02" },
];

export default function PortalSupermercadoScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const C = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { merchantSession, retailerStore } = useApp();

  const [section, setSection] = useState<Section>("overview");

  const topPad = isWeb ? 0 : insets.top;
  const bottomPad = isWeb ? 24 : insets.bottom + 16;

  const storeName = merchantSession?.registration
    ? (merchantSession.registration as any).nomeFantasia || (merchantSession.registration as any).storeName || "Minha Loja"
    : retailerStore?.name || "Minha Loja";

  const plan = merchantSession?.merchantUser?.plan || retailerStore?.plan || "normal";

  const metrics = [
    { label: "Visualizações", value: "48.500", delta: "+12%", icon: "eye", color: "#2196F3", bg: "#2196F318" },
    { label: "Cliques", value: "3.200", delta: "+8%", icon: "mouse-pointer", color: "#9C27B0", bg: "#9C27B018" },
    { label: "Seguidores", value: "1.240", delta: "+3%", icon: "users", color: "#4CAF50", bg: "#4CAF5018" },
    { label: "Alcance", value: plan === "plus" ? "10 km" : "5 km", delta: "raio", icon: "map-pin", color: "#FF9800", bg: "#FF980018" },
  ];

  const urgentCount = MOCK_ALERTS.filter((a) => a.urgent).length;

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      {/* Header */}
      <LinearGradient
        colors={["#1a1a2e", "#16213e"]}
        style={[styles.header, { paddingTop: topPad + 16 }]}
      >
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <Feather name="monitor" size={12} color="rgba(255,255,255,0.6)" />
            <Text style={styles.headerLabel}>Painel de Gestão</Text>
          </View>
          <Text style={styles.headerTitle} numberOfLines={1}>{storeName}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
            <View style={[styles.planBadge, { backgroundColor: plan === "plus" ? "#FFD700" : "rgba(255,255,255,0.15)" }]}>
              {plan === "plus" && <Ionicons name="star" size={9} color="#8B6914" />}
              <Text style={[styles.planBadgeText, { color: plan === "plus" ? "#8B6914" : "rgba(255,255,255,0.85)" }]}>
                {plan === "plus" ? "eCompara Plus" : "Plano Normal"}
              </Text>
            </View>
          </View>
        </View>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
        >
          <Feather name="x" size={20} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Section tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.tabBar, { backgroundColor: C.background, borderBottomColor: C.border }]}
        contentContainerStyle={{ paddingHorizontal: 12 }}
      >
        {SECTIONS.map((s) => {
          const active = section === s.id;
          const badge = s.id === "alerts" && urgentCount > 0 ? urgentCount : undefined;
          return (
            <Pressable
              key={s.id}
              style={[styles.tab, active && { borderBottomColor: "#2196F3" }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSection(s.id); }}
            >
              <View style={{ position: "relative" }}>
                <Feather name={s.icon as any} size={15} color={active ? "#2196F3" : C.textMuted} />
                {badge ? (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeText}>{badge}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.tabLabel, { color: active ? "#2196F3" : C.textMuted }]}>{s.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: bottomPad, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── VISÃO GERAL ── */}
        {section === "overview" && (
          <>
            {/* KPI cards */}
            <View style={styles.metricsGrid}>
              {metrics.map((m) => (
                <View key={m.label} style={[styles.metricCard, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
                  <View style={[styles.metricIconBox, { backgroundColor: m.bg }]}>
                    <Feather name={m.icon as any} size={16} color={m.color} />
                  </View>
                  <Text style={[styles.metricValue, { color: C.text }]}>{m.value}</Text>
                  <Text style={[styles.metricLabel, { color: C.textMuted }]}>{m.label}</Text>
                  <Text style={[styles.metricDelta, { color: m.delta.startsWith("+") ? "#4CAF50" : C.textMuted }]}>{m.delta}</Text>
                </View>
              ))}
            </View>

            {/* Health score */}
            <View style={[styles.healthCard, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <View>
                  <Text style={[styles.sectionTitle, { color: C.text }]}>Índice de Saúde da Loja</Text>
                  <Text style={[styles.sectionSub, { color: C.textMuted }]}>Baseado em preços, atividade e avaliações</Text>
                </View>
                <View style={[styles.healthScoreCircle, { borderColor: "#4CAF50" }]}>
                  <Text style={[styles.healthScoreNum, { color: "#4CAF50" }]}>74</Text>
                  <Text style={[styles.healthScoreOf, { color: C.textMuted }]}>/100</Text>
                </View>
              </View>
              <View style={[styles.healthBar, { backgroundColor: C.backgroundTertiary }]}>
                <View style={[styles.healthBarFill, { width: "74%", backgroundColor: "#4CAF50" }]} />
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
                {[
                  { label: "Preços atualizados", pct: "80%", ok: true },
                  { label: "Engajamento", pct: "68%", ok: true },
                  { label: "Avaliações", pct: "74%", ok: true },
                ].map((item) => (
                  <View key={item.label} style={{ alignItems: "center", flex: 1 }}>
                    <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: item.ok ? "#4CAF50" : "#FF5722" }}>{item.pct}</Text>
                    <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: C.textMuted, textAlign: "center" }}>{item.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Quick actions */}
            <View>
              <Text style={[styles.sectionTitle, { color: C.text, marginBottom: 10 }]}>Ações Rápidas</Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable
                  style={[styles.actionBtn, { backgroundColor: "#CC0000", flex: 1 }]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.back(); router.push("/retailer-scanner"); }}
                >
                  <MaterialCommunityIcons name="barcode-scan" size={18} color="#fff" />
                  <Text style={styles.actionBtnText}>Cadastrar Produto</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionBtn, { backgroundColor: "#2196F3", flex: 1 }]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSection("alerts"); }}
                >
                  <Feather name="bell" size={18} color="#fff" />
                  <Text style={styles.actionBtnText}>Ver Alertas</Text>
                </Pressable>
              </View>
            </View>

            {/* Recent activity */}
            <View>
              <Text style={[styles.sectionTitle, { color: C.text, marginBottom: 10 }]}>Atividade Recente</Text>
              <View style={{ gap: 8 }}>
                {MOCK_ACTIVITY.map((item) => (
                  <View key={item.id} style={[styles.activityRow, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
                    <View style={[styles.activityIcon, { backgroundColor: item.color + "18" }]}>
                      <Feather name={item.icon as any} size={14} color={item.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: C.text, lineHeight: 18 }}>{item.text}</Text>
                      <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: C.textMuted, marginTop: 2 }}>{item.time}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}

        {/* ── PRODUTOS ── */}
        {section === "products" && (
          <>
            <Pressable
              style={[styles.primaryBtn, { backgroundColor: "#CC0000" }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.back(); router.push("/retailer-scanner"); }}
            >
              <MaterialCommunityIcons name="barcode-scan" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>Cadastrar / Atualizar via EAN</Text>
            </Pressable>

            <Text style={[styles.sectionTitle, { color: C.text }]}>Catálogo da Loja</Text>
            <View style={{ gap: 8 }}>
              {(retailerStore?.products || [
                { ean: "7891000053508", name: "Leite Parmalat 1L", price: 5.49, updatedAt: "2025-03-13" },
                { ean: "7891910000197", name: "Arroz Tio João 5kg", price: 24.90, updatedAt: "2025-03-13" },
                { ean: "7894900700015", name: "Coca-Cola 2L", price: 9.99, updatedAt: "2025-03-12" },
                { ean: "7896045104482", name: "Feijão Camil 1kg", price: 8.99, updatedAt: "2025-03-11" },
                { ean: "7891000310755", name: "Açúcar União 1kg", price: 4.89, updatedAt: "2025-03-10" },
              ]).map((p: any) => {
                const isStale = p.updatedAt < "2025-03-12";
                return (
                  <View key={p.ean} style={[styles.productRow, { backgroundColor: C.surfaceElevated, borderColor: isStale ? "#FFC10760" : C.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text }}>{p.name}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 }}>
                        <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: C.textMuted }}>EAN: {p.ean}</Text>
                        {isStale && (
                          <View style={styles.staleBadge}>
                            <Feather name="clock" size={9} color="#FFC107" />
                            <Text style={{ fontSize: 9, fontFamily: "Inter_500Medium", color: "#FFC107" }}>Desatualizado</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 4 }}>
                      <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: C.text }}>
                        R$ {p.price.toFixed(2).replace(".", ",")}
                      </Text>
                      <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: C.textMuted }}>{p.updatedAt}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* ── ALERTAS ── */}
        {section === "alerts" && (
          <>
            {urgentCount > 0 && (
              <View style={[styles.urgentBanner, { backgroundColor: "#FF572218", borderColor: "#FF5722" }]}>
                <Feather name="alert-triangle" size={14} color="#FF5722" />
                <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#FF5722", flex: 1 }}>
                  {urgentCount} alerta{urgentCount > 1 ? "s" : ""} urgente{urgentCount > 1 ? "s" : ""} — preços denunciados por clientes
                </Text>
              </View>
            )}
            <Text style={[styles.sectionTitle, { color: C.text }]}>Denúncias de Preço</Text>
            <View style={{ gap: 10 }}>
              {MOCK_ALERTS.map((alert) => (
                <View key={alert.id} style={[styles.alertCard, { backgroundColor: C.surfaceElevated, borderColor: alert.urgent ? "#FF572260" : C.border, borderLeftColor: alert.urgent ? "#FF5722" : "#FFC107", borderLeftWidth: 3 }]}>
                  <View style={{ flex: 1, gap: 6 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      {alert.urgent && <View style={[styles.urgentDot, { backgroundColor: "#FF5722" }]} />}
                      <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text }}>{alert.product}</Text>
                    </View>
                    <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                      <View style={[styles.pricePill, { backgroundColor: C.backgroundTertiary }]}>
                        <Text style={{ fontSize: 9, fontFamily: "Inter_500Medium", color: C.textMuted }}>ATUAL</Text>
                        <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: C.text }}>{alert.current}</Text>
                      </View>
                      <Feather name="arrow-right" size={12} color={C.textMuted} />
                      <View style={[styles.pricePill, { backgroundColor: "#FF572218" }]}>
                        <Text style={{ fontSize: 9, fontFamily: "Inter_500Medium", color: C.textMuted }}>DENUNCIADO</Text>
                        <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: "#FF5722" }}>{alert.reported}</Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: C.textMuted }}>
                      Por {alert.reporter} · {alert.time}
                    </Text>
                  </View>
                  <View style={{ gap: 6, marginLeft: 8 }}>
                    <TouchableOpacity
                      style={[styles.alertActionBtn, { backgroundColor: "#4CAF50" }]}
                      onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); Alert.alert("Preço confirmado", "O preço foi atualizado com sucesso."); }}
                    >
                      <Feather name="check" size={12} color="#fff" />
                      <Text style={styles.alertActionText}>Confirmar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.alertActionBtn, { backgroundColor: C.backgroundTertiary }]}
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); Alert.alert("Denúncia rejeitada", "A denúncia foi rejeitada."); }}
                    >
                      <Feather name="x" size={12} color={C.textMuted} />
                      <Text style={[styles.alertActionText, { color: C.textMuted }]}>Rejeitar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── CAMPANHAS ── */}
        {section === "campaigns" && (
          <>
            <Pressable
              style={[styles.primaryBtn, { backgroundColor: "#9C27B0" }]}
              onPress={() => Alert.alert("Nova campanha", "Crie uma nova campanha de marketing para sua loja.")}
            >
              <Feather name="plus" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>Nova Campanha</Text>
            </Pressable>

            <Text style={[styles.sectionTitle, { color: C.text }]}>Campanhas Ativas</Text>
            <View style={{ gap: 12 }}>
              {MOCK_CAMPAIGNS.map((c) => (
                <View key={c.id} style={[styles.campaignCard, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: C.text }}>{c.name}</Text>
                      <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: C.textMuted, marginTop: 2 }}>{c.type} · {c.start} – {c.end}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: c.status === "active" ? "#4CAF5020" : "#78909C20", borderColor: c.status === "active" ? "#4CAF5060" : "#78909C60" }]}>
                      <View style={[styles.statusDot, { backgroundColor: c.status === "active" ? "#4CAF50" : "#78909C" }]} />
                      <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: c.status === "active" ? "#4CAF50" : "#78909C" }}>
                        {c.status === "active" ? "Ativo" : "Pausado"}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {[
                      { label: "Orçamento", value: c.budget, icon: "dollar-sign", color: "#4CAF50" },
                      { label: "Alcance", value: c.reach, icon: "eye", color: "#2196F3" },
                      { label: "Cliques", value: c.clicks, icon: "mouse-pointer", color: "#9C27B0" },
                    ].map((stat) => (
                      <View key={stat.label} style={[styles.campaignStat, { backgroundColor: C.backgroundTertiary }]}>
                        <Feather name={stat.icon as any} size={11} color={stat.color} />
                        <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: C.text }}>{stat.value}</Text>
                        <Text style={{ fontSize: 9, fontFamily: "Inter_400Regular", color: C.textMuted }}>{stat.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>

            {plan !== "plus" && (
              <View style={[styles.upgradeCard, { backgroundColor: "#FFD70015", borderColor: "#FFD70060" }]}>
                <Ionicons name="star" size={20} color="#FFD700" />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: C.text }}>Campanhas ilimitadas com Plus</Text>
                  <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: C.textMuted, marginTop: 2 }}>
                    Desbloqueie campanhas avançadas, segmentação e relatórios detalhados.
                  </Text>
                </View>
                <Pressable
                  style={{ backgroundColor: "#FFD700", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }}
                  onPress={() => Alert.alert("Upgrade para Plus", "Entre em contato para assinar o plano Plus.")}
                >
                  <Text style={{ color: "#000", fontFamily: "Inter_700Bold", fontSize: 12 }}>Ver plano</Text>
                </Pressable>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16, flexDirection: "row", alignItems: "flex-start" },
  headerLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.6)", letterSpacing: 0.5 },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#fff" },
  planBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  planBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  closeBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center", marginLeft: 12, marginTop: 4 },
  tabBar: { borderBottomWidth: 1, maxHeight: 52 },
  tab: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  tabBadge: { position: "absolute", top: -5, right: -8, width: 14, height: 14, borderRadius: 7, backgroundColor: "#FF5722", alignItems: "center", justifyContent: "center" },
  tabBadgeText: { fontSize: 8, fontFamily: "Inter_700Bold", color: "#fff" },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metricCard: { width: "47%", borderRadius: 14, padding: 14, borderWidth: 1, gap: 4 },
  metricIconBox: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  metricValue: { fontSize: 20, fontFamily: "Inter_700Bold" },
  metricLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  metricDelta: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  healthCard: { borderRadius: 16, padding: 16, borderWidth: 1 },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  sectionSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  healthScoreCircle: { width: 56, height: 56, borderRadius: 28, borderWidth: 3, alignItems: "center", justifyContent: "center" },
  healthScoreNum: { fontSize: 16, fontFamily: "Inter_700Bold", lineHeight: 18 },
  healthScoreOf: { fontSize: 9, fontFamily: "Inter_400Regular", lineHeight: 10 },
  healthBar: { height: 8, borderRadius: 4, overflow: "hidden" },
  healthBarFill: { height: "100%", borderRadius: 4 },
  actionBtn: { borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  actionBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 13 },
  activityRow: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, padding: 12, borderWidth: 1 },
  activityIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  primaryBtn: { borderRadius: 14, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  primaryBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 },
  productRow: { flexDirection: "row", alignItems: "center", borderRadius: 12, padding: 14, borderWidth: 1, gap: 10 },
  staleBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#FFC10718", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  urgentBanner: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, borderWidth: 1, padding: 12 },
  alertCard: { flexDirection: "row", alignItems: "center", borderRadius: 12, padding: 14, borderWidth: 1 },
  urgentDot: { width: 7, height: 7, borderRadius: 4 },
  pricePill: { borderRadius: 8, padding: 8, alignItems: "center", minWidth: 70 },
  alertActionBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  alertActionText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#fff" },
  campaignCard: { borderRadius: 16, padding: 14, borderWidth: 1 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  campaignStat: { flex: 1, alignItems: "center", borderRadius: 10, padding: 10, gap: 3 },
  upgradeCard: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, borderWidth: 1, padding: 14 },
});
