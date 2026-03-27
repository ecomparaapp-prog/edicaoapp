import { Feather, Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  Alert,
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

const FAVORITES_KEY = "@ecompara_favorite_stores";

type SectionData = { title: string; data: (Product & { storePrice: number })[] };

function getApiBase(): string {
  if (Platform.OS === "web") return "/api";
  const Constants = require("expo-constants").default;
  const domain = Constants.expoConfig?.extra?.domain ?? process.env.EXPO_PUBLIC_DOMAIN ?? "";
  if (domain) return `https://${domain}/api`;
  return "http://localhost:80/api";
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
  const { stores, products, addToShoppingList, shoppingList } = useApp();

  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 84 : (insets.bottom ? insets.bottom + 60 : 80);

  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());
  const [isFavorite, setIsFavorite] = useState(false);
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [suggestName, setSuggestName] = useState("");
  const [suggestNote, setSuggestNote] = useState("");
  const [suggestSending, setSuggestSending] = useState(false);

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
    if (store.name) setSuggestName(store.name);
  }, [store.id, store.name]);

  const toggleFavorite = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const raw = await AsyncStorage.getItem(FAVORITES_KEY);
    const favs: string[] = raw ? JSON.parse(raw) : [];
    let next: string[];
    if (isFavorite) {
      next = favs.filter((f) => f !== store.id);
    } else {
      next = [...favs, store.id];
    }
    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
    setIsFavorite(!isFavorite);

    try {
      fetch(`${getApiBase()}/stores/favorite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          google_place_id: store.id,
          action: isFavorite ? "remove" : "add",
        }),
      }).catch(() => {});
    } catch {}

    if (Platform.OS === "android") {
      ToastAndroid.show(
        isFavorite ? "Removido dos favoritos" : "Adicionado aos favoritos!",
        ToastAndroid.SHORT,
      );
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

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>

      {/* Header */}
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
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
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

      </View>

      {/* Contatos (verificado) */}
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

      {/* Ações principais */}
      <View style={[styles.actionsBar, { backgroundColor: C.backgroundSecondary, borderBottomColor: C.border }]}>
        {/* Favoritar — sempre visível, movido para cá para não sobrepor info do header */}
        <Pressable
          onPress={toggleFavorite}
          style={[styles.actionBtn, { backgroundColor: isFavorite ? "#FFF0F0" : (isDark ? "#2A2A2A" : "#EFEFEF"), borderWidth: 1, borderColor: isFavorite ? "#E53935" : C.border }]}
          hitSlop={8}
        >
          <Ionicons
            name={isFavorite ? "heart" : "heart-outline"}
            size={15}
            color={isFavorite ? "#E53935" : C.textSecondary}
          />
          <Text style={[styles.actionBtnText, { color: isFavorite ? "#E53935" : C.textSecondary }]} numberOfLines={1}>
            {isFavorite ? "Favoritado" : "Favoritar"}
          </Text>
        </Pressable>

        {store.isVerified ? (
          /* Parceiro verificado: botão "Preço Incorreto" no lugar de Cadastrar */
          <Pressable
            style={[styles.actionBtn, { backgroundColor: C.primary, flex: 1 }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push({
                pathname: "/register-price",
                params: {
                  preselectedPlaceId: store.id,
                  preselectedPlaceName: store.name,
                  isCorrection: "true",
                },
              });
            }}
          >
            <Feather name="alert-triangle" size={13} color="#fff" />
            <Text style={styles.actionBtnText} numberOfLines={1}>Preço Incorreto</Text>
          </Pressable>
        ) : (
          /* Não-parceiro: Cadastrar + Meu Negócio + Sugerir */
          <>
            <Pressable
              style={[styles.actionBtn, { backgroundColor: C.primary, flex: 1 }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push({
                  pathname: "/register-price",
                  params: {
                    preselectedPlaceId: store.id,
                    preselectedPlaceName: store.name,
                  },
                });
              }}
            >
              <MaterialIcon name="barcode-scan" color="#fff" />
              <Text style={styles.actionBtnText} numberOfLines={1}>Cadastrar</Text>
            </Pressable>

            <Pressable
              style={[styles.actionBtn, { backgroundColor: "#8B0000" }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push({
                  pathname: "/merchant-register",
                  params: {
                    googlePlaceId: store.id,
                    placeName: store.name,
                    placeLat: String(store.lat),
                    placeLng: String(store.lng),
                  },
                });
              }}
            >
              <Feather name="briefcase" size={13} color="#fff" />
              <Text style={styles.actionBtnText} numberOfLines={1}>Meu Negócio</Text>
            </Pressable>

            <Pressable
              style={[styles.actionBtn, { backgroundColor: isDark ? "#2A2A2A" : "#EFEFEF", borderWidth: 1, borderColor: C.border }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowSuggestModal(true);
              }}
            >
              <Feather name="edit-2" size={13} color={C.textSecondary} />
              <Text style={[styles.actionBtnText, { color: C.textSecondary }]} numberOfLines={1}>Sugerir</Text>
            </Pressable>
          </>
        )}
      </View>

      {/* Aviso shadow */}
      {store.isShadow && (
        <View style={[styles.shadowNotice, { backgroundColor: isDark ? "#1A1A1A" : "#FFF8E1", borderColor: "#FFE082" }]}>
          <Feather name="info" size={14} color="#F9A825" />
          <Text style={[styles.shadowNoticeText, { color: isDark ? "#FFE082" : "#795548" }]}>
            Este supermercado ainda não está verificado. Os dados podem estar incompletos. Ajude-nos cadastrando preços ou sugerindo correções!
          </Text>
        </View>
      )}

      {/* Lista de produtos */}
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
              router.push({
                pathname: "/register-price",
                params: { preselectedPlaceId: store.id, preselectedPlaceName: store.name },
              });
            }}
          >
            <Feather name="plus-circle" size={16} color="#fff" />
            <Text style={styles.emptyActionText}>Cadastrar primeiro produto</Text>
          </Pressable>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.ean}
          contentContainerStyle={{ paddingBottom: bottomPad, paddingTop: 8 }}
          stickySectionHeadersEnabled
          ListHeaderComponent={
            <View style={[styles.subtitleBar, { borderBottomColor: C.border }]}>
              <Text style={[styles.subtitleTxt, { color: C.textSecondary }]}>
                {sections.reduce((s, sec) => s + sec.data.length, 0)} produto(s) disponíveis
              </Text>
              <Pressable
                style={styles.listShortcut}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/(tabs)/list"); }}
              >
                <Feather name="shopping-cart" size={13} color={C.primary} />
                <Text style={[styles.listShortcutTxt, { color: C.primary }]}>Ver lista ({shoppingList.length})</Text>
              </Pressable>
            </View>
          }
          renderSectionHeader={({ section: { title } }) => (
            <View style={[styles.sectionHeader, { backgroundColor: C.background, borderBottomColor: C.border }]}>
              <View style={[styles.categoryDot, { backgroundColor: C.primary }]} />
              <Text style={[styles.sectionTitle, { color: C.text }]}>{title}</Text>
            </View>
          )}
          renderItem={({ item }) => {
            const alreadyAdded = addedItems.has(item.ean) || shoppingList.some((i) => i.eanCode === item.ean);
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
                    style={[styles.addBtn, alreadyAdded ? { backgroundColor: C.success } : { backgroundColor: C.primary }]}
                    onPress={(e) => { e.stopPropagation?.(); if (!alreadyAdded) handleAddToList(item); }}
                    hitSlop={4}
                  >
                    <Feather name={alreadyAdded ? "check" : "plus"} size={14} color="#fff" />
                    <Text style={styles.addBtnTxt}>{alreadyAdded ? "Na lista" : "Adicionar"}</Text>
                  </Pressable>
                </View>
              </Pressable>
            );
          }}
        />
      )}

      {/* Modal — Sugerir Mudança */}
      <Modal visible={showSuggestModal} transparent animationType="slide" onRequestClose={() => setShowSuggestModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <Pressable style={styles.modalOverlay} onPress={() => setShowSuggestModal(false)}>
            <Pressable style={[styles.modalBox, { backgroundColor: C.background, borderColor: C.border }]} onPress={() => {}}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: C.text }]}>Sugerir Mudança</Text>
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

function MaterialIcon({ name, color }: { name: string; color: string }) {
  const { MaterialCommunityIcons } = require("@expo/vector-icons");
  return <MaterialCommunityIcons name={name} size={14} color={color} />;
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
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  storeLogo: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  storeName: { fontSize: 15, fontFamily: "Inter_700Bold" },
  storeMeta: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
  storeMetaTxt: { fontSize: 11, fontFamily: "Inter_400Regular" },
  shadowBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
  },
  shadowBadgeText: { fontSize: 9, fontFamily: "Inter_600SemiBold" },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
  },
  verifiedBadgeText: { fontSize: 9, fontFamily: "Inter_700Bold" },
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
  actionsBar: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 10,
  },
  actionBtnText: { color: "#fff", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  shadowNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  shadowNoticeText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  subtitleBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
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
    width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center",
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
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingTop: 60, paddingHorizontal: 32 },
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
  backBtn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  planBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7 },
  planBadgeText: { color: "#fff", fontSize: 9, fontFamily: "Inter_700Bold" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
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
  modalSubmit: {
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  modalSubmitText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
});
