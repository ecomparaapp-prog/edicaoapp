import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { Colors } from "@/constants/colors";
import { useApp, type Product, type Store } from "@/context/AppContext";

const FAVORITES_KEY = "@ecompara_favorite_stores";
const MAX_STORE_DISTANCE_KM = 5;

export default function SearchScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const C = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { searchProducts, searchProductsAsync, addToShoppingList, shoppingList, removeFromShoppingList, updateShoppingItemQuantity, stores } = useApp();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>(() => searchProducts(""));
  const [storeResults, setStoreResults] = useState<Store[]>([]);
  const [searching, setSearching] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 84 : 90;

  useEffect(() => {
    AsyncStorage.getItem(FAVORITES_KEY).then((raw) => {
      const favs: string[] = raw ? JSON.parse(raw) : [];
      setFavoriteIds(new Set(favs));
    });
  }, []);

  const searchStores = useCallback((q: string): Store[] => {
    if (!q.trim()) return [];
    const lower = q.toLowerCase();
    return stores.filter((s) => {
      const nameMatch = s.name.toLowerCase().includes(lower);
      if (!nameMatch) return false;
      const storeId = s.googlePlaceId ?? s.id;
      const isFav = favoriteIds.has(storeId) || favoriteIds.has(s.id);
      const isNearby = (s.distance ?? 999) <= MAX_STORE_DISTANCE_KM;
      return isFav || isNearby;
    });
  }, [stores, favoriteIds]);

  useEffect(() => {
    setResults(searchProducts(query));
    setStoreResults(searchStores(query));
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const asyncResults = await searchProductsAsync(query);
        if (!cancelled) setResults(asyncResults);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); setSearching(false); };
  }, [query, favoriteIds]);

  const handleSearch = (text: string) => setQuery(text);

  const getBestPrice = (product: Product) => {
    if (!product.prices.length) return null;
    return product.prices.reduce((min, p) => (p.price < min.price ? p : min));
  };

  const getMaxPrice = (product: Product) => {
    if (!product.prices.length) return null;
    return product.prices.reduce((max, p) => (p.price > max.price ? p : max));
  };

  const handleAddToList = (product: Product) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const best = getBestPrice(product);
    addToShoppingList({
      eanCode: product.ean,
      productName: product.name,
      quantity: 1,
      checked: false,
      bestPrice: best?.price,
      bestStore: best?.storeName,
    });
  };

  const renderProduct = ({ item }: { item: Product }) => {
    const best = getBestPrice(item);
    const max = getMaxPrice(item);
    const savings = best && max ? ((max.price - best.price) / max.price * 100).toFixed(0) : null;
    const listItem = shoppingList.find((i) => i.eanCode === item.ean);
    const inList = !!listItem;

    return (
      <Pressable
        style={[styles.productCard, { backgroundColor: C.surfaceElevated, borderColor: inList ? C.success : C.border }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push({ pathname: "/product/[ean]", params: { ean: item.ean } });
        }}
      >
        <View style={[styles.productIcon, { backgroundColor: isDark ? C.backgroundTertiary : "#F5F5F5" }]}>
          <MaterialCommunityIcons name="package-variant" size={28} color={C.primary} />
        </View>
        <View style={styles.productInfo}>
          <Text style={[styles.productName, { color: C.text }]} numberOfLines={2}>{item.name}</Text>
          <Text style={[styles.productBrand, { color: C.textMuted }]}>{item.brand} · {item.ean}</Text>
          <View style={styles.priceRow}>
            {best ? (
              <>
                <Text style={[styles.bestPrice, { color: C.primary }]}>
                  R$ {best.price.toFixed(2).replace(".", ",")}
                </Text>
                <Text style={[styles.bestStore, { color: C.textSecondary }]}>{best.storeName}</Text>
                {savings && Number(savings) > 0 && (
                  <View style={[styles.savingsBadge, { backgroundColor: C.success }]}>
                    <Text style={styles.savingsText}>-{savings}%</Text>
                  </View>
                )}
              </>
            ) : (
              <Text style={{ color: C.textMuted }}>Sem preço</Text>
            )}
          </View>
          <Text style={[styles.storeCount, { color: C.textMuted }]}>
            {item.prices.length} mercado{item.prices.length !== 1 ? "s" : ""}
          </Text>
        </View>
        {inList ? (
          <View style={styles.stepperCol}>
            <View style={[styles.stepper, { backgroundColor: C.success + "18", borderColor: C.success + "60" }]}>
              <Pressable
                style={[styles.stepperBtn, { backgroundColor: C.success }]}
                onPress={(e) => { e.stopPropagation?.(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); updateShoppingItemQuantity(listItem.id, listItem.quantity - 1); }}
                hitSlop={6}
              >
                <Feather name="minus" size={13} color="#fff" />
              </Pressable>
              <Text style={[styles.stepperQty, { color: C.success }]}>{listItem.quantity}</Text>
              <Pressable
                style={[styles.stepperBtn, { backgroundColor: C.success }]}
                onPress={(e) => { e.stopPropagation?.(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); updateShoppingItemQuantity(listItem.id, listItem.quantity + 1); }}
                hitSlop={6}
              >
                <Feather name="plus" size={13} color="#fff" />
              </Pressable>
            </View>
            <Text style={[styles.inListLabel, { color: C.success }]}>Na lista</Text>
          </View>
        ) : (
          <Pressable
            style={[styles.addBtn, { backgroundColor: C.primary }]}
            onPress={(e) => { e.stopPropagation?.(); handleAddToList(item); }}
          >
            <Feather name="plus" size={18} color="#fff" />
          </Pressable>
        )}
      </Pressable>
    );
  };

  const renderStore = ({ item }: { item: Store }) => {
    const isVerified = item.status === "verified";
    const isFav = favoriteIds.has(item.googlePlaceId ?? item.id) || favoriteIds.has(item.id);
    return (
      <Pressable
        style={[
          styles.storeCard,
          { backgroundColor: C.surfaceElevated, borderColor: C.border },
          isVerified && { borderColor: C.primary },
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
        <View style={[styles.storeIconBox, { backgroundColor: isDark ? C.backgroundTertiary : "#F0F0F0" }]}>
          <Feather name="shopping-bag" size={20} color={isVerified ? C.primary : C.textMuted} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <Text style={[styles.storeName, { color: C.text }]} numberOfLines={1}>{item.name}</Text>
            {isVerified && (
              <View style={[styles.verifiedBadge, { backgroundColor: "#E8F5E9" }]}>
                <Feather name="check-circle" size={9} color="#2E7D32" />
                <Text style={[styles.verifiedBadgeText, { color: "#2E7D32" }]}>Parceiro</Text>
              </View>
            )}
            {isFav && (
              <Ionicons name="heart" size={11} color="#E53935" />
            )}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 }}>
            <Feather name="map-pin" size={10} color={C.textMuted} />
            <Text style={[styles.storeMeta, { color: C.textMuted }]} numberOfLines={1}>
              {item.distance > 0 ? `${item.distance}km · ` : ""}{item.address || "Endereço não disponível"}
            </Text>
          </View>
        </View>
        <Feather name="chevron-right" size={16} color={C.textMuted} />
      </Pressable>
    );
  };

  const hasStores = storeResults.length > 0;
  const hasProducts = results.length > 0;
  const hasQuery = query.trim().length > 0;

  const sections = [
    ...(hasStores ? [{
      title: "Mercados",
      data: storeResults,
      renderItem: renderStore,
      keyExtractor: (item: Store) => item.id,
    }] : []),
    ...(hasProducts ? [{
      title: "Produtos",
      data: results,
      renderItem: renderProduct,
      keyExtractor: (item: Product) => item.ean,
    }] : []),
  ];

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: C.background }]}>
        <View style={[styles.searchRow, { backgroundColor: C.backgroundSecondary }]}>
          <Feather name="search" size={18} color={C.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: C.text }]}
            placeholder="Produto, EAN ou nome do mercado..."
            placeholderTextColor={C.textMuted}
            value={query}
            onChangeText={handleSearch}
            autoFocus
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable onPress={() => handleSearch("")}>
              <Feather name="x" size={16} color={C.textMuted} />
            </Pressable>
          )}
          <Pressable
            style={[styles.scanBtn, { backgroundColor: C.primary }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/scanner"); }}
          >
            <MaterialCommunityIcons name="barcode-scan" size={17} color="#fff" />
          </Pressable>
        </View>
      </View>

      {/* Tip sobre favoritar mercados (mostrado quando há resultados de mercado com distância limite) */}
      {hasQuery && hasStores && (
        <View style={[styles.favTip, { backgroundColor: isDark ? "#1A1A2E" : "#EEF2FF", borderColor: isDark ? "#3730A3" : "#C7D2FE" }]}>
          <Ionicons name="heart" size={12} color="#6366F1" />
          <Text style={[styles.favTipText, { color: isDark ? "#A5B4FC" : "#4338CA" }]}>
            Mercados favoritos aparecem na busca de qualquer distância.{" "}
            <Text style={{ fontFamily: "Inter_700Bold" }}>Favorite para não perder promoções!</Text>
          </Text>
        </View>
      )}

      {/* Resultados mistos: Mercados + Produtos */}
      {hasQuery ? (
        sections.length === 0 ? (
          <View style={styles.empty}>
            {searching ? (
              <ActivityIndicator size="large" color={C.primary} />
            ) : (
              <>
                <MaterialCommunityIcons name="magnify-close" size={48} color={C.textMuted} />
                <Text style={[styles.emptyText, { color: C.textMuted }]}>Nenhum resultado encontrado</Text>
              </>
            )}
          </View>
        ) : (
          <SectionList
            sections={sections as any}
            keyExtractor={(item: any) => item.ean ?? item.id}
            renderItem={({ item, section }: any) => section.renderItem({ item })}
            renderSectionHeader={({ section }) => (
              <View style={[styles.sectionHeader, { backgroundColor: C.background, borderBottomColor: C.border }]}>
                <Text style={[styles.sectionTitle, { color: C.textSecondary }]}>{section.title}</Text>
                {searching && section.title === "Produtos" && (
                  <ActivityIndicator size="small" color={C.primary} />
                )}
                <Text style={[styles.sectionCount, { color: C.textMuted }]}>
                  {section.data.length} encontrado{section.data.length !== 1 ? "s" : ""}
                </Text>
              </View>
            )}
            contentContainerStyle={{ paddingBottom: bottomPad }}
            stickySectionHeadersEnabled
          />
        )
      ) : (
        /* Estado vazio — sem query */
        <View style={styles.emptyHint}>
          <MaterialCommunityIcons name="magnify" size={52} color={C.textMuted} style={{ opacity: 0.5 }} />
          <Text style={[styles.emptyHintTitle, { color: C.text }]}>Busque produtos ou mercados</Text>
          <Text style={[styles.emptyHintSub, { color: C.textMuted }]}>
            Digite o nome do produto, EAN ou o nome de um mercado próximo.
          </Text>
          <View style={[styles.favTipLarge, { backgroundColor: isDark ? "#1A1A2E" : "#EEF2FF", borderColor: isDark ? "#3730A3" : "#C7D2FE" }]}>
            <Ionicons name="heart" size={14} color="#6366F1" />
            <Text style={[styles.favTipLargeText, { color: isDark ? "#A5B4FC" : "#4338CA" }]}>
              <Text style={{ fontFamily: "Inter_700Bold" }}>Dica:</Text> Mercados favoritos aparecem na busca independente da distância. Favorite seus mercados preferidos para acessar ofertas a qualquer hora!
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12 },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 10,
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  scanBtn: { width: 34, height: 34, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  favTip: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginHorizontal: 16,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  favTipText: { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 8,
  },
  sectionTitle: { fontSize: 12, fontFamily: "Inter_700Bold", flex: 1 },
  sectionCount: { fontSize: 11, fontFamily: "Inter_400Regular" },
  storeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  storeIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  storeName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  storeMeta: { fontSize: 11, fontFamily: "Inter_400Regular" },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
  },
  verifiedBadgeText: { fontSize: 9, fontFamily: "Inter_700Bold" },
  productCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    borderWidth: 1,
    gap: 12,
  },
  productIcon: { width: 52, height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  productInfo: { flex: 1 },
  productName: { fontSize: 14, fontFamily: "Inter_600SemiBold", lineHeight: 18 },
  productBrand: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 5 },
  bestPrice: { fontSize: 16, fontFamily: "Inter_700Bold" },
  bestStore: { fontSize: 11, fontFamily: "Inter_400Regular" },
  savingsBadge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5 },
  savingsText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold" },
  storeCount: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 2 },
  addBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  stepperCol: { alignItems: "center", gap: 4 },
  stepper: { flexDirection: "row", alignItems: "center", borderRadius: 10, borderWidth: 1, overflow: "hidden" },
  stepperBtn: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  stepperQty: { width: 28, textAlign: "center", fontSize: 13, fontFamily: "Inter_700Bold" },
  inListLabel: { fontSize: 9, fontFamily: "Inter_600SemiBold", letterSpacing: 0.3 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  emptyHint: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 12 },
  emptyHintTitle: { fontSize: 17, fontFamily: "Inter_700Bold", textAlign: "center" },
  emptyHintSub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  favTipLarge: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  favTipLargeText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
});
