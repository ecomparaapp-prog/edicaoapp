import { Feather, MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
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
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import { useTheme } from "@/context/ThemeContext";

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const C = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { user, setUser, isLoggedIn, activeTab, setActiveTab, retailerStore, updateRetailerProduct } = useApp();
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
    if (isNaN(price) || price <= 0) {
      Alert.alert("Preço inválido");
      return;
    }
    updateRetailerProduct(ean, price);
    setEditingEan(null);
    setEditPrice("");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  if (activeTab === "retailer" && isLoggedIn) {
    return <RetailerPanel topPad={topPad} bottomPad={bottomPad} isDark={isDark} C={C} onSwitchToCustomer={() => setActiveTab("customer")} retailerStore={retailerStore} editingEan={editingEan} setEditingEan={setEditingEan} editPrice={editPrice} setEditPrice={setEditPrice} handleSavePrice={handleSavePrice} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: bottomPad }}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: C.background }]}>
          <Text style={[styles.title, { color: C.text }]}>Perfil</Text>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <Pressable
              style={[styles.iconBtnSm, { backgroundColor: C.backgroundSecondary }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggleTheme(); }}
            >
              <Feather name={isDark ? "sun" : "moon"} size={16} color={C.text} />
            </Pressable>
            {isLoggedIn && (
              <Pressable
                style={[styles.switchModeBtn, { backgroundColor: C.backgroundSecondary }]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveTab("retailer"); }}
              >
                <Feather name="store" size={14} color={C.textSecondary} />
                <Text style={[styles.switchModeTxt, { color: C.textSecondary }]}>Área Lojista</Text>
              </Pressable>
            )}
          </View>
        </View>

        {isLoggedIn ? (
          <>
            {/* User Card */}
            <View style={[styles.userCard, { backgroundColor: C.primary, marginHorizontal: 16, marginBottom: 20 }]}>
              <View style={[styles.avatarLarge, { backgroundColor: "rgba(255,255,255,0.15)" }]}>
                <Feather name="user" size={32} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.userName}>{user?.name}</Text>
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
            </View>

            {/* Menu Items */}
            <View style={{ paddingHorizontal: 16, gap: 8 }}>
              <MenuItem icon="map-pin" label="Localização" sub="São Paulo, SP" color={C} isDark={isDark} onPress={() => router.push("/settings/location")} />
              <MenuItem icon="shield" label="Privacidade" color={C} isDark={isDark} onPress={() => router.push("/settings/privacy")} />
              <MenuItem icon="bell" label="Notificações" color={C} isDark={isDark} onPress={() => router.push("/settings/notifications")} />
              <MenuItem icon="help-circle" label="Ajuda" color={C} isDark={isDark} onPress={() => router.push("/settings/help")} />
              <Pressable
                style={[styles.menuItem, { backgroundColor: C.surfaceElevated, borderColor: "#CC0000" + "40" }]}
                onPress={handleLogout}
              >
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

function MenuItem({ icon, label, sub, color: C, isDark, onPress }: any) {
  return (
    <Pressable
      style={[styles.menuItem, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress?.(); }}
    >
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

function RetailerPanel({ topPad, bottomPad, isDark, C, onSwitchToCustomer, retailerStore, editingEan, setEditingEan, editPrice, setEditPrice, handleSavePrice }: any) {
  const [section, setSection] = useState<"dashboard" | "products" | "plan">("dashboard");

  const metrics = [
    { label: "Visualizações", value: retailerStore?.totalViews?.toLocaleString("pt-BR") || "0", icon: "eye" },
    { label: "Cliques", value: retailerStore?.totalClicks?.toLocaleString("pt-BR") || "0", icon: "mouse-pointer" },
    { label: "Assinantes", value: retailerStore?.subscribers?.toLocaleString("pt-BR") || "0", icon: "users" },
    { label: "Raio atual", value: retailerStore?.plan === "plus" ? "10km" : "5km", icon: "map-pin" },
  ];

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: C.background }]}>
        <View>
          <Text style={[styles.title, { color: C.text }]}>Área Lojista</Text>
          <Text style={[styles.subtitle2, { color: C.textMuted }]}>{retailerStore?.name}</Text>
        </View>
        <Pressable style={[styles.switchModeBtn, { backgroundColor: C.backgroundSecondary }]} onPress={onSwitchToCustomer}>
          <Feather name="user" size={14} color={C.textSecondary} />
          <Text style={[styles.switchModeTxt, { color: C.textSecondary }]}>Cliente</Text>
        </Pressable>
      </View>

      {/* Section Tabs */}
      <View style={[styles.sectionTabs, { backgroundColor: C.backgroundSecondary, marginHorizontal: 16, marginBottom: 12 }]}>
        {(["dashboard", "products", "plan"] as const).map((s) => (
          <Pressable key={s} style={[styles.sectionTab, section === s && { backgroundColor: C.primary }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSection(s); }}>
            <Text style={[styles.sectionTabText, { color: section === s ? "#fff" : C.textSecondary }]}>
              {s === "dashboard" ? "Dashboard" : s === "products" ? "Produtos" : "Plano"}
            </Text>
          </Pressable>
        ))}
      </View>

      {section === "dashboard" && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPad, gap: 12 }}>
          <View style={styles.metricsGrid}>
            {metrics.map((m) => (
              <View key={m.label} style={[styles.metricCard, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
                <Feather name={m.icon as any} size={18} color={C.primary} />
                <Text style={[styles.metricValue, { color: C.text }]}>{m.value}</Text>
                <Text style={[styles.metricLabel, { color: C.textMuted }]}>{m.label}</Text>
              </View>
            ))}
          </View>
          <View style={[styles.campaignCard, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
            <View style={styles.campaignHeader}>
              <Text style={[styles.campaignTitle, { color: C.text }]}>Campanha Ativa</Text>
              <View style={[styles.activeBadge, { backgroundColor: C.success }]}>
                <Text style={styles.activeBadgeText}>Ativo</Text>
              </View>
            </View>
            <Text style={[styles.campaignSub, { color: C.textMuted }]}>Banner: Promoção Segunda e Terça</Text>
            <View style={[styles.progressBarBg, { backgroundColor: C.backgroundTertiary }]}>
              <View style={[styles.progressBarFill, { backgroundColor: C.primary, width: "65%" }]} />
            </View>
            <View style={styles.campaignFooter}>
              <Text style={[styles.campaignBudget, { color: C.textMuted }]}>Orçamento: R$ {retailerStore?.campaignBudget}</Text>
              <Text style={[styles.campaignUsed, { color: C.primary }]}>65% usado</Text>
            </View>
          </View>
          <Pressable
            style={[styles.addCampaignBtn, { backgroundColor: C.primary }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); Alert.alert("Em breve", "Criação de campanhas estará disponível em breve!"); }}
          >
            <Feather name="plus" size={16} color="#fff" />
            <Text style={styles.addCampaignText}>Nova campanha</Text>
          </Pressable>
        </ScrollView>
      )}

      {section === "products" && (
        <FlatList
          data={retailerStore?.products || []}
          keyExtractor={(item: any) => item.ean}
          contentContainerStyle={{ padding: 16, paddingBottom: bottomPad, gap: 8 }}
          scrollEnabled
          ListHeaderComponent={() => (
            <Pressable
              style={[styles.addProductBtn, { backgroundColor: C.primary, marginBottom: 8 }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/retailer-scanner"); }}
            >
              <MaterialCommunityIcons name="barcode-scan" size={16} color="#fff" />
              <Text style={styles.addCampaignText}>Cadastrar via EAN</Text>
            </Pressable>
          )}
          renderItem={({ item }: any) => (
            <View style={[styles.productRow, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
              <View style={styles.productRowInfo}>
                <Text style={[styles.productRowName, { color: C.text }]}>{item.name}</Text>
                <Text style={[styles.productRowEan, { color: C.textMuted }]}>{item.ean}</Text>
                <Text style={[styles.productRowDate, { color: C.textMuted }]}>Atualizado: {item.updatedAt}</Text>
              </View>
              {editingEan === item.ean ? (
                <View style={styles.editRow}>
                  <TextInput
                    style={[styles.priceInput, { color: C.text, backgroundColor: C.backgroundSecondary }]}
                    value={editPrice}
                    onChangeText={setEditPrice}
                    keyboardType="decimal-pad"
                    placeholder="0,00"
                    placeholderTextColor={C.textMuted}
                    autoFocus
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
                  style={[styles.priceTag, { backgroundColor: C.primary + "15" }]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setEditingEan(item.ean); setEditPrice(item.price.toFixed(2).replace(".", ",")); }}
                >
                  <Text style={[styles.priceTagText, { color: C.primary }]}>R$ {item.price.toFixed(2).replace(".", ",")}</Text>
                  <Feather name="edit-2" size={11} color={C.primary} />
                </Pressable>
              )}
            </View>
          )}
        />
      )}

      {section === "plan" && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPad, gap: 12 }}>
          <PlanCard isDark={isDark} C={C} plan="normal" current={retailerStore?.plan === "normal"} />
          <PlanCard isDark={isDark} C={C} plan="plus" current={retailerStore?.plan === "plus"} />
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
          <Text style={[styles.currentBadgeText, { color: isPlus ? C.primary : "#fff" }]}>PLANO ATUAL</Text>
        </View>
      )}
      <Text style={[styles.planName, { color: isPlus ? "#fff" : C.text }]}>
        eCompara {isPlus ? "Plus" : "Normal"}
      </Text>
      <Text style={[styles.planPrice, { color: isPlus ? "#fff" : C.text }]}>
        {isPlus ? "R$ 89,90" : "R$ 49,90"}<Text style={{ fontSize: 13 }}>/mês</Text>
      </Text>
      {[
        `Visibilidade: ${isPlus ? "até 10km" : "até 5km"}`,
        "Cadastro de produtos por EAN",
        "Importação via PDV",
        isPlus ? "Campanhas ilimitadas" : "1 campanha ativa",
        isPlus ? "Dashboard completo" : "Relatório básico",
        isPlus ? "Suporte prioritário" : "Suporte padrão",
      ].map((feature, i) => (
        <View key={i} style={styles.featureRow}>
          <Feather name="check" size={14} color={isPlus ? "#fff" : C.success} />
          <Text style={[styles.featureText, { color: isPlus ? "rgba(255,255,255,0.9)" : C.textSecondary }]}>{feature}</Text>
        </View>
      ))}
      <Pressable
        style={[styles.planBtn, { backgroundColor: isPlus ? "#fff" : C.primary }]}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); Alert.alert("Plano selecionado", `Você selecionou o plano ${isPlus ? "Plus" : "Normal"}.`); }}
      >
        <Text style={[styles.planBtnText, { color: isPlus ? C.primary : "#fff" }]}>
          {current ? "Plano atual" : "Assinar agora"}
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
  subtitle2: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  switchModeBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  switchModeTxt: { fontSize: 12, fontFamily: "Inter_500Medium" },
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
  sectionTabs: { flexDirection: "row", borderRadius: 12, padding: 4 },
  sectionTab: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 9 },
  sectionTabText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metricCard: { width: "47%", borderRadius: 14, padding: 14, alignItems: "center", borderWidth: 1, gap: 6 },
  metricValue: { fontSize: 20, fontFamily: "Inter_700Bold" },
  metricLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  campaignCard: { borderRadius: 14, padding: 16, borderWidth: 1, gap: 10 },
  campaignHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  campaignTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  activeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  activeBadgeText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold" },
  campaignSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  progressBarBg: { height: 6, borderRadius: 3, overflow: "hidden" },
  progressBarFill: { height: "100%", borderRadius: 3 },
  campaignFooter: { flexDirection: "row", justifyContent: "space-between" },
  campaignBudget: { fontSize: 11, fontFamily: "Inter_400Regular" },
  campaignUsed: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  addCampaignBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, paddingVertical: 14 },
  addCampaignText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  addProductBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, paddingVertical: 12 },
  productRow: { flexDirection: "row", alignItems: "center", borderRadius: 14, padding: 14, borderWidth: 1, gap: 10 },
  productRowInfo: { flex: 1 },
  productRowName: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  productRowEan: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 1 },
  productRowDate: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 1 },
  priceTag: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9 },
  priceTagText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  editRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  priceInput: { width: 70, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, fontSize: 13, fontFamily: "Inter_500Medium" },
  saveBtn: { width: 28, height: 28, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  planCard: { borderRadius: 18, padding: 20, borderWidth: 1.5, gap: 12 },
  currentBadge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  currentBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  planName: { fontSize: 20, fontFamily: "Inter_700Bold" },
  planPrice: { fontSize: 26, fontFamily: "Inter_700Bold" },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  featureText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  planBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  planBtnText: { fontSize: 15, fontFamily: "Inter_700Bold" },
});
