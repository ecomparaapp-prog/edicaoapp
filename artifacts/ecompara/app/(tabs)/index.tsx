import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Dimensions,
  FlatList,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import { useTheme } from "@/context/ThemeContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BANNER_WIDTH = SCREEN_WIDTH - 32;

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const C = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { user, isLoggedIn, stores, banners } = useApp();
  const { toggleTheme } = useTheme();
  const [activeBanner, setActiveBanner] = useState(0);

  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 84 : (insets.bottom ? insets.bottom + 60 : 80);

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
            <View style={styles.logoPill}>
              <Image
                source={require("@/assets/images/logo-cropped.png")}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            {isLoggedIn && (
              <Text style={[styles.greeting, { color: C.textSecondary }]}>
                Olá, {user?.name.split(" ")[0]}
              </Text>
            )}
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

        {/* Tagline */}
        <View style={[styles.taglineRow, { marginHorizontal: 16, marginTop: 2 }]}>
          <Feather name="navigation" size={12} color={C.primary} />
          <Text style={[styles.tagline, { color: C.textMuted }]}>
            O Waze dos supermercados
          </Text>
        </View>

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

        {/* Banners */}
        <View style={{ marginTop: 20 }}>
          <FlatList
            data={banners}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(
                e.nativeEvent.contentOffset.x / (BANNER_WIDTH + 12)
              );
              setActiveBanner(idx);
            }}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.bannerCard, { backgroundColor: item.color, width: BANNER_WIDTH }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push(`/store/${item.storeId}`);
                }}
              >
                <View style={styles.bannerContent}>
                  <View style={[styles.bannerTag, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
                    <Text style={styles.bannerTagText}>ANÚNCIO</Text>
                  </View>
                  <Text style={styles.bannerTitle}>{item.title}</Text>
                  <Text style={styles.bannerSubtitle}>{item.subtitle}</Text>
                  <Text style={styles.bannerStore}>{item.storeName}</Text>
                </View>
                <View style={styles.bannerIcon}>
                  <MaterialCommunityIcons
                    name="tag-multiple"
                    size={60}
                    color="rgba(255,255,255,0.15)"
                  />
                </View>
              </Pressable>
            )}
          />
          <View style={styles.bannerDots}>
            {banners.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  { backgroundColor: i === activeBanner ? C.primary : C.border },
                ]}
              />
            ))}
          </View>
        </View>

        {/* Supermercados Próximos */}
        <View style={{ marginTop: 24, paddingHorizontal: 16 }}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: C.text }]}>Supermercados</Text>
            <View style={[styles.radiusBadge, { backgroundColor: C.backgroundSecondary }]}>
              <Feather name="map-pin" size={11} color={C.primary} />
              <Text style={[styles.radiusText, { color: C.primary }]}>5km</Text>
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
          renderItem={({ item }) => (
            <Pressable
              style={[
                styles.storeCard,
                { backgroundColor: C.surfaceElevated, borderColor: C.border },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(`/store/${item.id}`);
              }}
            >
              <View
                style={[
                  styles.storeLogoCircle,
                  { backgroundColor: isDark ? C.backgroundTertiary : "#F0F0F0" },
                ]}
              >
                <Feather name="shopping-bag" size={22} color={C.primary} />
              </View>
              <Text style={[styles.storeName, { color: C.text }]} numberOfLines={2}>
                {item.name}
              </Text>
              <View style={styles.storeDistRow}>
                <Feather name="map-pin" size={10} color={C.textMuted} />
                <Text style={[styles.storeDist, { color: C.textMuted }]}>
                  {item.distance}km
                </Text>
              </View>
              {item.plan === "plus" && (
                <View style={[styles.planBadge, { backgroundColor: C.primary }]}>
                  <Text style={styles.planBadgeText}>PLUS</Text>
                </View>
              )}
            </Pressable>
          )}
        />

        {/* Quick Actions */}
        <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
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
    paddingBottom: 4,
  },
  logoBlock: { flexDirection: "row", alignItems: "center", gap: 8 },
  logoPill: { backgroundColor: "#0A0A0A", borderRadius: 12, paddingHorizontal: 4, paddingVertical: 2 },
  logoImage: { width: 210, height: 101 },
  greeting: { fontSize: 13, fontFamily: "Inter_500Medium" },
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
  bannerCard: {
    borderRadius: 16,
    padding: 20,
    height: 140,
    overflow: "hidden",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bannerContent: { flex: 1 },
  bannerTag: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 8,
  },
  bannerTagText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  bannerTitle: { color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold", lineHeight: 22 },
  bannerSubtitle: { color: "rgba(255,255,255,0.85)", fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 4 },
  bannerStore: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 6 },
  bannerIcon: { marginLeft: 8 },
  bannerDots: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3 },
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
    width: 100,
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
  },
  storeLogoCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  storeName: { fontSize: 11, fontFamily: "Inter_600SemiBold", textAlign: "center", lineHeight: 14 },
  storeDistRow: { flexDirection: "row", alignItems: "center", gap: 2, marginTop: 4 },
  storeDist: { fontSize: 10, fontFamily: "Inter_400Regular" },
  planBadge: { marginTop: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  planBadgeText: { color: "#fff", fontSize: 8, fontFamily: "Inter_700Bold" },
  quickActions: { flexDirection: "row", gap: 10 },
  quickCard: { flex: 1, borderRadius: 14, padding: 16, alignItems: "center", gap: 8 },
  quickCardText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
});
