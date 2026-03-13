import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Alert,
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
import { useApp } from "@/context/AppContext";

export default function RetailerScannerScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const C = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { getProductByEAN, updateRetailerProduct } = useApp();

  const [ean, setEan] = useState("");
  const [price, setPrice] = useState("");
  const [found, setFound] = useState<any>(null);
  const [error, setError] = useState("");

  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 34 : insets.bottom + 16;

  const handleSearch = () => {
    const code = ean.trim();
    if (!code) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const product = getProductByEAN(code);
    if (product) {
      setFound(product);
      setError("");
    } else {
      setFound(null);
      setError("EAN não encontrado no catálogo mestre");
    }
  };

  const handleSave = () => {
    const p = parseFloat(price.replace(",", "."));
    if (isNaN(p) || p <= 0) {
      Alert.alert("Preço inválido", "Digite um preço válido para o produto.");
      return;
    }
    if (!found) return;
    updateRetailerProduct(found.ean, p);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Atualizado!", `Preço de ${found.name} atualizado para R$ ${p.toFixed(2).replace(".", ",")}.`, [
      { text: "OK", onPress: () => router.back() },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: C.background, paddingTop: topPad, paddingBottom: bottomPad }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: C.text }]}>Cadastrar via EAN</Text>
        <Pressable
          style={[styles.closeBtn, { backgroundColor: C.backgroundSecondary }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
        >
          <Feather name="x" size={20} color={C.text} />
        </Pressable>
      </View>

      <Text style={[styles.subtitle, { color: C.textMuted, paddingHorizontal: 16 }]}>
        O catálogo mestre EAN garante nomes padronizados entre todos os mercados.
      </Text>

      {/* Camera */}
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

      {/* EAN Input */}
      <View style={[styles.inputRow, { backgroundColor: C.backgroundSecondary, marginHorizontal: 16 }]}>
        <MaterialCommunityIcons name="barcode-scan" size={20} color={C.textMuted} />
        <TextInput
          style={[styles.input, { color: C.text }]}
          placeholder="Código EAN-13..."
          placeholderTextColor={C.textMuted}
          value={ean}
          onChangeText={(t) => { setEan(t); setError(""); setFound(null); }}
          keyboardType="numeric"
          maxLength={14}
          returnKeyType="search"
          onSubmitEditing={handleSearch}
        />
      </View>

      <Pressable
        style={[styles.searchBtn, { backgroundColor: C.primary, marginHorizontal: 16 }]}
        onPress={handleSearch}
      >
        <Feather name="search" size={16} color="#fff" />
        <Text style={styles.searchBtnText}>Buscar no catálogo</Text>
      </Pressable>

      {error ? (
        <View style={[styles.errorCard, { backgroundColor: "#CC000015", marginHorizontal: 16 }]}>
          <Feather name="alert-circle" size={16} color="#CC0000" />
          <Text style={[styles.errorText, { color: "#CC0000" }]}>{error}</Text>
        </View>
      ) : null}

      {found ? (
        <View style={[styles.foundCard, { backgroundColor: C.surfaceElevated, borderColor: C.primary, marginHorizontal: 16 }]}>
          <View style={[styles.foundIcon, { backgroundColor: C.primary + "15" }]}>
            <MaterialCommunityIcons name="package-variant" size={26} color={C.primary} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.foundName, { color: C.text }]}>{found.name}</Text>
            <Text style={[styles.foundMeta, { color: C.textMuted }]}>{found.brand} · EAN: {found.ean}</Text>
            <View style={[styles.priceInputRow, { backgroundColor: C.backgroundSecondary }]}>
              <Text style={[styles.priceLabel, { color: C.textMuted }]}>R$</Text>
              <TextInput
                style={[styles.priceInput, { color: C.text }]}
                placeholder="0,00"
                placeholderTextColor={C.textMuted}
                value={price}
                onChangeText={setPrice}
                keyboardType="decimal-pad"
                autoFocus
              />
            </View>
            <Pressable
              style={[styles.saveBtn, { backgroundColor: C.primary }]}
              onPress={handleSave}
            >
              <Feather name="check" size={16} color="#fff" />
              <Text style={styles.saveBtnText}>Salvar preço</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={[styles.info, { backgroundColor: isDark ? C.backgroundTertiary : "#FFF8F8", borderColor: C.primary + "30", marginHorizontal: 16 }]}>
        <Feather name="shield" size={14} color={C.primary} />
        <Text style={[styles.infoText, { color: C.textSecondary }]}>
          Compatível com PDV: CSV, TXT, XML. Importação em lote disponível no painel web.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 14 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16 },
  title: { fontSize: 20, fontFamily: "Inter_700Bold" },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  cameraArea: { marginHorizontal: 16, borderRadius: 20, height: 160, borderWidth: 1, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  scannerOverlay: { position: "absolute", width: 160, height: 90, alignItems: "center", justifyContent: "center" },
  scanCorner: { position: "absolute", width: 20, height: 20, borderColor: "#CC0000", borderWidth: 3 },
  tlCorner: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 5 },
  trCorner: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 5 },
  blCorner: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 5 },
  brCorner: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 5 },
  scanLine: { width: 130, height: 2, opacity: 0.8 },
  cameraHint: { color: "rgba(255,255,255,0.4)", fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 50 },
  inputRow: { flexDirection: "row", alignItems: "center", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  searchBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, paddingVertical: 13, marginHorizontal: 16 },
  searchBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  errorCard: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, padding: 12 },
  errorText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  foundCard: { borderRadius: 16, padding: 14, borderWidth: 1.5, flexDirection: "row", gap: 12, alignItems: "flex-start" },
  foundIcon: { width: 46, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  foundName: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  foundMeta: { fontSize: 10, fontFamily: "Inter_400Regular" },
  priceInputRow: { flexDirection: "row", alignItems: "center", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, gap: 4 },
  priceLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  priceInput: { flex: 1, fontSize: 16, fontFamily: "Inter_700Bold" },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 10, paddingVertical: 10 },
  saveBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  info: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, padding: 12, borderWidth: 1 },
  infoText: { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },
});
