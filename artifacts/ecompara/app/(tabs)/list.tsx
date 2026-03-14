import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { useApp, type Product, type ShoppingItem, type Store } from "@/context/AppContext";

/* ─────────────────── helpers ────────────────────── */

type StrategyResult = {
  storeId: string;
  storeName: string;
  total: number;
  coverage: number;      // how many items this store covers
  distance: number;
  breakdown: { name: string; price: number; storeName: string }[];
};

type Strategies = {
  cheapestStore: StrategyResult | null;   // all items, cheapest single store
  cheapestMix: {
    total: number;
    stores: string[];
    breakdown: { name: string; price: number; storeName: string }[];
  };
  nearestStore: StrategyResult | null;    // nearest store
};

function calcStrategies(
  items: ShoppingItem[],
  products: Product[],
  stores: Store[]
): Strategies | null {
  const withEan = items.filter((i) => i.eanCode);
  if (withEan.length === 0) return null;

  // Build a map: storeId → { name, distance, total, items covered }
  const storeMap: Record<
    string,
    { storeName: string; distance: number; total: number; coverage: number; breakdown: { name: string; price: number; storeName: string }[] }
  > = {};

  withEan.forEach((item) => {
    const prod = products.find((p) => p.ean === item.eanCode);
    if (!prod) return;
    prod.prices.forEach((pr) => {
      if (!storeMap[pr.storeId]) {
        const s = stores.find((s) => s.id === pr.storeId);
        storeMap[pr.storeId] = {
          storeName: pr.storeName,
          distance: s?.distance ?? pr.distance,
          total: 0,
          coverage: 0,
          breakdown: [],
        };
      }
      storeMap[pr.storeId].total += pr.price * item.quantity;
      storeMap[pr.storeId].coverage += 1;
      storeMap[pr.storeId].breakdown.push({
        name: item.productName,
        price: pr.price,
        storeName: pr.storeName,
      });
    });
  });

  const storeResults: StrategyResult[] = Object.entries(storeMap).map(
    ([storeId, v]) => ({ storeId, ...v })
  );

  // Strategy 1 – cheapest single store (prioritise full coverage, then lowest total)
  const fullCoverage = storeResults.filter((s) => s.coverage === withEan.length);
  const s1Pool = fullCoverage.length ? fullCoverage : storeResults;
  const cheapestStore = s1Pool.reduce<StrategyResult | null>(
    (best, s) => (!best || s.total < best.total ? s : best),
    null
  );

  // Strategy 2 – cheapest per item regardless of store
  let mixTotal = 0;
  const mixBreakdown: { name: string; price: number; storeName: string }[] = [];
  const mixStoreSet = new Set<string>();

  withEan.forEach((item) => {
    const prod = products.find((p) => p.ean === item.eanCode);
    if (!prod || !prod.prices.length) return;
    const cheapest = prod.prices.reduce((a, b) => (b.price < a.price ? b : a));
    mixTotal += cheapest.price * item.quantity;
    mixBreakdown.push({ name: item.productName, price: cheapest.price, storeName: cheapest.storeName });
    mixStoreSet.add(cheapest.storeName);
  });

  // Strategy 3 – nearest store (by distance)
  const nearestStore = storeResults.reduce<StrategyResult | null>(
    (near, s) => (!near || s.distance < near.distance ? s : near),
    null
  );

  return {
    cheapestStore,
    cheapestMix: { total: mixTotal, stores: [...mixStoreSet], breakdown: mixBreakdown },
    nearestStore,
  };
}

/* ─────────────────── component ──────────────────── */

export default function ShoppingListScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const C = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const { shoppingList, toggleShoppingItem, removeFromShoppingList, clearShoppingList, addToShoppingList, searchProducts, products, stores } = useApp();

  const [query, setQuery] = useState("");
  const inputRef = useRef<TextInput>(null);

  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 84 : (insets.bottom ? insets.bottom + 60 : 80);

  const checked = shoppingList.filter((i) => i.checked);
  const unchecked = shoppingList.filter((i) => !i.checked);

  // Live search suggestions (max 5)
  const suggestions = useMemo(() => {
    if (!query.trim()) return [];
    return searchProducts(query).slice(0, 5);
  }, [query]);

  // 3 strategies (only when list has EAN-backed items)
  const strategies = useMemo(
    () => calcStrategies(shoppingList, products, stores),
    [shoppingList, products, stores]
  );

  const handleSelectSuggestion = (prod: Product) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const cheapestPrice = prod.prices.length
      ? prod.prices.reduce((a, b) => (b.price < a.price ? b : a))
      : null;
    addToShoppingList({
      eanCode: prod.ean,
      productName: prod.name,
      quantity: 1,
      checked: false,
      bestPrice: cheapestPrice?.price,
      bestStore: cheapestPrice?.storeName,
    });
    setQuery("");
    inputRef.current?.focus();
  };

  const handleClear = () => {
    Alert.alert("Limpar lista?", "Todos os itens serão removidos.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Limpar",
        style: "destructive",
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          clearShoppingList();
        },
      },
    ]);
  };

  const listData = [...unchecked, ...checked];

  /* ── render ── */
  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <View>
          <Text style={[styles.title, { color: C.text }]}>Minha Lista</Text>
          <Text style={[styles.subtitle, { color: C.textMuted }]}>
            {unchecked.length} restante{unchecked.length !== 1 ? "s" : ""} · {checked.length} marcado{checked.length !== 1 ? "s" : ""}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            style={[styles.headerBtn, { backgroundColor: C.backgroundSecondary }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/scanner"); }}
          >
            <MaterialCommunityIcons name="barcode-scan" size={18} color={C.text} />
          </Pressable>
          {shoppingList.length > 0 && (
            <Pressable style={[styles.headerBtn, { backgroundColor: C.backgroundSecondary }]} onPress={handleClear}>
              <Feather name="trash-2" size={18} color={C.textMuted} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Search / Add input */}
      <View style={{ paddingHorizontal: 16, marginBottom: 4 }}>
        <View style={[styles.addRow, { backgroundColor: C.backgroundSecondary, borderColor: query ? C.primary : C.border }]}>
          <Feather name="search" size={17} color={query ? C.primary : C.textMuted} />
          <TextInput
            ref={inputRef}
            style={[styles.addInput, { color: C.text }]}
            placeholder="Buscar produto (ex: feijão, leite…)"
            placeholderTextColor={C.textMuted}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery("")} hitSlop={8}>
              <Feather name="x" size={16} color={C.textMuted} />
            </Pressable>
          )}
        </View>

        {/* Autocomplete suggestions */}
        {suggestions.length > 0 && (
          <View style={[styles.suggestions, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
            {suggestions.map((prod, idx) => {
              const cheapest = prod.prices.length
                ? prod.prices.reduce((a, b) => (b.price < a.price ? b : a))
                : null;
              return (
                <Pressable
                  key={prod.ean}
                  style={[styles.suggestion, idx < suggestions.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.border }]}
                  onPress={() => handleSelectSuggestion(prod)}
                >
                  <View style={[styles.suggIcon, { backgroundColor: isDark ? C.backgroundTertiary : "#F5F5F5" }]}>
                    <Feather name="box" size={14} color={C.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.suggName, { color: C.text }]} numberOfLines={1}>{prod.name}</Text>
                    <Text style={[styles.suggBrand, { color: C.textMuted }]}>{prod.brand}</Text>
                  </View>
                  {cheapest && (
                    <View style={styles.suggPrice}>
                      <Text style={[styles.suggPriceVal, { color: C.primary }]}>
                        R$ {cheapest.price.toFixed(2).replace(".", ",")}
                      </Text>
                      <Text style={[styles.suggStore, { color: C.textMuted }]}>{cheapest.storeName}</Text>
                    </View>
                  )}
                  <Feather name="plus-circle" size={18} color={C.primary} style={{ marginLeft: 6 }} />
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
      >
        {/* List items */}
        {listData.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="shopping-cart" size={48} color={C.textMuted} />
            <Text style={[styles.emptyTitle, { color: C.text }]}>Lista vazia</Text>
            <Text style={[styles.emptySub, { color: C.textMuted }]}>
              Digite o nome de um produto acima para buscar e adicionar
            </Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16, gap: 8, paddingTop: 4 }}>
            {listData.map((item) => (
              <ItemRow key={item.id} item={item} C={C} onToggle={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggleShoppingItem(item.id); }} onRemove={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); removeFromShoppingList(item.id); }} />
            ))}
          </View>
        )}

        {/* ── 3 Strategies ── */}
        {strategies && listData.length > 0 && (
          <View style={{ marginTop: 20, paddingHorizontal: 16 }}>
            <View style={styles.stratHeader}>
              <Feather name="zap" size={15} color={C.primary} />
              <Text style={[styles.stratTitle, { color: C.text }]}>Melhores opções de compra</Text>
            </View>

            {/* S1 – Cheapest single store */}
            {strategies.cheapestStore && (
              <StrategyCard
                icon="tag"
                label="Mais barato em um mercado"
                storeNames={strategies.cheapestStore.storeName}
                total={strategies.cheapestStore.total}
                badge={strategies.cheapestStore.coverage < shoppingList.filter(i => i.eanCode).length ? `${strategies.cheapestStore.coverage} de ${shoppingList.filter(i => i.eanCode).length} itens` : undefined}
                distance={`${strategies.cheapestStore.distance}km`}
                accentColor={C.primary}
                C={C}
                isDark={isDark}
                onSearch={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push(`/store/${strategies.cheapestStore!.storeId}`); }}
              />
            )}

            {/* S2 – Cheapest mix */}
            {strategies.cheapestMix.total > 0 && (
              <StrategyCard
                icon="layers"
                label="Mais barato item a item"
                storeNames={strategies.cheapestMix.stores.join(", ")}
                total={strategies.cheapestMix.total}
                badge="Múltiplos mercados"
                accentColor="#1B5E20"
                C={C}
                isDark={isDark}
                onSearch={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/(tabs)/search"); }}
              />
            )}

            {/* S3 – Nearest store */}
            {strategies.nearestStore && (
              <StrategyCard
                icon="navigation"
                label="Mercado mais próximo"
                storeNames={strategies.nearestStore.storeName}
                total={strategies.nearestStore.total}
                distance={`${strategies.nearestStore.distance}km`}
                badge={strategies.nearestStore.coverage < shoppingList.filter(i => i.eanCode).length ? `${strategies.nearestStore.coverage} de ${shoppingList.filter(i => i.eanCode).length} itens` : undefined}
                accentColor="#0D47A1"
                C={C}
                isDark={isDark}
                onSearch={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push(`/store/${strategies.nearestStore!.storeId}`); }}
              />
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/* ─── sub-components ─── */

function ItemRow({ item, C, onToggle, onRemove }: { item: ShoppingItem; C: any; onToggle: () => void; onRemove: () => void }) {
  return (
    <Pressable
      style={[styles.item, { backgroundColor: C.surfaceElevated, borderColor: item.checked ? C.success : C.border, opacity: item.checked ? 0.65 : 1 }]}
      onPress={onToggle}
    >
      <View style={[styles.checkbox, { borderColor: item.checked ? C.success : C.border, backgroundColor: item.checked ? C.success : "transparent" }]}>
        {item.checked && <Feather name="check" size={12} color="#fff" />}
      </View>
      <View style={styles.itemInfo}>
        <Text style={[styles.itemName, { color: C.text, textDecorationLine: item.checked ? "line-through" : "none" }]} numberOfLines={1}>
          {item.productName}
        </Text>
        {item.eanCode ? <Text style={[styles.itemEan, { color: C.textMuted }]}>{item.eanCode}</Text> : null}
        {item.bestPrice != null && (
          <View style={styles.priceRow}>
            <Text style={[styles.itemPrice, { color: C.primary }]}>R$ {item.bestPrice.toFixed(2).replace(".", ",")}</Text>
            {item.bestStore ? <Text style={[styles.itemStore, { color: C.textMuted }]}>· {item.bestStore}</Text> : null}
          </View>
        )}
      </View>
      <Pressable onPress={onRemove} style={styles.removeBtn} hitSlop={8}>
        <Feather name="trash-2" size={15} color={C.textMuted} />
      </Pressable>
    </Pressable>
  );
}

function StrategyCard({ icon, label, storeNames, total, badge, distance, accentColor, C, isDark, onSearch }: any) {
  return (
    <View style={[styles.stratCard, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
      <View style={[styles.stratIconBox, { backgroundColor: accentColor + "18" }]}>
        <Feather name={icon} size={20} color={accentColor} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={[styles.stratCardLabel, { color: C.text }]}>{label}</Text>
        <Text style={[styles.stratCardStore, { color: C.textSecondary }]} numberOfLines={1}>{storeNames}</Text>
        <View style={styles.stratMeta}>
          {distance && (
            <View style={styles.metaChip}>
              <Feather name="map-pin" size={10} color={C.textMuted} />
              <Text style={[styles.metaChipTxt, { color: C.textMuted }]}>{distance}</Text>
            </View>
          )}
          {badge && (
            <View style={[styles.metaChip, { backgroundColor: accentColor + "18" }]}>
              <Text style={[styles.metaChipTxt, { color: accentColor }]}>{badge}</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.stratRight}>
        <Text style={[styles.stratTotal, { color: accentColor }]}>
          R$ {total.toFixed(2).replace(".", ",")}
        </Text>
        <Pressable style={[styles.searchBtn, { backgroundColor: accentColor }]} onPress={onSearch}>
          <Feather name="search" size={13} color="#fff" />
          <Text style={styles.searchBtnTxt}>Buscar</Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ─── styles ─── */

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  headerActions: { flexDirection: "row", gap: 8 },
  headerBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    paddingLeft: 12,
    paddingRight: 10,
    paddingVertical: 11,
    gap: 10,
    borderWidth: 1.5,
  },
  addInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  suggestions: {
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 4,
    overflow: "hidden",
  },
  suggestion: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, gap: 10 },
  suggIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  suggName: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  suggBrand: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  suggPrice: { alignItems: "flex-end" },
  suggPriceVal: { fontSize: 13, fontFamily: "Inter_700Bold" },
  suggStore: { fontSize: 10, fontFamily: "Inter_400Regular" },
  empty: { alignItems: "center", paddingTop: 60, paddingHorizontal: 40, gap: 10 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  item: { flexDirection: "row", alignItems: "center", borderRadius: 14, padding: 14, borderWidth: 1, gap: 12 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  itemEan: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 1 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  itemPrice: { fontSize: 13, fontFamily: "Inter_700Bold" },
  itemStore: { fontSize: 11, fontFamily: "Inter_400Regular" },
  removeBtn: { padding: 4 },
  stratHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  stratTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  stratCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    gap: 12,
    marginBottom: 10,
  },
  stratIconBox: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  stratCardLabel: { fontSize: 13, fontFamily: "Inter_700Bold" },
  stratCardStore: { fontSize: 12, fontFamily: "Inter_400Regular" },
  stratMeta: { flexDirection: "row", gap: 6, marginTop: 2, flexWrap: "wrap" },
  metaChip: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: "transparent" },
  metaChipTxt: { fontSize: 10, fontFamily: "Inter_500Medium" },
  stratRight: { alignItems: "flex-end", gap: 8 },
  stratTotal: { fontSize: 17, fontFamily: "Inter_700Bold" },
  searchBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9 },
  searchBtnTxt: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
});
