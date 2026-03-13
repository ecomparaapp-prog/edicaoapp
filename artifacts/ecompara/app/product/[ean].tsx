import { Feather, MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { useApp } from "@/context/AppContext";

export default function ProductDetailScreen() {
  const { ean } = useLocalSearchParams<{ ean: string }>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const C = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { getProductByEAN, addToShoppingList } = useApp();

  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 34 : insets.bottom + 24;

  const product = getProductByEAN(ean || "");

  if (!product) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: C.background }]}>
        <Feather name="alert-circle" size={48} color={C.textMuted} />
        <Text style={[styles.notFoundText, { color: C.textMuted }]}>Produto não encontrado</Text>
        <Pressable style={[styles.backBtn2, { backgroundColor: C.primary }]} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Voltar</Text>
        </Pressable>
      </View>
    );
  }

  const sortedPrices = [...product.prices].sort((a, b) => a.price - b.price);
  const best = sortedPrices[0];
  const worst = sortedPrices[sortedPrices.length - 1];
  const savings = ((worst.price - best.price) / worst.price * 100).toFixed(0);

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: C.background }]}>
        <Pressable
          style={[styles.backBtn, { backgroundColor: C.backgroundSecondary }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
        >
          <Feather name="arrow-left" size={20} color={C.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: C.text }]}>Comparar preços</Text>
        <Pressable
          style={[styles.backBtn, { backgroundColor: C.primary }]}
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            addToShoppingList({
              eanCode: product.ean,
              productName: product.name,
              quantity: 1,
              checked: false,
              bestPrice: best.price,
              bestStore: best.storeName,
            });
          }}
        >
          <Feather name="plus" size={20} color="#fff" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: bottomPad }}>
        {/* Product Card */}
        <View style={[styles.productHeader, { backgroundColor: C.surfaceElevated, marginHorizontal: 16, borderColor: C.border }]}>
          <View style={[styles.productIconLarge, { backgroundColor: isDark ? C.backgroundTertiary : "#F5F5F5" }]}>
            <MaterialCommunityIcons name="package-variant-closed" size={44} color={C.primary} />
          </View>
          <Text style={[styles.productName, { color: C.text }]}>{product.name}</Text>
          <Text style={[styles.productBrand, { color: C.textMuted }]}>{product.brand} · {product.category}</Text>
          <View style={styles.eanRow}>
            <MaterialCommunityIcons name="barcode" size={14} color={C.textMuted} />
            <Text style={[styles.eanText, { color: C.textMuted }]}>{product.ean}</Text>
          </View>
        </View>

        {/* Best Price Highlight */}
        <View style={[styles.bestPriceCard, { backgroundColor: C.primary, marginHorizontal: 16, marginTop: 12 }]}>
          <View>
            <Text style={styles.bestLabel}>Melhor preço</Text>
            <Text style={styles.bestPriceNum}>R$ {best.price.toFixed(2).replace(".", ",")}</Text>
            <Text style={styles.bestStoreName}>{best.storeName} · {best.distance}km</Text>
          </View>
          <View style={styles.savingsBlock}>
            <Text style={styles.savingsLabel}>Economize</Text>
            <Text style={styles.savingsValue}>{savings}%</Text>
            <Text style={styles.savingsVs}>vs. mais caro</Text>
          </View>
        </View>

        {/* Price List */}
        <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
          <Text style={[styles.sectionTitle, { color: C.text }]}>Preços por mercado</Text>
          <View style={{ gap: 8, marginTop: 10 }}>
            {sortedPrices.map((p, idx) => {
              const isBest = idx === 0;
              return (
                <View
                  key={p.storeId}
                  style={[styles.priceRow, { backgroundColor: isBest ? C.primary + "12" : C.surfaceElevated, borderColor: isBest ? C.primary : C.border }]}
                >
                  {isBest && (
                    <View style={[styles.bestBadge, { backgroundColor: C.primary }]}>
                      <Feather name="award" size={10} color="#fff" />
                      <Text style={styles.bestBadgeText}>Melhor</Text>
                    </View>
                  )}
                  <View style={[styles.storeCircle, { backgroundColor: isBest ? C.primary + "20" : C.backgroundTertiary }]}>
                    <Feather name="shopping-bag" size={16} color={isBest ? C.primary : C.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.storeName, { color: C.text }]}>{p.storeName}</Text>
                    <View style={styles.storeMetaRow}>
                      <Feather name="map-pin" size={10} color={C.textMuted} />
                      <Text style={[styles.storeMeta, { color: C.textMuted }]}>{p.distance}km · att. {p.updatedAt}</Text>
                    </View>
                  </View>
                  <Text style={[styles.priceNum, { color: isBest ? C.primary : C.text }]}>
                    R$ {p.price.toFixed(2).replace(".", ",")}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Update Price CTA */}
        <View style={{ paddingHorizontal: 16, marginTop: 20 }}>
          <View style={[styles.updateCta, { backgroundColor: isDark ? C.backgroundTertiary : "#FFF8F8", borderColor: C.primary + "30" }]}>
            <Ionicons name="trophy-outline" size={20} color={C.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.updateCtaTitle, { color: C.text }]}>Encontrou preço diferente?</Text>
              <Text style={[styles.updateCtaSub, { color: C.textMuted }]}>Atualize e ganhe +10 pontos no ranking!</Text>
            </View>
            <Pressable
              style={[styles.updateBtn, { backgroundColor: C.primary }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push("/scanner");
              }}
            >
              <Text style={styles.updateBtnText}>Atualizar</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { alignItems: "center", justifyContent: "center", gap: 12 },
  notFoundText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  backBtn2: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  backBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, gap: 12 },
  backBtn: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 16, fontFamily: "Inter_700Bold", textAlign: "center" },
  productHeader: { borderRadius: 18, padding: 20, marginTop: 12, borderWidth: 1, alignItems: "center", gap: 6 },
  productIconLarge: { width: 72, height: 72, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  productName: { fontSize: 16, fontFamily: "Inter_700Bold", textAlign: "center" },
  productBrand: { fontSize: 12, fontFamily: "Inter_400Regular" },
  eanRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  eanText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  bestPriceCard: { borderRadius: 18, padding: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  bestLabel: { color: "rgba(255,255,255,0.8)", fontSize: 12, fontFamily: "Inter_500Medium" },
  bestPriceNum: { color: "#fff", fontSize: 32, fontFamily: "Inter_700Bold" },
  bestStoreName: { color: "rgba(255,255,255,0.8)", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  savingsBlock: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 14, padding: 14 },
  savingsLabel: { color: "rgba(255,255,255,0.8)", fontSize: 10, fontFamily: "Inter_500Medium" },
  savingsValue: { color: "#fff", fontSize: 26, fontFamily: "Inter_700Bold" },
  savingsVs: { color: "rgba(255,255,255,0.7)", fontSize: 10, fontFamily: "Inter_400Regular" },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  priceRow: { flexDirection: "row", alignItems: "center", borderRadius: 14, padding: 12, borderWidth: 1, gap: 10 },
  bestBadge: { position: "absolute", top: -8, right: 12, flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  bestBadgeText: { color: "#fff", fontSize: 9, fontFamily: "Inter_700Bold" },
  storeCircle: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  storeName: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  storeMetaRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
  storeMeta: { fontSize: 10, fontFamily: "Inter_400Regular" },
  priceNum: { fontSize: 17, fontFamily: "Inter_700Bold" },
  updateCta: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, padding: 14, borderWidth: 1 },
  updateCtaTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  updateCtaSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  updateBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9 },
  updateBtnText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
});
