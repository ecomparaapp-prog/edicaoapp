import { Feather, MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import { useTheme } from "@/context/ThemeContext";

const MOCK_ALERTS = [
  { id: "a1", type: "price_report", product: "Leite Parmalat 1L", reported: "R$ 4,89", current: "R$ 5,49", reporter: "Ana S.", time: "Há 12 min", urgent: true },
  { id: "a2", type: "price_report", product: "Arroz Tio João 5kg", reported: "R$ 21,90", current: "R$ 24,90", reporter: "Carlos R.", time: "Há 38 min", urgent: true },
  { id: "a3", type: "verification", product: "Coca-Cola 2L", reported: "R$ 8,49", current: "R$ 9,99", reporter: "Pedro L.", time: "Há 1h", urgent: false },
  { id: "a4", type: "new_claim", product: "", reported: "", current: "", reporter: "Marcos N.", time: "Há 2h", urgent: false },
];

const MOCK_RECENT_ACTIVITY = [
  { id: "r1", icon: "eye", text: "48 novos usuários viram sua loja", time: "Hoje", color: "#2196F3" },
  { id: "r2", icon: "mouse-pointer", text: "12 cliques no seu banner de promoção", time: "Hoje", color: "#9C27B0" },
  { id: "r3", icon: "star", text: "Avaliação nova: ★★★★★", time: "Ontem", color: "#FFC107" },
  { id: "r4", icon: "users", text: "3 novos seguidores na sua loja", time: "Ontem", color: "#4CAF50" },
  { id: "r5", icon: "alert-circle", text: "2 preços marcados como desatualizados", time: "Ontem", color: "#FF5722" },
];

const MOCK_TOP_PRODUCTS = [
  { ean: "7891000053508", name: "Leite Parmalat 1L", views: 284, trend: "up" },
  { ean: "7894900700015", name: "Coca-Cola 2L", views: 196, trend: "up" },
  { ean: "7891910000197", name: "Arroz Tio João 5kg", views: 143, trend: "down" },
];

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const C = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { user, setUser, isLoggedIn, activeTab, setActiveTab, retailerStore, updateRetailerProduct, finalizedLists, processedNFCe } = useApp();
  const { toggleTheme } = useTheme();

  const [editingEan, setEditingEan] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");

  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 84 : 90;

  const handleLogin = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/(auth)/login");
  };

  const handleLogout = () => {
    Alert.alert("Sair", "Deseja sair da sua conta?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Sair", style: "destructive", onPress: () => { setUser(null); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } },
    ]);
  };

  const handleSavePrice = (ean: string) => {
    const price = parseFloat(editPrice.replace(",", "."));
    if (isNaN(price) || price <= 0) { Alert.alert("Preço inválido"); return; }
    updateRetailerProduct(ean, price);
    setEditingEan(null);
    setEditPrice("");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  if (activeTab === "retailer" && isLoggedIn) {
    return (
      <RetailerPanel
        topPad={topPad} bottomPad={bottomPad} isDark={isDark} C={C}
        onSwitchToCustomer={() => setActiveTab("customer")}
        retailerStore={retailerStore}
        editingEan={editingEan} setEditingEan={setEditingEan}
        editPrice={editPrice} setEditPrice={setEditPrice}
        handleSavePrice={handleSavePrice}
        finalizedLists={finalizedLists}
        processedNFCe={processedNFCe}
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: bottomPad }}>
        <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: C.background }]}>
          <Text style={[styles.title, { color: C.text }]}>Perfil</Text>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <Pressable style={[styles.iconBtnSm, { backgroundColor: C.backgroundSecondary }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggleTheme(); }}>
              <Feather name={isDark ? "sun" : "moon"} size={16} color={C.text} />
            </Pressable>
            {isLoggedIn && (
              <Pressable style={[styles.switchModeBtn, { backgroundColor: "#CC000015", borderColor: "#CC000040", borderWidth: 1 }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveTab("retailer"); }}>
                <Feather name="store" size={14} color={C.primary} />
                <Text style={[styles.switchModeTxt, { color: C.primary }]}>Área Lojista</Text>
              </Pressable>
            )}
          </View>
        </View>

        {isLoggedIn ? (
          <>
            <Pressable style={[styles.userCard, { backgroundColor: C.primary, marginHorizontal: 16, marginBottom: 20 }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/settings/profile-edit"); }}>
              <View style={[styles.avatarLarge, { backgroundColor: "rgba(255,255,255,0.15)" }]}>
                <Feather name="user" size={32} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={styles.userName}>{user?.name}</Text>
                  <Feather name="edit-2" size={12} color="rgba(255,255,255,0.7)" />
                </View>
                <Text style={styles.userEmail}>{user?.email}</Text>
                <View style={styles.userStats}>
                  <View style={styles.userStat}>
                    <Text style={styles.userStatNum}>{(user?.points || 0).toLocaleString("pt-BR")}</Text>
                    <Text style={styles.userStatLabel}>pontos</Text>
                  </View>
                  <View style={[styles.userStatDiv, { backgroundColor: "rgba(255,255,255,0.2)" }]} />
                  <View style={styles.userStat}>
                    <Text style={styles.userStatNum}>#{user?.rank || 12}</Text>
                    <Text style={styles.userStatLabel}>ranking</Text>
                  </View>
                  <View style={[styles.userStatDiv, { backgroundColor: "rgba(255,255,255,0.2)" }]} />
                  <View style={styles.userStat}>
                    <Text style={styles.userStatNum}>{user?.totalPriceUpdates || 16}</Text>
                    <Text style={styles.userStatLabel}>atualizações</Text>
                  </View>
                </View>
              </View>
            </Pressable>

            <View style={{ paddingHorizontal: 16, gap: 8 }}>
              <MenuItem icon="map-pin" label="Localização" sub="Brasília, DF" color={C} onPress={() => router.push("/settings/location")} />
              <MenuItem icon="shield" label="Privacidade" color={C} onPress={() => router.push("/settings/privacy")} />
              <MenuItem icon="bell" label="Notificações" color={C} onPress={() => router.push("/settings/notifications")} />
              <MenuItem icon="help-circle" label="Ajuda" color={C} onPress={() => router.push("/settings/help")} />
              <Pressable style={[styles.menuItem, { backgroundColor: C.surfaceElevated, borderColor: "#CC0000" + "40" }]} onPress={handleLogout}>
                <View style={[styles.menuIcon, { backgroundColor: "#CC000020" }]}>
                  <Feather name="log-out" size={16} color="#CC0000" />
                </View>
                <Text style={[styles.menuLabel, { color: "#CC0000" }]}>Sair</Text>
                <Feather name="chevron-right" size={16} color="#CC0000" />
              </Pressable>
            </View>
          </>
        ) : (
          <View style={styles.notLoggedIn}>
            <View style={[styles.loginIcon, { backgroundColor: C.backgroundSecondary }]}>
              <Feather name="user" size={40} color={C.textMuted} />
            </View>
            <Text style={[styles.notLoggedTitle, { color: C.text }]}>Entre na sua conta</Text>
            <Text style={[styles.notLoggedSub, { color: C.textMuted }]}>
              Faça login para salvar sua lista, acompanhar o ranking e ganhar pontos
            </Text>
            <Pressable style={[styles.googleBtn, { backgroundColor: C.primary }]} onPress={handleLogin}>
              <Feather name="log-in" size={18} color="#fff" />
              <Text style={styles.googleBtnText}>Entrar com Google</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function MenuItem({ icon, label, sub, color: C, onPress }: any) {
  return (
    <Pressable style={[styles.menuItem, { backgroundColor: C.surfaceElevated, borderColor: C.border }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress?.(); }}>
      <View style={[styles.menuIcon, { backgroundColor: C.backgroundTertiary }]}>
        <Feather name={icon} size={16} color={C.textSecondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.menuLabel, { color: C.text }]}>{label}</Text>
        {sub && <Text style={[styles.menuSub, { color: C.textMuted }]}>{sub}</Text>}
      </View>
      <Feather name="chevron-right" size={16} color={C.textMuted} />
    </Pressable>
  );
}

function RetailerPanel({ topPad, bottomPad, isDark, C, onSwitchToCustomer, retailerStore, editingEan, setEditingEan, editPrice, setEditPrice, handleSavePrice, finalizedLists, processedNFCe }: any) {
  const [section, setSection] = useState<"dashboard" | "alertas" | "products" | "plan">("dashboard");
  const urgentCount = MOCK_ALERTS.filter((a) => a.urgent).length;

  const metrics = [
    { label: "Visualizações", value: "48.500", prev: "+12%", icon: "eye", trend: "up", color: "#2196F3" },
    { label: "Cliques", value: "3.200", prev: "+8%", icon: "mouse-pointer", trend: "up", color: "#9C27B0" },
    { label: "Seguidores", value: "1.240", prev: "+3%", icon: "users", trend: "up", color: "#4CAF50" },
    { label: "Alcance", value: retailerStore?.plan === "plus" ? "10km" : "5km", prev: "raio", icon: "map-pin", trend: "flat", color: "#FF9800" },
  ];

  const healthScore = 74;

  const tabs: { id: typeof section; label: string; icon: string; badge?: number }[] = [
    { id: "dashboard", label: "Dashboard", icon: "bar-chart-2" },
    { id: "alertas", label: "Alertas", icon: "bell", badge: urgentCount },
    { id: "products", label: "Produtos", icon: "package" },
    { id: "plan", label: "Plano", icon: "star" },
  ];

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      {/* Header */}
      <LinearGradient colors={["#CC0000", "#8B0000"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.retailerHeaderGrad, { paddingTop: topPad + 10 }]}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <Feather name="store" size={14} color="rgba(255,255,255,0.75)" />
            <Text style={styles.retailerHeaderLabel}>Área Lojista</Text>
          </View>
          <Text style={styles.retailerStoreName} numberOfLines={1}>{retailerStore?.name || "Minha Loja"}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
            <View style={[styles.planPill, { backgroundColor: retailerStore?.plan === "plus" ? "#FFD700" : "rgba(255,255,255,0.2)" }]}>
              {retailerStore?.plan === "plus" && <Ionicons name="star" size={9} color="#8B6914" />}
              <Text style={[styles.planPillText, { color: retailerStore?.plan === "plus" ? "#8B6914" : "rgba(255,255,255,0.9)" }]}>
                {retailerStore?.plan === "plus" ? "eCompara Plus" : "Plano Normal"}
              </Text>
            </View>
            <View style={[styles.activeDot, { backgroundColor: "#4CAF50" }]} />
            <Text style={styles.activeLabel}>Loja ativa</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.switchClientBtn} onPress={onSwitchToCustomer}>
          <Feather name="user" size={13} color="rgba(255,255,255,0.85)" />
          <Text style={styles.switchClientText}>Cliente</Text>
        </TouchableOpacity>
      </LinearGradient>

      {/* Section Tabs */}
      <View style={[styles.retailerTabs, { backgroundColor: C.background, borderBottomColor: C.border }]}>
        {tabs.map((t) => (
          <Pressable key={t.id} style={[styles.retailerTab, section === t.id && { borderBottomColor: C.primary }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSection(t.id); }}>
            <View style={{ position: "relative" }}>
              <Feather name={t.icon as any} size={16} color={section === t.id ? C.primary : C.textMuted} />
              {t.badge ? (
                <View style={[styles.tabBadge, { backgroundColor: "#FF5722" }]}>
                  <Text style={styles.tabBadgeText}>{t.badge}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.retailerTabText, { color: section === t.id ? C.primary : C.textMuted }]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* DASHBOARD */}
      {section === "dashboard" && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPad, gap: 14 }}>
          {/* Health Score */}
          <View style={[styles.healthCard, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.healthTitle, { color: C.text }]}>Saúde da Loja</Text>
              <Text style={[styles.healthSub, { color: C.textMuted }]}>Baseado em preços, avaliações e atividade</Text>
              <View style={[styles.healthBarBg, { backgroundColor: C.backgroundTertiary, marginTop: 10 }]}>
                <View style={[styles.healthBarFill, { width: `${healthScore}%`, backgroundColor: healthScore >= 70 ? C.success : healthScore >= 40 ? "#FFC107" : C.primary }]} />
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                <Text style={[{ fontSize: 10, fontFamily: "Inter_400Regular", color: C.textMuted }]}>0</Text>
                <Text style={[{ fontSize: 11, fontFamily: "Inter_700Bold", color: healthScore >= 70 ? C.success : "#FFC107" }]}>{healthScore}/100 — Bom</Text>
                <Text style={[{ fontSize: 10, fontFamily: "Inter_400Regular", color: C.textMuted }]}>100</Text>
              </View>
            </View>
            <View style={[styles.healthScoreBig, { borderColor: healthScore >= 70 ? C.success : "#FFC107" }]}>
              <Text style={[styles.healthScoreNum, { color: healthScore >= 70 ? C.success : "#FFC107" }]}>{healthScore}</Text>
              <Text style={[styles.healthScorePts, { color: C.textMuted }]}>pts</Text>
            </View>
          </View>

          {/* Metrics Grid */}
          <View style={styles.metricsGrid}>
            {metrics.map((m) => (
              <View key={m.label} style={[styles.metricCard, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                  <View style={[styles.metricIconBg, { backgroundColor: m.color + "18" }]}>
                    <Feather name={m.icon as any} size={14} color={m.color} />
                  </View>
                  {m.trend === "up" && (
                    <View style={styles.trendUp}>
                      <Feather name="trending-up" size={10} color="#4CAF50" />
                      <Text style={[styles.trendText, { color: "#4CAF50" }]}>{m.prev}</Text>
                    </View>
                  )}
                  {m.trend === "down" && (
                    <View style={styles.trendDown}>
                      <Feather name="trending-down" size={10} color="#F44336" />
                      <Text style={[styles.trendText, { color: "#F44336" }]}>{m.prev}</Text>
                    </View>
                  )}
                  {m.trend === "flat" && (
                    <Text style={[styles.trendText, { color: C.textMuted }]}>{m.prev}</Text>
                  )}
                </View>
                <Text style={[styles.metricValue, { color: C.text }]}>{m.value}</Text>
                <Text style={[styles.metricLabel, { color: C.textMuted }]}>{m.label}</Text>
              </View>
            ))}
          </View>

          {/* Quick Actions */}
          <View style={{ gap: 6 }}>
            <Text style={[styles.sectionLabel, { color: C.textMuted }]}>AÇÕES RÁPIDAS</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[
                { icon: "plus-circle", label: "Nova Campanha", color: C.primary },
                { icon: "package", label: "Cadastrar Produto", color: "#2196F3" },
                { icon: "share-2", label: "Compartilhar Loja", color: "#9C27B0" },
              ].map((a) => (
                <Pressable
                  key={a.label}
                  style={[styles.quickAction, { backgroundColor: C.surfaceElevated, borderColor: a.color + "30", borderWidth: 1 }]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); if (a.label === "Cadastrar Produto") router.push("/retailer-scanner"); else Alert.alert("Em breve", `${a.label} estará disponível em breve.`); }}
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: a.color + "18" }]}>
                    <Feather name={a.icon as any} size={16} color={a.color} />
                  </View>
                  <Text style={[styles.quickActionLabel, { color: C.text }]}>{a.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Active Campaign */}
          <View style={{ gap: 6 }}>
            <Text style={[styles.sectionLabel, { color: C.textMuted }]}>CAMPANHA ATIVA</Text>
            <View style={[styles.campaignCard, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
              <View style={styles.campaignHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.campaignTitle, { color: C.text }]}>Promoção Segunda e Terça</Text>
                  <Text style={[styles.campaignSub, { color: C.textMuted }]}>Banner • Filé Mignon até 40% off</Text>
                </View>
                <View style={[styles.activeBadge, { backgroundColor: C.success }]}>
                  <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: "#fff", marginRight: 4 }} />
                  <Text style={styles.activeBadgeText}>Ativo</Text>
                </View>
              </View>
              <View style={[styles.progressBarBg, { backgroundColor: C.backgroundTertiary }]}>
                <View style={[styles.progressBarFill, { backgroundColor: C.primary, width: "65%" }]} />
              </View>
              <View style={styles.campaignFooter}>
                <Text style={[styles.campaignBudget, { color: C.textMuted }]}>Orçamento: R$ {retailerStore?.campaignBudget || 500}</Text>
                <Text style={[styles.campaignUsed, { color: C.primary }]}>65% usado · R$ 175 restante</Text>
              </View>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                <View style={[styles.campStat, { backgroundColor: C.backgroundSecondary }]}>
                  <Text style={[{ fontSize: 13, fontFamily: "Inter_700Bold", color: C.text }]}>2.080</Text>
                  <Text style={[{ fontSize: 10, color: C.textMuted, fontFamily: "Inter_400Regular" }]}>impressões</Text>
                </View>
                <View style={[styles.campStat, { backgroundColor: C.backgroundSecondary }]}>
                  <Text style={[{ fontSize: 13, fontFamily: "Inter_700Bold", color: C.text }]}>147</Text>
                  <Text style={[{ fontSize: 10, color: C.textMuted, fontFamily: "Inter_400Regular" }]}>cliques</Text>
                </View>
                <View style={[styles.campStat, { backgroundColor: C.backgroundSecondary }]}>
                  <Text style={[{ fontSize: 13, fontFamily: "Inter_700Bold", color: "#4CAF50" }]}>7,1%</Text>
                  <Text style={[{ fontSize: 10, color: C.textMuted, fontFamily: "Inter_400Regular" }]}>CTR</Text>
                </View>
              </View>
            </View>
            <Pressable style={[styles.addCampaignBtn, { backgroundColor: C.primary }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); Alert.alert("Em breve", "Criação de campanhas estará disponível em breve!"); }}>
              <Feather name="plus" size={16} color="#fff" />
              <Text style={styles.addCampaignText}>Nova campanha</Text>
            </Pressable>
          </View>

          {/* Top Products */}
          <View style={{ gap: 6 }}>
            <Text style={[styles.sectionLabel, { color: C.textMuted }]}>PRODUTOS MAIS VISTOS (ESTA SEMANA)</Text>
            {MOCK_TOP_PRODUCTS.map((p, i) => (
              <View key={p.ean} style={[styles.topProductRow, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
                <View style={[styles.topProductRank, { backgroundColor: i === 0 ? "#FFD700" : C.backgroundTertiary }]}>
                  <Text style={[styles.topProductRankText, { color: i === 0 ? "#000" : C.textSecondary }]}>#{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.topProductName, { color: C.text }]}>{p.name}</Text>
                  <Text style={[styles.topProductEan, { color: C.textMuted }]}>{p.ean}</Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 2 }}>
                  <Text style={[styles.topProductViews, { color: C.primary }]}>{p.views}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                    <Feather name={p.trend === "up" ? "trending-up" : "trending-down"} size={10} color={p.trend === "up" ? "#4CAF50" : "#F44336"} />
                    <Text style={{ fontSize: 9, color: p.trend === "up" ? "#4CAF50" : "#F44336", fontFamily: "Inter_500Medium" }}>views</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>

          {/* Recent Activity */}
          <View style={{ gap: 6 }}>
            <Text style={[styles.sectionLabel, { color: C.textMuted }]}>ATIVIDADE RECENTE</Text>
            {MOCK_RECENT_ACTIVITY.map((a) => (
              <View key={a.id} style={[styles.activityRow, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
                <View style={[styles.activityIcon, { backgroundColor: a.color + "18" }]}>
                  <Feather name={a.icon as any} size={14} color={a.color} />
                </View>
                <Text style={[styles.activityText, { color: C.text, flex: 1 }]}>{a.text}</Text>
                <Text style={[styles.activityTime, { color: C.textMuted }]}>{a.time}</Text>
              </View>
            ))}
          </View>

          {/* ── Plus Report ── */}
          {retailerStore?.plan === "plus" ? (
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={[styles.sectionLabel, { color: C.textMuted }]}>RELATÓRIO PLUS</Text>
                <View style={[styles.plusTag, { backgroundColor: "#FFD70020" }]}>
                  <Ionicons name="star" size={9} color="#8B6914" />
                  <Text style={[styles.plusTagTxt, { color: "#8B6914" }]}>Exclusivo</Text>
                </View>
              </View>

              {/* Finalized lists sub-section */}
              <View style={[styles.reportSection, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
                <View style={styles.reportSectionHeader}>
                  <View style={[styles.reportIcon, { backgroundColor: "#CC000015" }]}>
                    <MaterialCommunityIcons name="map-marker-check" size={16} color="#CC0000" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.reportSectionTitle, { color: C.text }]}>Listas Finalizadas na Loja</Text>
                    <Text style={[styles.reportSectionSub, { color: C.textMuted }]}>Clientes que validaram presença aqui</Text>
                  </View>
                  <View style={[styles.reportCountBadge, { backgroundColor: "#CC000015" }]}>
                    <Text style={[styles.reportCountVal, { color: "#CC0000" }]}>{finalizedLists?.length ?? 0}</Text>
                  </View>
                </View>
                {(finalizedLists ?? []).slice(0, 3).map((fl: any) => (
                  <View key={fl.id} style={[styles.reportRow, { borderTopColor: C.border }]}>
                    <View style={[styles.reportRowIcon, { backgroundColor: fl.status === "full" ? "#22C55E18" : fl.status === "fraud" ? "#F59E0B18" : "#2196F318" }]}>
                      <Feather name={fl.status === "full" ? "check-circle" : fl.status === "fraud" ? "alert-triangle" : "clock"} size={13} color={fl.status === "full" ? "#22C55E" : fl.status === "fraud" ? "#F59E0B" : "#2196F3"} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.reportRowTitle, { color: C.text }]}>{fl.checkedItems}/{fl.totalItems} itens marcados</Text>
                      <Text style={[styles.reportRowMeta, { color: C.textMuted }]}>{Math.floor(fl.durationSeconds / 60)}min no local · {fl.timestamp}</Text>
                    </View>
                    <Text style={[styles.reportRowPts, { color: "#CC0000" }]}>+{fl.points} pts</Text>
                  </View>
                ))}
                {(finalizedLists?.length ?? 0) === 0 && (
                  <Text style={[styles.reportEmpty, { color: C.textMuted }]}>Nenhuma lista finalizada ainda.</Text>
                )}
              </View>

              {/* NFCe sub-section */}
              <View style={[styles.reportSection, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
                <View style={styles.reportSectionHeader}>
                  <View style={[styles.reportIcon, { backgroundColor: "#22C55E15" }]}>
                    <MaterialCommunityIcons name="receipt" size={16} color="#22C55E" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.reportSectionTitle, { color: C.text }]}>Notas Fiscais Enviadas</Text>
                    <Text style={[styles.reportSectionSub, { color: C.textMuted }]}>Preços atualizados via NFC-e</Text>
                  </View>
                  <View style={[styles.reportCountBadge, { backgroundColor: "#22C55E15" }]}>
                    <Text style={[styles.reportCountVal, { color: "#22C55E" }]}>{(processedNFCe ?? []).filter((n: any) => !n.isDuplicate).length}</Text>
                  </View>
                </View>
                {(processedNFCe ?? []).slice(0, 3).map((nf: any) => (
                  <View key={nf.id} style={[styles.reportRow, { borderTopColor: C.border }]}>
                    <View style={[styles.reportRowIcon, { backgroundColor: nf.isDuplicate ? "#F59E0B18" : "#22C55E18" }]}>
                      <MaterialCommunityIcons name="qrcode" size={13} color={nf.isDuplicate ? "#F59E0B" : "#22C55E"} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.reportRowTitle, { color: C.text }]}>{nf.items.length} preços atualizados</Text>
                      <Text style={[styles.reportRowMeta, { color: C.textMuted }]}>CNPJ {nf.storeCNPJ} · {nf.timestamp}</Text>
                      <Text style={[styles.reportRowMeta, { color: C.textMuted }]} numberOfLines={1}>
                        chNFe: {nf.chNFe.slice(0, 16)}…
                      </Text>
                    </View>
                    <Text style={[styles.reportRowPts, { color: nf.isDuplicate ? "#F59E0B" : "#22C55E" }]}>
                      {nf.isDuplicate ? "Dup." : `+${nf.points} pts`}
                    </Text>
                  </View>
                ))}
                {(processedNFCe?.length ?? 0) === 0 && (
                  <Text style={[styles.reportEmpty, { color: C.textMuted }]}>Nenhuma nota processada ainda.</Text>
                )}
              </View>

              {/* Summary stats */}
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={[styles.summaryCard, { backgroundColor: C.surfaceElevated, borderColor: C.border, flex: 1 }]}>
                  <Text style={[styles.summaryVal, { color: "#CC0000" }]}>{(finalizedLists ?? []).reduce((s: number, f: any) => s + f.checkedItems, 0)}</Text>
                  <Text style={[styles.summaryLabel, { color: C.textMuted }]}>Itens comprados</Text>
                </View>
                <View style={[styles.summaryCard, { backgroundColor: C.surfaceElevated, borderColor: C.border, flex: 1 }]}>
                  <Text style={[styles.summaryVal, { color: "#22C55E" }]}>{(processedNFCe ?? []).reduce((s: number, n: any) => s + n.items.length, 0)}</Text>
                  <Text style={[styles.summaryLabel, { color: C.textMuted }]}>Preços via nota</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={[styles.plusLockedCard, { backgroundColor: C.surfaceElevated, borderColor: "#FFD70050" }]}>
              <Ionicons name="star" size={24} color="#FFD700" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.plusLockedTitle, { color: C.text }]}>Relatório Completo</Text>
                <Text style={[styles.plusLockedSub, { color: C.textMuted }]}>Listas finalizadas e notas enviadas disponíveis no Plano Plus.</Text>
              </View>
              <Pressable style={styles.plusUpgradeBtn} onPress={() => setSection("plan")}>
                <Text style={styles.plusUpgradeTxt}>Ver planos</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      )}

      {/* ALERTAS */}
      {section === "alertas" && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPad, gap: 10 }}>
          {urgentCount > 0 && (
            <View style={[styles.alertBanner, { backgroundColor: "#FF572218", borderColor: "#FF5722" }]}>
              <Feather name="alert-triangle" size={15} color="#FF5722" />
              <Text style={[styles.alertBannerText, { color: "#FF5722" }]}>
                {urgentCount} alerta{urgentCount > 1 ? "s" : ""} urgente{urgentCount > 1 ? "s" : ""} — Preços denunciados por clientes
              </Text>
            </View>
          )}
          <Text style={[styles.sectionLabel, { color: C.textMuted }]}>DENÚNCIAS DE PREÇO</Text>
          {MOCK_ALERTS.filter((a) => a.type === "price_report" || a.type === "verification").map((alert) => (
            <View key={alert.id} style={[styles.alertCard, { backgroundColor: C.surfaceElevated, borderColor: alert.urgent ? "#FF572260" : C.border, borderLeftColor: alert.urgent ? "#FF5722" : "#FFC107", borderLeftWidth: 3 }]}>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  {alert.urgent && <View style={[styles.urgentDot, { backgroundColor: "#FF5722" }]} />}
                  <Text style={[styles.alertProduct, { color: C.text }]}>{alert.product}</Text>
                </View>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={[styles.pricePill, { backgroundColor: C.backgroundTertiary }]}>
                    <Text style={[styles.pricePillLabel, { color: C.textMuted }]}>Atual</Text>
                    <Text style={[styles.pricePillVal, { color: C.text }]}>{alert.current}</Text>
                  </View>
                  <Feather name="arrow-right" size={14} color={C.textMuted} style={{ alignSelf: "center" }} />
                  <View style={[styles.pricePill, { backgroundColor: "#FF572218" }]}>
                    <Text style={[styles.pricePillLabel, { color: C.textMuted }]}>Denunciado</Text>
                    <Text style={[styles.pricePillVal, { color: "#FF5722" }]}>{alert.reported}</Text>
                  </View>
                </View>
                <Text style={[styles.alertMeta, { color: C.textMuted }]}>Por {alert.reporter} · {alert.time}</Text>
              </View>
              <View style={{ gap: 6, marginLeft: 8 }}>
                <TouchableOpacity
                  style={[styles.alertBtn, { backgroundColor: C.success }]}
                  onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); Alert.alert("Preço atualizado", "O preço foi confirmado e atualizado com sucesso."); }}
                >
                  <Feather name="check" size={13} color="#fff" />
                  <Text style={styles.alertBtnText}>Confirmar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.alertBtn, { backgroundColor: C.backgroundTertiary }]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); Alert.alert("Denúncia rejeitada", "A denúncia foi rejeitada. O preço não será alterado."); }}
                >
                  <Feather name="x" size={13} color={C.textMuted} />
                  <Text style={[styles.alertBtnText, { color: C.textMuted }]}>Rejeitar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          <Text style={[styles.sectionLabel, { color: C.textMuted, marginTop: 6 }]}>SOLICITAÇÕES DE PARCERIA</Text>
          {MOCK_ALERTS.filter((a) => a.type === "new_claim").map((alert) => (
            <View key={alert.id} style={[styles.alertCard, { backgroundColor: C.surfaceElevated, borderColor: C.border, borderLeftColor: "#2196F3", borderLeftWidth: 3 }]}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[styles.alertProduct, { color: C.text }]}>Solicitação de revindicação</Text>
                <Text style={[styles.alertMeta, { color: C.textMuted }]}>Usuário {alert.reporter} reivindica ser dono desta loja · {alert.time}</Text>
              </View>
              <View style={{ gap: 6, marginLeft: 8 }}>
                <TouchableOpacity style={[styles.alertBtn, { backgroundColor: "#2196F3" }]} onPress={() => Alert.alert("Em análise", "A solicitação será analisada pela equipe eCompara.")}>
                  <Feather name="eye" size={13} color="#fff" />
                  <Text style={styles.alertBtnText}>Ver</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* PRODUTOS */}
      {section === "products" && (
        <FlatList
          data={retailerStore?.products || []}
          keyExtractor={(item: any) => item.ean}
          contentContainerStyle={{ padding: 16, paddingBottom: bottomPad, gap: 8 }}
          scrollEnabled
          ListHeaderComponent={() => (
            <View style={{ gap: 8, marginBottom: 4 }}>
              <Pressable style={[styles.addProductBtn, { backgroundColor: C.primary }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/retailer-scanner"); }}>
                <MaterialCommunityIcons name="barcode-scan" size={16} color="#fff" />
                <Text style={styles.addCampaignText}>Cadastrar via EAN / Scanner</Text>
              </Pressable>
              <View style={[styles.infoBox, { backgroundColor: isDark ? "#161600" : "#FFFBEA", borderColor: "#D4AF37" + "50" }]}>
                <Feather name="info" size={12} color="#D4AF37" />
                <Text style={[styles.infoBoxText, { color: C.textSecondary }]}>
                  Toque no preço de qualquer produto para editar. Preços atualizados aumentam sua pontuação de saúde.
                </Text>
              </View>
            </View>
          )}
          renderItem={({ item }: any) => {
            const isStale = item.updatedAt < "2025-03-12";
            return (
              <View style={[styles.productRow, { backgroundColor: C.surfaceElevated, borderColor: isStale ? "#FFC107" + "60" : C.border }]}>
                <View style={styles.productRowInfo}>
                  <Text style={[styles.productRowName, { color: C.text }]}>{item.name}</Text>
                  <Text style={[styles.productRowEan, { color: C.textMuted }]}>{item.ean}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                    {isStale && <Feather name="clock" size={10} color="#FFC107" />}
                    <Text style={[styles.productRowDate, { color: isStale ? "#FFC107" : C.textMuted }]}>
                      {isStale ? "Desatualizado · " : ""}Atualizado: {item.updatedAt}
                    </Text>
                  </View>
                </View>
                {editingEan === item.ean ? (
                  <View style={styles.editRow}>
                    <TextInput
                      style={[styles.priceInput, { color: C.text, backgroundColor: C.backgroundSecondary, borderColor: C.primary, borderWidth: 1 }]}
                      value={editPrice} onChangeText={setEditPrice}
                      keyboardType="decimal-pad" placeholder="0,00" placeholderTextColor={C.textMuted} autoFocus
                    />
                    <Pressable style={[styles.saveBtn, { backgroundColor: C.success }]} onPress={() => handleSavePrice(item.ean)}>
                      <Feather name="check" size={14} color="#fff" />
                    </Pressable>
                    <Pressable style={[styles.saveBtn, { backgroundColor: C.backgroundTertiary }]} onPress={() => setEditingEan(null)}>
                      <Feather name="x" size={14} color={C.textMuted} />
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    style={[styles.priceTag, { backgroundColor: C.primary + "15", borderColor: C.primary + "30", borderWidth: 1 }]}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setEditingEan(item.ean); setEditPrice(item.price.toFixed(2).replace(".", ",")); }}
                  >
                    <Text style={[styles.priceTagText, { color: C.primary }]}>R$ {item.price.toFixed(2).replace(".", ",")}</Text>
                    <Feather name="edit-2" size={11} color={C.primary} />
                  </Pressable>
                )}
              </View>
            );
          }}
        />
      )}

      {/* PLANO */}
      {section === "plan" && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPad, gap: 12 }}>
          <View style={[styles.infoBox, { backgroundColor: isDark ? "#001600" : "#F0FFF0", borderColor: "#4CAF50" + "50", marginBottom: 4 }]}>
            <Feather name="check-circle" size={13} color="#4CAF50" />
            <Text style={[styles.infoBoxText, { color: C.textSecondary }]}>
              Plano ativo até 30/04/2025. Renovação automática habilitada.
            </Text>
          </View>
          <PlanCard isDark={isDark} C={C} plan="normal" current={retailerStore?.plan === "normal"} />
          <PlanCard isDark={isDark} C={C} plan="plus" current={retailerStore?.plan === "plus"} />
          <View style={[styles.infoBox, { backgroundColor: isDark ? "#0A0A0A" : "#F5F5F5", borderColor: C.border }]}>
            <Feather name="phone" size={13} color={C.textMuted} />
            <Text style={[styles.infoBoxText, { color: C.textMuted }]}>
              Precisa de ajuda para escolher um plano? Entre em contato: suporte@ecompara.com.br
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function PlanCard({ isDark, C, plan, current }: any) {
  const isPlus = plan === "plus";
  return (
    <View style={[styles.planCard, { backgroundColor: isPlus ? C.primary : C.surfaceElevated, borderColor: isPlus ? C.primary : C.border }]}>
      {current && (
        <View style={[styles.currentBadge, { backgroundColor: isPlus ? "#fff" : C.primary }]}>
          <Feather name="check" size={10} color={isPlus ? C.primary : "#fff"} />
          <Text style={[styles.currentBadgeText, { color: isPlus ? C.primary : "#fff" }]}>PLANO ATUAL</Text>
        </View>
      )}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {isPlus && <Ionicons name="star" size={20} color="#FFD700" />}
        <Text style={[styles.planName, { color: isPlus ? "#fff" : C.text }]}>
          eCompara {isPlus ? "Plus" : "Normal"}
        </Text>
      </View>
      <Text style={[styles.planPrice, { color: isPlus ? "#fff" : C.text }]}>
        {isPlus ? "R$ 89,90" : "R$ 49,90"}<Text style={[{ fontSize: 13 }, { color: isPlus ? "rgba(255,255,255,0.7)" : C.textMuted }]}>/mês</Text>
      </Text>
      {[
        { text: `Visibilidade: ${isPlus ? "até 10km" : "até 5km"}`, highlight: isPlus },
        { text: "Cadastro de produtos por EAN", highlight: false },
        { text: "Importação via PDV", highlight: false },
        { text: isPlus ? "Campanhas ilimitadas" : "1 campanha ativa por vez", highlight: isPlus },
        { text: isPlus ? "Dashboard completo com analytics" : "Relatório básico mensal", highlight: isPlus },
        { text: isPlus ? "Alertas de denúncia em tempo real" : "—", highlight: isPlus },
        { text: isPlus ? "Suporte prioritário 24h" : "Suporte padrão (72h)", highlight: false },
      ].map((feature, i) => (
        <View key={i} style={styles.featureRow}>
          <Feather name={feature.text === "—" ? "x" : "check"} size={14} color={feature.text === "—" ? "rgba(255,255,255,0.3)" : (isPlus ? "#fff" : C.success)} />
          <Text style={[styles.featureText, { color: feature.text === "—" ? "rgba(255,255,255,0.35)" : (isPlus ? "rgba(255,255,255,0.9)" : C.textSecondary), fontFamily: feature.highlight ? "Inter_600SemiBold" : "Inter_400Regular" }]}>{feature.text}</Text>
        </View>
      ))}
      <Pressable
        style={[styles.planBtn, { backgroundColor: isPlus ? "#fff" : C.primary }]}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); Alert.alert("Plano selecionado", `Você selecionou o plano ${isPlus ? "Plus" : "Normal"}.`); }}
      >
        <Text style={[styles.planBtnText, { color: isPlus ? C.primary : "#fff" }]}>
          {current ? "Gerenciar plano" : isPlus ? "Fazer upgrade" : "Assinar agora"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12 },
  iconBtnSm: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  switchModeBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  switchModeTxt: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  userCard: { borderRadius: 18, padding: 20, flexDirection: "row", gap: 14, alignItems: "center" },
  avatarLarge: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center" },
  userName: { color: "#fff", fontSize: 17, fontFamily: "Inter_700Bold" },
  userEmail: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  userStats: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 10 },
  userStat: { alignItems: "center" },
  userStatNum: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  userStatLabel: { color: "rgba(255,255,255,0.7)", fontSize: 10, fontFamily: "Inter_400Regular" },
  userStatDiv: { width: 1, height: 24 },
  menuItem: { flexDirection: "row", alignItems: "center", borderRadius: 14, padding: 14, borderWidth: 1, gap: 12 },
  menuIcon: { width: 34, height: 34, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  menuLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  menuSub: { fontSize: 11, fontFamily: "Inter_400Regular" },
  notLoggedIn: { alignItems: "center", paddingTop: 60, paddingHorizontal: 32, gap: 12 },
  loginIcon: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  notLoggedTitle: { fontSize: 22, fontFamily: "Inter_700Bold" },
  notLoggedSub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  googleBtn: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14, marginTop: 8 },
  googleBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  // Retailer Header
  retailerHeaderGrad: { paddingHorizontal: 16, paddingBottom: 14, flexDirection: "row", alignItems: "flex-end", gap: 10 },
  retailerHeaderLabel: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontFamily: "Inter_500Medium" },
  retailerStoreName: { color: "#fff", fontSize: 20, fontFamily: "Inter_700Bold", marginTop: 1 },
  planPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  planPillText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  activeDot: { width: 6, height: 6, borderRadius: 3 },
  activeLabel: { color: "rgba(255,255,255,0.75)", fontSize: 10, fontFamily: "Inter_400Regular" },
  switchClientBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.15)" },
  switchClientText: { color: "rgba(255,255,255,0.85)", fontSize: 12, fontFamily: "Inter_500Medium" },
  // Retailer Tabs
  retailerTabs: { flexDirection: "row", borderBottomWidth: 1 },
  retailerTab: { flex: 1, alignItems: "center", paddingVertical: 10, gap: 3, borderBottomWidth: 2, borderBottomColor: "transparent" },
  retailerTabText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  tabBadge: { position: "absolute", top: -4, right: -6, minWidth: 14, height: 14, borderRadius: 7, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  tabBadgeText: { color: "#fff", fontSize: 8, fontFamily: "Inter_700Bold" },
  // Health Card
  healthCard: { borderRadius: 14, padding: 16, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 16 },
  healthTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  healthSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  healthBarBg: { height: 6, borderRadius: 3, overflow: "hidden" },
  healthBarFill: { height: "100%", borderRadius: 3 },
  healthScoreBig: { width: 58, height: 58, borderRadius: 29, borderWidth: 3, alignItems: "center", justifyContent: "center" },
  healthScoreNum: { fontSize: 18, fontFamily: "Inter_700Bold" },
  healthScorePts: { fontSize: 9, fontFamily: "Inter_400Regular" },
  // Metrics
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metricCard: { width: "47%", borderRadius: 14, padding: 14, borderWidth: 1, gap: 6 },
  metricIconBg: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  metricValue: { fontSize: 20, fontFamily: "Inter_700Bold" },
  metricLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  trendUp: { flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: "#4CAF5018", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6 },
  trendDown: { flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: "#F4433618", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6 },
  trendText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  // Quick Actions
  sectionLabel: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1.1 },
  quickAction: { flex: 1, borderRadius: 12, padding: 12, alignItems: "center", gap: 6 },
  quickActionIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  quickActionLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  // Campaign
  campaignCard: { borderRadius: 14, padding: 16, borderWidth: 1, gap: 10 },
  campaignHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  campaignTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  activeBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  activeBadgeText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold" },
  campaignSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  progressBarBg: { height: 6, borderRadius: 3, overflow: "hidden" },
  progressBarFill: { height: "100%", borderRadius: 3 },
  campaignFooter: { flexDirection: "row", justifyContent: "space-between" },
  campaignBudget: { fontSize: 11, fontFamily: "Inter_400Regular" },
  campaignUsed: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  campStat: { flex: 1, borderRadius: 8, padding: 8, alignItems: "center", gap: 1 },
  addCampaignBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, paddingVertical: 13 },
  addCampaignText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  // Top Products
  topProductRow: { flexDirection: "row", alignItems: "center", borderRadius: 12, padding: 12, borderWidth: 1, gap: 10 },
  topProductRank: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  topProductRankText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  topProductName: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  topProductEan: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 1 },
  topProductViews: { fontSize: 15, fontFamily: "Inter_700Bold" },
  // Activity
  activityRow: { flexDirection: "row", alignItems: "center", borderRadius: 12, padding: 12, borderWidth: 1, gap: 10 },
  activityIcon: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  activityText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  activityTime: { fontSize: 10, fontFamily: "Inter_400Regular" },
  // Alerts
  alertBanner: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, padding: 12, borderWidth: 1 },
  alertBannerText: { flex: 1, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  alertCard: { flexDirection: "row", alignItems: "flex-start", borderRadius: 12, padding: 14, borderWidth: 1, gap: 10 },
  urgentDot: { width: 7, height: 7, borderRadius: 4 },
  alertProduct: { fontSize: 13, fontFamily: "Inter_700Bold" },
  alertMeta: { fontSize: 11, fontFamily: "Inter_400Regular" },
  pricePill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, alignItems: "center" },
  pricePillLabel: { fontSize: 9, fontFamily: "Inter_400Regular" },
  pricePillVal: { fontSize: 13, fontFamily: "Inter_700Bold" },
  alertBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  alertBtnText: { color: "#fff", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  // Info boxes
  infoBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: 10, padding: 11, borderWidth: 1 },
  infoBoxText: { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },
  // Products
  addProductBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, paddingVertical: 12 },
  productRow: { flexDirection: "row", alignItems: "center", borderRadius: 14, padding: 14, borderWidth: 1, gap: 10 },
  productRowInfo: { flex: 1 },
  productRowName: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  productRowEan: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 1 },
  productRowDate: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 1 },
  priceTag: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9 },
  priceTagText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  editRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  priceInput: { width: 72, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, fontSize: 13, fontFamily: "Inter_500Medium" },
  saveBtn: { width: 28, height: 28, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  // Plan
  planCard: { borderRadius: 18, padding: 20, borderWidth: 1.5, gap: 12 },
  currentBadge: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  currentBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  planName: { fontSize: 20, fontFamily: "Inter_700Bold" },
  planPrice: { fontSize: 26, fontFamily: "Inter_700Bold" },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  featureText: { fontSize: 13 },
  planBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  planBtnText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  // Report section
  plusTag: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7 },
  plusTagTxt: { fontSize: 9, fontFamily: "Inter_700Bold" },
  reportSection: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  reportSectionHeader: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  reportIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  reportSectionTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  reportSectionSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  reportCountBadge: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  reportCountVal: { fontSize: 16, fontFamily: "Inter_700Bold" },
  reportRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1 },
  reportRowIcon: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  reportRowTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  reportRowMeta: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 1 },
  reportRowPts: { fontSize: 13, fontFamily: "Inter_700Bold" },
  reportEmpty: { fontSize: 12, fontFamily: "Inter_400Regular", paddingHorizontal: 14, paddingBottom: 12, textAlign: "center" },
  summaryCard: { borderRadius: 14, borderWidth: 1, padding: 14, alignItems: "center", gap: 3 },
  summaryVal: { fontSize: 24, fontFamily: "Inter_700Bold" },
  summaryLabel: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center" },
  plusLockedCard: { borderRadius: 16, borderWidth: 1.5, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  plusLockedTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  plusLockedSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  plusUpgradeBtn: { backgroundColor: "#FFD700", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  plusUpgradeTxt: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#8B6914" },
});
