import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState } from "react";
import {
  Linking,
  Platform,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  ToastAndroid,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { useApp, type Product } from "@/context/AppContext";

type SectionData = { title: string; data: (Product & { storePrice: number })[] };

export default function StoreScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const C = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { stores, products, addToShoppingList, shoppingList } = useApp();

  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());

  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 84 : (insets.bottom ? insets.bottom + 60 : 80);

  const store = stores.find((s) => s.id === id);

  const sections: SectionData[] = useMemo(() => {
    const storeProducts = products
      .filter((p) => p.prices.some((pr) => pr.storeId === id))
      .map((p) => ({
        ...p,
        storePrice: p.prices.find((pr) => pr.storeId === id)!.price,
      }));

    const grouped: Record<string, typeof storeProducts> = {};
    storeProducts.forEach((p) => {
      if (!grouped[p.category]) grouped[p.category] = [];
      grouped[p.category].push(p);
    });

    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([title, data]) => ({ title, data }));
  }, [id, products]);

  const totalProducts = sections.reduce((sum, s) => sum + s.data.length, 0);

  const handleAddToList = (product: Product & { storePrice: number }) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addToShoppingList({
      eanCode: product.ean,
      productName: product.name,
      quantity: 1,
      checked: false,
      bestPrice: product.storePrice,
      bestStore: store?.name,
    });
    setAddedItems((prev) => new Set(prev).add(product.ean));
    if (Platform.OS === "android") {
      ToastAndroid.show("Adicionado à lista!", ToastAndroid.SHORT);
    }
  };

  if (!store) {
    return (
      <View style={[styles.container, { backgroundColor: C.background, justifyContent: "center", alignItems: "center" }]}>
        <Text style={[styles.emptyTitle, { color: C.text }]}>Supermercado não encontrado</Text>
        <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: C.primary }]}>
          <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold" }}>Voltar</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: C.background, borderBottomColor: C.border }]}>
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
          style={[styles.backBtnIcon, { backgroundColor: C.backgroundSecondary }]}
          hitSlop={8}
        >
          <Feather name="arrow-left" size={20} color={C.text} />
        </Pressable>

        <View style={styles.headerCenter}>
          <View style={[styles.storeLogo, { backgroundColor: isDark ? C.backgroundTertiary : "#F0F0F0" }]}>
            <Feather name="shopping-bag" size={22} color={C.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.storeName, { color: C.text }]} numberOfLines={1}>{store.name}</Text>
            <View style={styles.storeMeta}>
              <Feather name="map-pin" size={11} color={C.textMuted} />
              <Text style={[styles.storeMetaTxt, { color: C.textMuted }]}>{store.distance}km · {store.address}</Text>
            </View>
          </View>
        </View>

        {store.plan === "plus" && (
          <View style={[styles.planBadge, { backgroundColor: C.primary }]}>
            <Text style={styles.planBadgeText}>PLUS</Text>
          </View>
        )}
      </View>

      {store.status === "verified" && (store.phone || store.website) && (
        <View style={[styles.verifiedBar, { backgroundColor: C.backgroundSecondary, borderBottomColor: C.border }]}>
          <View style={[styles.verifiedTag, { backgroundColor: "#E8F5E9" }]}>
            <Feather name="check-circle" size={10} color="#2E7D32" />
            <Text style={{ color: "#2E7D32", fontSize: 10, fontFamily: "Inter_700Bold" }}>Verificado</Text>
          </View>
          {store.phone && (
            <Pressable
              style={styles.verifiedLink}
              onPress={() => Linking.openURL(`tel:${store.phone}`)}
              hitSlop={4}
            >
              <Feather name="phone" size={12} color={C.primary} />
              <Text style={[styles.verifiedLinkText, { color: C.primary }]}>{store.phone}</Text>
            </Pressable>
          )}
          {store.website && (
            <Pressable
              style={styles.verifiedLink}
              onPress={() => Linking.openURL(store.website!)}
              hitSlop={4}
            >
              <Feather name="globe" size={12} color={C.primary} />
              <Text style={[styles.verifiedLinkText, { color: C.primary }]}>Visitar site</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Subtitle bar */}
      <View style={[styles.subtitleBar, { backgroundColor: C.backgroundSecondary }]}>
        <Text style={[styles.subtitleTxt, { color: C.textSecondary }]}>
          {totalProducts} produto{totalProducts !== 1 ? "s" : ""} disponíveis
        </Text>
        <Pressable
          style={styles.listShortcut}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/(tabs)/list"); }}
        >
          <Feather name="shopping-cart" size={13} color={C.primary} />
          <Text style={[styles.listShortcutTxt, { color: C.primary }]}>
            Ver lista ({shoppingList.length})
          </Text>
        </Pressable>
      </View>

      {sections.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="package" size={48} color={C.textMuted} />
          <Text style={[styles.emptyTitle, { color: C.text }]}>Nenhum produto cadastrado</Text>
          <Text style={[styles.emptySub, { color: C.textMuted }]}>
            Este supermercado ainda não cadastrou seus produtos
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.ean}
          contentContainerStyle={{ paddingBottom: bottomPad, paddingTop: 8 }}
          stickySectionHeadersEnabled
          renderSectionHeader={({ section: { title } }) => (
            <View style={[styles.sectionHeader, { backgroundColor: C.background, borderBottomColor: C.border }]}>
              <View style={[styles.categoryDot, { backgroundColor: C.primary }]} />
              <Text style={[styles.sectionTitle, { color: C.text }]}>{title}</Text>
            </View>
          )}
          renderItem={({ item }) => {
            const alreadyAdded = addedItems.has(item.ean) ||
              shoppingList.some((i) => i.eanCode === item.ean);

            return (
              <Pressable
                style={[styles.productRow, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}
                onPress={() => router.push(`/product/${item.ean}`)}
              >
                <View style={[styles.productIcon, { backgroundColor: isDark ? C.backgroundTertiary : "#F5F5F5" }]}>
                  <Feather name="box" size={18} color={C.primary} />
                </View>
                <View style={styles.productInfo}>
                  <Text style={[styles.productName, { color: C.text }]} numberOfLines={2}>{item.name}</Text>
                  <Text style={[styles.productBrand, { color: C.textMuted }]}>{item.brand}</Text>
                  <Text style={[styles.productEan, { color: C.textMuted }]}>{item.ean}</Text>
                </View>
                <View style={styles.productRight}>
                  <Text style={[styles.productPrice, { color: C.primary }]}>
                    R$ {item.storePrice.toFixed(2).replace(".", ",")}
                  </Text>
                  <Pressable
                    style={[
                      styles.addBtn,
                      alreadyAdded
                        ? { backgroundColor: C.success }
                        : { backgroundColor: C.primary },
                    ]}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      if (!alreadyAdded) handleAddToList(item);
                    }}
                    hitSlop={4}
                  >
                    <Feather name={alreadyAdded ? "check" : "plus"} size={14} color="#fff" />
                    <Text style={styles.addBtnTxt}>
                      {alreadyAdded ? "Na lista" : "Adicionar"}
                    </Text>
                  </Pressable>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
    borderBottomWidth: 1,
  },
  backBtnIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  backBtn: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  storeLogo: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  storeName: { fontSize: 16, fontFamily: "Inter_700Bold" },
  storeMeta: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
  storeMetaTxt: { fontSize: 11, fontFamily: "Inter_400Regular" },
  planBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7 },
  planBadgeText: { color: "#fff", fontSize: 9, fontFamily: "Inter_700Bold" },
  subtitleBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  subtitleTxt: { fontSize: 12, fontFamily: "Inter_400Regular" },
  listShortcut: { flexDirection: "row", alignItems: "center", gap: 4 },
  listShortcutTxt: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
  },
  categoryDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    gap: 10,
  },
  productIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  productInfo: { flex: 1 },
  productName: { fontSize: 13, fontFamily: "Inter_600SemiBold", lineHeight: 18 },
  productBrand: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  productEan: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 1 },
  productRight: { alignItems: "flex-end", gap: 6 },
  productPrice: { fontSize: 15, fontFamily: "Inter_700Bold" },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addBtnTxt: { color: "#fff", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  verifiedBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
    borderBottomWidth: 1,
  },
  verifiedTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  verifiedLink: { flexDirection: "row", alignItems: "center", gap: 4 },
  verifiedLinkText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingTop: 80 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 40 },
});
