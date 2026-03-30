import { Feather, MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState, useEffect, useCallback } from "react";
import * as ExpoClipboard from "expo-clipboard";
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
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
import { useApp, type User } from "@/context/AppContext";
import { useTheme } from "@/context/ThemeContext";

const MOCK_ALERTS = [
  { id: "a1", type: "price_report", product: "Leite Parmalat 1L", reported: "R$ 4,89", current: "R$ 5,49", reporter: "Ana S.", time: "Há 12 min", urgent: true },
  { id: "a2", type: "price_report", product: "Arroz Tio João 5kg", reported: "R$ 21,90", current: "R$ 24,90", reporter: "Carlos R.", time: "Há 38 min", urgent: true },
  { id: "a3", type: "verification", product: "Coca-Cola 2L", reported: "R$ 8,49", current: "R$ 9,99", reporter: "Pedro L.", time: "Há 1h", urgent: false },
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
  const [referralData, setReferralData] = useState<{
    referralCode: string | null;
    referralCount: number;
    maxReferrals: number;
    canEarnMore: boolean;
    referralLink: string | null;
    pointsPerReferral: number;
  } | null>(null);
  const [referralLoading, setReferralLoading] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);

  const loadReferralData = useCallback(async () => {
    if (!user?.id) return;
    setReferralLoading(true);
    try {
      const apiBase = process.env.EXPO_PUBLIC_API_URL || "https://ecompara.com.br/api";
      const res = await fetch(`${apiBase}/referral/code/${encodeURIComponent(user.id)}`);
      if (res.ok) {
        const data = await res.json();
        setReferralData(data);
      }
    } catch {
      // offline — use optimistic mock
      setReferralData({
        referralCode: null,
        referralCount: 0,
        maxReferrals: 5,
        canEarnMore: true,
        referralLink: null,
        pointsPerReferral: 2000,
      });
    } finally {
      setReferralLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (isLoggedIn) loadReferralData();
  }, [isLoggedIn, loadReferralData]);

  useEffect(() => {
    if (!isLoggedIn) {
      router.push("/(auth)/login");
    }
  }, [isLoggedIn]);

  const handleShareReferral = async () => {
    const link = referralData?.referralLink ?? `https://ecompara.com.br/invite/${referralData?.referralCode ?? ""}`;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await Share.share({
        message: `🛒 Economize nas compras de supermercado com o eCompara!\nBaixe agora e ganhe pontos na Arena: ${link}`,
        url: link,
        title: "eCompara — Indique e Ganhe",
      });
    } catch {}
  };

  const handleCopyCode = () => {
    const code = referralData?.referralCode;
    if (!code) return;
    ExpoClipboard.setStringAsync(code);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 84 : 90;

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

  if (activeTab === "retailer" && isLoggedIn && user?.role === "retailer") {
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
            {isLoggedIn && user?.role === "retailer" && (
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

            {/* Indique e Ganhe Card */}
            <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
              <LinearGradient
                colors={["#1B5E20", "#2E7D32", "#388E3C"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.referralCard}
              >
                <View style={styles.referralCardHeader}>
                  <View style={styles.referralCardIconWrap}>
                    <MaterialCommunityIcons name="account-multiple-plus" size={22} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.referralCardTitle}>Indique e Ganhe</Text>
                    <Text style={styles.referralCardSub}>
                      Ganhe {(referralData?.pointsPerReferral ?? 2000).toLocaleString("pt-BR")} XP por cada amigo que baixar o app
                    </Text>
                  </View>
                  <View style={styles.referralLimitBadge}>
                    <Text style={styles.referralLimitText}>
                      {referralData?.referralCount ?? 0}/{referralData?.maxReferrals ?? 5}
                    </Text>
                  </View>
                </View>

                {/* Progress bar */}
                <View style={styles.referralProgressBg}>
                  <View
                    style={[
                      styles.referralProgressFill,
                      {
                        width: `${Math.min(
                          ((referralData?.referralCount ?? 0) / (referralData?.maxReferrals ?? 5)) * 100,
                          100
                        )}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.referralProgressLabel}>
                  {referralData?.canEarnMore !== false
                    ? `Faltam ${(referralData?.maxReferrals ?? 5) - (referralData?.referralCount ?? 0)} indicações para o limite`
                    : "Parabéns! Você atingiu o limite de recompensas"}
                </Text>

                {/* Code box */}
                {referralData?.referralCode ? (
                  <Pressable style={styles.referralCodeBox} onPress={handleCopyCode}>
                    <View>
                      <Text style={styles.referralCodeLabel}>Seu código</Text>
                      <Text style={styles.referralCodeText}>{referralData.referralCode}</Text>
                    </View>
                    <View style={[styles.referralCopyBtn, copyFeedback && { backgroundColor: "rgba(255,255,255,0.3)" }]}>
                      <Feather name={copyFeedback ? "check" : "copy"} size={14} color="#fff" />
                      <Text style={styles.referralCopyTxt}>{copyFeedback ? "Copiado!" : "Copiar"}</Text>
                    </View>
                  </Pressable>
                ) : (
                  <View style={[styles.referralCodeBox, { justifyContent: "center" }]}>
                    <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, fontFamily: "Inter_400Regular" }}>
                      {referralLoading ? "Gerando seu código…" : "Código indisponível offline"}
                    </Text>
                  </View>
                )}

                {/* Share button */}
                <Pressable
                  style={[styles.referralShareBtn, !referralData?.referralCode && { opacity: 0.5 }]}
                  onPress={handleShareReferral}
                  disabled={!referralData?.referralCode}
                >
                  <Feather name="share-2" size={16} color="#2E7D32" />
                  <Text style={styles.referralShareTxt}>Compartilhar link de indicação</Text>
                </Pressable>

                {/* Earned points display */}
                {(referralData?.referralCount ?? 0) > 0 && (
                  <View style={styles.referralEarned}>
                    <MaterialCommunityIcons name="star-circle" size={16} color="#FFD54F" />
                    <Text style={styles.referralEarnedTxt}>
                      +{((referralData?.referralCount ?? 0) * (referralData?.pointsPerReferral ?? 2000)).toLocaleString("pt-BR")} XP já ganhos
                    </Text>
                  </View>
                )}
              </LinearGradient>
            </View>

            {/* Configurações */}
            <View style={{ paddingHorizontal: 16, gap: 8 }}>
              <MenuItem icon="map-pin" label="Localização" sub="Santa Maria, DF" color={C} onPress={() => router.push("/settings/location")} />
              <MenuItem icon="shield" label="Privacidade" color={C} onPress={() => router.push("/settings/privacy")} />
              <MenuItem icon="bell" label="Notificações" color={C} onPress={() => router.push("/settings/notifications")} />
              <MenuItem icon="help-circle" label="Ajuda" color={C} onPress={() => router.push("/settings/help")} />
            </View>

            {/* Para Empresas & Marcas */}
            <View style={{ paddingHorizontal: 16, marginTop: 24, marginBottom: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
                <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color: C.textMuted, letterSpacing: 1.2 }}>
                  PARA EMPRESAS & MARCAS
                </Text>
                <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
              </View>
              <Pressable
                style={[styles.brandsCard, { backgroundColor: isDark ? "#080820" : "#F0F4FF", borderColor: "#3B4FCC28" }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push("/advertiser-register");
                }}
              >
                <View style={[styles.brandsIconWrap, { backgroundColor: "#3B4FCC15" }]}>
                  <MaterialCommunityIcons name="bullhorn-outline" size={26} color="#3B4FCC" />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={[styles.brandsTitle, { color: C.text }]}>Anuncie no eCompara</Text>
                  <Text style={[styles.brandsSub, { color: C.textMuted }]}>
                    Destaque sua marca para milhares de consumidores. Parmalat, Trident, Piracanjuba e outras já anunciam.
                  </Text>
                </View>
                <View style={styles.brandsArrow}>
                  <Feather name="arrow-right" size={14} color="#fff" />
                </View>
              </Pressable>
              <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: C.textMuted, textAlign: "center", marginTop: 8 }}>
                Área exclusiva para indústrias e marcas parceiras
              </Text>
            </View>

            {/* Sair */}
            <View style={{ paddingHorizontal: 16, marginTop: 8, gap: 8 }}>
              <Pressable style={[styles.menuItem, { backgroundColor: C.surfaceElevated, borderColor: "#CC0000" + "40" }]} onPress={handleLogout}>
                <View style={[styles.menuIcon, { backgroundColor: "#CC000020" }]}>
                  <Feather name="log-out" size={16} color="#CC0000" />
                </View>
                <Text style={[styles.menuLabel, { color: "#CC0000" }]}>Sair</Text>
                <Feather name="chevron-right" size={16} color="#CC0000" />
              </Pressable>
            </View>
          </>
        ) : null}
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

const WEEKLY_DATA = [
  { day: "Seg", views: 5200, cliques: 320 },
  { day: "Ter", views: 7800, cliques: 480 },
  { day: "Qua", views: 6100, cliques: 390 },
  { day: "Qui", views: 8900, cliques: 560 },
  { day: "Sex", views: 11200, cliques: 720 },
  { day: "Sáb", views: 9800, cliques: 630 },
  { day: "Dom", views: 7400, cliques: 480 },
];

function WeeklyChart({ C }: { C: any }) {
  const maxViews = Math.max(...WEEKLY_DATA.map((d) => d.views));
  const maxCliques = Math.max(...WEEKLY_DATA.map((d) => d.cliques));
  const BAR_H = 80;
  const today = new Date().getDay();
  const todayIdx = today === 0 ? 6 : today - 1;
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", height: BAR_H + 24 }}>
        {WEEKLY_DATA.map((d, i) => {
          const vH = Math.round((d.views / maxViews) * BAR_H);
          const cH = Math.round((d.cliques / maxCliques) * BAR_H);
          const isToday = i === todayIdx;
          return (
            <View key={d.day} style={{ alignItems: "center", flex: 1, justifyContent: "flex-end", gap: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 2 }}>
                <View style={{ width: 8, height: vH, borderRadius: 4, backgroundColor: isToday ? "#CC0000" : "#CC000055", minHeight: 4 }} />
                <View style={{ width: 6, height: cH, borderRadius: 3, backgroundColor: isToday ? "#2196F3" : "#2196F355", minHeight: 3 }} />
              </View>
              <Text style={{ fontSize: 9, color: isToday ? C.text : C.textMuted, fontFamily: "Inter_600SemiBold" }}>{d.day.slice(0, 3)}</Text>
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", gap: 14, marginTop: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: "#CC0000" }} />
          <Text style={{ fontSize: 10, color: C.textMuted, fontFamily: "Inter_400Regular" }}>Visualizações</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: "#2196F3" }} />
          <Text style={{ fontSize: 10, color: C.textMuted, fontFamily: "Inter_400Regular" }}>Cliques</Text>
        </View>
      </View>
    </View>
  );
}

function RetailerPanel({ topPad, bottomPad, isDark, C, onSwitchToCustomer, retailerStore, editingEan, setEditingEan, editPrice, setEditPrice, handleSavePrice, finalizedLists, processedNFCe }: any) {
  const [section, setSection] = useState<"dashboard" | "alertas" | "products" | "plan">("dashboard");
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [campaignBudget, setCampaignBudget] = useState("500");
  const [campaignType, setCampaignType] = useState<"banner" | "oferta" | "destaque">("banner");
  const urgentCount = MOCK_ALERTS.filter((a) => a.urgent).length;

  const handleShare = async () => {
    try {
      await Share.share({
        title: `${retailerStore?.name || "Minha Loja"} no eCompara`,
        message: `Confira os melhores preços em ${retailerStore?.name || "Minha Loja"}! Encontre e compare preços no app eCompara. 🛒 https://ecompara.app/store/${retailerStore?.id || "demo"}`,
      });
    } catch {}
  };

  const handleCreateCampaign = () => {
    if (!campaignName.trim()) { Alert.alert("Campo obrigatório", "Informe o nome da campanha."); return; }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowCampaignModal(false);
    setCampaignName("");
    setCampaignBudget("500");
    setCampaignType("banner");
    Alert.alert("Campanha criada!", `"${campaignName}" foi criada com orçamento de R$ ${campaignBudget}.\nSua campanha entrará em revisão e será ativada em até 24h.`);
  };

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

      {/* Campaign Creation Modal */}
      <Modal visible={showCampaignModal} transparent animationType="slide" onRequestClose={() => setShowCampaignModal(false)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }} onPress={() => setShowCampaignModal(false)} />
        <View style={{ backgroundColor: C.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36, gap: 14, position: "absolute", bottom: 0, left: 0, right: 0 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: "center", marginBottom: 4 }} />
          <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: C.text }}>Nova Campanha</Text>

          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: C.textMuted }}>NOME DA CAMPANHA</Text>
            <TextInput
              value={campaignName}
              onChangeText={setCampaignName}
              placeholder="Ex: Promoção do fim de semana"
              placeholderTextColor={C.textMuted}
              style={{ backgroundColor: C.surfaceElevated, borderRadius: 12, padding: 14, color: C.text, fontFamily: "Inter_400Regular", fontSize: 14, borderWidth: 1, borderColor: C.border }}
            />
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: C.textMuted }}>TIPO DE CAMPANHA</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {(["banner", "oferta", "destaque"] as const).map((t) => (
                <Pressable key={t} onPress={() => setCampaignType(t)} style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", backgroundColor: campaignType === t ? C.primary : C.surfaceElevated, borderWidth: 1, borderColor: campaignType === t ? C.primary : C.border }}>
                  <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: campaignType === t ? "#fff" : C.textMuted, textTransform: "capitalize" }}>{t}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: C.textMuted }}>ORÇAMENTO (R$)</Text>
            <TextInput
              value={campaignBudget}
              onChangeText={setCampaignBudget}
              keyboardType="numeric"
              placeholder="500"
              placeholderTextColor={C.textMuted}
              style={{ backgroundColor: C.surfaceElevated, borderRadius: 12, padding: 14, color: C.text, fontFamily: "Inter_400Regular", fontSize: 14, borderWidth: 1, borderColor: C.border }}
            />
          </View>

          <Pressable onPress={handleCreateCampaign} style={{ backgroundColor: C.primary, borderRadius: 14, padding: 16, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8, marginTop: 4 }}>
            <Feather name="zap" size={16} color="#fff" />
            <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 }}>Criar Campanha</Text>
          </Pressable>
        </View>
      </Modal>

      {/* DASHBOARD */}
      {section === "dashboard" && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPad, gap: 16 }}>

          {/* Health Score Card */}
          <LinearGradient colors={["#1a1a2e", "#16213e"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 18, padding: 16, flexDirection: "row", alignItems: "center" }}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.6)", letterSpacing: 0.8 }}>SAÚDE DA LOJA</Text>
              <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)" }}>Preços, avaliações e atividade</Text>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.15)", marginTop: 6 }}>
                <View style={{ height: 6, borderRadius: 3, width: `${healthScore}%`, backgroundColor: healthScore >= 70 ? "#4CAF50" : "#FFC107" }} />
              </View>
              <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: healthScore >= 70 ? "#4CAF50" : "#FFC107" }}>{healthScore}/100 · {healthScore >= 70 ? "Bom" : "Regular"}</Text>
            </View>
            <View style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 3, borderColor: healthScore >= 70 ? "#4CAF50" : "#FFC107", alignItems: "center", justifyContent: "center", marginLeft: 14 }}>
              <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: "#fff" }}>{healthScore}</Text>
              <Text style={{ fontSize: 9, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.6)" }}>pts</Text>
            </View>
          </LinearGradient>

          {/* KPI Strip */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            {metrics.map((m) => (
              <View key={m.label} style={{ flex: 1, backgroundColor: C.surfaceElevated, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: C.border, alignItems: "center", gap: 4 }}>
                <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: m.color + "18", alignItems: "center", justifyContent: "center" }}>
                  <Feather name={m.icon as any} size={13} color={m.color} />
                </View>
                <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: C.text }}>{m.value}</Text>
                <Text style={{ fontSize: 9, fontFamily: "Inter_400Regular", color: C.textMuted, textAlign: "center" }}>{m.label}</Text>
                {m.trend === "up" && <Text style={{ fontSize: 9, fontFamily: "Inter_600SemiBold", color: "#4CAF50" }}>{m.prev}</Text>}
                {m.trend === "flat" && <Text style={{ fontSize: 9, fontFamily: "Inter_400Regular", color: C.textMuted }}>{m.prev}</Text>}
              </View>
            ))}
          </View>

          {/* Weekly Chart */}
          <View style={{ backgroundColor: C.surfaceElevated, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: C.border, gap: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: C.text }}>Tráfego Semanal</Text>
              <View style={{ backgroundColor: C.backgroundTertiary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: C.textMuted }}>Esta semana</Text>
              </View>
            </View>
            <WeeklyChart C={C} />
          </View>

          {/* Quick Actions */}
          <View style={{ gap: 10 }}>
            <Text style={[styles.sectionLabel, { color: C.textMuted }]}>AÇÕES RÁPIDAS</Text>
            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowCampaignModal(true); }}
              style={{ backgroundColor: C.primary, borderRadius: 14, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" }}>
                <Feather name="zap" size={18} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff" }}>Nova Campanha</Text>
                <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)" }}>Crie banners e ofertas patrocinadas</Text>
              </View>
              <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.7)" />
            </Pressable>

            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/retailer-scanner"); }}
                style={{ flex: 1, backgroundColor: C.surfaceElevated, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: "#2196F330" }}
              >
                <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: "#2196F318", alignItems: "center", justifyContent: "center" }}>
                  <Feather name="package" size={16} color="#2196F3" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.text }}>Cadastrar Produto</Text>
                  <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: C.textMuted }}>Scan de código de barras</Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); handleShare(); }}
                style={{ flex: 1, backgroundColor: C.surfaceElevated, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: "#9C27B030" }}
              >
                <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: "#9C27B018", alignItems: "center", justifyContent: "center" }}>
                  <Feather name="share-2" size={16} color="#9C27B0" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.text }}>Compartilhar</Text>
                  <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: C.textMuted }}>Divulgue sua loja</Text>
                </View>
              </Pressable>
            </View>
          </View>

          {/* Active Campaign */}
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={[styles.sectionLabel, { color: C.textMuted }]}>CAMPANHA ATIVA</Text>
              <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowCampaignModal(true); }} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Feather name="plus" size={12} color={C.primary} />
                <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: C.primary }}>Nova</Text>
              </Pressable>
            </View>
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
  brandsCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 16, borderWidth: 1.5 },
  brandsIconWrap: { width: 46, height: 46, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  brandsTitle: { fontSize: 14, fontFamily: "Inter_700Bold", marginBottom: 2 },
  brandsSub: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  brandsArrow: { width: 30, height: 30, borderRadius: 9, backgroundColor: "#3B4FCC", alignItems: "center", justifyContent: "center" },
  menuSub: { fontSize: 11, fontFamily: "Inter_400Regular" },
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

  referralCard: { borderRadius: 20, padding: 18, gap: 12 },
  referralCardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  referralCardIconWrap: {
    width: 42, height: 42, borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center",
  },
  referralCardTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  referralCardSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)", marginTop: 2 },
  referralLimitBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5,
  },
  referralLimitText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#fff" },
  referralProgressBg: {
    height: 6, borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.2)",
    overflow: "hidden",
  },
  referralProgressFill: {
    height: 6, borderRadius: 3,
    backgroundColor: "#A5D6A7",
  },
  referralProgressLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)" },
  referralCodeBox: {
    backgroundColor: "rgba(0,0,0,0.25)",
    borderRadius: 12, padding: 14,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  referralCodeLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.6)", marginBottom: 2 },
  referralCodeText: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: 2 },
  referralCopyBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 9, paddingHorizontal: 12, paddingVertical: 8,
  },
  referralCopyTxt: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#fff" },
  referralShareBtn: {
    backgroundColor: "#fff",
    borderRadius: 12, padding: 14,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  referralShareTxt: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#2E7D32" },
  referralEarned: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(255,213,79,0.15)",
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
    alignSelf: "flex-start",
  },
  referralEarnedTxt: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#FFD54F" },
});
