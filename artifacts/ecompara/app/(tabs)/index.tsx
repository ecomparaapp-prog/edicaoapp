import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { useApp, type Store } from "@/context/AppContext";
import { useTheme } from "@/context/ThemeContext";
import type { ClaimRequest } from "@/services/storesService";
import { fetchNearbyMissions, type NearbyMission } from "@/services/missionService";
import HomeAdBanner from "@/components/HomeAdBanner";

const FALLBACK_LAT = -15.8634;
const FALLBACK_LNG = -47.9968;

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const C = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { user, isLoggedIn, stores, storesLoading, loadNearbyStores, submitStoreClaim } = useApp();
  const { toggleTheme } = useTheme();
  const [activeBanner, setActiveBanner] = useState(0);

  const [claimStore, setClaimStore] = useState<Store | null>(null);
  const [claimName, setClaimName] = useState("");
  const [claimEmail, setClaimEmail] = useState("");
  const [claimMsg, setClaimMsg] = useState("");
  const [claimSending, setClaimSending] = useState(false);

  const [missions, setMissions] = useState<NearbyMission[]>([]);
  const [missionsLoading, setMissionsLoading] = useState(false);
  const missionPlaceIdSet = React.useMemo(
    () => new Set(missions.map((m) => m.googlePlaceId)),
    [missions],
  );

  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 84 : (insets.bottom ? insets.bottom + 60 : 80);

  useEffect(() => {
    async function loadWithLocation() {
      let lat = FALLBACK_LAT;
      let lng = FALLBACK_LNG;

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        }
      } catch {
        // sem permissão ou erro: usa fallback silenciosamente
      }

      loadNearbyStores(lat, lng, 50);
      setMissionsLoading(true);
      fetchNearbyMissions(lat, lng, 2)
        .then(setMissions)
        .finally(() => setMissionsLoading(false));
    }

    loadWithLocation();
  }, []);

  const handleClaim = async () => {
    if (!claimStore) return;
    if (!claimName.trim() || !claimEmail.trim()) {
      Alert.alert("Atenção", "Preencha nome e e-mail para continuar.");
      return;
    }
    setClaimSending(true);
    const claim: ClaimRequest = {
      googlePlaceId: claimStore.googlePlaceId ?? claimStore.id,
      placeName: claimStore.name,
      requesterName: claimName.trim(),
      requesterEmail: claimEmail.trim(),
      message: claimMsg.trim(),
    };
    const result = await submitStoreClaim(claim);
    setClaimSending(false);
    if (result.ok) {
      setClaimStore(null);
      setClaimName(""); setClaimEmail(""); setClaimMsg("");
      Alert.alert("Pedido enviado!", "Entraremos em contato em breve.");
    } else {
      Alert.alert("Erro", result.error ?? "Não foi possível enviar o pedido.");
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: C.background }]}>
          <View style={styles.logoBlock}>
            <Image
              source={
                isDark
                  ? require("@/assets/images/logo-light.png")
                  : require("@/assets/images/logo-dark.png")
              }
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <View style={styles.headerActions}>
            <Pressable
              style={[styles.iconBtn, { backgroundColor: C.backgroundSecondary }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                toggleTheme();
              }}
            >
              <Feather name={isDark ? "sun" : "moon"} size={18} color={C.text} />
            </Pressable>
            {!isLoggedIn ? (
              <Pressable
                style={[styles.loginBtn, { backgroundColor: C.primary }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push("/(auth)/login");
                }}
              >
                <Text style={styles.loginBtnText}>Entrar</Text>
              </Pressable>
            ) : (
              <Pressable
                style={[styles.avatarBtn, { backgroundColor: C.backgroundTertiary }]}
                onPress={() => router.push("/(tabs)/profile")}
              >
                <Feather name="user" size={20} color={C.text} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Centered greeting */}
        {isLoggedIn && (
          <Text style={[styles.greeting, { color: C.textSecondary }]}>
            Olá, {user?.name.split(" ")[0]}
          </Text>
        )}

        {/* Search Bar */}
        <Pressable
          style={[styles.searchBar, { backgroundColor: C.backgroundSecondary, marginTop: 14, marginHorizontal: 16 }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/(tabs)/search");
          }}
        >
          <Feather name="search" size={18} color={C.textMuted} />
          <Text style={[styles.searchPlaceholder, { color: C.textMuted }]}>
            Buscar produtos, mercados...
          </Text>
          <Pressable
            style={[styles.barcodeBtn, { backgroundColor: C.primary }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/scanner");
            }}
          >
            <MaterialCommunityIcons name="barcode-scan" size={18} color="#fff" />
          </Pressable>
        </Pressable>

        {/* Ad Banners */}
        <HomeAdBanner
          isDark={isDark}
          activeBanner={activeBanner}
          setActiveBanner={setActiveBanner}
        />

        {/* Missões Relâmpago */}
        {(missionsLoading || missions.length > 0) && (
          <View style={{ marginTop: 24 }}>
            <View style={[styles.sectionHeader, { paddingHorizontal: 16 }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={[styles.missionBolt, { backgroundColor: "#CC0000" }]}>
                  <Ionicons name="flash" size={13} color="#fff" />
                </View>
                <Text style={[styles.sectionTitle, { color: C.text }]}>Missões Relâmpago</Text>
              </View>
              {missionsLoading && <ActivityIndicator size="small" color={C.primary} />}
            </View>
            <FlatList
              data={missions}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(m) => m.googlePlaceId}
              contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, gap: 12 }}
              renderItem={({ item: m }) => (
                <Pressable
                  style={[styles.missionCard, {
                    backgroundColor: C.surfaceElevated,
                    borderColor: m.disputedCount > 0 ? "#CC000060" : "#FF980060",
                  }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    router.push({
                      pathname: "/missions/[placeId]",
                      params: {
                        placeId: m.googlePlaceId,
                        placeName: m.name,
                        xpMultiplier: String(m.xpMultiplier),
                      },
                    });
                  }}
                >
                  <View style={styles.missionCardTop}>
                    <View style={[styles.missionXpBadge, { backgroundColor: m.disputedCount > 0 ? "#CC0000" : "#FF9800" }]}>
                      <Ionicons name="flash" size={10} color="#fff" />
                      <Text style={styles.missionXpText}>x{m.xpMultiplier} XP</Text>
                    </View>
                    <Text style={[styles.missionDist, { color: C.textMuted }]}>
                      {m.distanceM < 1000 ? `${m.distanceM}m` : `${(m.distanceM / 1000).toFixed(1)}km`}
                    </Text>
                  </View>
                  <Text style={[styles.missionStoreName, { color: C.text }]} numberOfLines={2}>
                    {m.name}
                  </Text>
                  <Text style={[styles.missionAddress, { color: C.textMuted }]} numberOfLines={1}>
                    {m.address ?? ""}
                  </Text>
                  <View style={styles.missionStats}>
                    {m.staleCount > 0 && (
                      <View style={[styles.missionStat, { backgroundColor: "#FF980015" }]}>
                        <Feather name="clock" size={10} color="#FF9800" />
                        <Text style={[styles.missionStatText, { color: "#FF9800" }]}>
                          {m.staleCount} {m.staleCount === 1 ? "desatualizado" : "desatualizados"}
                        </Text>
                      </View>
                    )}
                    {m.disputedCount > 0 && (
                      <View style={[styles.missionStat, { backgroundColor: "#CC000015" }]}>
                        <Feather name="alert-triangle" size={10} color="#CC0000" />
                        <Text style={[styles.missionStatText, { color: "#CC0000" }]}>
                          {m.disputedCount} {m.disputedCount === 1 ? "contestado" : "contestados"}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={[styles.missionAction, { backgroundColor: C.primary }]}>
                    <Text style={styles.missionActionText}>Iniciar Missão</Text>
                    <Feather name="arrow-right" size={12} color="#fff" />
                  </View>
                </Pressable>
              )}
            />
          </View>
        )}

        {/* Supermercados Próximos */}
        <View style={{ marginTop: 24, paddingHorizontal: 16 }}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: C.text }]}>Supermercados</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              {storesLoading && <ActivityIndicator size="small" color={C.primary} />}
              <View style={[styles.radiusBadge, { backgroundColor: C.backgroundSecondary }]}>
                <Feather name="map-pin" size={11} color={C.primary} />
                <Text style={[styles.radiusText, { color: C.primary }]}>50km</Text>
              </View>
            </View>
          </View>
        </View>

        <FlatList
          data={stores}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12 }}
          ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
          renderItem={({ item }) => {
            const isShadow = item.isShadow === true;
            const isVerified = item.status === "verified";
            const hasMission = missionPlaceIdSet.has(item.googlePlaceId ?? item.id);
            const mission = hasMission ? missions.find((m) => m.googlePlaceId === (item.googlePlaceId ?? item.id)) : null;
            return (
              <Pressable
                style={[
                  styles.storeCard,
                  { backgroundColor: C.surfaceElevated, borderColor: C.border },
                  isVerified && { borderColor: C.primary, borderWidth: 1.5 },
                  hasMission && !isVerified && { borderColor: "#CC000050", borderWidth: 1.5 },
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push({
                    pathname: "/store/[id]",
                    params: {
                      id: item.googlePlaceId ?? item.id,
                      name: item.name,
                      address: item.address ?? "",
                      lat: String(item.lat ?? ""),
                      lng: String(item.lng ?? ""),
                      distance: String(item.distance ?? ""),
                      rating: String(item.rating ?? ""),
                      photoUrl: item.photoUrl ?? "",
                      status: item.status ?? "shadow",
                      phone: item.phone ?? "",
                      website: item.website ?? "",
                    },
                  });
                }}
              >
                {isShadow && (
                  <View style={styles.shadowOverlay} pointerEvents="none" />
                )}

                {/* Mission coral ! badge */}
                {hasMission && (
                  <Pressable
                    style={styles.missionCoralbadge}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      router.push({
                        pathname: "/missions/[placeId]",
                        params: {
                          placeId: item.googlePlaceId ?? item.id,
                          placeName: item.name,
                          xpMultiplier: String(mission?.xpMultiplier ?? 2),
                        },
                      });
                    }}
                  >
                    <Text style={styles.missionCoralText}>!</Text>
                  </Pressable>
                )}

                <View
                  style={[
                    styles.storeLogoCircle,
                    { backgroundColor: isDark ? C.backgroundTertiary : "#F0F0F0" },
                  ]}
                >
                  {item.photoUrl ? (
                    <Image
                      source={{ uri: item.photoUrl }}
                      style={{ width: 48, height: 48, borderRadius: 24 }}
                      resizeMode="cover"
                    />
                  ) : (
                    <Feather name="shopping-bag" size={22} color={isShadow ? C.textMuted : C.primary} />
                  )}
                </View>

                <Text style={[styles.storeName, { color: isShadow ? C.textMuted : C.text }]} numberOfLines={2}>
                  {item.name}
                </Text>

                <View style={styles.storeDistRow}>
                  <Feather name="map-pin" size={10} color={C.textMuted} />
                  <Text style={[styles.storeDist, { color: C.textMuted }]}>
                    {item.distance}km
                  </Text>
                </View>

                {item.rating != null && (
                  <View style={styles.storeDistRow}>
                    <Ionicons name="star" size={10} color={isShadow ? "#999" : "#F9A825"} />
                    <Text style={[styles.storeDist, { color: C.textMuted }]}>
                      {item.rating.toFixed(1)}
                    </Text>
                  </View>
                )}

                {isVerified && (
                  <>
                    <View style={[styles.verifiedBadge, { backgroundColor: "#E8F5E9" }]}>
                      <Feather name="check-circle" size={9} color="#2E7D32" />
                      <Text style={styles.verifiedBadgeText}>Verificado</Text>
                    </View>
                    {item.phone && (
                      <Pressable
                        style={styles.storeDistRow}
                        onPress={() => Linking.openURL(`tel:${item.phone}`)}
                        hitSlop={4}
                      >
                        <Feather name="phone" size={9} color={C.primary} />
                        <Text style={[styles.storeMetaLink, { color: C.primary }]} numberOfLines={1}>
                          {item.phone}
                        </Text>
                      </Pressable>
                    )}
                    {item.website && (
                      <Pressable
                        style={styles.storeDistRow}
                        onPress={() => Linking.openURL(item.website!)}
                        hitSlop={4}
                      >
                        <Feather name="globe" size={9} color={C.primary} />
                        <Text style={[styles.storeMetaLink, { color: C.primary }]} numberOfLines={1}>
                          Site
                        </Text>
                      </Pressable>
                    )}
                  </>
                )}

                {!isShadow && item.plan === "plus" && !isVerified && (
                  <View style={[styles.planBadge, { backgroundColor: C.primary }]}>
                    <Text style={styles.planBadgeText}>PLUS</Text>
                  </View>
                )}

                {isShadow && (
                  <Pressable
                    style={[styles.claimBtn, { backgroundColor: "#CC0000" }]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      router.push({
                        pathname: "/merchant-register",
                        params: {
                          googlePlaceId: item.googlePlaceId ?? item.id,
                          placeName: item.name,
                          placeLat: String(item.lat ?? ""),
                          placeLng: String(item.lng ?? ""),
                        },
                      });
                    }}
                  >
                    <Text style={styles.claimBtnText}>Este é meu negócio</Text>
                  </Pressable>
                )}
              </Pressable>
            );
          }}
        />

        {/* Para Lojistas Banner */}
        <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
          <Pressable
            style={[styles.retailerBanner, { backgroundColor: isDark ? "#1A0000" : "#FFF5F5", borderColor: "#CC000030" }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push("/merchant-register");
            }}
          >
            <View style={[styles.retailerBannerIcon, { backgroundColor: "#CC000015" }]}>
              <Feather name="briefcase" size={22} color="#CC0000" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.retailerBannerTitle, { color: C.text }]}>
                Você é dono de uma loja?
              </Text>
              <Text style={[styles.retailerBannerSub, { color: C.textMuted }]}>
                Cadastre seu negócio e apareça para clientes próximos
              </Text>
            </View>
            <View style={[styles.retailerBannerArrow, { backgroundColor: "#CC0000" }]}>
              <Feather name="chevron-right" size={16} color="#fff" />
            </View>
          </Pressable>
        </View>

        {/* Quick Actions */}
        <View style={{ paddingHorizontal: 16, marginTop: 20 }}>
          <Text style={[styles.sectionTitle, { color: C.text, marginBottom: 12 }]}>
            Ações rápidas
          </Text>
          <View style={styles.quickActions}>
            <Pressable
              style={[styles.quickCard, { backgroundColor: C.primary }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push("/(tabs)/list");
              }}
            >
              <Feather name="shopping-cart" size={24} color="#fff" />
              <Text style={styles.quickCardText}>Minha Lista</Text>
            </Pressable>
            <Pressable
              style={[styles.quickCard, { backgroundColor: isDark ? "#1C1C1C" : "#1A1A1A" }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push("/scanner");
              }}
            >
              <MaterialCommunityIcons name="barcode-scan" size={24} color="#fff" />
              <Text style={styles.quickCardText}>Escanear</Text>
            </Pressable>
            <Pressable
              style={[styles.quickCard, { backgroundColor: "#C9A227" }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push("/(tabs)/game");
              }}
            >
              <Ionicons name="trophy-outline" size={24} color="#fff" />
              <Text style={styles.quickCardText}>Ranking</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* Claim Modal */}
      <Modal
        visible={!!claimStore}
        animationType="slide"
        transparent
        onRequestClose={() => setClaimStore(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: isDark ? C.backgroundSecondary : "#fff" }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: C.text }]}>Solicitar parceria</Text>
            <Text style={[styles.modalSubtitle, { color: C.textSecondary }]}>
              Solicite parceria para {claimStore?.name} e comece a divulgar preços e promoções.
            </Text>

            <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>Seu nome completo *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: C.backgroundTertiary, color: C.text }]}
              value={claimName}
              onChangeText={setClaimName}
              placeholder="Nome do responsável"
              placeholderTextColor={C.textMuted}
            />

            <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>E-mail de contato *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: C.backgroundTertiary, color: C.text }]}
              value={claimEmail}
              onChangeText={setClaimEmail}
              placeholder="seu@email.com"
              placeholderTextColor={C.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>Mensagem (opcional)</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline, { backgroundColor: C.backgroundTertiary, color: C.text }]}
              value={claimMsg}
              onChangeText={setClaimMsg}
              placeholder="Conte um pouco sobre seu estabelecimento..."
              placeholderTextColor={C.textMuted}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnCancel, { backgroundColor: C.backgroundTertiary }]}
                onPress={() => setClaimStore(null)}
              >
                <Text style={[styles.modalBtnText, { color: C.textSecondary }]}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnSend, { opacity: claimSending ? 0.6 : 1 }]}
                onPress={handleClaim}
                disabled={claimSending}
              >
                {claimSending
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={[styles.modalBtnText, { color: "#fff" }]}>Enviar pedido</Text>
                }
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 12,
  },
  logoBlock: { flexDirection: "column", gap: 0, justifyContent: "center", flex: 1 },
  logoImage: { width: 210, height: 52 },
  greeting: { fontSize: 14, fontFamily: "Inter_500Medium", textAlign: "center", marginTop: 6, paddingHorizontal: 16 },
  headerActions: { flexDirection: "row", gap: 8, alignItems: "center" },
  iconBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  loginBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  loginBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13 },
  avatarBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  taglineRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  tagline: { fontSize: 12, fontFamily: "Inter_400Regular", fontStyle: "italic" },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 10,
    gap: 10,
  },
  searchPlaceholder: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  barcodeBtn: { width: 34, height: 34, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  radiusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  radiusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  storeCard: {
    width: 120,
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    overflow: "hidden",
  },
  shadowOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(128,128,128,0.45)",
    borderRadius: 14,
    zIndex: 10,
  },
  storeLogoCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    overflow: "hidden",
  },
  storeName: { fontSize: 11, fontFamily: "Inter_600SemiBold", textAlign: "center", lineHeight: 14 },
  storeDistRow: { flexDirection: "row", alignItems: "center", gap: 2, marginTop: 4 },
  storeDist: { fontSize: 10, fontFamily: "Inter_400Regular" },
  planBadge: { marginTop: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  planBadgeText: { color: "#fff", fontSize: 8, fontFamily: "Inter_700Bold" },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  verifiedBadgeText: { color: "#2E7D32", fontSize: 8, fontFamily: "Inter_700Bold" },
  storeMetaLink: { fontSize: 8, fontFamily: "Inter_500Medium" },
  claimBtn: {
    marginTop: 6,
    backgroundColor: "#CC0000",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  claimBtnText: { color: "#fff", fontSize: 8, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  quickActions: { flexDirection: "row", gap: 10 },
  quickCard: { flex: 1, borderRadius: 14, padding: 16, alignItems: "center", gap: 8 },
  quickCardText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  retailerBanner: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1.5 },
  retailerBannerIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  retailerBannerTitle: { fontSize: 14, fontFamily: "Inter_700Bold", marginBottom: 2 },
  retailerBannerSub: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 16 },
  retailerBannerArrow: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  qaRegister: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14 },
  qaRegisterTitle: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  qaRegisterSub: { color: "rgba(255,255,255,0.75)", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  qaPoints: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  qaPointsText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  modalBox: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#ddd",
    alignSelf: "center",
    marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 6 },
  modalSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 20, lineHeight: 18 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginBottom: 6 },
  input: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginBottom: 14,
  },
  inputMultiline: { height: 80, textAlignVertical: "top" },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  modalBtn: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  modalBtnCancel: {},
  modalBtnSend: { backgroundColor: "#CC0000" },
  modalBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },

  // Mission section styles
  missionBolt: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  missionCard: {
    width: 200, borderRadius: 16, borderWidth: 1.5,
    padding: 14, gap: 8,
    elevation: 2,
    shadowColor: "#CC0000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6,
  },
  missionCardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  missionXpBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20,
  },
  missionXpText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#fff" },
  missionDist: { fontSize: 10, fontFamily: "Inter_400Regular" },
  missionStoreName: { fontSize: 14, fontFamily: "Inter_700Bold", lineHeight: 18 },
  missionAddress: { fontSize: 10, fontFamily: "Inter_400Regular" },
  missionStats: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  missionStat: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6,
  },
  missionStatText: { fontSize: 10, fontFamily: "Inter_500Medium" },
  missionAction: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4,
    paddingVertical: 8, borderRadius: 8,
  },
  missionActionText: { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },

  // Coral ! badge on store cards
  missionCoralbadge: {
    position: "absolute", top: 8, right: 8, zIndex: 10,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: "#FF6B35",
    alignItems: "center", justifyContent: "center",
    elevation: 3,
    shadowColor: "#FF6B35", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 4,
  },
  missionCoralText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 13, lineHeight: 16 },
});
