import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
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
import { useApp } from "@/context/AppContext";
import type { CosmosProduct } from "@/services/cosmosService";

export default function ScannerScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const C = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { getProductByEAN, addToShoppingList, lookupEAN, addManualProduct } = useApp();

  const [manualEan, setManualEan] = useState("");
  const [cosmosProduct, setCosmosProduct] = useState<CosmosProduct | null>(null);
  const [localProduct, setLocalProduct] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualName, setManualName] = useState("");

  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 34 : insets.bottom + 16;

  const resetState = () => {
    setCosmosProduct(null);
    setLocalProduct(null);
    setError("");
    setShowManualForm(false);
    setManualName("");
  };

  const handleManualSearch = async () => {
    const ean = manualEan.trim();
    if (!ean) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    resetState();
    setLoading(true);

    try {
      const result = await lookupEAN(ean);

      if (result.found && result.product) {
        setCosmosProduct(result.product);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const local = getProductByEAN(ean);
        if (local) setLocalProduct(local);
      } else if (result.error) {
        const local = getProductByEAN(ean);
        if (local) {
          setLocalProduct(local);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          setError(result.error);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      } else {
        const local = getProductByEAN(ean);
        if (local) {
          setLocalProduct(local);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          setShowManualForm(true);
          setError("Produto não encontrado no catálogo. Cadastre manualmente e ganhe +50 pts!");
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }
      }
    } catch {
      setError("Erro ao buscar produto. Tente novamente.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = () => {
    const name = manualName.trim();
    if (!name) return;
    addManualProduct(manualEan.trim(), name);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addToShoppingList({
      eanCode: manualEan.trim(),
      productName: name,
      quantity: 1,
      checked: false,
    });
    router.back();
  };

  const getBestPrice = (product: any) => {
    if (!product.prices?.length) return null;
    return product.prices.reduce((min: any, p: any) => (p.price < min.price ? p : min));
  };

  const displayName = cosmosProduct?.description || localProduct?.name || "";
  const displayBrand = cosmosProduct?.brand || localProduct?.brand || "";

  return (
    <View style={[styles.container, { backgroundColor: C.background, paddingTop: topPad, paddingBottom: bottomPad }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: C.text }]}>Escanear código</Text>
        <Pressable
          style={[styles.closeBtn, { backgroundColor: C.backgroundSecondary }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
        >
          <Feather name="x" size={20} color={C.text} />
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 16, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.cameraArea, { backgroundColor: "#111", borderColor: C.border }]}>
          <View style={styles.scannerOverlay}>
            <View style={[styles.scanCorner, styles.tlCorner]} />
            <View style={[styles.scanCorner, styles.trCorner]} />
            <View style={[styles.scanCorner, styles.blCorner]} />
            <View style={[styles.scanCorner, styles.brCorner]} />
            <View style={[styles.scanLine, { backgroundColor: C.primary }]} />
          </View>
          <Text style={styles.cameraHint}>Câmera disponível no app instalado</Text>
        </View>

        <Text style={[styles.orText, { color: C.textMuted }]}>ou digite o código manualmente</Text>

        <View style={[styles.inputRow, { backgroundColor: C.backgroundSecondary, marginHorizontal: 16 }]}>
          <MaterialCommunityIcons name="barcode-scan" size={20} color={C.textMuted} />
          <TextInput
            style={[styles.input, { color: C.text }]}
            placeholder="EAN-13: 7891000053508"
            placeholderTextColor={C.textMuted}
            value={manualEan}
            onChangeText={(t) => { setManualEan(t); resetState(); setError(""); }}
            keyboardType="numeric"
            maxLength={14}
            returnKeyType="search"
            onSubmitEditing={handleManualSearch}
          />
          {manualEan.length > 0 && (
            <Pressable onPress={() => { setManualEan(""); resetState(); setError(""); }}>
              <Feather name="x" size={16} color={C.textMuted} />
            </Pressable>
          )}
        </View>

        <View style={{ paddingHorizontal: 16 }}>
          <Text style={[styles.quickLabel, { color: C.textMuted }]}>Exemplos para testar:</Text>
          <View style={styles.quickRow}>
            {["7891000053508", "7891910000197", "7894900700015"].map((ean) => (
              <Pressable
                key={ean}
                style={[styles.quickChip, { backgroundColor: C.backgroundSecondary }]}
                onPress={() => { setManualEan(ean); resetState(); setError(""); }}
              >
                <Text style={[styles.quickChipText, { color: C.textSecondary }]}>{ean.slice(-6)}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Pressable
          style={[styles.searchBtn, { backgroundColor: loading ? C.textMuted : C.primary, marginHorizontal: 16 }]}
          onPress={handleManualSearch}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Feather name="search" size={18} color="#fff" />
          )}
          <Text style={styles.searchBtnText}>{loading ? "Buscando..." : "Buscar produto"}</Text>
        </Pressable>

        {error && !showManualForm ? (
          <View style={[styles.errorCard, { backgroundColor: "#CC000020", marginHorizontal: 16 }]}>
            <Feather name="alert-circle" size={16} color="#CC0000" />
            <Text style={[styles.errorText, { color: "#CC0000" }]}>{error}</Text>
          </View>
        ) : null}

        {(cosmosProduct || localProduct) && !showManualForm ? (
          <View style={[styles.foundCard, { backgroundColor: C.surfaceElevated, borderColor: C.primary, marginHorizontal: 16 }]}>
            {cosmosProduct?.thumbnailUrl ? (
              <Image
                source={{ uri: cosmosProduct.thumbnailUrl }}
                style={styles.productImage}
                resizeMode="contain"
              />
            ) : (
              <View style={[styles.foundIcon, { backgroundColor: C.primary + "20" }]}>
                <MaterialCommunityIcons name="package-variant" size={28} color={C.primary} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={[styles.foundName, { color: C.text }]}>{displayName}</Text>
              <Text style={[styles.foundBrand, { color: C.textMuted }]}>
                {displayBrand}{displayBrand ? " · " : ""}{manualEan.trim()}
              </Text>
              {cosmosProduct?.category ? (
                <Text style={[styles.foundCategory, { color: C.textSecondary }]}>{cosmosProduct.category}</Text>
              ) : null}
              {localProduct && getBestPrice(localProduct) && (
                <Text style={[styles.foundPrice, { color: C.primary }]}>
                  A partir de R$ {getBestPrice(localProduct).price.toFixed(2).replace(".", ",")} · {getBestPrice(localProduct).storeName}
                </Text>
              )}
            </View>
            <View style={styles.foundActions}>
              <Pressable
                style={[styles.foundBtn, { backgroundColor: C.primary }]}
                onPress={() => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  const best = localProduct ? getBestPrice(localProduct) : null;
                  addToShoppingList({
                    eanCode: manualEan.trim(),
                    productName: displayName,
                    quantity: 1,
                    checked: false,
                    bestPrice: best?.price,
                    bestStore: best?.storeName,
                  });
                  router.back();
                }}
              >
                <Feather name="plus" size={14} color="#fff" />
              </Pressable>
              {localProduct && (
                <Pressable
                  style={[styles.foundBtn, { backgroundColor: C.backgroundTertiary }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.replace({ pathname: "/product/[ean]", params: { ean: localProduct.ean } });
                  }}
                >
                  <Feather name="eye" size={14} color={C.text} />
                </Pressable>
              )}
            </View>
          </View>
        ) : null}

        {showManualForm ? (
          <View style={[styles.manualCard, { backgroundColor: C.surfaceElevated, borderColor: "#F59E0B", marginHorizontal: 16 }]}>
            <View style={[styles.manualHeader, { backgroundColor: "#F59E0B20" }]}>
              <Feather name="edit-3" size={16} color="#F59E0B" />
              <Text style={[styles.manualTitle, { color: C.text }]}>Cadastro manual (+50 pts)</Text>
            </View>
            <Text style={[styles.manualSubtitle, { color: C.textMuted }]}>
              EAN {manualEan.trim()} não encontrado. Ajude a comunidade cadastrando!
            </Text>
            <View style={[styles.inputRow, { backgroundColor: C.backgroundSecondary }]}>
              <Feather name="package" size={18} color={C.textMuted} />
              <TextInput
                style={[styles.input, { color: C.text }]}
                placeholder="Nome do produto..."
                placeholderTextColor={C.textMuted}
                value={manualName}
                onChangeText={setManualName}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleManualSubmit}
              />
            </View>
            <Pressable
              style={[styles.searchBtn, { backgroundColor: manualName.trim() ? "#F59E0B" : C.textMuted }]}
              onPress={handleManualSubmit}
              disabled={!manualName.trim()}
            >
              <Feather name="check" size={18} color="#fff" />
              <Text style={styles.searchBtnText}>Cadastrar e ganhar 50 pts</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 0, gap: 16 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16 },
  title: { fontSize: 20, fontFamily: "Inter_700Bold" },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  cameraArea: { marginHorizontal: 16, borderRadius: 20, height: 200, borderWidth: 1, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  scannerOverlay: { position: "absolute", width: 160, height: 100, alignItems: "center", justifyContent: "center" },
  scanCorner: { position: "absolute", width: 22, height: 22, borderColor: "#CC0000", borderWidth: 3 },
  tlCorner: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 6 },
  trCorner: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 6 },
  blCorner: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 6 },
  brCorner: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 6 },
  scanLine: { width: 140, height: 2, opacity: 0.8 },
  cameraHint: { color: "rgba(255,255,255,0.4)", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 60 },
  orText: { textAlign: "center", fontSize: 12, fontFamily: "Inter_400Regular" },
  inputRow: { flexDirection: "row", alignItems: "center", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  quickLabel: { fontSize: 11, fontFamily: "Inter_500Medium", marginBottom: 6 },
  quickRow: { flexDirection: "row", gap: 8 },
  quickChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  quickChipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  searchBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, paddingVertical: 14 },
  searchBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  errorCard: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, padding: 12 },
  errorText: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  foundCard: { flexDirection: "row", alignItems: "center", borderRadius: 16, padding: 14, borderWidth: 1.5, gap: 12 },
  productImage: { width: 56, height: 56, borderRadius: 10 },
  foundIcon: { width: 50, height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  foundName: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  foundBrand: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 1 },
  foundCategory: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 1 },
  foundPrice: { fontSize: 12, fontFamily: "Inter_700Bold", marginTop: 3 },
  foundActions: { flexDirection: "column", gap: 6 },
  foundBtn: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  manualCard: { borderRadius: 16, borderWidth: 1.5, overflow: "hidden", gap: 12, padding: 14 },
  manualHeader: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10, marginBottom: -4 },
  manualTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  manualSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
});
