import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
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
import { useApp, type Store } from "@/context/AppContext";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import {
  fetchProductPrices,
  voteOnPrice,
  type PriceEntry,
} from "@/services/priceService";

function fmtPrice(v: number) {
  return `R$ ${v.toFixed(2).replace(".", ",")}`;
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  } catch {
    return "—";
  }
}

export default function ProductDetailScreen() {
  const { ean } = useLocalSearchParams<{ ean: string }>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const C = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 34 : insets.bottom + 24;

  const { getProductByEAN, addToShoppingList, submitPriceUpdate, stores, user, isLoggedIn } = useApp();
  const { requireAuth } = useRequireAuth();

  const product = getProductByEAN(ean || "");

  const [livePrice, setLivePrice] = useState<PriceEntry[]>([]);
  const [loadingPrices, setLoadingPrices] = useState(true);
  const [votedIds, setVotedIds] = useState<Set<number>>(new Set());

  const [showSubmit, setShowSubmit] = useState(false);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [priceInput, setPriceInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showStorePicker, setShowStorePicker] = useState(false);

  const loadPrices = useCallback(async () => {
    if (!ean) return;
    setLoadingPrices(true);
    const data = await fetchProductPrices(ean);
    setLivePrice(data);
    setLoadingPrices(false);
  }, [ean]);

  useEffect(() => { loadPrices(); }, [loadPrices]);

  const allPrices: PriceEntry[] = livePrice.length > 0
    ? [...livePrice].sort((a, b) => a.price - b.price)
    : (product?.prices ?? []).map((p, i) => ({
        reportId: -(i + 1),
        ean: ean ?? "",
        placeId: p.storeId,
        price: p.price,
        reportedAt: p.updatedAt,
        isVerified: false,
        upvotes: 0,
        downvotes: 0,
        storeName: p.storeName,
        storeAddress: null,
        lat: p.lat,
        lng: p.lng,
        photoUrl: null,
        rating: null,
        storeStatus: null,
      }));

  const best = allPrices[0];
  const worst = allPrices[allPrices.length - 1];
  const savings = best && worst && worst.price > best.price
    ? ((worst.price - best.price) / worst.price * 100).toFixed(0)
    : null;

  const handleVote = async (reportId: number, vote: "up" | "down") => {
    if (reportId < 0) return;
    if (votedIds.has(reportId)) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setVotedIds((prev) => new Set([...prev, reportId]));
    const result = await voteOnPrice(reportId, vote);
    if (result.ok) {
      setLivePrice((prev) =>
        prev.map((p) =>
          p.reportId === reportId
            ? { ...p, upvotes: result.upvotes ?? p.upvotes, downvotes: result.downvotes ?? p.downvotes }
            : p
        )
      );
    }
  };

  const handleSubmitPrice = async () => {
    if (!selectedStore || !priceInput.trim() || !user) return;
    const priceNum = parseFloat(priceInput.replace(",", "."));
    if (isNaN(priceNum) || priceNum <= 0) {
      Alert.alert("Preço inválido", "Digite um valor válido.");
      return;
    }

    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const result = await submitPriceUpdate(ean ?? "", priceNum, selectedStore.id);

    setSubmitting(false);

    if (result.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("🏆 +10 pontos!", `Preço registrado em ${selectedStore.name}. Obrigado!`);
      setShowSubmit(false);
      setPriceInput("");
      setSelectedStore(null);
      await loadPrices();
    } else {
      Alert.alert("Erro", result.error ?? "Não foi possível registrar o preço.");
    }
  };

  if (!product && !ean) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: C.background }]}>
        <Feather name="alert-circle" size={48} color={C.textMuted} />
        <Text style={[styles.emptyText, { color: C.textMuted }]}>Produto não encontrado</Text>
        <Pressable style={[styles.backBtn2, { backgroundColor: C.primary }]} onPress={() => router.back()}>
          <Text style={styles.backBtnText2}>Voltar</Text>
        </Pressable>
      </View>
    );
  }

  const productName = product?.name ?? `EAN ${ean}`;
  const productBrand = product?.brand ?? "—";
  const productCategory = product?.category ?? "Outros";
  const productImage = product?.image;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: C.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: C.border }]}>
        <Pressable
          style={[styles.headerBtn, { backgroundColor: C.backgroundSecondary }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
        >
          <Feather name="arrow-left" size={20} color={C.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: C.text }]}>Comparar preços</Text>
        <Pressable
          style={[styles.headerBtn, { backgroundColor: C.primary }]}
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            addToShoppingList({
              eanCode: ean ?? "",
              productName,
              quantity: 1,
              checked: false,
              bestPrice: best?.price,
              bestStore: best?.storeName,
            });
          }}
        >
          <Feather name="plus" size={20} color="#fff" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
        {/* Product Info */}
        <View style={[styles.productCard, { backgroundColor: C.surfaceElevated, marginHorizontal: 16, marginTop: 14, borderColor: C.border }]}>
          {productImage ? (
            <Image source={{ uri: productImage }} style={styles.productImage} contentFit="contain" transition={200} />
          ) : (
            <View style={[styles.productIconBox, { backgroundColor: isDark ? C.backgroundTertiary : "#F5F5F5" }]}>
              <MaterialCommunityIcons name="package-variant-closed" size={40} color={C.primary} />
            </View>
          )}
          <Text style={[styles.productName, { color: C.text }]}>{productName}</Text>
          <Text style={[styles.productMeta, { color: C.textMuted }]}>{productBrand} · {productCategory}</Text>
          <View style={styles.eanRow}>
            <MaterialCommunityIcons name="barcode" size={13} color={C.textMuted} />
            <Text style={[styles.eanText, { color: C.textMuted }]}>{ean}</Text>
          </View>
        </View>

        {/* Best Price Highlight */}
        {best ? (
          <View style={[styles.bestCard, { backgroundColor: C.primary, marginHorizontal: 16, marginTop: 12 }]}>
            <View>
              <Text style={styles.bestLabel}>Melhor preço</Text>
              <Text style={styles.bestPrice}>{fmtPrice(best.price)}</Text>
              <Text style={styles.bestStore}>{best.storeName}</Text>
            </View>
            {savings && Number(savings) > 0 ? (
              <View style={styles.savingsBox}>
                <Text style={styles.savingsLabel}>Economize</Text>
                <Text style={styles.savingsValue}>{savings}%</Text>
                <Text style={styles.savingsVs}>vs. + caro</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Price List */}
        <View style={{ paddingHorizontal: 16, marginTop: 18 }}>
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionTitle, { color: C.text }]}>Preços por supermercado</Text>
            {loadingPrices && <ActivityIndicator size="small" color={C.primary} />}
            {livePrice.length > 0 && (
              <Text style={[styles.liveTag, { color: C.primary, borderColor: C.primary + "40", backgroundColor: C.primary + "12" }]}>
                ao vivo
              </Text>
            )}
          </View>

          {allPrices.length === 0 && !loadingPrices ? (
            <View style={[styles.emptyBox, { backgroundColor: C.backgroundSecondary, borderColor: C.border }]}>
              <Feather name="tag" size={24} color={C.textMuted} />
              <Text style={[styles.emptyText, { color: C.textMuted }]}>Nenhum preço cadastrado ainda.</Text>
              <Text style={[styles.emptySubText, { color: C.textMuted }]}>Seja o primeiro a registrar e ganhe +10 pts!</Text>
            </View>
          ) : (
            <View style={{ gap: 8, marginTop: 10 }}>
              {allPrices.map((p, idx) => {
                const isBest = idx === 0;
                const hasVoted = votedIds.has(p.reportId);
                const isLive = p.reportId > 0;
                return (
                  <View
                    key={`${p.placeId}-${p.reportId}`}
                    style={[
                      styles.priceRow,
                      {
                        backgroundColor: isBest ? C.primary + "10" : C.surfaceElevated,
                        borderColor: isBest ? C.primary : C.border,
                      },
                    ]}
                  >
                    {isBest && (
                      <View style={[styles.bestBadge, { backgroundColor: C.primary }]}>
                        <Feather name="award" size={9} color="#fff" />
                        <Text style={styles.bestBadgeText}>Melhor</Text>
                      </View>
                    )}
                    <View style={[styles.storeCircle, { backgroundColor: isBest ? C.primary + "20" : C.backgroundTertiary }]}>
                      <Feather name="shopping-bag" size={15} color={isBest ? C.primary : C.textMuted} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[styles.storeName, { color: C.text }]} numberOfLines={1}>{p.storeName}</Text>
                      <View style={styles.metaRow}>
                        {p.isVerified && (
                          <View style={[styles.verifiedBadge, { backgroundColor: C.success + "20" }]}>
                            <Feather name="check-circle" size={9} color={C.success} />
                            <Text style={[styles.verifiedText, { color: C.success }]}>verificado</Text>
                          </View>
                        )}
                        <Text style={[styles.metaText, { color: C.textMuted }]}>
                          {isLive ? `att. ${fmtDate(p.reportedAt)}` : `att. ${p.reportedAt}`}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.priceCol}>
                      <Text style={[styles.priceNum, { color: isBest ? C.primary : C.text }]}>{fmtPrice(p.price)}</Text>
                      {isLive && (
                        <View style={styles.voteRow}>
                          <Pressable
                            style={[styles.voteBtn, hasVoted && { opacity: 0.4 }]}
                            onPress={() => handleVote(p.reportId, "up")}
                          >
                            <Feather name="thumbs-up" size={10} color={C.success} />
                            <Text style={[styles.voteCount, { color: C.success }]}>{p.upvotes}</Text>
                          </Pressable>
                          <Pressable
                            style={[styles.voteBtn, hasVoted && { opacity: 0.4 }]}
                            onPress={() => handleVote(p.reportId, "down")}
                          >
                            <Feather name="thumbs-down" size={10} color={C.error} />
                            <Text style={[styles.voteCount, { color: C.error }]}>{p.downvotes}</Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Submit Price CTA */}
        <View style={{ paddingHorizontal: 16, marginTop: 18 }}>
          {!showSubmit ? (
            <Pressable
              style={[styles.ctaCard, { backgroundColor: isDark ? C.backgroundTertiary : "#FFF8F8", borderColor: C.primary + "30" }]}
              onPress={() => {
                requireAuth(() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setShowSubmit(true);
                });
              }}
            >
              <Ionicons name="trophy-outline" size={20} color={C.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.ctaTitle, { color: C.text }]}>Encontrou preço diferente?</Text>
                <Text style={[styles.ctaSub, { color: C.textMuted }]}>Registre agora e ganhe +10 pontos!</Text>
              </View>
              <Feather name="chevron-right" size={18} color={C.primary} />
            </Pressable>
          ) : (
            <View style={[styles.submitCard, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
              <Text style={[styles.submitTitle, { color: C.text }]}>Registrar preço</Text>

              {/* Store picker */}
              <Pressable
                style={[styles.storePickerBtn, { backgroundColor: C.backgroundSecondary, borderColor: selectedStore ? C.primary : C.border }]}
                onPress={() => setShowStorePicker(true)}
              >
                <Feather name="shopping-bag" size={14} color={selectedStore ? C.primary : C.textMuted} />
                <Text style={[styles.storePickerText, { color: selectedStore ? C.text : C.textMuted }]} numberOfLines={1}>
                  {selectedStore ? selectedStore.name : "Selecionar supermercado..."}
                </Text>
                <Feather name="chevron-down" size={14} color={C.textMuted} />
              </Pressable>

              {/* Price input */}
              <View style={[styles.priceInputRow, { backgroundColor: C.backgroundSecondary, borderColor: priceInput ? C.primary : C.border }]}>
                <Text style={[styles.pricePrefix, { color: C.textMuted }]}>R$</Text>
                <TextInput
                  style={[styles.priceInputField, { color: C.text }]}
                  placeholder="0,00"
                  placeholderTextColor={C.textMuted}
                  value={priceInput}
                  onChangeText={setPriceInput}
                  keyboardType="decimal-pad"
                  maxLength={8}
                />
              </View>

              <View style={styles.submitActions}>
                <Pressable style={[styles.cancelBtn, { borderColor: C.border }]} onPress={() => { setShowSubmit(false); setPriceInput(""); setSelectedStore(null); }}>
                  <Text style={[styles.cancelBtnText, { color: C.textMuted }]}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={[styles.confirmBtn, { backgroundColor: (!selectedStore || !priceInput || submitting) ? C.primary + "60" : C.primary, flex: 1 }]}
                  onPress={handleSubmitPrice}
                  disabled={!selectedStore || !priceInput || submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Feather name="check" size={14} color="#fff" />
                      <Text style={styles.confirmBtnText}>Enviar preço</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          )}
        </View>

        <View style={{ height: 16 }} />
      </ScrollView>

      {/* Store Picker Modal */}
      <Modal visible={showStorePicker} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalContainer, { backgroundColor: C.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: C.border }]}>
            <Text style={[styles.modalTitle, { color: C.text }]}>Selecionar supermercado</Text>
            <Pressable onPress={() => setShowStorePicker(false)}>
              <Feather name="x" size={22} color={C.text} />
            </Pressable>
          </View>
          {stores.length === 0 ? (
            <View style={styles.centered}>
              <Text style={[styles.emptyText, { color: C.textMuted }]}>Nenhum supermercado próximo encontrado.</Text>
            </View>
          ) : (
            <FlatList
              data={stores}
              keyExtractor={(s) => s.id}
              contentContainerStyle={{ padding: 16, gap: 8 }}
              renderItem={({ item }) => (
                <Pressable
                  style={[
                    styles.storePickerItem,
                    {
                      backgroundColor: selectedStore?.id === item.id ? C.primary + "12" : C.surfaceElevated,
                      borderColor: selectedStore?.id === item.id ? C.primary : C.border,
                    },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedStore(item);
                    setShowStorePicker(false);
                  }}
                >
                  <View style={[styles.storePickerIcon, { backgroundColor: C.backgroundTertiary }]}>
                    <Feather name="shopping-bag" size={16} color={C.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.storePickerName, { color: C.text }]} numberOfLines={1}>{item.name}</Text>
                    <Text style={[styles.storePickerAddr, { color: C.textMuted }]} numberOfLines={1}>
                      {item.distance.toFixed(1)}km · {item.address}
                    </Text>
                  </View>
                  {selectedStore?.id === item.id && <Feather name="check-circle" size={18} color={C.primary} />}
                </Pressable>
              )}
            />
          )}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
    borderBottomWidth: 1,
  },
  headerBtn: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 16, fontFamily: "Inter_700Bold", textAlign: "center" },
  productCard: { borderRadius: 18, padding: 18, borderWidth: 1, alignItems: "center", gap: 6 },
  productImage: { width: 72, height: 72, borderRadius: 16, marginBottom: 4 },
  productIconBox: { width: 72, height: 72, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  productName: { fontSize: 15, fontFamily: "Inter_700Bold", textAlign: "center" },
  productMeta: { fontSize: 12, fontFamily: "Inter_400Regular" },
  eanRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  eanText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  bestCard: { borderRadius: 18, padding: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  bestLabel: { color: "rgba(255,255,255,0.8)", fontSize: 12, fontFamily: "Inter_500Medium" },
  bestPrice: { color: "#fff", fontSize: 30, fontFamily: "Inter_700Bold" },
  bestStore: { color: "rgba(255,255,255,0.75)", fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  savingsBox: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 14, padding: 12 },
  savingsLabel: { color: "rgba(255,255,255,0.8)", fontSize: 10, fontFamily: "Inter_500Medium" },
  savingsValue: { color: "#fff", fontSize: 24, fontFamily: "Inter_700Bold" },
  savingsVs: { color: "rgba(255,255,255,0.7)", fontSize: 10, fontFamily: "Inter_400Regular" },
  sectionRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold", flex: 1 },
  liveTag: { fontSize: 10, fontFamily: "Inter_600SemiBold", borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  emptyBox: { borderRadius: 14, padding: 20, alignItems: "center", gap: 8, borderWidth: 1, marginTop: 10 },
  emptyText: { fontSize: 14, fontFamily: "Inter_500Medium", textAlign: "center" },
  emptySubText: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
  priceRow: { flexDirection: "row", alignItems: "center", borderRadius: 14, padding: 12, borderWidth: 1, gap: 10 },
  bestBadge: { position: "absolute", top: -7, right: 10, flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7 },
  bestBadgeText: { color: "#fff", fontSize: 8, fontFamily: "Inter_700Bold" },
  storeCircle: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  storeName: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  verifiedBadge: { flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 5 },
  verifiedText: { fontSize: 9, fontFamily: "Inter_600SemiBold" },
  metaText: { fontSize: 10, fontFamily: "Inter_400Regular" },
  priceCol: { alignItems: "flex-end", gap: 4 },
  priceNum: { fontSize: 16, fontFamily: "Inter_700Bold" },
  voteRow: { flexDirection: "row", gap: 6 },
  voteBtn: { flexDirection: "row", alignItems: "center", gap: 2 },
  voteCount: { fontSize: 9, fontFamily: "Inter_600SemiBold" },
  ctaCard: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, padding: 14, borderWidth: 1 },
  ctaTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  ctaSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  submitCard: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 12 },
  submitTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  storePickerBtn: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, padding: 12, borderWidth: 1 },
  storePickerText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  priceInputRow: { flexDirection: "row", alignItems: "center", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, gap: 6, borderWidth: 1 },
  pricePrefix: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  priceInputField: { flex: 1, fontSize: 20, fontFamily: "Inter_700Bold" },
  submitActions: { flexDirection: "row", gap: 8 },
  cancelBtn: { borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  cancelBtnText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  confirmBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 10, paddingVertical: 12 },
  confirmBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },
  backBtn2: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  backBtnText2: { color: "#fff", fontFamily: "Inter_600SemiBold" },
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1 },
  modalTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  storePickerItem: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, padding: 12, borderWidth: 1 },
  storePickerIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  storePickerName: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  storePickerAddr: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
});
