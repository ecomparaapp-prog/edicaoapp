import { Feather, Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import {
  Alert,
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  View,
  useColorScheme,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { useApp, type Product } from "@/context/AppContext";
import { useRequireAuth } from "@/hooks/useRequireAuth";

const FAVORITES_KEY = "@ecompara_favorite_stores";
const SHADOW_DISMISSED_KEY = "@ecompara_shadow_dismissed_";

type SectionData = { title: string; data: (Product & { storePrice: number })[] };

function getApiBase(): string {
  if (Platform.OS === "web") return "/api";
  const Constants = require("expo-constants").default;
  const domain = Constants.expoConfig?.extra?.domain ?? process.env.EXPO_PUBLIC_DOMAIN ?? "";
  if (domain) return `https://${domain}/api`;
  return "http://localhost:80/api";
}

function MaterialIcon({ name, color, size = 15 }: { name: string; color: string; size?: number }) {
  const { MaterialCommunityIcons } = require("@expo/vector-icons");
  return <MaterialCommunityIcons name={name} size={size} color={color} />;
}

export default function StoreScreen() {
  const params = useLocalSearchParams<{
    id: string;
    name?: string;
    address?: string;
    lat?: string;
    lng?: string;
    distance?: string;
    rating?: string;
    photoUrl?: string;
    status?: string;
    phone?: string;
    website?: string;
  }>();

  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const C = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { stores, products, addToShoppingList, shoppingList, updateShoppingItemQuantity } = useApp();
  const { requireAuth } = useRequireAuth();
  const sectionListRef = useRef<SectionList>(null);

  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 84 : (insets.bottom ? insets.bottom + 60 : 80);

  // Estado
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());
  const [isFavorite, setIsFavorite] = useState(false);
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [suggestName, setSuggestName] = useState("");
  const [suggestNote, setSuggestNote] = useState("");
  const [suggestSending, setSuggestSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [shadowDismissed, setShadowDismissed] = useState(false);

  const searchInputRef = useRef<TextInput>(null);
  const searchBarAnim = useRef(new Animated.Value(0)).current;

  const storeFromCtx = stores.find((s) => s.id === params.id || s.googlePlaceId === params.id);

  const store = useMemo(() => ({
    id: params.id,
    googlePlaceId: params.id,
    name: storeFromCtx?.name ?? params.name ?? "",
    address: storeFromCtx?.address ?? params.address ?? "",
    lat: storeFromCtx?.lat ?? parseFloat(params.lat ?? "0"),
    lng: storeFromCtx?.lng ?? parseFloat(params.lng ?? "0"),
    distance: storeFromCtx?.distance ?? parseFloat(params.distance ?? "0"),
    rating: storeFromCtx?.rating ?? (params.rating ? parseFloat(params.rating) : undefined),
    photoUrl: storeFromCtx?.photoUrl ?? (params.photoUrl || undefined),
    status: (storeFromCtx?.status ?? params.status ?? "shadow") as "shadow" | "verified",
    phone: storeFromCtx?.phone ?? (params.phone || undefined),
    website: storeFromCtx?.website ?? (params.website || undefined),
    isShadow: (storeFromCtx?.status ?? params.status) === "shadow",
    isVerified: (storeFromCtx?.status ?? params.status) === "verified",
    plan: storeFromCtx?.plan ?? "normal",
  }), [params, storeFromCtx]);

  useEffect(() => {
    AsyncStorage.getItem(FAVORITES_KEY).then((raw) => {
      const favs: string[] = raw ? JSON.parse(raw) : [];
      setIsFavorite(favs.includes(store.id));
    });
    AsyncStorage.getItem(SHADOW_DISMISSED_KEY + store.id).then((val) => {
      if (val === "1") setShadowDismissed(true);
    });
    if (store.name) setSuggestName(store.name);
  }, [store.id, store.name]);

  const dismissShadowNotice = useCallback(async () => {
    setShadowDismissed(true);
    await AsyncStorage.setItem(SHADOW_DISMISSED_KEY + store.id, "1");
  }, [store.id]);

  const toggleSearch = useCallback(() => {
    if (showSearch) {
      setSearchQuery("");
      setShowSearch(false);
      Animated.timing(searchBarAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();
    } else {
      setShowSearch(true);
      Animated.timing(searchBarAnim, { toValue: 1, duration: 220, useNativeDriver: false }).start(() => {
        searchInputRef.current?.focus();
      });
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [showSearch]);

  const toggleFavorite = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const raw = await AsyncStorage.getItem(FAVORITES_KEY);
    const favs: string[] = raw ? JSON.parse(raw) : [];
    const next = isFavorite ? favs.filter((f) => f !== store.id) : [...favs, store.id];
    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
    setIsFavorite(!isFavorite);
    try {
      fetch(`${getApiBase()}/stores/favorite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ google_place_id: store.id, action: isFavorite ? "remove" : "add" }),
      }).catch(() => {});
    } catch {}
    if (Platform.OS === "android") {
      ToastAndroid.show(isFavorite ? "Removido dos favoritos" : "Adicionado aos favoritos!", ToastAndroid.SHORT);
    }
  }, [isFavorite, store.id]);

  const handleSuggestChange = async () => {
    if (!suggestName.trim()) {
      Alert.alert("Atenção", "Preencha ao menos o nome sugerido.");
      return;
    }
    setSuggestSending(true);
    try {
      await fetch(`${getApiBase()}/stores/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          google_place_id: store.id,
          original_name: store.name,
          suggested_name: suggestName.trim(),
          note: suggestNote.trim(),
        }),
      });
    } catch {}
    setSuggestSending(false);
    setShowSuggestModal(false);
    if (Platform.OS === "android") {
      ToastAndroid.show("Sugestão enviada! Obrigado.", ToastAndroid.SHORT);
    } else {
      Alert.alert("Obrigado!", "Sua sugestão foi enviada para revisão.");
    }
  };

  // Seções brutas
  const sections: SectionData[] = useMemo(() => {
    const storeProducts = products
      .filter((p) => p.prices.some((pr) => pr.storeId === store.id))
      .map((p) => ({
        ...p,
        storePrice: p.prices.find((pr) => pr.storeId === store.id)!.price,
      }));

    const grouped: Record<string, typeof storeProducts> = {};
    storeProducts.forEach((p) => {
      if (!grouped[p.category]) grouped[p.category] = [];
      grouped[p.category].push(p);
    });

    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([title, data]) => ({ title, data }));
  }, [store.id, products]);

  // Categorias únicas para os chips
  const allCategories = useMemo(() => sections.map((s) => s.title), [sections]);

  // Seções filtradas por busca e categoria
  const filteredSections = useMemo(() => {
    let result = sections;
    if (selectedCategory) {
      result = result.filter((s) => s.title === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result
        .map((s) => ({
          ...s,
          data: s.data.filter(
            (p) =>
              p.name.toLowerCase().includes(q) ||
              (p.brand ?? "").toLowerCase().includes(q) ||
              p.ean.includes(q),
          ),
        }))
        .filter((s) => s.data.length > 0);
    }
    return result;
  }, [sections, searchQuery, selectedCategory]);

  const totalProducts = useMemo(
    () => sections.reduce((s, sec) => s + sec.data.length, 0),
    [sections],
  );

  const handleAddToList = (product: Product & { storePrice: number }) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addToShoppingList({
      eanCode: product.ean,
      productName: product.name,
      quantity: 1,
      checked: false,
      bestPrice: product.storePrice,
      bestStore: store.name,
    });
    setAddedItems((prev) => new Set(prev).add(product.ean));
    if (Platform.OS === "android") {
      ToastAndroid.show("Adicionado à lista!", ToastAndroid.SHORT);
    }
  };

  const searchBarHeight = searchBarAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 52],
  });

  // ─── RENDER ───────────────────────────────────────────────────────────────

  const ListHeader = (
    <>
      {/* Barra de busca animada */}
      <Animated.View style={{ height: searchBarHeight, overflow: "hidden", paddingHorizontal: 16 }}>
        <View style={[styles.searchBar, { backgroundColor: C.backgroundSecondary, borderColor: C.border }]}>
          <Feather name="search" size={15} color={C.textMuted} />
          <TextInput
            ref={searchInputRef}
            style={[styles.searchInput, { color: C.text }]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Buscar produto, marca ou código..."
            placeholderTextColor={C.textMuted}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
              <Feather name="x-circle" size={15} color={C.textMuted} />
            </Pressable>
          )}
        </View>
      </Animated.View>

      {/* Chips de categoria */}
      {allCategories.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
          style={{ marginTop: 8 }}
        >
          <Pressable
            style={[
              styles.chip,
              selectedCategory === null
                ? { backgroundColor: C.primary, borderColor: C.primary }
                : { backgroundColor: C.backgroundSecondary, borderColor: C.border },
            ]}
            onPress={() => { setSelectedCategory(null); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          >
            <Text style={[styles.chipText, { color: selectedCategory === null ? "#fff" : C.textSecondary }]}>
              Todos
            </Text>
          </Pressable>
          {allCategories.map((cat) => (
            <Pressable
              key={cat}
              style={[
                styles.chip,
                selectedCategory === cat
                  ? { backgroundColor: C.primary, borderColor: C.primary }
                  : { backgroundColor: C.backgroundSecondary, borderColor: C.border },
              ]}
              onPress={() => {
                setSelectedCategory(selectedCategory === cat ? null : cat);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <Text style={[styles.chipText, { color: selectedCategory === cat ? "#fff" : C.textSecondary }]}>
                {cat}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Aviso shadow — dispensável */}
      {store.isShadow && !shadowDismissed && (
        <View style={[styles.shadowNotice, { backgroundColor: isDark ? "#1A1600" : "#FFF8E1", borderColor: "#FFE082" }]}>
          <Feather name="info" size={14} color="#F9A825" style={{ marginTop: 1 }} />
          <Text style={[styles.shadowNoticeText, { color: isDark ? "#FFE082" : "#795548" }]}>
            Este supermercado ainda não está verificado. Os dados podem estar incompletos. Ajude-nos cadastrando preços!
          </Text>
          <Pressable onPress={dismissShadowNotice} hitSlop={10} style={styles.shadowDismissBtn}>
            <Feather name="x" size={14} color={isDark ? "#FFE082" : "#A1887F"} />
          </Pressable>
        </View>
      )}

      {/* Barra de resumo */}
      <View style={[styles.subtitleBar, { borderBottomColor: C.border }]}>
        <Text style={[styles.subtitleTxt, { color: C.textSecondary }]}>
          {filteredSections.reduce((s, sec) => s + sec.data.length, 0)}{" "}
          {searchQuery || selectedCategory ? "resultado(s)" : `de ${totalProducts} produto(s)`}
        </Text>
        <Pressable
          style={styles.listShortcut}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/(tabs)/list"); }}
        >
          <Feather name="shopping-cart" size={13} color={C.primary} />
          <Text style={[styles.listShortcutTxt, { color: C.primary }]}>Ver lista ({shoppingList.length})</Text>
        </Pressable>
      </View>
    </>
  );

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>

      {/* ── HEADER ── */}
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: C.background, borderBottomColor: C.border }]}>
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
          style={[styles.iconBtn, { backgroundColor: C.backgroundSecondary }]}
          hitSlop={8}
        >
          <Feather name="arrow-left" size={20} color={C.text} />
        </Pressable>

        <View style={styles.headerCenter}>
          <View style={[styles.storeLogo, { backgroundColor: isDark ? C.backgroundTertiary : "#F0F0F0" }]}>
            {store.photoUrl ? (
              <Image source={{ uri: store.photoUrl }} style={{ width: 44, height: 44, borderRadius: 12 }} resizeMode="cover" />
            ) : (
              <Feather name="shopping-bag" size={22} color={store.isShadow ? C.textMuted : C.primary} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <Text style={[styles.storeName, { color: C.text }]} numberOfLines={1}>{store.name}</Text>
              {store.isShadow && (
                <View style={[styles.shadowBadge, { backgroundColor: C.backgroundSecondary }]}>
                  <Text style={[styles.shadowBadgeText, { color: C.textMuted }]}>Não verificado</Text>
                </View>
              )}
              {store.isVerified && (
                <View style={[styles.verifiedBadge, { backgroundColor: "#E8F5E9" }]}>
                  <Feather name="check-circle" size={9} color="#2E7D32" />
                  <Text style={[styles.verifiedBadgeText, { color: "#2E7D32" }]}>Verificado</Text>
                </View>
              )}
            </View>
            <View style={styles.storeMeta}>
              <Feather name="map-pin" size={11} color={C.textMuted} />
              <Text style={[styles.storeMetaTxt, { color: C.textMuted }]} numberOfLines={1}>
                {store.distance > 0 ? `${store.distance}km · ` : ""}{store.address || "Endereço não disponível"}
              </Text>
            </View>
            {store.rating != null && store.rating > 0 && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 }}>
                <Ionicons name="star" size={10} color="#F9A825" />
                <Text style={{ fontSize: 11, color: C.textMuted, fontFamily: "Inter_400Regular" }}>
                  {store.rating.toFixed(1)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Botão buscar no header */}
        <Pressable
          onPress={toggleSearch}
          style={[styles.iconBtn, { backgroundColor: showSearch ? C.primary : C.backgroundSecondary }]}
          hitSlop={8}
        >
          <Feather name={showSearch ? "x" : "search"} size={18} color={showSearch ? "#fff" : C.text} />
        </Pressable>
      </View>

      {/* ── CONTATOS (verificado) ── */}
      {store.isVerified && (store.phone || store.website) && (
        <View style={[styles.verifiedBar, { backgroundColor: C.backgroundSecondary, borderBottomColor: C.border }]}>
          {store.phone && (
            <Pressable style={styles.verifiedLink} onPress={() => Linking.openURL(`tel:${store.phone}`)}>
              <Feather name="phone" size={12} color={C.primary} />
              <Text style={[styles.verifiedLinkText, { color: C.primary }]}>{store.phone}</Text>
            </Pressable>
          )}
          {store.website && (
            <Pressable style={styles.verifiedLink} onPress={() => Linking.openURL(store.website!)}>
              <Feather name="globe" size={12} color={C.primary} />
              <Text style={[styles.verifiedLinkText, { color: C.primary }]}>Visitar site</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* ── AÇÕES PRINCIPAIS ── */}
      <View style={[styles.actionsBar, { backgroundColor: C.background, borderBottomColor: C.border }]}>

        {/* Linha 1 — botões secundários */}
        <View style={styles.actionsRow}>
          {/* Favoritar */}
          <Pressable
            onPress={toggleFavorite}
            style={[
              styles.actionBtnSecondary,
              { flex: 1, backgroundColor: isFavorite ? "#FFF0F0" : (isDark ? "#2A2A2A" : "#F2F2F2"), borderColor: isFavorite ? "#E53935" : C.border },
            ]}
            hitSlop={4}
          >
            <Ionicons name={isFavorite ? "heart" : "heart-outline"} size={15} color={isFavorite ? "#E53935" : C.textSecondary} />
            <Text style={[styles.actionBtnSecondaryText, { color: isFavorite ? "#E53935" : C.textSecondary }]} numberOfLines={1}>
              {isFavorite ? "Favoritado" : "Favoritar"}
            </Text>
          </Pressable>

          {/* Meu Negócio — só para shadow */}
          {store.isShadow && (
            <Pressable
              style={[styles.actionBtnSecondary, { flex: 1, backgroundColor: isDark ? "#2A0000" : "#FFF0F0", borderColor: "#CC000040" }]}
              onPress={() => {
                requireAuth(() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push({
                    pathname: "/merchant-register",
                    params: { googlePlaceId: store.id, placeName: store.name, placeLat: String(store.lat), placeLng: String(store.lng) },
                  });
                });
              }}
            >
              <Feather name="briefcase" size={15} color="#CC0000" />
              <Text style={[styles.actionBtnSecondaryText, { color: "#CC0000" }]} numberOfLines={1}>Meu Negócio</Text>
            </Pressable>
          )}

          {/* Sugerir Correção */}
          <Pressable
            style={[styles.actionBtnSecondary, { flex: 1, backgroundColor: isDark ? "#2A2A2A" : "#F2F2F2", borderColor: C.border }]}
            onPress={() => {
              requireAuth(() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowSuggestModal(true);
              });
            }}
          >
            <Feather name="edit-2" size={15} color={C.textSecondary} />
            <Text style={[styles.actionBtnSecondaryText, { color: C.textSecondary }]} numberOfLines={1}>Sugerir</Text>
          </Pressable>
        </View>

        {/* Linha 2 — Cadastrar Preço (destaque, maior) */}
        <Pressable
          style={[styles.actionBtnPrimary, { backgroundColor: C.primary, marginTop: 8 }]}
          onPress={() => {
            requireAuth(() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push({
                pathname: "/register-price",
                params: {
                  preselectedPlaceId: store.id,
                  preselectedPlaceName: store.name,
                  ...(store.isVerified ? { isCorrection: "true" } : {}),
                },
              });
            });
          }}
        >
          <MaterialIcon name="barcode-scan" color="#fff" size={18} />
          <Text style={styles.actionBtnPrimaryText}>Cadastrar Preço</Text>
        </Pressable>

      </View>

      {/* ── LISTA DE PRODUTOS ── */}
      {sections.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="package" size={48} color={C.textMuted} />
          <Text style={[styles.emptyTitle, { color: C.text }]}>Nenhum produto cadastrado</Text>
          <Text style={[styles.emptySub, { color: C.textMuted }]}>
            Seja o primeiro a cadastrar preços neste supermercado!
          </Text>
          <Pressable
            style={[styles.emptyAction, { backgroundColor: C.primary }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push({ pathname: "/register-price", params: { preselectedPlaceId: store.id, preselectedPlaceName: store.name } });
            }}
          >
            <Feather name="plus-circle" size={16} color="#fff" />
            <Text style={styles.emptyActionText}>Cadastrar primeiro produto</Text>
          </Pressable>
        </View>
      ) : (
        <SectionList
          ref={sectionListRef}
          sections={filteredSections}
          keyExtractor={(item) => item.ean}
          contentContainerStyle={{ paddingBottom: bottomPad }}
          stickySectionHeadersEnabled
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={
            <View style={styles.emptySearch}>
              <Feather name="search" size={36} color={C.textMuted} />
              <Text style={[styles.emptyTitle, { color: C.text, fontSize: 16 }]}>Nenhum produto encontrado</Text>
              <Text style={[styles.emptySub, { color: C.textMuted }]}>Tente outro termo ou limpe o filtro</Text>
            </View>
          }
          renderSectionHeader={({ section: { title } }) => (
            <View style={[styles.sectionHeader, { backgroundColor: C.background, borderBottomColor: C.border }]}>
              <View style={[styles.categoryDot, { backgroundColor: C.primary }]} />
              <Text style={[styles.sectionTitle, { color: C.text }]}>{title}</Text>
              <View style={{ flex: 1 }} />
              {/* Botão filtrar por esta categoria */}
              <Pressable
                style={[
                  styles.filterChipInline,
                  selectedCategory === title
                    ? { backgroundColor: C.primary, borderColor: C.primary }
                    : { backgroundColor: C.backgroundSecondary, borderColor: C.border },
                ]}
                onPress={() => {
                  setSelectedCategory(selectedCategory === title ? null : title);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Feather
                  name="filter"
                  size={10}
                  color={selectedCategory === title ? "#fff" : C.textMuted}
                />
                <Text style={[styles.filterChipText, { color: selectedCategory === title ? "#fff" : C.textMuted }]}>
                  {selectedCategory === title ? "Limpar" : "Filtrar"}
                </Text>
              </Pressable>
            </View>
          )}
          renderItem={({ item }) => {
            const listItem = shoppingList.find((i) => i.eanCode === item.ean);
            const alreadyAdded = addedItems.has(item.ean) || !!listItem;
            return (
              <Pressable
                style={[styles.productRow, { backgroundColor: C.surfaceElevated, borderColor: alreadyAdded ? C.success : C.border }]}
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
                  {listItem ? (
                    <View style={styles.stepperCol}>
                      <View style={[styles.stepper, { backgroundColor: C.success + "18", borderColor: C.success + "60" }]}>
                        <Pressable
                          style={[styles.stepperBtn, { backgroundColor: C.success }]}
                          onPress={(e) => { e.stopPropagation?.(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); updateShoppingItemQuantity(listItem.id, listItem.quantity - 1); }}
                          hitSlop={6}
                        >
                          <Feather name="minus" size={12} color="#fff" />
                        </Pressable>
                        <Text style={[styles.stepperQty, { color: C.success }]}>{listItem.quantity}</Text>
                        <Pressable
                          style={[styles.stepperBtn, { backgroundColor: C.success }]}
                          onPress={(e) => { e.stopPropagation?.(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); updateShoppingItemQuantity(listItem.id, listItem.quantity + 1); }}
                          hitSlop={6}
                        >
                          <Feather name="plus" size={12} color="#fff" />
                        </Pressable>
                      </View>
                      <Text style={[styles.inListLabel, { color: C.success }]}>Na lista</Text>
                    </View>
                  ) : (
                    <Pressable
                      style={[styles.addBtn, { backgroundColor: C.primary }]}
                      onPress={(e) => { e.stopPropagation?.(); handleAddToList(item); }}
                      hitSlop={4}
                    >
                      <Feather name="plus" size={14} color="#fff" />
                      <Text style={styles.addBtnTxt}>Adicionar</Text>
                    </Pressable>
                  )}
                </View>
              </Pressable>
            );
          }}
        />
      )}

      {/* ── MODAL — Sugerir Mudança ── */}
      <Modal visible={showSuggestModal} transparent animationType="slide" onRequestClose={() => setShowSuggestModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <Pressable style={styles.modalOverlay} onPress={() => setShowSuggestModal(false)}>
            <Pressable style={[styles.modalBox, { backgroundColor: C.background, borderColor: C.border }]} onPress={() => {}}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: C.text }]}>Sugerir Correção</Text>
                <Pressable onPress={() => setShowSuggestModal(false)} hitSlop={8}>
                  <Feather name="x" size={20} color={C.textMuted} />
                </Pressable>
              </View>

              <Text style={[styles.modalLabel, { color: C.textSecondary }]}>Nome correto do estabelecimento</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: C.backgroundSecondary, color: C.text, borderColor: C.border }]}
                value={suggestName}
                onChangeText={setSuggestName}
                placeholder="Ex: Supermercado Bom Preço"
                placeholderTextColor={C.textMuted}
              />

              <Text style={[styles.modalLabel, { color: C.textSecondary, marginTop: 12 }]}>Observação (opcional)</Text>
              <TextInput
                style={[styles.modalInput, styles.modalTextArea, { backgroundColor: C.backgroundSecondary, color: C.text, borderColor: C.border }]}
                value={suggestNote}
                onChangeText={setSuggestNote}
                placeholder="Ex: Endereço errado, nome desatualizado..."
                placeholderTextColor={C.textMuted}
                multiline
                numberOfLines={3}
              />

              <Pressable
                style={[styles.modalSubmit, { backgroundColor: C.primary, opacity: suggestSending ? 0.6 : 1 }]}
                onPress={handleSuggestChange}
                disabled={suggestSending}
              >
                <Text style={styles.modalSubmitText}>{suggestSending ? "Enviando..." : "Enviar Sugestão"}</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
    borderBottomWidth: 1,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  storeLogo: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    flexShrink: 0,
  },
  storeName: { fontSize: 15, fontFamily: "Inter_700Bold" },
  storeMeta: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
  storeMetaTxt: { fontSize: 11, fontFamily: "Inter_400Regular", flex: 1 },
  shadowBadge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5 },
  shadowBadgeText: { fontSize: 9, fontFamily: "Inter_600SemiBold" },
  verifiedBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5 },
  verifiedBadgeText: { fontSize: 9, fontFamily: "Inter_700Bold" },

  // Contato bar
  verifiedBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 16,
    borderBottomWidth: 1,
  },
  verifiedLink: { flexDirection: "row", alignItems: "center", gap: 4 },
  verifiedLinkText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  // Actions
  actionsBar: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 0,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtnSecondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 11,
    borderWidth: 1,
    minWidth: 0,
  },
  actionBtnSecondaryText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  actionBtnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
    borderRadius: 13,
  },
  actionBtnPrimaryText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },

  // Search
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 11,
    borderWidth: 1,
    marginTop: 10,
    marginBottom: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    padding: 0,
  },

  // Category chips
  chipsRow: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    gap: 8,
    flexDirection: "row",
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  // Shadow notice
  shadowNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginHorizontal: 14,
    marginTop: 10,
    padding: 12,
    borderRadius: 11,
    borderWidth: 1,
  },
  shadowNoticeText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  shadowDismissBtn: { padding: 2, marginTop: 1 },

  // Subtitle bar
  subtitleBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    marginTop: 8,
  },
  subtitleTxt: { fontSize: 12, fontFamily: "Inter_400Regular" },
  listShortcut: { flexDirection: "row", alignItems: "center", gap: 4 },
  listShortcutTxt: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  // Section header
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
  filterChipInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  filterChipText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },

  // Product row
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 14,
    marginVertical: 4,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    gap: 10,
  },
  productIcon: { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
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

  // Stepper
  stepperCol: { alignItems: "center", gap: 3 },
  stepper: { flexDirection: "row", alignItems: "center", borderRadius: 8, borderWidth: 1, overflow: "hidden" },
  stepperBtn: { width: 26, height: 26, alignItems: "center", justifyContent: "center" },
  stepperQty: { width: 26, textAlign: "center", fontSize: 13, fontFamily: "Inter_700Bold" },
  inListLabel: { fontSize: 9, fontFamily: "Inter_600SemiBold", letterSpacing: 0.3 },

  // Empty states
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingTop: 60, paddingHorizontal: 32 },
  emptySearch: { alignItems: "center", gap: 10, paddingTop: 48, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_700Bold", textAlign: "center" },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  emptyAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  emptyActionText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalBox: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  modalLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginBottom: 6 },
  modalInput: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  modalTextArea: { height: 80, textAlignVertical: "top", paddingTop: 11 },
  modalSubmit: { marginTop: 20, paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  modalSubmitText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },

  // Outros
  planBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7 },
  planBadgeText: { color: "#fff", fontSize: 9, fontFamily: "Inter_700Bold" },
});
