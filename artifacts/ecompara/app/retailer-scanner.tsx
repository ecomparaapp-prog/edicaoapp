import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { useApp, type Product } from "@/context/AppContext";
import type { CosmosProduct } from "@/services/cosmosService";

type BulkRow = { ean: string; name: string; price: string; status: "pending" | "ok" | "error" };

function parseCSV(text: string): BulkRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const rows: BulkRow[] = [];
  for (const line of lines) {
    const sep = line.includes(";") ? ";" : ",";
    const parts = line.split(sep).map((p) => p.trim().replace(/^["']|["']$/g, ""));
    if (parts.length < 2) continue;
    const ean = parts[0].replace(/\D/g, "");
    if (ean.length < 7) continue;
    const name = parts[1] || "";
    const price = parts[2] ? parts[2].replace(",", ".") : "";
    rows.push({ ean, name, price, status: "pending" });
  }
  return rows;
}

export default function RetailerScannerScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const C = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { getProductByEAN, updateRetailerProduct, lookupEAN, addManualProduct, user, isLoggedIn, merchantSession, merchantSessionLoaded } = useApp();

  const isMerchant = merchantSession !== null;
  const isRetailerUser = isLoggedIn && user?.role === "retailer";
  const hasAccess = isMerchant || isRetailerUser;

  useEffect(() => {
    if (merchantSessionLoaded && !hasAccess) {
      router.replace("/(auth)/merchant-login");
    }
  }, [merchantSessionLoaded, hasAccess]);

  if (!merchantSessionLoaded) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: isDark ? Colors.dark.background : Colors.light.background }}>
        <ActivityIndicator size="large" color={C.primary} />
        <Text style={{ color: C.textMuted, fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 12 }}>
          Verificando acesso...
        </Text>
      </View>
    );
  }

  if (!hasAccess) {
    return null;
  }

  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 34 : insets.bottom + 16;

  const [tab, setTab] = useState<"individual" | "lote">("individual");

  // ── Individual ──────────────────────────────────────────────
  const [ean, setEan] = useState("");
  const [price, setPrice] = useState("");
  const [cosmosProduct, setCosmosProduct] = useState<CosmosProduct | null>(null);
  const [localProduct, setLocalProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualName, setManualName] = useState("");

  // ── Bulk ─────────────────────────────────────────────────────
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [bulkDone, setBulkDone] = useState(false);

  const resetState = () => {
    setCosmosProduct(null);
    setLocalProduct(null);
    setError("");
    setShowManualForm(false);
    setManualName("");
    setPrice("");
  };

  const handleSearch = async () => {
    const code = ean.trim();
    if (!code) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    resetState();
    setLoading(true);
    try {
      const result = await lookupEAN(code);
      if (result.found && result.product) {
        setCosmosProduct(result.product);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const local = getProductByEAN(code);
        if (local) setLocalProduct(local);
      } else if (result.error) {
        const local = getProductByEAN(code);
        if (local) {
          setLocalProduct(local);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          setError(result.error);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      } else {
        const local = getProductByEAN(code);
        if (local) {
          setLocalProduct(local);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          setShowManualForm(true);
          setError("EAN não encontrado. Cadastre manualmente e ganhe +50 pts!");
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

  const handleSave = () => {
    const p = parseFloat(price.replace(",", "."));
    if (isNaN(p) || p <= 0) { Alert.alert("Preço inválido", "Digite um preço válido."); return; }
    const productEan = ean.trim();
    const productName = cosmosProduct?.description || localProduct?.name || manualName.trim();
    if (!productName) return;
    updateRetailerProduct(productEan, p);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Atualizado!", `Preço de ${productName} atualizado para R$ ${p.toFixed(2).replace(".", ",")}.`, [
      { text: "OK", onPress: () => router.back() },
    ]);
  };

  const handleManualSubmit = () => {
    const name = manualName.trim();
    if (!name) return;
    const productEan = ean.trim();
    addManualProduct(productEan, name);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const newProduct: Product = { ean: productEan, name, brand: "Manual", category: "Outros", prices: [] };
    setLocalProduct(newProduct);
    setShowManualForm(false);
    setCosmosProduct(null);
    setError("");
  };

  // ── Bulk handlers ────────────────────────────────────────────
  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/csv", "text/plain", "text/comma-separated-values", "*/*"],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      setBulkLoading(true);
      try {
        const content = await FileSystem.readAsStringAsync(asset.uri);
        const rows = parseCSV(content);
        if (rows.length === 0) {
          Alert.alert("Arquivo vazio", "Nenhuma linha válida encontrada. Verifique o formato.");
          return;
        }
        setBulkRows(rows);
        setBulkDone(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        Alert.alert("Erro de leitura", "Não foi possível ler o arquivo. Tente um arquivo .csv ou .txt.");
      } finally {
        setBulkLoading(false);
      }
    } catch {
      Alert.alert("Erro", "Não foi possível abrir o seletor de arquivos.");
    }
  };

  const handleParsePaste = () => {
    const rows = parseCSV(pasteText);
    if (rows.length === 0) { Alert.alert("Nenhuma linha válida", "Verifique o formato: EAN;Nome;Preço"); return; }
    setBulkRows(rows);
    setBulkDone(false);
    setShowPaste(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const updateBulkPrice = (idx: number, val: string) => {
    setBulkRows((prev) => prev.map((r, i) => i === idx ? { ...r, price: val } : r));
  };

  const handleSaveBulk = () => {
    const invalid = bulkRows.filter((r) => !r.price || isNaN(parseFloat(r.price.replace(",", "."))));
    if (invalid.length > 0) {
      Alert.alert("Preços incompletos", `${invalid.length} produto(s) sem preço válido. Preencha todos os preços antes de salvar.`);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const updated: BulkRow[] = bulkRows.map((r) => {
      try {
        const p = parseFloat(r.price.replace(",", "."));
        updateRetailerProduct(r.ean, p);
        return { ...r, status: "ok" as const };
      } catch {
        return { ...r, status: "error" as const };
      }
    });
    setBulkRows(updated);
    setBulkDone(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const okCount = bulkRows.filter((r) => r.status === "ok").length;
  const errCount = bulkRows.filter((r) => r.status === "error").length;
  const displayName = cosmosProduct?.description || localProduct?.name || "";
  const displayBrand = cosmosProduct?.brand || localProduct?.brand || "";

  return (
    <View style={[styles.container, { backgroundColor: C.background, paddingTop: topPad, paddingBottom: bottomPad }]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: C.text }]}>Cadastrar Produtos</Text>
        <Pressable style={[styles.closeBtn, { backgroundColor: C.backgroundSecondary }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}>
          <Feather name="x" size={20} color={C.text} />
        </Pressable>
      </View>

      {/* Tab switcher */}
      <View style={[styles.tabBar, { backgroundColor: C.backgroundSecondary, marginHorizontal: 16 }]}>
        <Pressable onPress={() => setTab("individual")} style={[styles.tabItem, tab === "individual" && { backgroundColor: C.primary, borderRadius: 10 }]}>
          <Feather name="search" size={14} color={tab === "individual" ? "#fff" : C.textMuted} />
          <Text style={[styles.tabLabel, { color: tab === "individual" ? "#fff" : C.textMuted }]}>Individual (EAN)</Text>
        </Pressable>
        <Pressable onPress={() => setTab("lote")} style={[styles.tabItem, tab === "lote" && { backgroundColor: C.primary, borderRadius: 10 }]}>
          <Feather name="upload" size={14} color={tab === "lote" ? "#fff" : C.textMuted} />
          <Text style={[styles.tabLabel, { color: tab === "lote" ? "#fff" : C.textMuted }]}>Em Lote (CSV)</Text>
        </Pressable>
      </View>

      {/* ── INDIVIDUAL TAB ── */}
      {tab === "individual" && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 14, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
          <Text style={[styles.subtitle, { color: C.textMuted, paddingHorizontal: 16 }]}>
            Busca automática no catálogo Cosmos com 26M+ de produtos brasileiros.
          </Text>

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

          <View style={[styles.inputRow, { backgroundColor: C.backgroundSecondary, marginHorizontal: 16 }]}>
            <MaterialCommunityIcons name="barcode-scan" size={20} color={C.textMuted} />
            <TextInput
              style={[styles.input, { color: C.text }]}
              placeholder="Código EAN-13..."
              placeholderTextColor={C.textMuted}
              value={ean}
              onChangeText={(t) => { setEan(t); resetState(); setError(""); }}
              keyboardType="numeric"
              maxLength={14}
              returnKeyType="search"
              onSubmitEditing={handleSearch}
            />
          </View>

          <Pressable style={[styles.searchBtn, { backgroundColor: loading ? C.textMuted : C.primary, marginHorizontal: 16 }]} onPress={handleSearch} disabled={loading}>
            {loading ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="search" size={16} color="#fff" />}
            <Text style={styles.searchBtnText}>{loading ? "Consultando Cosmos..." : "Buscar no catálogo"}</Text>
          </Pressable>

          {error && !showManualForm ? (
            <View style={[styles.errorCard, { backgroundColor: "#CC000015", marginHorizontal: 16 }]}>
              <Feather name="alert-circle" size={16} color="#CC0000" />
              <Text style={[styles.errorText, { color: "#CC0000" }]}>{error}</Text>
            </View>
          ) : null}

          {showManualForm ? (
            <View style={[styles.manualCard, { backgroundColor: C.surfaceElevated, borderColor: "#F59E0B", marginHorizontal: 16 }]}>
              <View style={[styles.manualHeader, { backgroundColor: "#F59E0B20" }]}>
                <Feather name="edit-3" size={16} color="#F59E0B" />
                <Text style={[styles.manualTitle, { color: C.text }]}>Cadastro manual (+50 pts)</Text>
              </View>
              <Text style={[styles.manualSubtitle, { color: C.textMuted }]}>EAN {ean.trim()} não encontrado. Cadastre o nome do produto:</Text>
              <View style={[styles.inputRow, { backgroundColor: C.backgroundSecondary }]}>
                <Feather name="package" size={18} color={C.textMuted} />
                <TextInput style={[styles.input, { color: C.text }]} placeholder="Nome do produto..." placeholderTextColor={C.textMuted} value={manualName} onChangeText={setManualName} autoFocus returnKeyType="done" onSubmitEditing={handleManualSubmit} />
              </View>
              <Pressable style={[styles.searchBtn, { backgroundColor: manualName.trim() ? "#F59E0B" : C.textMuted }]} onPress={handleManualSubmit} disabled={!manualName.trim()}>
                <Feather name="check" size={18} color="#fff" />
                <Text style={styles.searchBtnText}>Cadastrar e ganhar 50 pts</Text>
              </Pressable>
            </View>
          ) : null}

          {(cosmosProduct || localProduct) && !showManualForm ? (
            <View style={[styles.foundCard, { backgroundColor: C.surfaceElevated, borderColor: C.primary, marginHorizontal: 16 }]}>
              {cosmosProduct?.thumbnailUrl ? (
                <Image source={{ uri: cosmosProduct.thumbnailUrl }} style={styles.productImage} contentFit="contain" transition={200} />
              ) : (
                <View style={[styles.foundIcon, { backgroundColor: C.primary + "15" }]}>
                  <MaterialCommunityIcons name="package-variant" size={26} color={C.primary} />
                </View>
              )}
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[styles.foundName, { color: C.text }]}>{displayName}</Text>
                <Text style={[styles.foundMeta, { color: C.textMuted }]}>{displayBrand}{displayBrand ? " · " : ""}EAN: {ean.trim()}</Text>
                {cosmosProduct?.category ? <Text style={[styles.foundCategory, { color: C.textSecondary }]}>{cosmosProduct.category}</Text> : null}
                <View style={[styles.priceInputRow, { backgroundColor: C.backgroundSecondary }]}>
                  <Text style={[styles.priceLabel, { color: C.textMuted }]}>R$</Text>
                  <TextInput style={[styles.priceInput, { color: C.text }]} placeholder="0,00" placeholderTextColor={C.textMuted} value={price} onChangeText={setPrice} keyboardType="decimal-pad" autoFocus />
                </View>
                <Pressable style={[styles.saveBtn, { backgroundColor: C.primary }]} onPress={handleSave}>
                  <Feather name="check" size={16} color="#fff" />
                  <Text style={styles.saveBtnText}>Salvar preço</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}

      {/* ── LOTE TAB ── */}
      {tab === "lote" && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 14, padding: 16, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>

          {/* Format guide */}
          <View style={[styles.formatCard, { backgroundColor: isDark ? "#1a2a1a" : "#F0FFF4", borderColor: "#4CAF5040" }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Feather name="file-text" size={15} color="#4CAF50" />
              <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: "#4CAF50" }}>Formato do arquivo</Text>
            </View>
            <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: C.textSecondary, lineHeight: 18 }}>
              Arquivo CSV ou TXT com separador <Text style={{ fontFamily: "Inter_600SemiBold" }}>; (ponto e vírgula)</Text> ou <Text style={{ fontFamily: "Inter_600SemiBold" }}>,(vírgula)</Text>:{"\n"}
            </Text>
            <View style={{ backgroundColor: isDark ? "#0d1f0d" : "#e8f5e9", borderRadius: 8, padding: 10 }}>
              <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: isDark ? "#81C784" : "#2E7D32", lineHeight: 18 }}>
                EAN;Nome do produto;Preço{"\n"}
                7891234560019;Leite Integral 1L;5,49{"\n"}
                7896234560021;Arroz Tipo 1 5kg;24,90{"\n"}
                7891234560041;Feijão Carioca 1kg;8,70
              </Text>
            </View>
            <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: C.textMuted, marginTop: 8, lineHeight: 16 }}>
              A coluna "Nome" é opcional quando o EAN já está cadastrado. A coluna "Preço" pode ser preenchida na tela.
            </Text>
          </View>

          {/* Action buttons */}
          {bulkRows.length === 0 && (
            <View style={{ gap: 10 }}>
              <Pressable
                onPress={handlePickDocument}
                disabled={bulkLoading}
                style={{ backgroundColor: C.primary, borderRadius: 14, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 }}
              >
                {bulkLoading ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="upload" size={18} color="#fff" />}
                <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 }}>
                  {bulkLoading ? "Lendo arquivo..." : "Selecionar arquivo CSV/TXT"}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setShowPaste(!showPaste)}
                style={{ backgroundColor: C.surfaceElevated, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: C.border }}
              >
                <Feather name="clipboard" size={16} color={C.textMuted} />
                <Text style={{ color: C.textMuted, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>Colar texto diretamente</Text>
              </Pressable>

              {showPaste && (
                <View style={{ gap: 8 }}>
                  <TextInput
                    value={pasteText}
                    onChangeText={setPasteText}
                    placeholder={"EAN;Nome;Preço\n7891234560019;Leite;5,49\n..."}
                    placeholderTextColor={C.textMuted}
                    multiline
                    numberOfLines={7}
                    style={{ backgroundColor: C.surfaceElevated, borderRadius: 12, padding: 14, color: C.text, fontFamily: "Inter_400Regular", fontSize: 13, borderWidth: 1, borderColor: C.border, minHeight: 120, textAlignVertical: "top" }}
                  />
                  <Pressable
                    onPress={handleParsePaste}
                    style={{ backgroundColor: "#2196F3", borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
                  >
                    <Feather name="check-circle" size={16} color="#fff" />
                    <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 }}>Processar texto</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}

          {/* Parsed rows table */}
          {bulkRows.length > 0 && (
            <View style={{ gap: 10 }}>
              {/* Summary header */}
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: C.text }}>
                  {bulkRows.length} produto{bulkRows.length !== 1 ? "s" : ""} encontrado{bulkRows.length !== 1 ? "s" : ""}
                </Text>
                <Pressable onPress={() => { setBulkRows([]); setBulkDone(false); setPasteText(""); }} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Feather name="refresh-cw" size={13} color={C.primary} />
                  <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: C.primary }}>Novo arquivo</Text>
                </Pressable>
              </View>

              {/* Result summary (after save) */}
              {bulkDone && (
                <View style={{ backgroundColor: "#4CAF5015", borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: "#4CAF5040" }}>
                  <Feather name="check-circle" size={22} color="#4CAF50" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: "#4CAF50" }}>Importação concluída!</Text>
                    <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: C.textSecondary }}>
                      {okCount} atualizados{errCount > 0 ? ` · ${errCount} com erro` : ""}
                    </Text>
                  </View>
                </View>
              )}

              {/* Table header */}
              <View style={{ flexDirection: "row", paddingHorizontal: 12, paddingVertical: 6 }}>
                <Text style={{ flex: 2, fontSize: 10, fontFamily: "Inter_600SemiBold", color: C.textMuted }}>EAN / PRODUTO</Text>
                <Text style={{ width: 90, fontSize: 10, fontFamily: "Inter_600SemiBold", color: C.textMuted, textAlign: "right" }}>PREÇO (R$)</Text>
              </View>

              {/* Rows */}
              {bulkRows.map((row, idx) => (
                <View key={idx} style={[styles.bulkRow, { backgroundColor: C.surfaceElevated, borderColor: row.status === "ok" ? "#4CAF5030" : row.status === "error" ? "#F4433630" : C.border }]}>
                  {row.status === "ok" && <View style={[styles.bulkStatusBar, { backgroundColor: "#4CAF50" }]} />}
                  {row.status === "error" && <View style={[styles.bulkStatusBar, { backgroundColor: "#F44336" }]} />}
                  {row.status === "pending" && <View style={[styles.bulkStatusBar, { backgroundColor: C.border }]} />}
                  <View style={{ flex: 1, paddingLeft: 8 }}>
                    <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: C.text }} numberOfLines={1}>
                      {row.name || "Produto sem nome"}
                    </Text>
                    <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: C.textMuted }}>{row.ean}</Text>
                  </View>
                  <View style={[styles.bulkPriceInput, { backgroundColor: C.backgroundSecondary }]}>
                    <Text style={{ fontSize: 11, color: C.textMuted, fontFamily: "Inter_400Regular" }}>R$</Text>
                    <TextInput
                      value={row.price}
                      onChangeText={(v) => updateBulkPrice(idx, v)}
                      keyboardType="decimal-pad"
                      placeholder="0,00"
                      placeholderTextColor={C.textMuted}
                      style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: C.text, minWidth: 56, textAlign: "right" }}
                      editable={!bulkDone}
                    />
                  </View>
                </View>
              ))}

              {/* Save all button */}
              {!bulkDone && (
                <Pressable
                  onPress={handleSaveBulk}
                  style={{ backgroundColor: C.primary, borderRadius: 14, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 4 }}
                >
                  <Feather name="save" size={18} color="#fff" />
                  <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 }}>
                    Salvar {bulkRows.length} produto{bulkRows.length !== 1 ? "s" : ""}
                  </Text>
                </Pressable>
              )}

              {bulkDone && (
                <Pressable
                  onPress={() => router.back()}
                  style={{ backgroundColor: "#4CAF50", borderRadius: 14, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 4 }}
                >
                  <Feather name="check" size={18} color="#fff" />
                  <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 }}>Concluir</Text>
                </Pressable>
              )}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 12 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16 },
  title: { fontSize: 20, fontFamily: "Inter_700Bold" },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  tabBar: { flexDirection: "row", borderRadius: 12, padding: 4, gap: 4 },
  tabItem: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, paddingHorizontal: 4 },
  tabLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
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
  searchBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, paddingVertical: 13 },
  searchBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  errorCard: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, padding: 12 },
  errorText: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  foundCard: { borderRadius: 16, padding: 14, borderWidth: 1.5, flexDirection: "row", gap: 12, alignItems: "flex-start" },
  productImage: { width: 52, height: 52, borderRadius: 10 },
  foundIcon: { width: 46, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  foundName: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  foundMeta: { fontSize: 10, fontFamily: "Inter_400Regular" },
  foundCategory: { fontSize: 10, fontFamily: "Inter_400Regular" },
  priceInputRow: { flexDirection: "row", alignItems: "center", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, gap: 4 },
  priceLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  priceInput: { flex: 1, fontSize: 16, fontFamily: "Inter_700Bold" },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 10, paddingVertical: 10 },
  saveBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  manualCard: { borderRadius: 16, borderWidth: 1.5, overflow: "hidden", gap: 12, padding: 14 },
  manualHeader: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10, marginBottom: -4 },
  manualTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  manualSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  formatCard: { borderRadius: 16, padding: 14, borderWidth: 1 },
  bulkRow: { borderRadius: 12, borderWidth: 1, flexDirection: "row", alignItems: "center", overflow: "hidden" },
  bulkStatusBar: { width: 4, alignSelf: "stretch" },
  bulkPriceInput: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginRight: 10, marginVertical: 10 },
});
