import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { useApp, type Product } from "@/context/AppContext";

export default function SearchScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const C = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { searchProducts, addToShoppingList } = useApp();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>(searchProducts(""));

  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 84 : 90;

  const handleSearch = (text: string) => {
    setQuery(text);
    setResults(searchProducts(text));
  };

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

    return (
      <Pressable
        style={[styles.productCard, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}
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
        <Pressable
          style={[styles.addBtn, { backgroundColor: C.primary }]}
          onPress={() => handleAddToList(item)}
        >
          <Feather name="plus" size={18} color="#fff" />
        </Pressable>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: C.background }]}>
        <View style={[styles.searchRow, { backgroundColor: C.backgroundSecondary }]}>
          <Feather name="search" size={18} color={C.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: C.text }]}
            placeholder="EAN, produto ou marca..."
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

      {/* Results */}
      <FlatList
        data={results}
        keyExtractor={(item) => item.ean}
        renderItem={renderProduct}
        contentContainerStyle={{ padding: 16, paddingBottom: bottomPad, gap: 10 }}
        scrollEnabled={!!results.length}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="magnify-close" size={48} color={C.textMuted} />
            <Text style={[styles.emptyText, { color: C.textMuted }]}>Nenhum produto encontrado</Text>
          </View>
        )}
        ListHeaderComponent={() =>
          results.length > 0 ? (
            <Text style={[styles.resultCount, { color: C.textMuted }]}>
              {results.length} produto{results.length !== 1 ? "s" : ""} encontrado{results.length !== 1 ? "s" : ""}
            </Text>
          ) : null
        }
      />
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
  resultCount: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 8 },
  productCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    padding: 12,
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
  empty: { alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular" },
});
