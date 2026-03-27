import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import {
  ActivityIndicator,
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
import { validateNfce, type NfceItem } from "@/services/nfceService";

/* ── Exemplos de NFC-e do Distrito Federal (estado 53) para testes ── */
const MOCK_NOTAS: Record<string, {
  storeName: string; storeId: string; storeCNPJ: string;
  items: NfceItem[];
}> = {
  // Exemplo 1 — Tatico Supermercados, Santa Maria DF (5 itens = 150 pts)
  "53260307280903000173650010001245671123456789": {
    storeName: "Tatico Supermercados Santa Maria", storeId: "1", storeCNPJ: "07.280.903/0001-73",
    items: [
      { ean: "7891000053508", name: "Leite Integral Parmalat 1L", qty: 2, unit: "UN", price: 5.49 },
      { ean: "7891910000197", name: "Arroz Tio João 5kg", qty: 1, unit: "UN", price: 22.90 },
      { ean: "7894900700015", name: "Coca-Cola 2L", qty: 2, unit: "UN", price: 8.79 },
      { ean: "7891000310755", name: "Açúcar Cristal União 1kg", qty: 1, unit: "UN", price: 4.49 },
      { ean: "7896004804009", name: "Óleo de Soja Liza 900ml", qty: 1, unit: "UN", price: 7.19 },
    ],
  },
  // Exemplo 2 — Comper Supermercado, Santa Maria DF (12 itens = 300 pts, bônus 2x)
  "53260326729748000182650010000894321987654328": {
    storeName: "Comper Supermercado Santa Maria", storeId: "2", storeCNPJ: "26.729.748/0001-82",
    items: [
      { ean: "7891910000197", name: "Arroz Tio João 5kg", qty: 2, unit: "UN", price: 21.50 },
      { ean: "7891000053508", name: "Leite Integral Parmalat 1L", qty: 3, unit: "UN", price: 5.19 },
      { ean: "7894900700015", name: "Coca-Cola 2L", qty: 2, unit: "UN", price: 8.29 },
      { ean: "7891000310755", name: "Açúcar Cristal União 1kg", qty: 2, unit: "UN", price: 4.29 },
      { ean: "7896004804009", name: "Óleo de Soja Liza 900ml", qty: 2, unit: "UN", price: 6.89 },
      { ean: "7891149100006", name: "Macarrão Penne Barilla 500g", qty: 3, unit: "UN", price: 3.99 },
      { ean: "7891700201035", name: "Farinha de Trigo Dona Benta 1kg", qty: 1, unit: "UN", price: 4.59 },
      { ean: "7896007801015", name: "Sabão em Pó OMO 1kg", qty: 1, unit: "UN", price: 11.49 },
      { ean: "7891150062144", name: "Biscoito Recheado Oreo 144g", qty: 2, unit: "UN", price: 3.89 },
      { ean: "7891962047706", name: "Café Pilão Torrado 500g", qty: 1, unit: "UN", price: 13.99 },
      { ean: "7891000100103", name: "Leite Condensado Moça 395g", qty: 2, unit: "UN", price: 6.29 },
      { ean: "7896036090022", name: "Vinagre de Maçã Heinz 750ml", qty: 1, unit: "UN", price: 4.19 },
    ],
  },
  // Exemplo 3 — Atacadão Santa Maria DF (8 itens = 150 pts)
  "53260375315333000109650010003456781112233445": {
    storeName: "Atacadão Santa Maria", storeId: "4", storeCNPJ: "75.315.333/0001-09",
    items: [
      { ean: "7891910000197", name: "Arroz Tio João 5kg", qty: 5, unit: "UN", price: 19.99 },
      { ean: "7891000053508", name: "Leite Integral Parmalat 1L", qty: 12, unit: "UN", price: 4.79 },
      { ean: "7891000310755", name: "Açúcar Cristal União 5kg", qty: 2, unit: "UN", price: 18.90 },
      { ean: "7896004804009", name: "Óleo de Soja Liza 900ml", qty: 6, unit: "UN", price: 6.49 },
      { ean: "7896007801015", name: "Sabão em Pó OMO 3kg", qty: 1, unit: "UN", price: 29.90 },
      { ean: "7891962047706", name: "Café Pilão Torrado 500g", qty: 3, unit: "UN", price: 12.99 },
      { ean: "7894900700015", name: "Coca-Cola 2L", qty: 6, unit: "UN", price: 7.99 },
      { ean: "7891149100006", name: "Macarrão Penne 500g", qty: 4, unit: "UN", price: 3.29 },
    ],
  },
};

const SAMPLE_KEYS = [
  "53260307280903000173650010001245671123456789",
  "53260326729748000182650010000894321987654328",
  "53260375315333000109650010003456781112233445",
];

interface NotaData {
  storeName: string;
  storeCNPJ: string;
  storeId?: string;
  items: NfceItem[];
  totalValue: number;
}

export default function NFCeScannerScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const C = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top;

  const { processNFCe, seenChNFe, user } = useApp();

  const [chNFeInput, setChNFeInput] = useState("");
  const [parsedNota, setParsedNota] = useState<NotaData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ ok: boolean; duplicate: boolean; points: number } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [apiSource, setApiSource] = useState<"api" | "mock" | null>(null);
  const [itemsSource, setItemsSource] = useState<"client" | "sefaz" | "unavailable" | null>(null);

  const handleParse = async () => {
    const key = chNFeInput.trim().replace(/\s/g, "");
    if (key.length !== 44) {
      setError("Chave deve ter 44 dígitos. Verifique e tente novamente.");
      setParsedNota(null);
      return;
    }
    setLoading(true);
    setError("");
    setParsedNota(null);
    setResult(null);
    setConfirmed(false);
    setApiSource(null);
    setItemsSource(null);

    // Try the real API first (validates, deduplicates, enriches via ReceitaWS)
    const userId = user?.id ?? "anon_" + Date.now();
    const mockData = MOCK_NOTAS[key];
    const apiResult = await validateNfce(key, userId, mockData?.storeId, mockData?.items);

    if (apiResult.ok && apiResult.customer) {
      // API validated and processed successfully
      const src = (apiResult as any).itemsSource as "client" | "sefaz" | "unavailable" ?? "unavailable";
      setItemsSource(src);
      const nota: NotaData = {
        storeName: apiResult.customer.storeName,
        storeCNPJ: apiResult.customer.cnpj,
        items: apiResult.merchant?.items ?? mockData?.items ?? [],
        totalValue: apiResult.customer.totalValue,
      };
      setParsedNota(nota);
      setApiSource("api");

      // Also update local state for immediate UI feedback (points, etc.)
      const r = processNFCe(
        key,
        mockData?.storeId ?? `cnpj:${apiResult.customer.cnpj}`,
        apiResult.customer.storeName,
        apiResult.customer.cnpj,
        (apiResult.merchant?.items ?? []).map((i) => ({ ean: i.ean, name: i.name, price: i.price })),
      );
      setResult({ ok: true, duplicate: false, points: apiResult.customer.points });
      setConfirmed(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setLoading(false);
      return;
    }

    if (apiResult.duplicate) {
      // Already processed by someone — no points, show warning
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError("Esta nota já foi processada. Nenhum ponto será concedido para evitar fraude.");
      setResult({ ok: false, duplicate: true, points: 0 });
      setConfirmed(true);
      setLoading(false);
      return;
    }

    // API error (network, no DB, etc.) — fall back to mock data for demo/testing
    if (mockData) {
      setParsedNota({
        storeName: mockData.storeName,
        storeCNPJ: mockData.storeCNPJ,
        storeId: mockData.storeId,
        items: mockData.items,
        totalValue: mockData.items.reduce((s, i) => s + i.price * i.qty, 0),
      });
      setApiSource("mock");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      setError("Nota não encontrada. Tente com os exemplos abaixo ou verifique sua conexão.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }

    setLoading(false);
  };

  const handleConfirm = () => {
    if (!parsedNota) return;
    const key = chNFeInput.trim().replace(/\s/g, "");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const r = processNFCe(
      key,
      parsedNota.storeId ?? `cnpj:${parsedNota.storeCNPJ}`,
      parsedNota.storeName,
      parsedNota.storeCNPJ,
      parsedNota.items.map((i) => ({ ean: i.ean, name: i.name, price: i.price })),
    );
    setResult(r);
    setConfirmed(true);
  };

  const isAlreadySeen = chNFeInput.trim().length === 44 && seenChNFe.has(chNFeInput.trim());
  const totalValue = parsedNota ? parsedNota.totalValue : 0;
  const previewPoints = parsedNota
    ? Math.round(150 * (parsedNota.items.length > 10 ? 2 : 1))
    : 0;

  return (
    <View style={[styles.container, { backgroundColor: C.background, paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.title, { color: C.text }]}>Nota Fiscal</Text>
          <Text style={[styles.titleSub, { color: C.textMuted }]}>Escaneie e ganhe pontos</Text>
        </View>
        <Pressable style={[styles.closeBtn, { backgroundColor: C.backgroundSecondary }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}>
          <Feather name="x" size={20} color={C.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
        {/* How it works */}
        <View style={[styles.infoCard, { backgroundColor: "#CC000010", marginHorizontal: 16 }]}>
          <MaterialCommunityIcons name="receipt" size={20} color="#CC0000" />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.infoTitle, { color: C.text }]}>Como funciona</Text>
            <Text style={[styles.infoDesc, { color: C.textMuted }]}>
              Escaneie o QR Code da nota fiscal eletrônica. Os preços são extraídos, validados e atualizados no mapa — você ganha 150 pts. Se a nota tiver mais de 10 itens, os pontos dobram!
            </Text>
          </View>
        </View>

        {/* Camera placeholder */}
        <View style={[styles.cameraArea, { backgroundColor: "#111", borderColor: C.border, marginHorizontal: 16 }]}>
          <View style={styles.scannerOverlay}>
            <View style={[styles.scanCorner, styles.tlCorner]} />
            <View style={[styles.scanCorner, styles.trCorner]} />
            <View style={[styles.scanCorner, styles.blCorner]} />
            <View style={[styles.scanCorner, styles.brCorner]} />
          </View>
          <MaterialCommunityIcons name="qrcode-scan" size={40} color="rgba(255,255,255,0.25)" />
          <Text style={styles.cameraHint}>Câmera disponível no app instalado</Text>
        </View>

        <Text style={[styles.orText, { color: C.textMuted }]}>ou cole a chave da nota (44 dígitos)</Text>

        {/* Input */}
        <View style={{ marginHorizontal: 16, gap: 8 }}>
          <View style={[styles.inputRow, { backgroundColor: C.backgroundSecondary }]}>
            <MaterialCommunityIcons name="key-variant" size={18} color={C.textMuted} />
            <TextInput
              style={[styles.input, { color: C.text }]}
              placeholder="Chave de acesso NFC-e (44 dígitos)"
              placeholderTextColor={C.textMuted}
              value={chNFeInput}
              onChangeText={(t) => { setChNFeInput(t); setParsedNota(null); setError(""); setResult(null); setConfirmed(false); setApiSource(null); }}
              keyboardType="numeric"
              maxLength={44}
              returnKeyType="done"
              onSubmitEditing={handleParse}
            />
            {chNFeInput.length > 0 && (
              <Pressable onPress={() => { setChNFeInput(""); setParsedNota(null); setError(""); setResult(null); setConfirmed(false); setApiSource(null); }}>
                <Feather name="x" size={16} color={C.textMuted} />
              </Pressable>
            )}
          </View>

          {/* char count */}
          <Text style={[styles.charCount, { color: chNFeInput.length === 44 ? C.success : C.textMuted }]}>
            {chNFeInput.length}/44 dígitos{chNFeInput.length === 44 ? " ✓" : ""}
          </Text>

          {/* Sample keys */}
          <Text style={[styles.quickLabel, { color: C.textMuted }]}>Exemplos para testar:</Text>
          {SAMPLE_KEYS.map((key) => (
            <Pressable
              key={key}
              style={[styles.sampleChip, { backgroundColor: C.backgroundSecondary, borderColor: C.border, opacity: seenChNFe.has(key) ? 0.5 : 1 }]}
              onPress={() => { setChNFeInput(key); setParsedNota(null); setError(""); setResult(null); setConfirmed(false); setApiSource(null); }}
            >
              <MaterialCommunityIcons name="file-document-outline" size={14} color={seenChNFe.has(key) ? C.textMuted : C.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.sampleKey, { color: seenChNFe.has(key) ? C.textMuted : C.text }]} numberOfLines={1}>{key.slice(0, 20)}…</Text>
                <Text style={[styles.sampleMeta, { color: C.textMuted }]}>{MOCK_NOTAS[key]?.storeName ?? "—"} · {MOCK_NOTAS[key]?.items.length ?? 0} itens</Text>
              </View>
              {seenChNFe.has(key) ? (
                <View style={styles.usedBadge}><Text style={styles.usedBadgeTxt}>Usada</Text></View>
              ) : (
                <View style={styles.ptsBadge}><Text style={styles.ptsBadgeTxt}>+{(MOCK_NOTAS[key]?.items.length ?? 0) > 10 ? 300 : 150} pts</Text></View>
              )}
            </Pressable>
          ))}
        </View>

        {/* Process button */}
        {!confirmed && (
          <Pressable
            style={[styles.processBtn, { backgroundColor: loading ? C.textMuted : "#CC0000", marginHorizontal: 16, opacity: chNFeInput.length !== 44 ? 0.5 : 1 }]}
            onPress={handleParse}
            disabled={loading || chNFeInput.length !== 44}
          >
            {loading ? <ActivityIndicator size="small" color="#fff" /> : <MaterialCommunityIcons name="cloud-search" size={18} color="#fff" />}
            <Text style={styles.processBtnTxt}>{loading ? "Consultando SEFAZ..." : "Consultar nota fiscal"}</Text>
          </Pressable>
        )}

        {/* Duplicate warning */}
        {isAlreadySeen && !parsedNota && !confirmed && (
          <View style={[styles.warnCard, { marginHorizontal: 16 }]}>
            <Feather name="alert-circle" size={16} color="#F59E0B" />
            <Text style={[styles.warnTxt, { color: "#F59E0B" }]}>Esta nota já foi processada. Nenhum ponto será concedido para evitar fraude.</Text>
          </View>
        )}

        {/* Error */}
        {error ? (
          <View style={[styles.errorCard, { marginHorizontal: 16 }]}>
            <Feather name="alert-circle" size={16} color="#CC0000" />
            <Text style={[styles.errorTxt, { color: "#CC0000" }]}>{error}</Text>
          </View>
        ) : null}

        {/* API source badge */}
        {apiSource && !confirmed && (
          <View style={[styles.sourceBadge, { marginHorizontal: 16, backgroundColor: apiSource === "api" ? "#22C55E15" : "#F59E0B15" }]}>
            <Feather name={apiSource === "api" ? "cloud" : "database"} size={12} color={apiSource === "api" ? "#22C55E" : "#F59E0B"} />
            <Text style={[styles.sourceTxt, { color: apiSource === "api" ? "#22C55E" : "#F59E0B" }]}>
              {apiSource === "api" ? "Validado via SEFAZ · Preços indexados" : "Modo demonstração · Dados de teste"}
            </Text>
          </View>
        )}

        {/* Parsed nota items */}
        {parsedNota && !confirmed && (
          <View style={[styles.notaCard, { backgroundColor: C.surfaceElevated, borderColor: "#22C55E", marginHorizontal: 16 }]}>
            <LinearGradient colors={["#22C55E15", "transparent"]} style={styles.notaHeader}>
              <View style={styles.notaHeaderLeft}>
                <MaterialCommunityIcons name="store-check" size={20} color="#22C55E" />
                <View>
                  <Text style={[styles.notaStoreName, { color: C.text }]}>{parsedNota.storeName}</Text>
                  <Text style={[styles.notaCNPJ, { color: C.textMuted }]}>CNPJ {parsedNota.storeCNPJ}</Text>
                </View>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[styles.notaTotal, { color: "#22C55E" }]}>R$ {totalValue.toFixed(2).replace(".", ",")}</Text>
                <Text style={[styles.notaItemCount, { color: C.textMuted }]}>
                  {parsedNota.items.length > 0 ? `${parsedNota.items.length} itens` : itemsSource === "unavailable" ? "Itens via SEFAZ" : "—"}
                </Text>
              </View>
            </LinearGradient>

            {parsedNota.items.length === 0 ? (
              <View style={[styles.noItemsBox, { backgroundColor: C.backgroundSecondary }]}>
                <MaterialCommunityIcons name="information-outline" size={22} color={C.textMuted} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.noItemsTitle, { color: C.text }]}>Itens não disponíveis no QR Code</Text>
                  <Text style={[styles.noItemsDesc, { color: C.textMuted }]}>
                    {itemsSource === "unavailable"
                      ? "O QR Code da nota contém apenas a chave de acesso. Os itens ficam no XML emitido pela SEFAZ, que não está acessível publicamente. A nota foi validada pelo CNPJ e você pode confirmar para ganhar os pontos."
                      : "Itens não encontrados. Confirme a nota para registrar a compra."}
                  </Text>
                </View>
              </View>
            ) : (
              parsedNota.items.map((item, idx) => (
                <View
                  key={item.ean + idx}
                  style={[styles.notaItem, idx < parsedNota.items.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.border }]}
                >
                  <View style={[styles.notaItemIcon, { backgroundColor: C.backgroundTertiary }]}>
                    <MaterialCommunityIcons name="barcode" size={14} color={C.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.notaItemName, { color: C.text }]}>{item.name}</Text>
                    <Text style={[styles.notaItemEan, { color: C.textMuted }]}>{item.ean} · {item.qty}{item.unit}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[styles.notaItemPrice, { color: C.text }]}>R$ {item.price.toFixed(2).replace(".", ",")}</Text>
                    <Text style={[styles.notaItemSub, { color: C.textMuted }]}>un</Text>
                  </View>
                </View>
              ))
            )}

            <View style={[styles.notaFooter, { backgroundColor: "#CC000010" }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.notaFooterLabel, { color: C.text }]}>Pontos a ganhar</Text>
                {parsedNota.items.length > 10 && (
                  <Text style={[styles.notaFooterBonus, { color: "#F59E0B" }]}>2x XP · mais de 10 itens!</Text>
                )}
              </View>
              <Text style={styles.notaFooterPts}>+{previewPoints} pts</Text>
            </View>

            <Pressable style={styles.confirmBtn} onPress={handleConfirm}>
              <Feather name="check" size={18} color="#fff" />
              <Text style={styles.confirmBtnTxt}>Confirmar e ganhar {previewPoints} pts</Text>
            </Pressable>
          </View>
        )}

        {/* Result after confirmation */}
        {confirmed && result && (
          <View style={[styles.resultCard, { backgroundColor: C.surfaceElevated, borderColor: result.duplicate ? "#F59E0B" : "#22C55E", marginHorizontal: 16 }]}>
            {result.duplicate ? (
              <>
                <Feather name="alert-circle" size={32} color="#F59E0B" />
                <Text style={[styles.resultTitle, { color: C.text }]}>Nota já utilizada</Text>
                <Text style={[styles.resultSub, { color: C.textMuted }]}>Esta chave NFC-e já foi processada por outro usuário. Nenhum ponto foi concedido.</Text>
              </>
            ) : (
              <>
                <LinearGradient colors={["#22C55E", "#16A34A"]} style={styles.resultIconBg}>
                  <MaterialCommunityIcons name="trophy" size={32} color="#fff" />
                </LinearGradient>
                <Text style={[styles.resultTitle, { color: C.text }]}>Nota processada!</Text>
                <Text style={[styles.resultSub, { color: C.textMuted }]}>
                  {parsedNota?.items.length} preços atualizados em {parsedNota?.storeName}.
                </Text>
                {apiSource === "api" && (
                  <View style={[styles.sourceBadge, { backgroundColor: "#22C55E15", width: "100%" }]}>
                    <Feather name="cloud" size={12} color="#22C55E" />
                    <Text style={[styles.sourceTxt, { color: "#22C55E" }]}>Validado via SEFAZ · CNPJ verificado</Text>
                  </View>
                )}
                <View style={[styles.resultPtsBadge, { backgroundColor: "#CC000010", borderColor: "#CC000030" }]}>
                  <Text style={styles.resultPtsVal}>+{result.points} pts</Text>
                  <Text style={[styles.resultPtsLabel, { color: C.textMuted }]}>creditados ao seu saldo</Text>
                </View>
              </>
            )}
            <Pressable style={[styles.doneBtn, { backgroundColor: C.backgroundTertiary }]} onPress={() => router.back()}>
              <Text style={[styles.doneBtnTxt, { color: C.text }]}>Concluir</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 0 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingBottom: 16 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  titleSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  infoCard: { flexDirection: "row", gap: 12, borderRadius: 14, padding: 14, alignItems: "flex-start" },
  infoTitle: { fontSize: 13, fontFamily: "Inter_700Bold" },
  infoDesc: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  cameraArea: { borderRadius: 20, height: 180, borderWidth: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  scannerOverlay: { position: "absolute", width: 160, height: 120 },
  scanCorner: { position: "absolute", width: 24, height: 24, borderColor: "#CC0000", borderWidth: 3 },
  tlCorner: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 6 },
  trCorner: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 6 },
  blCorner: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 6 },
  brCorner: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 6 },
  cameraHint: { color: "rgba(255,255,255,0.35)", fontSize: 12, fontFamily: "Inter_400Regular" },
  orText: { textAlign: "center", fontSize: 12, fontFamily: "Inter_400Regular" },
  inputRow: { flexDirection: "row", alignItems: "center", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  input: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  charCount: { fontSize: 11, fontFamily: "Inter_500Medium", textAlign: "right" },
  quickLabel: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 4 },
  sampleChip: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, padding: 12, borderWidth: 1 },
  sampleKey: { fontSize: 12, fontFamily: "Inter_500Medium" },
  sampleMeta: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  usedBadge: { backgroundColor: "#F59E0B20", borderRadius: 7, paddingHorizontal: 7, paddingVertical: 2 },
  usedBadgeTxt: { color: "#F59E0B", fontSize: 10, fontFamily: "Inter_700Bold" },
  ptsBadge: { backgroundColor: "#CC000015", borderRadius: 7, paddingHorizontal: 7, paddingVertical: 2 },
  ptsBadgeTxt: { color: "#CC0000", fontSize: 10, fontFamily: "Inter_700Bold" },
  processBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, paddingVertical: 14 },
  processBtnTxt: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  warnCard: { flexDirection: "row", gap: 8, borderRadius: 12, padding: 12, backgroundColor: "#F59E0B15", alignItems: "flex-start" },
  warnTxt: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  errorCard: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, padding: 12, backgroundColor: "#CC000015" },
  errorTxt: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  sourceBadge: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  sourceTxt: { fontSize: 11, fontFamily: "Inter_500Medium", flex: 1 },
  notaCard: { borderRadius: 16, borderWidth: 1.5, overflow: "hidden" },
  notaHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14 },
  notaHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  notaStoreName: { fontSize: 14, fontFamily: "Inter_700Bold" },
  notaCNPJ: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 2 },
  notaTotal: { fontSize: 18, fontFamily: "Inter_700Bold" },
  notaItemCount: { fontSize: 11, fontFamily: "Inter_400Regular" },
  notaItem: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, gap: 10 },
  notaItemIcon: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  notaItemName: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  notaItemEan: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 1 },
  notaItemPrice: { fontSize: 13, fontFamily: "Inter_700Bold" },
  notaItemSub: { fontSize: 10, fontFamily: "Inter_400Regular" },
  notaFooter: { flexDirection: "row", alignItems: "center", padding: 14 },
  notaFooterLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  notaFooterBonus: { fontSize: 11, fontFamily: "Inter_700Bold", marginTop: 2 },
  notaFooterPts: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#CC0000" },
  noItemsBox: { flexDirection: "row", gap: 10, alignItems: "flex-start", margin: 14, borderRadius: 10, padding: 12 },
  noItemsTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  noItemsDesc: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2, lineHeight: 17 },
  confirmBtn: { backgroundColor: "#22C55E", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, marginHorizontal: 14, marginBottom: 14, borderRadius: 14 },
  confirmBtnTxt: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  resultCard: { borderRadius: 16, borderWidth: 1.5, padding: 24, alignItems: "center", gap: 14 },
  resultIconBg: { width: 68, height: 68, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  resultTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  resultSub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  resultPtsBadge: { borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12, alignItems: "center", borderWidth: 1, width: "100%" },
  resultPtsVal: { fontSize: 30, fontFamily: "Inter_700Bold", color: "#CC0000" },
  resultPtsLabel: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  doneBtn: { width: "100%", paddingVertical: 13, borderRadius: 14, alignItems: "center" },
  doneBtnTxt: { fontSize: 14, fontFamily: "Inter_700Bold" },
});
