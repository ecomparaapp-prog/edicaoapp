import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { Image } from "expo-image";
import React, { useState, useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Keyboard,
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
import { AuthGate } from "@/components/AuthGate";
import { lookupEAN, type CosmosProduct } from "@/services/cosmosService";
import { fetchNearbyStores, type NearbyStore } from "@/services/storesService";
import { submitPrice, type SubmitPriceResult, type ReportType } from "@/services/priceService";

type Step = "ean" | "price" | "store" | "confirm" | "result";

const POINT_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  product_registration: { label: "Cadastro de produto", color: "#2E7D32", icon: "package-variant-closed" },
  price_validation: { label: "Validação de preço", color: "#1565C0", icon: "check-decagram" },
  price_submission: { label: "Registro de preço", color: "#E65100", icon: "tag" },
  auto_validated: { label: "Validação automática!", color: "#6A1B9A", icon: "lightning-bolt" },
  conflict_pending: { label: "Aguardando parceiro", color: "#827717", icon: "clock-outline" },
};

export default function RegisterPriceScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const C = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { user } = useApp();
  const params = useLocalSearchParams<{ preselectedPlaceId?: string; preselectedPlaceName?: string; isCorrection?: string }>();
  const isCorrection = params.isCorrection === "true";

  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 34 : insets.bottom + 16;

  // When coming from a store profile, the store is already chosen
  const preselectedStore: NearbyStore | null = params.preselectedPlaceId
    ? {
        googlePlaceId: params.preselectedPlaceId,
        name: params.preselectedPlaceName ?? "Mercado",
        address: null,
        lat: 0,
        lng: 0,
        phone: null,
        website: null,
        photoUrl: null,
        rating: null,
        status: "shadow" as const,
        is_partner: false,
        is_shadow: true,
        distanceKm: 0,
        syncedAt: new Date().toISOString(),
      }
    : null;

  // Step state
  const [step, setStep] = useState<Step>("ean");

  // EAN step
  const [ean, setEan] = useState("");
  const [eanLoading, setEanLoading] = useState(false);
  const [product, setProduct] = useState<CosmosProduct | null>(null);
  const [eanError, setEanError] = useState("");

  // Price step
  const [priceText, setPriceText] = useState("");
  const [priceError, setPriceError] = useState("");

  // Store step
  const [locationLoading, setLocationLoading] = useState(false);
  const [stores, setStores] = useState<NearbyStore[]>([]);
  const [selectedStore, setSelectedStore] = useState<NearbyStore | null>(null);
  const [storeError, setStoreError] = useState("");
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);

  // Submit
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitPriceResult | null>(null);

  // Success animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (step === "result") {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
      ]).start();
    }
  }, [step]);

  if (!user) {
    return (
      <AuthGate
        title="Login necessário"
        description="Faça login para registrar preços e ganhar pontos por cada contribuição."
        icon="tag-outline"
      />
    );
  }

  // ─── EAN lookup ───────────────────────────────────────────────────────────

  const handleLookupEAN = async () => {
    const code = ean.trim();
    if (!code || code.length < 8) {
      setEanError("Digite um código EAN válido (mínimo 8 dígitos).");
      return;
    }
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEanLoading(true);
    setEanError("");
    setProduct(null);

    try {
      const result = await lookupEAN(code);
      if (result.found && result.product) {
        setProduct(result.product);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setStep("price");
      } else {
        setEanError(
          result.error ?? "Produto não encontrado. Verifique o código ou tente outro."
        );
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch {
      setEanError("Erro ao buscar produto. Verifique a conexão.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setEanLoading(false);
    }
  };

  // ─── Price validation ─────────────────────────────────────────────────────

  const handleConfirmPrice = () => {
    const val = parseFloat(priceText.replace(",", "."));
    if (!priceText || isNaN(val) || val <= 0 || val > 99999) {
      setPriceError("Digite um preço válido (ex: 12,99).");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setPriceError("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (preselectedStore) {
      setSelectedStore(preselectedStore);
      setStep("confirm");
    } else {
      loadNearbyStores();
      setStep("store");
    }
  };

  // ─── Location + stores ───────────────────────────────────────────────────

  const loadNearbyStores = async () => {
    setLocationLoading(true);
    setStoreError("");

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setStoreError("Permissão de localização negada. Habilite nas configurações.");
        setLocationLoading(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;
      setUserLat(lat);
      setUserLng(lng);

      const { stores: nearby, success } = await fetchNearbyStores(lat, lng, 5);

      if (!success || !nearby.length) {
        setStoreError("Nenhum mercado encontrado nas proximidades. Tente ampliar a busca.");
      } else {
        setStores(nearby);
      }
    } catch {
      setStoreError("Erro ao obter localização. Verifique as permissões do app.");
    } finally {
      setLocationLoading(false);
    }
  };

  const handleSelectStore = (store: NearbyStore) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedStore(store);
    setStep("confirm");
  };

  // ─── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!selectedStore || !product || !ean) return;
    const priceNum = parseFloat(priceText.replace(",", "."));
    if (isNaN(priceNum)) return;

    const userId = user.id;
    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const res = await submitPrice(ean.trim(), selectedStore.googlePlaceId, userId, priceNum, product?.description ?? "");
      setResult(res);

      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert("Erro", res.error ?? "Erro ao enviar. Tente novamente.");
      }
      setStep("result");
    } catch {
      Alert.alert("Erro", "Sem conexão com o servidor. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Helpers ─────────────────────────────────────────────────────────────

  const getStepIndex = () =>
    ({ ean: 0, price: 1, store: 2, confirm: 3, result: 4 }[step]);

  const priceNum = parseFloat(priceText.replace(",", "."));

  // ─── Renders ─────────────────────────────────────────────────────────────

  return (
    <View style={[s.root, { backgroundColor: C.background, paddingTop: topPad, paddingBottom: bottomPad }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable
          style={[s.backBtn, { backgroundColor: C.backgroundSecondary }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (step === "ean" || step === "result") {
              router.back();
            } else {
              const prev: Record<Step, Step> = {
                ean: "ean",
                price: "ean",
                store: "price",
                confirm: "store",
                result: "ean",
              };
              setStep(prev[step]);
            }
          }}
        >
          <Feather name={step === "result" ? "x" : "arrow-left"} size={20} color={C.text} />
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={[s.headerTitle, { color: C.text }]}>Cadastrar no Mercado</Text>
          {step !== "result" && (
            <Text style={[s.headerSub, { color: C.textMuted }]}>
              Passo {getStepIndex() + 1} de 4
            </Text>
          )}
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Progress bar */}
      {step !== "result" && (
        <View style={[s.progressTrack, { backgroundColor: C.backgroundSecondary }]}>
          <View
            style={[
              s.progressFill,
              { backgroundColor: C.primary, width: `${((getStepIndex() + 1) / 4) * 100}%` },
            ]}
          />
        </View>
      )}

      {/* ── Step: EAN ──────────────────────────────────────────────────── */}
      {step === "ean" && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ gap: 20, paddingHorizontal: 20, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[s.stepIconRow]}>
            <View style={[s.bigIcon, { backgroundColor: C.primary + "20" }]}>
              <MaterialCommunityIcons name="barcode-scan" size={40} color={C.primary} />
            </View>
            <Text style={[s.stepTitle, { color: C.text }]}>Escanear produto</Text>
            <Text style={[s.stepDesc, { color: C.textMuted }]}>
              Digite o código de barras (EAN) do produto que deseja cadastrar.
            </Text>
          </View>

          {/* Camera placeholder */}
          <View style={[s.cameraBox, { backgroundColor: "#111", borderColor: C.border }]}>
            <View style={s.scanFrame}>
              {["tl", "tr", "bl", "br"].map((pos) => (
                <View
                  key={pos}
                  style={[
                    s.corner,
                    pos.includes("t") ? s.top : s.bottom,
                    pos.includes("l") ? s.left : s.right,
                    { borderColor: C.primary },
                  ]}
                />
              ))}
            </View>
            <Text style={s.cameraHint}>Câmera disponível no app instalado</Text>
          </View>

          <Text style={[s.orLabel, { color: C.textMuted }]}>ou digite manualmente</Text>

          <View style={[s.inputRow, { backgroundColor: C.backgroundSecondary }]}>
            <MaterialCommunityIcons name="barcode" size={20} color={C.textMuted} />
            <TextInput
              style={[s.input, { color: C.text }]}
              placeholder="EAN-13: 7891000053508"
              placeholderTextColor={C.textMuted}
              value={ean}
              onChangeText={(t) => { setEan(t); setEanError(""); }}
              keyboardType="numeric"
              maxLength={14}
              returnKeyType="search"
              onSubmitEditing={handleLookupEAN}
            />
            {ean.length > 0 && (
              <Pressable onPress={() => setEan("")}>
                <Feather name="x" size={16} color={C.textMuted} />
              </Pressable>
            )}
          </View>

          {/* Quick EAN examples */}
          <View>
            <Text style={[s.quickLabel, { color: C.textMuted }]}>Exemplos para testar:</Text>
            <View style={s.quickRow}>
              {["7891000053508", "7891910000197", "7894900700015"].map((code) => (
                <Pressable
                  key={code}
                  style={[s.quickChip, { backgroundColor: C.backgroundSecondary }]}
                  onPress={() => { setEan(code); setEanError(""); }}
                >
                  <Text style={[s.quickChipText, { color: C.textSecondary }]}>...{code.slice(-6)}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {eanError ? (
            <View style={[s.errorCard, { backgroundColor: C.error + "18" }]}>
              <Feather name="alert-circle" size={15} color={C.error} />
              <Text style={[s.errorText, { color: C.error }]}>{eanError}</Text>
            </View>
          ) : null}

          <Pressable
            style={[s.primaryBtn, { backgroundColor: eanLoading ? C.textMuted : C.primary }]}
            onPress={handleLookupEAN}
            disabled={eanLoading || !ean.trim()}
          >
            {eanLoading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Feather name="search" size={18} color="#fff" />}
            <Text style={s.primaryBtnText}>{eanLoading ? "Buscando..." : "Buscar produto"}</Text>
          </Pressable>
        </ScrollView>
      )}

      {/* ── Step: Price ─────────────────────────────────────────────────── */}
      {step === "price" && product && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ gap: 20, paddingHorizontal: 20, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Product card */}
          <View style={[s.productCard, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
            {product.thumbnailUrl ? (
              <Image source={{ uri: product.thumbnailUrl }} style={s.productImg} contentFit="contain" />
            ) : (
              <View style={[s.productImgPlaceholder, { backgroundColor: C.primary + "18" }]}>
                <MaterialCommunityIcons name="package-variant" size={28} color={C.primary} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={[s.productName, { color: C.text }]} numberOfLines={2}>
                {product.description}
              </Text>
              {product.brand ? (
                <Text style={[s.productBrand, { color: C.textMuted }]}>{product.brand}</Text>
              ) : null}
              {product.category ? (
                <View style={[s.categoryChip, { backgroundColor: C.primary + "18" }]}>
                  <Text style={[s.categoryChipText, { color: C.primary }]}>{product.category}</Text>
                </View>
              ) : null}
              <Text style={[s.eanLabel, { color: C.textMuted }]}>EAN {ean}</Text>
            </View>
          </View>

          {/* Price input */}
          <View style={[s.priceSection, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
            <View style={s.priceLabelRow}>
              <MaterialCommunityIcons name="tag-outline" size={18} color={C.primary} />
              <Text style={[s.priceSectionLabel, { color: C.text }]}>Qual o preço neste mercado?</Text>
            </View>

            <View style={[s.priceInputRow, { borderColor: priceError ? C.error : C.border }]}>
              <Text style={[s.currencySymbol, { color: C.textMuted }]}>R$</Text>
              <TextInput
                style={[s.priceInput, { color: C.text }]}
                placeholder="0,00"
                placeholderTextColor={C.textMuted}
                value={priceText}
                onChangeText={(t) => { setPriceText(t); setPriceError(""); }}
                keyboardType="numeric"
                returnKeyType="done"
                onSubmitEditing={handleConfirmPrice}
                autoFocus
                maxLength={10}
              />
            </View>

            {priceError ? (
              <Text style={[s.fieldError, { color: C.error }]}>{priceError}</Text>
            ) : null}

            <Text style={[s.priceHint, { color: C.textMuted }]}>
              Digite o preço que você viu na prateleira. Ex: 12,99
            </Text>
          </View>

          <Pressable
            style={[s.primaryBtn, { backgroundColor: priceText ? C.primary : C.textMuted }]}
            onPress={handleConfirmPrice}
            disabled={!priceText}
          >
            <Text style={s.primaryBtnText}>Confirmar preço</Text>
            <Feather name="arrow-right" size={18} color="#fff" />
          </Pressable>
        </ScrollView>
      )}

      {/* ── Step: Store ──────────────────────────────────────────────────── */}
      {step === "store" && (
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 20, paddingBottom: 12, gap: 8 }}>
            <Text style={[s.stepTitle2, { color: C.text }]}>Selecione o mercado</Text>
            <Text style={[s.stepDesc, { color: C.textMuted }]}>
              Escolha o mercado onde você encontrou esse produto.
            </Text>
          </View>

          {locationLoading ? (
            <View style={s.centerContent}>
              <ActivityIndicator size="large" color={C.primary} />
              <Text style={[s.loadingText, { color: C.textMuted }]}>Localizando mercados próximos...</Text>
            </View>
          ) : storeError ? (
            <View style={s.centerContent}>
              <MaterialCommunityIcons name="map-marker-off" size={48} color={C.textMuted} />
              <Text style={[s.emptyText, { color: C.textMuted }]}>{storeError}</Text>
              <Pressable
                style={[s.retryBtn, { backgroundColor: C.primary }]}
                onPress={loadNearbyStores}
              >
                <Feather name="refresh-cw" size={16} color="#fff" />
                <Text style={s.retryText}>Tentar novamente</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={stores}
              keyExtractor={(item) => item.googlePlaceId}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32, gap: 10 }}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={s.centerContent}>
                  <Text style={[s.emptyText, { color: C.textMuted }]}>Nenhum mercado encontrado.</Text>
                </View>
              }
              renderItem={({ item }) => (
                <Pressable
                  style={[
                    s.storeCard,
                    {
                      backgroundColor: C.surfaceElevated,
                      borderColor: selectedStore?.googlePlaceId === item.googlePlaceId
                        ? C.primary
                        : C.border,
                      borderWidth: selectedStore?.googlePlaceId === item.googlePlaceId ? 2 : 1,
                    },
                  ]}
                  onPress={() => handleSelectStore(item)}
                >
                  {item.photoUrl ? (
                    <Image source={{ uri: item.photoUrl }} style={s.storePhoto} contentFit="cover" />
                  ) : (
                    <View style={[s.storePhotoPlaceholder, { backgroundColor: C.backgroundSecondary }]}>
                      <MaterialCommunityIcons name="store" size={22} color={C.textMuted} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[s.storeName, { color: C.text }]} numberOfLines={1}>{item.name}</Text>
                    {item.address ? (
                      <Text style={[s.storeAddr, { color: C.textMuted }]} numberOfLines={1}>{item.address}</Text>
                    ) : null}
                    <View style={s.storeMeta}>
                      <View style={[s.distanceBadge, { backgroundColor: C.backgroundSecondary }]}>
                        <Feather name="map-pin" size={10} color={C.textMuted} />
                        <Text style={[s.distanceText, { color: C.textMuted }]}>{item.distanceKm} km</Text>
                      </View>
                      {item.is_partner ? (
                        <View style={[s.partnerBadge, { backgroundColor: "#1565C020" }]}>
                          <Feather name="check-circle" size={10} color="#1565C0" />
                          <Text style={[s.partnerText, { color: "#1565C0" }]}>Parceiro</Text>
                        </View>
                      ) : (
                        <View style={[s.shadowBadge, { backgroundColor: C.backgroundSecondary }]}>
                          <Text style={[s.shadowText, { color: C.textMuted }]}>Sem parceria</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Feather name="chevron-right" size={18} color={C.textMuted} />
                </Pressable>
              )}
            />
          )}
        </View>
      )}

      {/* ── Step: Confirm ────────────────────────────────────────────────── */}
      {step === "confirm" && selectedStore && product && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ gap: 16, paddingHorizontal: 20, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[s.stepTitle2, { color: C.text }]}>Confirmar envio</Text>
          <Text style={[s.stepDesc, { color: C.textMuted }]}>
            Verifique as informações antes de enviar.
          </Text>

          {/* Summary card */}
          <View style={[s.summaryCard, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
            <SummaryRow icon="barcode" label="Produto" value={product.description ?? ean} C={C} />
            <View style={[s.divider, { backgroundColor: C.border }]} />
            <SummaryRow icon="tag" label="Preço" value={`R$ ${parseFloat(priceText.replace(",", ".")).toFixed(2).replace(".", ",")}`} C={C} highlight />
            <View style={[s.divider, { backgroundColor: C.border }]} />
            <SummaryRow icon="store" label="Mercado" value={selectedStore.name} C={C} />
            <View style={[s.divider, { backgroundColor: C.border }]} />
            <SummaryRow icon="map-pin" label="Distância" value={`${selectedStore.distanceKm} km`} C={C} />
          </View>

          {/* Store type info card */}
          <View style={[
            s.infoCard,
            {
              backgroundColor: selectedStore.is_partner ? "#1565C018" : "#82771718",
              borderColor: selectedStore.is_partner ? "#1565C040" : "#82771740",
            },
          ]}>
            <View style={s.infoCardHeader}>
              <MaterialCommunityIcons
                name={selectedStore.is_partner ? "check-decagram" : "store-outline"}
                size={18}
                color={selectedStore.is_partner ? "#1565C0" : "#827717"}
              />
              <Text style={[s.infoCardTitle, { color: selectedStore.is_partner ? "#1565C0" : "#827717" }]}>
                {selectedStore.is_partner ? "Mercado Parceiro" : "Mercado sem Parceria"}
              </Text>
            </View>
            <Text style={[s.infoCardText, { color: C.textSecondary }]}>
              {selectedStore.is_partner
                ? "Seu preço será comparado com os dados do parceiro. Caso haja conflito, o parceiro será notificado para validar."
                : "Você ganha pontos por cadastrar o produto. Se o preço já foi registrado nos últimos 5 dias, seu envio será usado como validação."}
            </Text>
          </View>

          {/* Nota fiscal hint for shadow stores */}
          {!selectedStore.is_partner && (
            <Pressable
              style={[s.nfceBtn, { borderColor: C.border, backgroundColor: C.backgroundSecondary }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({
                  pathname: "/nfce-scanner",
                  params: { placeId: selectedStore.googlePlaceId },
                });
              }}
            >
              <MaterialCommunityIcons name="receipt" size={18} color={C.textSecondary} />
              <View style={{ flex: 1 }}>
                <Text style={[s.nfceBtnTitle, { color: C.text }]}>Tem nota fiscal?</Text>
                <Text style={[s.nfceBtnSub, { color: C.textMuted }]}>
                  Escanear NFC-e garante pontos extras e valida automaticamente
                </Text>
              </View>
              <Feather name="chevron-right" size={16} color={C.textMuted} />
            </Pressable>
          )}

          {/* Points preview */}
          <View style={[s.pointsPreview, { backgroundColor: C.primary + "10", borderColor: C.primary + "40" }]}>
            <MaterialCommunityIcons name="star-circle" size={22} color={C.primary} />
            <View>
              <Text style={[s.pointsPreviewTitle, { color: C.text }]}>Pontos estimados</Text>
              <Text style={[s.pointsPreviewSub, { color: C.textMuted }]}>
                {selectedStore.is_partner
                  ? "10–30 pts dependendo do resultado da validação"
                  : "15–30 pts baseado no histórico do produto"}
              </Text>
            </View>
          </View>

          <Pressable
            style={[s.primaryBtn, { backgroundColor: submitting ? C.textMuted : C.primary }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting
              ? <ActivityIndicator size="small" color="#fff" />
              : <Feather name="send" size={18} color="#fff" />}
            <Text style={s.primaryBtnText}>{submitting ? "Enviando..." : "Enviar e ganhar pontos"}</Text>
          </Pressable>
        </ScrollView>
      )}

      {/* ── Step: Result ─────────────────────────────────────────────────── */}
      {step === "result" && result && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ gap: 24, paddingHorizontal: 24, paddingBottom: 32, alignItems: "center" }}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[s.resultIconWrap, { transform: [{ scale: scaleAnim }], opacity: fadeAnim }]}
          >
            {result.ok ? (
              <View style={[s.resultIcon, { backgroundColor: result.reportType === "conflict_pending" ? "#82771720" : "#2E7D3220" }]}>
                <MaterialCommunityIcons
                  name={result.reportType === "conflict_pending" ? "clock-outline" : "check-circle"}
                  size={64}
                  color={result.reportType === "conflict_pending" ? "#827717" : "#2E7D32"}
                />
              </View>
            ) : (
              <View style={[s.resultIcon, { backgroundColor: C.error + "20" }]}>
                <Feather name="x-circle" size={64} color={C.error} />
              </View>
            )}
          </Animated.View>

          <Animated.View style={[{ alignItems: "center", gap: 8 }, { opacity: fadeAnim }]}>
            <Text style={[s.resultTitle, { color: C.text }]}>
              {result.ok
                ? result.reportType === "conflict_pending"
                  ? "Preço enviado!"
                  : "Cadastrado com sucesso! 🎉"
                : "Algo deu errado"}
            </Text>
            <Text style={[s.resultMsg, { color: C.textMuted }]}>
              {result.message ?? result.error ?? ""}
            </Text>
          </Animated.View>

          {result.ok && result.reportType && result.reportType !== "conflict_pending" && (
            <Animated.View style={[s.pointsBubble, { opacity: fadeAnim }]}>
              <Text style={s.pointsBubblePoints}>+{result.pointsAwarded ?? 0}</Text>
              <Text style={s.pointsBubbleLabel}>pontos</Text>
            </Animated.View>
          )}

          {result.ok && result.reportType && POINT_LABELS[result.reportType] && (
            <Animated.View
              style={[
                s.typeBadge,
                {
                  backgroundColor: POINT_LABELS[result.reportType].color + "18",
                  borderColor: POINT_LABELS[result.reportType].color + "50",
                  opacity: fadeAnim,
                },
              ]}
            >
              <MaterialCommunityIcons
                name={POINT_LABELS[result.reportType].icon as any}
                size={16}
                color={POINT_LABELS[result.reportType].color}
              />
              <Text style={[s.typeBadgeText, { color: POINT_LABELS[result.reportType].color }]}>
                {POINT_LABELS[result.reportType].label}
              </Text>
            </Animated.View>
          )}

          {/* Result details */}
          {result.ok && selectedStore && (
            <Animated.View style={[s.resultDetailsCard, { backgroundColor: C.surfaceElevated, borderColor: C.border, opacity: fadeAnim }]}>
              <Text style={[s.resultDetailTitle, { color: C.textMuted }]}>Detalhes do envio</Text>
              <View style={{ gap: 8, marginTop: 8 }}>
                <ResultDetailRow label="Produto" value={product?.description ?? ean} C={C} />
                <ResultDetailRow label="Preço" value={`R$ ${parseFloat(priceText.replace(",", ".")).toFixed(2).replace(".", ",")}`} C={C} />
                <ResultDetailRow label="Mercado" value={selectedStore.name} C={C} />
                <ResultDetailRow label="Tipo" value={selectedStore.is_partner ? "Parceiro" : "Sem parceria"} C={C} />
                {result.hasFreshPrice && result.latestPrice ? (
                  <ResultDetailRow
                    label="Último preço"
                    value={`R$ ${result.latestPrice.toFixed(2).replace(".", ",")}`}
                    C={C}
                  />
                ) : null}
              </View>
            </Animated.View>
          )}

          {/* Auto-validated info */}
          {result.autoValidated && (
            <Animated.View style={[s.autoValidCard, { opacity: fadeAnim }]}>
              <MaterialCommunityIcons name="lightning-bolt" size={20} color="#6A1B9A" />
              <Text style={[s.autoValidText, { color: C.textSecondary }]}>
                3 usuários confirmaram o mesmo preço nas últimas 24h — validado automaticamente!
              </Text>
            </Animated.View>
          )}

          {/* Action buttons */}
          <View style={{ width: "100%", gap: 12 }}>
            <Pressable
              style={[s.primaryBtn, { backgroundColor: C.primary }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setStep("ean");
                setEan("");
                setPriceText("");
                setProduct(null);
                setSelectedStore(null);
                setResult(null);
                setStores([]);
                fadeAnim.setValue(0);
                scaleAnim.setValue(0.5);
              }}
            >
              <MaterialCommunityIcons name="barcode-scan" size={18} color="#fff" />
              <Text style={s.primaryBtnText}>Cadastrar outro produto</Text>
            </Pressable>
            <Pressable
              style={[s.secondaryBtn, { backgroundColor: C.backgroundSecondary }]}
              onPress={() => router.back()}
            >
              <Text style={[s.secondaryBtnText, { color: C.text }]}>Voltar ao início</Text>
            </Pressable>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function SummaryRow({
  icon, label, value, C, highlight,
}: {
  icon: string;
  label: string;
  value: string;
  C: typeof Colors.light;
  highlight?: boolean;
}) {
  return (
    <View style={s.summaryRow}>
      <Feather name={icon as any} size={15} color={C.textMuted} style={{ width: 20 }} />
      <Text style={[s.summaryLabel, { color: C.textMuted }]}>{label}</Text>
      <Text
        style={[s.summaryValue, { color: highlight ? C.primary : C.text }]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function ResultDetailRow({ label, value, C }: { label: string; value: string; C: typeof Colors.light }) {
  return (
    <View style={s.resultDetailRow}>
      <Text style={[s.resultDetailLabel, { color: C.textMuted }]}>{label}</Text>
      <Text style={[s.resultDetailValue, { color: C.text }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  progressTrack: { height: 4, marginHorizontal: 20, borderRadius: 2, marginBottom: 16 },
  progressFill: { height: 4, borderRadius: 2 },

  stepIconRow: { alignItems: "center", paddingTop: 8, gap: 10 },
  bigIcon: { width: 80, height: 80, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  stepTitle: { fontSize: 22, fontFamily: "Inter_700Bold", textAlign: "center" },
  stepTitle2: { fontSize: 20, fontFamily: "Inter_700Bold" },
  stepDesc: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },

  cameraBox: { height: 180, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  scanFrame: { position: "absolute", width: 160, height: 100 },
  corner: { position: "absolute", width: 22, height: 22, borderWidth: 3 },
  top: { top: 0 }, bottom: { bottom: 0 }, left: { left: 0, borderRightWidth: 0 }, right: { right: 0, borderLeftWidth: 0 },
  cameraHint: { color: "rgba(255,255,255,0.35)", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 50 },

  orLabel: { textAlign: "center", fontSize: 12, fontFamily: "Inter_400Regular" },
  inputRow: { flexDirection: "row", alignItems: "center", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, gap: 10 },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  quickLabel: { fontSize: 11, fontFamily: "Inter_500Medium", marginBottom: 6 },
  quickRow: { flexDirection: "row", gap: 8 },
  quickChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  quickChipText: { fontSize: 12, fontFamily: "Inter_500Medium" },

  errorCard: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, padding: 12 },
  errorText: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },

  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 16, paddingVertical: 16 },
  primaryBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  secondaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: 16, paddingVertical: 14 },
  secondaryBtnText: { fontSize: 15, fontFamily: "Inter_500Medium" },

  productCard: { flexDirection: "row", gap: 14, borderRadius: 16, padding: 14, borderWidth: 1 },
  productImg: { width: 64, height: 64, borderRadius: 10 },
  productImgPlaceholder: { width: 64, height: 64, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  productName: { fontSize: 14, fontFamily: "Inter_600SemiBold", lineHeight: 20 },
  productBrand: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  categoryChip: { alignSelf: "flex-start", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 },
  categoryChipText: { fontSize: 10, fontFamily: "Inter_500Medium" },
  eanLabel: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 4 },

  priceSection: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 12 },
  priceLabelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  priceSectionLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  priceInputRow: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  currencySymbol: { fontSize: 24, fontFamily: "Inter_600SemiBold" },
  priceInput: { flex: 1, fontSize: 36, fontFamily: "Inter_700Bold" },
  fieldError: { fontSize: 12, fontFamily: "Inter_500Medium" },
  priceHint: { fontSize: 12, fontFamily: "Inter_400Regular" },

  centerContent: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 32 },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  retryBtn: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 },
  retryText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },

  storeCard: { flexDirection: "row", alignItems: "center", borderRadius: 16, padding: 14, gap: 12 },
  storePhoto: { width: 50, height: 50, borderRadius: 12 },
  storePhotoPlaceholder: { width: 50, height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  storeName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  storeAddr: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  storeMeta: { flexDirection: "row", gap: 6, marginTop: 5, alignItems: "center" },
  distanceBadge: { flexDirection: "row", alignItems: "center", gap: 3, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  distanceText: { fontSize: 10, fontFamily: "Inter_500Medium" },
  partnerBadge: { flexDirection: "row", alignItems: "center", gap: 3, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  partnerText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  shadowBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  shadowText: { fontSize: 10, fontFamily: "Inter_400Regular" },

  summaryCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 13 },
  summaryLabel: { fontSize: 13, fontFamily: "Inter_400Regular", width: 70 },
  summaryValue: { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "right" },
  divider: { height: 1, marginHorizontal: 16 },

  infoCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 8 },
  infoCardHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  infoCardTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  infoCardText: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },

  nfceBtn: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, borderWidth: 1, padding: 14 },
  nfceBtnTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  nfceBtnSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },

  pointsPreview: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, borderWidth: 1, padding: 14 },
  pointsPreviewTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  pointsPreviewSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },

  resultIconWrap: { marginTop: 16 },
  resultIcon: { width: 120, height: 120, borderRadius: 60, alignItems: "center", justifyContent: "center" },
  resultTitle: { fontSize: 26, fontFamily: "Inter_700Bold", textAlign: "center" },
  resultMsg: { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },

  pointsBubble: { backgroundColor: "#CC0000", borderRadius: 50, paddingHorizontal: 32, paddingVertical: 16, alignItems: "center" },
  pointsBubblePoints: { color: "#fff", fontSize: 40, fontFamily: "Inter_700Bold" },
  pointsBubbleLabel: { color: "rgba(255,255,255,0.8)", fontSize: 14, fontFamily: "Inter_500Medium" },

  typeBadge: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 7 },
  typeBadgeText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  resultDetailsCard: { width: "100%", borderRadius: 16, borderWidth: 1, padding: 16 },
  resultDetailTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5 },
  resultDetailRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  resultDetailLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  resultDetailValue: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1, textAlign: "right" },

  autoValidCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#6A1B9A18", borderRadius: 14, padding: 14 },
  autoValidText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
});
