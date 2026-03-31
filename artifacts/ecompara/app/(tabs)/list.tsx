import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
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

type ShopStatus = "idle" | "shopping" | "finished";

type StrategyResult = {
  storeId: string;
  storeName: string;
  total: number;
  coverage: number;
  distance: number;
  breakdown: { name: string; price: number; storeName: string }[];
};

type Strategies = {
  bestCoverageStore: (StrategyResult & { isComplete: boolean; totalItems: number }) | null;
  cheapestStore: StrategyResult | null;
  cheapestMix: {
    total: number;
    stores: string[];
    breakdown: { name: string; price: number; storeName: string }[];
  };
  nearestStore: StrategyResult | null;
  noMatchItems: ShoppingItem[];
};

function calcStrategies(items: ShoppingItem[], products: Product[], stores: Store[]): Strategies | null {
  const withEan = items.filter((i) => i.eanCode);
  if (withEan.length === 0) return null;

  // Items with no price in any store
  const noMatchItems = withEan.filter((item) => {
    const prod = products.find((p) => p.ean === item.eanCode);
    return !prod || prod.prices.length === 0;
  });

  // Only items that have prices somewhere
  const pricedItems = withEan.filter((item) => {
    const prod = products.find((p) => p.ean === item.eanCode);
    return prod && prod.prices.length > 0;
  });

  if (pricedItems.length === 0) return { bestCoverageStore: null, cheapestStore: null, cheapestMix: { total: 0, stores: [], breakdown: [] }, nearestStore: null, noMatchItems };

  const storeMap: Record<string, { storeName: string; distance: number; total: number; coverage: number; breakdown: { name: string; price: number; storeName: string }[] }> = {};
  pricedItems.forEach((item) => {
    const prod = products.find((p) => p.ean === item.eanCode);
    if (!prod) return;
    prod.prices.forEach((pr) => {
      if (!storeMap[pr.storeId]) {
        const s = stores.find((s) => s.id === pr.storeId);
        storeMap[pr.storeId] = { storeName: pr.storeName, distance: s?.distance ?? pr.distance, total: 0, coverage: 0, breakdown: [] };
      }
      storeMap[pr.storeId].total += pr.price * item.quantity;
      storeMap[pr.storeId].coverage += 1;
      storeMap[pr.storeId].breakdown.push({ name: item.productName, price: pr.price, storeName: pr.storeName });
    });
  });

  const storeResults: StrategyResult[] = Object.entries(storeMap).map(([storeId, v]) => ({ storeId, ...v }));

  // Best coverage store: most items first, then cheapest as tiebreak
  const sortedByCoverage = [...storeResults].sort((a, b) => b.coverage - a.coverage || a.total - b.total);
  const topStore = sortedByCoverage[0] ?? null;
  const bestCoverageStore = topStore
    ? { ...topStore, isComplete: topStore.coverage === pricedItems.length, totalItems: pricedItems.length }
    : null;

  const fullCoverage = storeResults.filter((s) => s.coverage === pricedItems.length);
  const s1Pool = fullCoverage.length ? fullCoverage : storeResults;
  const cheapestStore = s1Pool.reduce<StrategyResult | null>((best, s) => (!best || s.total < best.total ? s : best), null);

  let mixTotal = 0;
  const mixBreakdown: { name: string; price: number; storeName: string }[] = [];
  const mixStoreSet = new Set<string>();
  pricedItems.forEach((item) => {
    const prod = products.find((p) => p.ean === item.eanCode);
    if (!prod || !prod.prices.length) return;
    const cheapest = prod.prices.reduce((a, b) => (b.price < a.price ? b : a));
    mixTotal += cheapest.price * item.quantity;
    mixBreakdown.push({ name: item.productName, price: cheapest.price, storeName: cheapest.storeName });
    mixStoreSet.add(cheapest.storeName);
  });

  const nearestStore = storeResults.reduce<StrategyResult | null>((near, s) => (!near || s.distance < near.distance ? s : near), null);
  return { bestCoverageStore, cheapestStore, cheapestMix: { total: mixTotal, stores: [...mixStoreSet], breakdown: mixBreakdown }, nearestStore, noMatchItems };
}

function findSimilarProducts(item: ShoppingItem, allProducts: Product[]): Product[] {
  const itemProduct = allProducts.find((p) => p.ean === item.eanCode);
  if (!itemProduct) return [];
  const nameWords = itemProduct.name.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  const scored = allProducts
    .filter((p) => p.ean !== item.eanCode && p.prices.length > 0)
    .map((p) => {
      let score = 0;
      if (p.category === itemProduct.category) score += 3;
      const pWords = p.name.toLowerCase().split(/\s+/);
      nameWords.forEach((w) => { if (pWords.some((pw) => pw.includes(w) || w.includes(pw))) score += 1; });
      return { product: p, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ product }) => product);
  return scored.slice(0, 3);
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/* ─────────────────── component ──────────────────── */

export default function ShoppingListScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const C = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const {
    shoppingList, toggleShoppingItem, removeFromShoppingList, clearShoppingList,
    addToShoppingList, searchProducts, searchProductsAsync, products, stores,
    finalizeShoppingList, updateShoppingItemQuantity,
  } = useApp();

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const inputRef = useRef<TextInput>(null);

  /* — shopping state machine — */
  const [shopStatus, setShopStatus] = useState<ShopStatus>("idle");
  const [activeStore, setActiveStore] = useState<Store | null>(null);
  const [shopStartTime, setShopStartTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showStoreSheet, setShowStoreSheet] = useState(false);
  const [showScanSheet, setShowScanSheet] = useState(false);
  const [completionResult, setCompletionResult] = useState<{ points: number; status: "full" | "partial" | "fraud" } | null>(null);

  /* — geolocation auto-detection — */
  const [nearbyStore, setNearbyStore] = useState<Store | null>(null);
  const [showNearbyConfirm, setShowNearbyConfirm] = useState(false);
  const geoCheckedRef = useRef(false);

  /* — nudge after 5 min — */
  const [showNudge, setShowNudge] = useState(false);

  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 84 : (insets.bottom ? insets.bottom + 60 : 80);

  /* timer when shopping */
  useEffect(() => {
    if (shopStatus !== "shopping" || shopStartTime === null) return;
    const interval = setInterval(() => {
      const secs = Math.floor((Date.now() - shopStartTime) / 1000);
      setElapsedSeconds(secs);
      if (secs >= 300 && !showNudge) setShowNudge(true);
    }, 1000);
    return () => clearInterval(interval);
  }, [shopStatus, shopStartTime, showNudge]);

  /* auto-detect nearby store on mount when list has items */
  useEffect(() => {
    if (shopStatus !== "idle" || shoppingList.length === 0 || geoCheckedRef.current || stores.length === 0) return;
    geoCheckedRef.current = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        // Use the pre-computed distance from the stores list to find nearest within 25m (0.025km)
        const nearby = stores.reduce<Store | null>((best, s) => {
          if (s.distance <= 0.025) return !best || s.distance < best.distance ? s : best;
          return best;
        }, null);
        if (nearby) {
          setNearbyStore(nearby);
          setShowNearbyConfirm(true);
        }
      } catch {
        // silent — permissions denied or unavailable
      }
    })();
  }, [shopStatus, shoppingList.length, stores]);

  const checked = shoppingList.filter((i) => i.checked);
  const unchecked = shoppingList.filter((i) => !i.checked);

  useEffect(() => {
    if (!query.trim()) { setSuggestions([]); return; }
    setSuggestions(searchProducts(query).slice(0, 5));
    let cancelled = false;
    const timer = setTimeout(async () => {
      const asyncResults = await searchProductsAsync(query);
      if (!cancelled) setSuggestions(asyncResults.slice(0, 5));
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query]);

  const strategies = useMemo(() => calcStrategies(shoppingList, products, stores), [shoppingList, products, stores]);

  const handleSelectSuggestion = (prod: Product) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const cheapestPrice = prod.prices.length ? prod.prices.reduce((a, b) => (b.price < a.price ? b : a)) : null;
    addToShoppingList({ eanCode: prod.ean, productName: prod.name, quantity: 1, checked: false, bestPrice: cheapestPrice?.price, bestStore: cheapestPrice?.storeName });
    setQuery("");
    inputRef.current?.focus();
  };

  const handleClear = () => {
    Alert.alert("Limpar lista?", "Todos os itens serão removidos.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Limpar", style: "destructive", onPress: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); clearShoppingList(); setShopStatus("idle"); setActiveStore(null); setShopStartTime(null); setElapsedSeconds(0); } },
    ]);
  };

  const handleStartShopping = (store: Store) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setActiveStore(store);
    const now = Date.now();
    setShopStartTime(now);
    setElapsedSeconds(0);
    setShopStatus("shopping");
    setShowStoreSheet(false);
  };

  const handleFinalize = () => {
    if (!activeStore) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const result = finalizeShoppingList(
      activeStore.id, activeStore.name, activeStore.plan === "plus",
      elapsedSeconds, shoppingList.length, checked.length
    );
    setCompletionResult(result);
    setShopStatus("finished");
  };

  const handleResetShop = () => {
    setShopStatus("idle");
    setActiveStore(null);
    setShopStartTime(null);
    setElapsedSeconds(0);
    setCompletionResult(null);
    setShowNudge(false);
    geoCheckedRef.current = false;
  };

  const listData = [...unchecked, ...checked];

  const progressPct = shoppingList.length === 0 ? 0 : Math.round((checked.length / shoppingList.length) * 100);

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
            style={[styles.scanBtn, { backgroundColor: C.primary }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowScanSheet(true); }}
          >
            <MaterialCommunityIcons name="barcode-scan" size={16} color="#fff" />
            <Text style={styles.scanBtnTxt}>Escanear</Text>
          </Pressable>
          {shoppingList.length > 0 && (
            <Pressable style={[styles.headerBtn, { backgroundColor: C.backgroundSecondary }]} onPress={handleClear}>
              <Feather name="trash-2" size={18} color={C.textMuted} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Shopping banner */}
      {shopStatus === "shopping" && activeStore && (
        <LinearGradient colors={["#CC0000", "#E53935"]} style={styles.shoppingBanner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={styles.activeDot} />
              <Text style={styles.bannerLabel}>Em Compras</Text>
            </View>
            <Text style={styles.bannerStore} numberOfLines={1}>{activeStore.name}</Text>
          </View>
          <View style={{ alignItems: "flex-end", gap: 2 }}>
            <Text style={styles.bannerTimer}>{formatDuration(elapsedSeconds)}</Text>
            <View style={styles.progressRow}>
              <Text style={styles.bannerProgress}>{checked.length}/{shoppingList.length} itens</Text>
            </View>
          </View>
        </LinearGradient>
      )}

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

        {suggestions.length > 0 && (
          <View style={[styles.suggestions, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
            {suggestions.map((prod, idx) => {
              const cheapest = prod.prices.length ? prod.prices.reduce((a, b) => (b.price < a.price ? b : a)) : null;
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
                      <Text style={[styles.suggPriceVal, { color: C.primary }]}>R$ {cheapest.price.toFixed(2).replace(".", ",")}</Text>
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
        contentContainerStyle={{ paddingBottom: shopStatus === "shopping" ? bottomPad + 80 : bottomPad }}
        showsVerticalScrollIndicator={false}
      >
        {listData.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="shopping-cart" size={48} color={C.textMuted} />
            <Text style={[styles.emptyTitle, { color: C.text }]}>Lista vazia</Text>
            <Text style={[styles.emptySub, { color: C.textMuted }]}>Digite o nome de um produto acima para buscar e adicionar</Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16, gap: 8, paddingTop: 4 }}>
            {listData.map((item) => (
              <ItemRow key={item.id} item={item} C={C} onToggle={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggleShoppingItem(item.id); }} onRemove={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); removeFromShoppingList(item.id); }} onQuantityChange={(qty) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); updateShoppingItemQuantity(item.id, qty); }} />
            ))}
          </View>
        )}

        {/* Card informativo — início automático via geolocalização */}
        {shoppingList.length > 0 && shopStatus === "idle" && (
          <View style={{ paddingHorizontal: 16, marginTop: 20 }}>
            <View style={[styles.startCard, { backgroundColor: isDark ? "#2A0A0A" : "#FFF5F5", borderColor: "#CC000030" }]}>
              <View style={[styles.startCardIcon, { backgroundColor: "#CC000018" }]}>
                <MaterialCommunityIcons name="map-marker-check" size={22} color="#CC0000" />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={[styles.startCardTitle, { color: isDark ? "#fff" : "#1A0000" }]}>Iniciar Compras no Local</Text>
                  <View style={[styles.startBtnBadge, { backgroundColor: "#CC000018" }]}>
                    <Text style={[styles.startBtnBadgeTxt, { color: "#CC0000" }]}>+200 pts</Text>
                  </View>
                </View>
                <Text style={[styles.startCardSub, { color: C.textMuted }]}>
                  O timer inicia automaticamente ao detectar sua presença em um mercado
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Best store for list (shown first, always prominent) */}
        {strategies?.bestCoverageStore && listData.length > 0 && (
          <View style={{ marginTop: 20, paddingHorizontal: 16 }}>
            <View style={styles.stratHeader}>
              <MaterialCommunityIcons name="trophy-outline" size={16} color={strategies.bestCoverageStore.isComplete ? "#2E7D32" : "#E65100"} />
              <Text style={[styles.stratTitle, { color: C.text }]}>Melhor mercado para sua lista</Text>
            </View>
            <BestStoreCard store={strategies.bestCoverageStore} C={C} isDark={isDark}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push(`/store/${strategies.bestCoverageStore!.storeId}`); }} />
          </View>
        )}

        {/* No-match items with similar suggestions */}
        {strategies?.noMatchItems && strategies.noMatchItems.length > 0 && (
          <NoMatchSection noMatchItems={strategies.noMatchItems} products={products} C={C} isDark={isDark}
            onSwap={(oldItem, newProd) => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              const cheapest = newProd.prices.reduce((a, b) => (b.price < a.price ? b : a));
              removeFromShoppingList(oldItem.id);
              addToShoppingList({ eanCode: newProd.ean, productName: newProd.name, quantity: oldItem.quantity, checked: false, bestPrice: cheapest.price, bestStore: cheapest.storeName });
            }} />
        )}

        {/* 3 Strategies */}
        {strategies && listData.length > 0 && (strategies.cheapestStore || strategies.cheapestMix.total > 0 || strategies.nearestStore) && (
          <View style={{ marginTop: 16, paddingHorizontal: 16 }}>
            <View style={styles.stratHeader}>
              <Feather name="zap" size={15} color={C.primary} />
              <Text style={[styles.stratTitle, { color: C.text }]}>Outras opções de compra</Text>
            </View>
            {strategies.cheapestStore && (
              <StrategyCard icon="tag" label="Mais barato em um mercado" storeNames={strategies.cheapestStore.storeName} total={strategies.cheapestStore.total} badge={strategies.bestCoverageStore && strategies.cheapestStore.coverage < strategies.bestCoverageStore.totalItems ? `${strategies.cheapestStore.coverage} de ${strategies.bestCoverageStore.totalItems} itens` : undefined} distance={`${strategies.cheapestStore.distance}km`} accentColor={C.primary} C={C} isDark={isDark} onSearch={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push(`/store/${strategies.cheapestStore!.storeId}`); }} />
            )}
            {strategies.cheapestMix.total > 0 && (
              <StrategyCard icon="layers" label="Mais barato item a item" storeNames={strategies.cheapestMix.stores.join(", ")} total={strategies.cheapestMix.total} badge="Múltiplos mercados" accentColor="#1B5E20" C={C} isDark={isDark} onSearch={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/(tabs)/search"); }} />
            )}
            {strategies.nearestStore && (
              <StrategyCard icon="navigation" label="Mercado mais próximo" storeNames={strategies.nearestStore.storeName} total={strategies.nearestStore.total} distance={`${strategies.nearestStore.distance}km`} badge={strategies.bestCoverageStore && strategies.nearestStore.coverage < strategies.bestCoverageStore.totalItems ? `${strategies.nearestStore.coverage} de ${strategies.bestCoverageStore.totalItems} itens` : undefined} accentColor="#0D47A1" C={C} isDark={isDark} onSearch={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push(`/store/${strategies.nearestStore!.storeId}`); }} />
            )}
          </View>
        )}
      </ScrollView>

      {/* Barra de finalização — inclui nudge de cupom após 5 min */}
      {shopStatus === "shopping" && (
        <View style={[styles.finalizeBar, { paddingBottom: insets.bottom + 8, flexDirection: "column", gap: 0 }]}>
          {/* Nudge integrado — aparece após 5 min */}
          {showNudge && (
            <Pressable
              style={styles.nudgeInBar}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowNudge(false); router.push("/nfce-scanner"); }}
            >
              <MaterialCommunityIcons name="receipt" size={15} color="#E65100" />
              <Text style={styles.nudgeInBarText}>Enviar cupom fiscal para receber seus pontos</Text>
              <Feather name="arrow-right" size={13} color="#E65100" />
              <Pressable onPress={(e) => { e.stopPropagation?.(); setShowNudge(false); }} hitSlop={10} style={{ padding: 2 }}>
                <Feather name="x" size={13} color="#E65100" />
              </Pressable>
            </Pressable>
          )}
          {/* Linha de progresso + botão */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingTop: showNudge ? 10 : 0 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.finalizeHint}>Tempo mínimo para +200 pts: 5 min</Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.min(100, (elapsedSeconds / 300) * 100)}%` }]} />
              </View>
            </View>
            <Pressable
              style={[styles.finalizeBtn, { opacity: elapsedSeconds < 10 ? 0.6 : 1 }]}
              onPress={handleFinalize}
            >
              <Feather name="check-circle" size={18} color="#fff" />
              <Text style={styles.finalizeBtnTxt}>Finalizar</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Store Picker Sheet */}
      <Modal visible={showStoreSheet} transparent animationType="slide" onRequestClose={() => setShowStoreSheet(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setShowStoreSheet(false)} />
        <View style={[styles.sheet, { backgroundColor: C.backgroundSecondary, paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.sheetHandle} />
          <Text style={[styles.sheetTitle, { color: C.text }]}>Onde você está?</Text>
          <Text style={[styles.sheetSub, { color: C.textMuted }]}>Selecione o mercado para validar sua presença</Text>
          <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
            {stores.map((store) => (
              <Pressable
                key={store.id}
                style={[styles.storeRow, { borderBottomColor: C.border }]}
                onPress={() => handleStartShopping(store)}
              >
                <View style={[styles.storeIcon, { backgroundColor: store.plan === "plus" ? "#CC000015" : C.backgroundTertiary }]}>
                  <MaterialCommunityIcons name="store" size={20} color={store.plan === "plus" ? "#CC0000" : C.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={[styles.storeName, { color: C.text }]}>{store.name}</Text>
                    {store.plan === "plus" && <View style={styles.partnerBadge}><Text style={styles.partnerBadgeTxt}>PARCEIRO</Text></View>}
                  </View>
                  <Text style={[styles.storeAddr, { color: C.textMuted }]}>{store.distance}km · {store.address}</Text>
                </View>
                {store.plan === "plus" && (
                  <View style={styles.bonusBadge}>
                    <Text style={styles.bonusTxt}>+100 pts</Text>
                  </View>
                )}
                <Feather name="chevron-right" size={16} color={C.textMuted} />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Scan Picker Sheet */}
      <Modal visible={showScanSheet} transparent animationType="slide" onRequestClose={() => setShowScanSheet(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setShowScanSheet(false)} />
        <View style={[styles.sheet, { backgroundColor: C.backgroundSecondary, paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.sheetHandle} />
          <Text style={[styles.sheetTitle, { color: C.text }]}>O que deseja escanear?</Text>
          <Text style={[styles.sheetSub, { color: C.textMuted }]}>Escolha a opção correta para cada situação</Text>

          <View style={styles.scanOptions}>
            {/* Produto */}
            <Pressable
              style={[styles.scanOption, { backgroundColor: isDark ? C.backgroundTertiary : "#F8F8F8", borderColor: isDark ? C.border : "#E5E5E5" }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setShowScanSheet(false);
                router.push("/scanner");
              }}
            >
              <View style={[styles.scanOptionIcon, { backgroundColor: "#CC000018" }]}>
                <MaterialCommunityIcons name="barcode-scan" size={28} color="#CC0000" />
              </View>
              <View style={styles.scanOptionBody}>
                <View style={styles.scanOptionWhen}>
                  <Feather name="shopping-cart" size={10} color="#CC0000" />
                  <Text style={[styles.scanOptionWhenTxt, { color: "#CC0000" }]}>ANTES das compras</Text>
                </View>
                <Text style={[styles.scanOptionTitle, { color: C.text }]}>Produto</Text>
                <Text style={[styles.scanOptionDesc, { color: C.textMuted }]}>Escaneie o código de barras para buscar preços e adicionar à sua lista</Text>
              </View>
              <Feather name="chevron-right" size={18} color={C.textMuted} style={{ marginTop: 4 }} />
            </Pressable>

            {/* Cupom Fiscal */}
            <Pressable
              style={[styles.scanOption, { backgroundColor: isDark ? C.backgroundTertiary : "#F8F8F8", borderColor: isDark ? C.border : "#E5E5E5" }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setShowScanSheet(false);
                router.push("/nfce-scanner");
              }}
            >
              <View style={[styles.scanOptionIcon, { backgroundColor: "#1B5E2018" }]}>
                <MaterialCommunityIcons name="receipt-text-outline" size={28} color="#1B5E20" />
              </View>
              <View style={styles.scanOptionBody}>
                <View style={styles.scanOptionWhen}>
                  <Feather name="check-circle" size={10} color="#1B5E20" />
                  <Text style={[styles.scanOptionWhenTxt, { color: "#1B5E20" }]}>APÓS as compras</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={[styles.scanOptionTitle, { color: C.text }]}>Cupom Fiscal (NF-e)</Text>
                  <View style={styles.ptsBadge}>
                    <Text style={styles.ptsBadgeTxt}>+150 pts</Text>
                  </View>
                </View>
                <Text style={[styles.scanOptionDesc, { color: C.textMuted }]}>Escaneie o QR Code da nota fiscal e ganhe pontos automaticamente</Text>
              </View>
              <Feather name="chevron-right" size={18} color={C.textMuted} style={{ marginTop: 4 }} />
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Modal — Supermercado próximo detectado */}
      <Modal visible={showNearbyConfirm} transparent animationType="fade" onRequestClose={() => setShowNearbyConfirm(false)}>
        <View style={styles.resultBackdrop}>
          <View style={[styles.resultCard, { backgroundColor: C.backgroundSecondary }]}>
            <View style={[styles.resultIcon, { backgroundColor: "#CC000015" }]}>
              <MaterialCommunityIcons name="map-marker-radius" size={32} color="#CC0000" />
            </View>
            <Text style={[styles.resultTitle, { color: C.text }]}>Você está em um mercado!</Text>
            <Text style={[styles.resultSub, { color: C.textMuted }]}>
              Detectamos que você está próximo de{"\n"}
              <Text style={{ fontFamily: "Inter_700Bold", color: C.text }}>{nearbyStore?.name}</Text>
              {"\n"}Deseja iniciar o timer de compras?
            </Text>
            <View style={{ flexDirection: "row", gap: 10, width: "100%" }}>
              <Pressable
                style={[styles.resultBtn, { backgroundColor: C.backgroundTertiary, flex: 1 }]}
                onPress={() => { setShowNearbyConfirm(false); setShowStoreSheet(true); }}
              >
                <Text style={[styles.resultBtnTxt, { color: C.text }]}>Outro mercado</Text>
              </Pressable>
              <Pressable
                style={[styles.resultBtn, { backgroundColor: "#CC0000", flex: 1 }]}
                onPress={() => { setShowNearbyConfirm(false); if (nearbyStore) handleStartShopping(nearbyStore); }}
              >
                <Text style={[styles.resultBtnTxt, { color: "#fff" }]}>Confirmar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Completion Result Modal */}
      <Modal visible={completionResult !== null} transparent animationType="fade" onRequestClose={handleResetShop}>
        <View style={styles.resultBackdrop}>
          <View style={[styles.resultCard, { backgroundColor: C.backgroundSecondary }]}>
            {completionResult?.status === "fraud" ? (
              <>
                <View style={[styles.resultIcon, { backgroundColor: "#F59E0B20" }]}>
                  <Feather name="alert-triangle" size={32} color="#F59E0B" />
                </View>
                <Text style={[styles.resultTitle, { color: C.text }]}>Validação suspeita</Text>
                <Text style={[styles.resultSub, { color: C.textMuted }]}>Lista muito rápida para o número de itens. Pontuação reduzida para prevenir fraudes.</Text>
              </>
            ) : completionResult?.status === "partial" ? (
              <>
                <View style={[styles.resultIcon, { backgroundColor: "#0D47A120" }]}>
                  <Feather name="clock" size={32} color="#0D47A1" />
                </View>
                <Text style={[styles.resultTitle, { color: C.text }]}>Compras concluídas!</Text>
                <Text style={[styles.resultSub, { color: C.textMuted }]}>Fique ao menos 5 minutos no mercado para ganhar a pontuação completa (+200 pts).</Text>
              </>
            ) : (
              <>
                <View style={[styles.resultIcon, { backgroundColor: "#CC000015" }]}>
                  <MaterialCommunityIcons name="trophy" size={32} color="#CC0000" />
                </View>
                <Text style={[styles.resultTitle, { color: C.text }]}>Compras validadas!</Text>
                <Text style={[styles.resultSub, { color: C.textMuted }]}>
                  Presença confirmada em {activeStore?.name}.{activeStore?.plan === "plus" ? "\nBônus de loja parceira incluído!" : ""}
                </Text>
              </>
            )}
            <View style={[styles.resultPts, { backgroundColor: "#CC000010", borderColor: "#CC000030" }]}>
              <Text style={[styles.resultPtsVal, { color: "#CC0000" }]}>+{completionResult?.points} pts</Text>
              <Text style={[styles.resultPtsLabel, { color: C.textMuted }]}>adicionados ao seu saldo</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable style={[styles.resultBtn, { backgroundColor: C.backgroundTertiary, flex: 1 }]} onPress={handleResetShop}>
                <Text style={[styles.resultBtnTxt, { color: C.text }]}>Fechar</Text>
              </Pressable>
              <Pressable style={[styles.resultBtn, { backgroundColor: "#CC0000", flex: 1 }]} onPress={() => { handleResetShop(); clearShoppingList(); }}>
                <Text style={[styles.resultBtnTxt, { color: "#fff" }]}>Nova lista</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ─── sub-components ─── */

type ThemeColors = typeof Colors.light;

function ItemRow({ item, C, onToggle, onRemove, onQuantityChange }: {
  item: ShoppingItem;
  C: ThemeColors;
  onToggle: () => void;
  onRemove: () => void;
  onQuantityChange: (qty: number) => void;
}) {
  const [qtyInput, setQtyInput] = useState(String(item.quantity));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setQtyInput(String(item.quantity));
  }, [item.quantity, editing]);

  const commitQty = () => {
    setEditing(false);
    const parsed = parseInt(qtyInput, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed !== item.quantity) {
      onQuantityChange(parsed);
    } else {
      setQtyInput(String(item.quantity));
    }
  };

  const handleDecrement = (e: any) => {
    e.stopPropagation?.();
    const next = item.quantity - 1;
    if (next < 1) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQtyInput(String(next));
    onQuantityChange(next);
  };

  const handleIncrement = (e: any) => {
    e.stopPropagation?.();
    const next = item.quantity + 1;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQtyInput(String(next));
    onQuantityChange(next);
  };

  const total = item.bestPrice != null ? item.bestPrice * item.quantity : null;

  return (
    <Pressable
      style={[styles.item, { backgroundColor: C.surfaceElevated, borderColor: item.checked ? C.success : C.border, opacity: item.checked ? 0.65 : 1 }]}
      onPress={onToggle}
    >
      <View style={[styles.checkbox, { borderColor: item.checked ? C.success : C.border, backgroundColor: item.checked ? C.success : "transparent" }]}>
        {item.checked && <Feather name="check" size={12} color="#fff" />}
      </View>
      <View style={styles.itemInfo}>
        <Text style={[styles.itemName, { color: C.text, textDecorationLine: item.checked ? "line-through" : "none" }]} numberOfLines={1}>{item.productName}</Text>
        {item.eanCode ? <Text style={[styles.itemEan, { color: C.textMuted }]}>{item.eanCode}</Text> : null}
        {item.bestPrice != null && (
          <View style={styles.priceRow}>
            <Text style={[styles.itemPrice, { color: C.primary }]}>R$ {item.bestPrice.toFixed(2).replace(".", ",")}</Text>
            {item.bestStore ? <Text style={[styles.itemStore, { color: C.textMuted }]}>· {item.bestStore}</Text> : null}
          </View>
        )}
        {total != null && item.quantity > 1 && (
          <Text style={[styles.itemTotal, { color: C.textSecondary }]}>
            Total: R$ {total.toFixed(2).replace(".", ",")}
          </Text>
        )}
      </View>
      <View style={styles.itemActions}>
        <View style={[styles.qtyRow, { backgroundColor: C.backgroundSecondary, borderColor: editing ? C.primary : C.border }]}>
          <Pressable onPress={handleDecrement} style={styles.qtyBtn} hitSlop={6}>
            <Feather name="minus" size={13} color={item.quantity <= 1 ? C.textMuted : C.primary} />
          </Pressable>
          <TextInput
            style={[styles.qtyInput, { color: C.text }]}
            value={qtyInput}
            onChangeText={(v) => { setEditing(true); setQtyInput(v.replace(/[^0-9]/g, "")); }}
            onFocus={() => { setEditing(true); }}
            onBlur={commitQty}
            onSubmitEditing={commitQty}
            keyboardType="number-pad"
            selectTextOnFocus
            maxLength={3}
            returnKeyType="done"
          />
          <Pressable onPress={handleIncrement} style={styles.qtyBtn} hitSlop={6}>
            <Feather name="plus" size={13} color={C.primary} />
          </Pressable>
        </View>
        <Pressable onPress={onRemove} style={styles.removeBtn} hitSlop={8}>
          <Feather name="trash-2" size={14} color={C.textMuted} />
        </Pressable>
      </View>
    </Pressable>
  );
}

/* ─── BestStoreCard ─── */

function BestStoreCard({
  store, C, isDark, onPress,
}: {
  store: StrategyResult & { isComplete: boolean; totalItems: number };
  C: ThemeColors;
  isDark: boolean;
  onPress: () => void;
}) {
  const green = "#2E7D32";
  const orange = "#E65100";
  const accentColor = store.isComplete ? green : orange;
  return (
    <Pressable
      style={[styles.bestCard, { backgroundColor: accentColor + "12", borderColor: accentColor + "40" }]}
      onPress={onPress}
    >
      <View style={[styles.bestIconBox, { backgroundColor: accentColor + "20" }]}>
        <MaterialCommunityIcons name={store.isComplete ? "check-all" : "store-check-outline"} size={26} color={accentColor} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={[styles.bestStoreName, { color: C.text }]} numberOfLines={1}>{store.storeName}</Text>
        <View style={styles.bestMeta}>
          <View style={[styles.bestBadge, { backgroundColor: accentColor }]}>
            <MaterialCommunityIcons name={store.isComplete ? "check-circle-outline" : "numeric"} size={11} color="#fff" />
            <Text style={styles.bestBadgeTxt}>
              {store.isComplete ? `Tem todos os ${store.totalItems} itens!` : `${store.coverage} de ${store.totalItems} itens`}
            </Text>
          </View>
          {store.distance > 0 && (
            <View style={styles.bestDistChip}>
              <Feather name="map-pin" size={10} color={C.textMuted} />
              <Text style={[styles.bestDistTxt, { color: C.textMuted }]}>{store.distance}km</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.bestRight}>
        <Text style={[styles.bestTotal, { color: accentColor }]}>R$ {store.total.toFixed(2).replace(".", ",")}</Text>
        <Pressable style={[styles.bestBtn, { backgroundColor: accentColor }]} onPress={onPress}>
          <Feather name="arrow-right" size={13} color="#fff" />
          <Text style={styles.bestBtnTxt}>Ver</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

/* ─── NoMatchSection ─── */

function NoMatchSection({
  noMatchItems, products, C, isDark, onSwap,
}: {
  noMatchItems: ShoppingItem[];
  products: Product[];
  C: ThemeColors;
  isDark: boolean;
  onSwap: (oldItem: ShoppingItem, newProd: Product) => void;
}) {
  return (
    <View style={{ marginTop: 20, paddingHorizontal: 16 }}>
      <View style={styles.stratHeader}>
        <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#E65100" />
        <Text style={[styles.stratTitle, { color: C.text }]}>Sem preço disponível</Text>
      </View>
      {noMatchItems.map((item) => {
        const similares = findSimilarProducts(item, products);
        return (
          <View key={item.id} style={[styles.noMatchCard, { backgroundColor: isDark ? "#1A1A1A" : "#FFF8F5", borderColor: "#E6510030" }]}>
            <View style={styles.noMatchHeader}>
              <MaterialCommunityIcons name="package-variant-remove" size={16} color="#E65100" />
              <Text style={[styles.noMatchName, { color: C.text }]} numberOfLines={1}>{item.productName}</Text>
              <View style={[styles.noMatchBadge]}>
                <Text style={styles.noMatchBadgeTxt}>Sem preço</Text>
              </View>
            </View>
            {similares.length > 0 && (
              <>
                <Text style={[styles.similarLabel, { color: C.textMuted }]}>Produtos similares disponíveis:</Text>
                {similares.map((prod) => {
                  const cheapest = prod.prices.reduce((a, b) => (b.price < a.price ? b : a));
                  return (
                    <Pressable
                      key={prod.ean}
                      style={[styles.similarRow, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}
                      onPress={() => onSwap(item, prod)}
                    >
                      <View style={[styles.similarIcon, { backgroundColor: "#1565C018" }]}>
                        <Feather name="box" size={13} color="#1565C0" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.similarName, { color: C.text }]} numberOfLines={1}>{prod.name}</Text>
                        <Text style={[styles.similarBrand, { color: C.textMuted }]}>{prod.brand} · {cheapest.storeName}</Text>
                      </View>
                      <Text style={[styles.similarPrice, { color: "#1565C0" }]}>R$ {cheapest.price.toFixed(2).replace(".", ",")}</Text>
                      <View style={styles.swapBtn}>
                        <Feather name="refresh-cw" size={11} color="#fff" />
                        <Text style={styles.swapBtnTxt}>Trocar</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </>
            )}
            {similares.length === 0 && (
              <Text style={[styles.similarLabel, { color: C.textMuted }]}>Nenhum similar encontrado no catálogo.</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

type StrategyCardProps = {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  storeNames: string;
  total: number;
  badge?: string;
  distance?: string;
  accentColor: string;
  C: ThemeColors;
  isDark: boolean;
  onSearch: () => void;
};

function StrategyCard({ icon, label, storeNames, total, badge, distance, accentColor, C, isDark, onSearch }: StrategyCardProps) {
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
        <Text style={[styles.stratTotal, { color: accentColor }]}>R$ {total.toFixed(2).replace(".", ",")}</Text>
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
  headerActions: { flexDirection: "row", gap: 8, alignItems: "center" },
  headerBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  scanBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12 },
  scanBtnTxt: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },
  /* scan picker sheet */
  scanOptions: { gap: 10, marginTop: 4 },
  scanOption: { flexDirection: "row", alignItems: "flex-start", gap: 14, borderRadius: 18, padding: 16, borderWidth: 1.5 },
  scanOptionIcon: { width: 54, height: 54, borderRadius: 16, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  scanOptionBody: { flex: 1, gap: 3 },
  scanOptionWhen: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 1 },
  scanOptionWhenTxt: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  scanOptionTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  scanOptionDesc: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17, marginTop: 1 },
  ptsBadge: { backgroundColor: "#1B5E2018", borderRadius: 7, paddingHorizontal: 7, paddingVertical: 2 },
  ptsBadgeTxt: { color: "#1B5E20", fontSize: 10, fontFamily: "Inter_700Bold" },
  addRow: { flexDirection: "row", alignItems: "center", borderRadius: 14, paddingLeft: 12, paddingRight: 10, paddingVertical: 11, gap: 10, borderWidth: 1.5 },
  addInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  suggestions: { borderRadius: 14, borderWidth: 1, marginTop: 4, overflow: "hidden" },
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
  itemTotal: { fontSize: 11, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  itemActions: { alignItems: "center", gap: 6 },
  qtyRow: { flexDirection: "row", alignItems: "center", borderRadius: 9, borderWidth: 1, overflow: "hidden" },
  qtyBtn: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  qtyNum: { width: 28, textAlign: "center", fontSize: 13, fontFamily: "Inter_700Bold" },
  qtyInput: { width: 32, textAlign: "center", fontSize: 13, fontFamily: "Inter_700Bold", padding: 0 },
  removeBtn: { padding: 4 },
  nudgeInBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#2A1A00",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#E6510040",
  },
  nudgeInBarText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#E65100",
  },
  /* shopping */
  shoppingBanner: { marginHorizontal: 16, marginBottom: 10, borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center" },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff", opacity: 0.9 },
  bannerLabel: { color: "rgba(255,255,255,0.85)", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  bannerStore: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold", marginTop: 2, maxWidth: 200 },
  bannerTimer: { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold" },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  bannerProgress: { color: "rgba(255,255,255,0.8)", fontSize: 11, fontFamily: "Inter_500Medium" },
  /* start btn */
  startCard: { flexDirection: "row", alignItems: "flex-start", gap: 12, borderRadius: 16, padding: 14, borderWidth: 1 },
  startCardIcon: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  startCardTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  startCardSub: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  startBtnBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  startBtnBadgeTxt: { fontSize: 11, fontFamily: "Inter_700Bold" },
  /* finalize bar */
  finalizeBar: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#1A1A1A", paddingHorizontal: 16, paddingTop: 12, gap: 0 },
  finalizeHint: { color: "rgba(255,255,255,0.6)", fontSize: 10, fontFamily: "Inter_400Regular", marginBottom: 5 },
  progressTrack: { height: 4, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 2, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#CC0000", borderRadius: 2 },
  finalizeBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#CC0000", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14 },
  finalizeBtnTxt: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  /* store sheet */
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingHorizontal: 16 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#ccc", alignSelf: "center", marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 4 },
  sheetSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 16 },
  storeRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, gap: 12 },
  storeIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  storeName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  storeAddr: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  partnerBadge: { backgroundColor: "#CC000015", borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 },
  partnerBadgeTxt: { color: "#CC0000", fontSize: 9, fontFamily: "Inter_700Bold" },
  bonusBadge: { backgroundColor: "#F59E0B20", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  bonusTxt: { color: "#F59E0B", fontSize: 11, fontFamily: "Inter_700Bold" },
  /* result modal */
  resultBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 24 },
  resultCard: { width: "100%", borderRadius: 24, padding: 24, alignItems: "center", gap: 16 },
  resultIcon: { width: 72, height: 72, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  resultTitle: { fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "center" },
  resultSub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  resultPts: { borderRadius: 16, paddingHorizontal: 24, paddingVertical: 12, alignItems: "center", borderWidth: 1, width: "100%" },
  resultPtsVal: { fontSize: 32, fontFamily: "Inter_700Bold" },
  resultPtsLabel: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  resultBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 13, borderRadius: 14 },
  resultBtnTxt: { fontSize: 14, fontFamily: "Inter_700Bold" },
  /* best store card */
  bestCard: { flexDirection: "row", alignItems: "center", borderRadius: 18, padding: 16, borderWidth: 1.5, gap: 12, marginBottom: 4 },
  bestIconBox: { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  bestStoreName: { fontSize: 15, fontFamily: "Inter_700Bold" },
  bestMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3, flexWrap: "wrap" },
  bestBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  bestBadgeTxt: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" },
  bestDistChip: { flexDirection: "row", alignItems: "center", gap: 3 },
  bestDistTxt: { fontSize: 11, fontFamily: "Inter_400Regular" },
  bestRight: { alignItems: "flex-end", gap: 8 },
  bestTotal: { fontSize: 18, fontFamily: "Inter_700Bold" },
  bestBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9 },
  bestBtnTxt: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  /* no match section */
  noMatchCard: { borderRadius: 16, padding: 14, borderWidth: 1, marginBottom: 10, gap: 10 },
  noMatchHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  noMatchName: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  noMatchBadge: { backgroundColor: "#E6510020", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  noMatchBadgeTxt: { color: "#E65100", fontSize: 10, fontFamily: "Inter_700Bold" },
  similarLabel: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 4 },
  similarRow: { flexDirection: "row", alignItems: "center", borderRadius: 12, padding: 10, borderWidth: 1, gap: 10 },
  similarIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  similarName: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  similarBrand: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  similarPrice: { fontSize: 13, fontFamily: "Inter_700Bold" },
  swapBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#1565C0", paddingHorizontal: 9, paddingVertical: 6, borderRadius: 8 },
  swapBtnTxt: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" },
  /* strategies */
  stratHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  stratTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  stratCard: { flexDirection: "row", alignItems: "center", borderRadius: 16, padding: 14, borderWidth: 1, gap: 12, marginBottom: 10 },
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
