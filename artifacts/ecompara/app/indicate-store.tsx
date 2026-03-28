import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import MapView, { Marker, Region } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import { AuthGate } from "@/components/AuthGate";
import { indicateStore } from "@/services/storesService";

const INDICATION_POINTS = 1000;
const DEFAULT_DELTA = 0.01;

export default function IndicateStoreScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const C = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const { user } = useApp();

  const [region, setRegion] = useState<Region | null>(null);
  const [markerCoords, setMarkerCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [storeName, setStoreName] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [geocoding, setGeocoding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const successScale = useRef(new Animated.Value(0)).current;
  const pointsOpacity = useRef(new Animated.Value(0)).current;
  const pointsTranslate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setRegion({ latitude: -23.55, longitude: -46.63, latitudeDelta: DEFAULT_DELTA, longitudeDelta: DEFAULT_DELTA });
          setLoadingLocation(false);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setRegion({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: DEFAULT_DELTA,
          longitudeDelta: DEFAULT_DELTA,
        });
      } catch {
        setRegion({ latitude: -23.55, longitude: -46.63, latitudeDelta: DEFAULT_DELTA, longitudeDelta: DEFAULT_DELTA });
      } finally {
        setLoadingLocation(false);
      }
    })();
  }, [user]);

  if (!user) {
    return (
      <AuthGate
        title="Login necessário"
        description="Faça login para indicar um mercado e ganhar 1.000 pontos."
        icon="map-marker-plus-outline"
      />
    );
  }

  async function reverseGeocode(lat: number, lng: number) {
    setGeocoding(true);
    setStoreAddress("");
    try {
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (results.length > 0) {
        const r = results[0];
        // Build a rich address: Street Number, Street, District, City - State
        const streetPart = [r.street, r.streetNumber].filter(Boolean).join(", ");
        const localityPart = [r.district || r.subregion, r.city].filter(Boolean).join(" — ");
        const statePart = r.region ? ` - ${r.region}` : "";
        const parts = [streetPart, localityPart].filter(Boolean);
        const formatted = parts.join(", ") + statePart;
        setStoreAddress(formatted);
      }
    } catch {
      // silent — user can type manually
    } finally {
      setGeocoding(false);
    }
  }

  function handleMapPress(event: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setMarkerCoords({ lat: latitude, lng: longitude });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    reverseGeocode(latitude, longitude);
  }

  function playSuccessAnimation() {
    Animated.sequence([
      Animated.spring(successScale, { toValue: 1, useNativeDriver: true, bounciness: 12 }),
      Animated.delay(300),
      Animated.parallel([
        Animated.timing(pointsOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(pointsTranslate, { toValue: -30, duration: 600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
    ]).start();
  }

  async function handleSubmit() {
    if (!storeName.trim()) {
      Alert.alert("Nome obrigatório", "Por favor, informe o nome do mercado.");
      return;
    }
    if (!markerCoords) {
      Alert.alert("Localização obrigatória", "Toque no mapa para marcar onde fica o mercado.");
      return;
    }

    const userId = user.id;
    setSubmitting(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      const result = await indicateStore({
        user_id: userId,
        name: storeName.trim(),
        address: storeAddress.trim() || undefined,
        lat: markerCoords.lat,
        lng: markerCoords.lng,
      });

      if (!result.ok) {
        const isAlreadyIndicated = result.error?.includes("anteriormente");
        Alert.alert(
          isAlreadyIndicated ? "Mercado já indicado" : "Erro",
          result.error ?? "Não foi possível registrar a indicação.",
        );
        return;
      }

      setSuccess(true);
      playSuccessAnimation();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      setTimeout(() => {
        router.back();
      }, 3000);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: C.background, borderBottomColor: C.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Feather name="x" size={22} color={C.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: C.text }]}>Indicar Mercado</Text>
          <Text style={[styles.headerSub, { color: C.textMuted }]}>Ganhe {INDICATION_POINTS.toLocaleString()} pontos!</Text>
        </View>
        <View style={[styles.pointsBadge, { backgroundColor: "#FFF3E0" }]}>
          <MaterialCommunityIcons name="star-circle" size={14} color="#E65100" />
          <Text style={styles.pointsBadgeText}>+{INDICATION_POINTS.toLocaleString()} pts</Text>
        </View>
      </View>

      {/* Reward Banner */}
      <View style={[styles.rewardBanner, { backgroundColor: isDark ? "#1B2A1B" : "#E8F5E9", borderColor: isDark ? "#2E7D32" : "#A5D6A7" }]}>
        <MaterialCommunityIcons name="map-marker-plus" size={20} color="#2E7D32" />
        <Text style={[styles.rewardText, { color: isDark ? "#A5D6A7" : "#1B5E20" }]}>
          Mapeie um mercado novo e ajude sua comunidade! O mercado ficará disponível para todos em até 10km.
        </Text>
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        {loadingLocation ? (
          <View style={[styles.mapPlaceholder, { backgroundColor: C.backgroundSecondary }]}>
            <ActivityIndicator size="large" color={C.primary} />
            <Text style={[styles.mapHint, { color: C.textMuted }]}>Carregando localização...</Text>
          </View>
        ) : region ? (
          <>
            <MapView
              style={styles.map}
              initialRegion={region}
              onPress={handleMapPress}
              showsUserLocation
              showsMyLocationButton
            >
              {markerCoords && (
                <Marker
                  coordinate={{ latitude: markerCoords.lat, longitude: markerCoords.lng }}
                  title={storeName || "Mercado indicado"}
                  pinColor="#2E7D32"
                />
              )}
            </MapView>
            <View style={[styles.mapHintBox, { backgroundColor: C.background + "EE" }]}>
              <Feather name="map-pin" size={13} color={C.primary} />
              <Text style={[styles.mapHint, { color: C.textSecondary }]}>
                {markerCoords ? "Marcador posicionado — ajuste se necessário" : "Toque no mapa para marcar o mercado"}
              </Text>
            </View>
          </>
        ) : null}
      </View>

      {/* Form */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 0 }}
      >
        <ScrollView style={[styles.form, { backgroundColor: C.background }]} keyboardShouldPersistTaps="handled">
          <Text style={[styles.label, { color: C.textSecondary }]}>Nome do Mercado *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: C.backgroundSecondary, color: C.text, borderColor: C.border }]}
            placeholder="Ex: Mercadinho do Zé, Empório São João..."
            placeholderTextColor={C.textMuted}
            value={storeName}
            onChangeText={setStoreName}
            returnKeyType="next"
            maxLength={80}
          />

          <Text style={[styles.label, { color: C.textSecondary, marginTop: 12 }]}>Endereço (opcional)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: C.backgroundSecondary, color: C.text, borderColor: C.border }]}
            placeholder="Preenchido automaticamente ao tocar no mapa"
            placeholderTextColor={C.textMuted}
            value={storeAddress}
            onChangeText={setStoreAddress}
            returnKeyType="done"
            maxLength={200}
          />

          {/* Coordinates indicator */}
          {markerCoords && (
            <View style={[styles.coordRow, { backgroundColor: isDark ? "#1A2A1A" : "#F1F8E9", borderColor: "#A5D6A7" }]}>
              <Feather name="check-circle" size={13} color="#388E3C" />
              <Text style={[styles.coordText, { color: isDark ? "#A5D6A7" : "#2E7D32" }]}>
                Localização: {markerCoords.lat.toFixed(5)}, {markerCoords.lng.toFixed(5)}
              </Text>
            </View>
          )}

          <Pressable
            style={[
              styles.submitBtn,
              { backgroundColor: markerCoords && storeName.trim() ? C.primary : C.border },
            ]}
            onPress={handleSubmit}
            disabled={submitting || !markerCoords || !storeName.trim()}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <MaterialCommunityIcons name="map-marker-check" size={20} color="#fff" />
                <Text style={styles.submitText}>Indicar Mercado e Ganhar {INDICATION_POINTS.toLocaleString()} Pontos</Text>
              </>
            )}
          </Pressable>

          <View style={[styles.rulesBox, { backgroundColor: C.backgroundSecondary, borderColor: C.border }]}>
            <Text style={[styles.rulesTitle, { color: C.textSecondary }]}>Regras da indicação</Text>
            <Text style={[styles.rulesText, { color: C.textMuted }]}>
              • O mercado estará disponível imediatamente para todos em até 10km.{"\n"}
              • Se 3 usuários denunciarem o mercado como inexistente, os pontos serão revertidos.{"\n"}
              • Indicações de locais que não são mercados serão removidas.
            </Text>
          </View>

          <View style={{ height: insets.bottom + 24 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Success Overlay */}
      {success && (
        <View style={styles.successOverlay}>
          <Animated.View style={[styles.successCard, { transform: [{ scale: successScale }] }]}>
            <MaterialCommunityIcons name="map-marker-check" size={64} color="#2E7D32" />
            <Text style={styles.successTitle}>Parabéns, Explorador!</Text>
            <Text style={styles.successSub}>Você mapeou um novo mercado para a comunidade.</Text>
            <Animated.View style={[styles.pointsPill, { opacity: pointsOpacity, transform: [{ translateY: pointsTranslate }] }]}>
              <MaterialCommunityIcons name="star-circle" size={22} color="#E65100" />
              <Text style={styles.pointsPillText}>+{INDICATION_POINTS.toLocaleString()} Pontos Recebidos!</Text>
            </Animated.View>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  pointsBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  pointsBadgeText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#E65100" },
  rewardBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  rewardText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  mapContainer: { height: 240, marginHorizontal: 16, marginTop: 10, borderRadius: 16, overflow: "hidden" },
  mapPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, borderRadius: 16 },
  map: { flex: 1 },
  mapHintBox: {
    position: "absolute",
    bottom: 8,
    left: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  mapHint: { fontSize: 11, fontFamily: "Inter_400Regular" },
  form: { paddingHorizontal: 16, paddingTop: 16 },
  label: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  coordRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  coordText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 20,
    paddingVertical: 15,
    borderRadius: 14,
  },
  submitText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" },
  rulesBox: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  rulesTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginBottom: 6 },
  rulesText: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 99,
  },
  successCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    gap: 10,
    width: 300,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  successTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#1B5E20", textAlign: "center" },
  successSub: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#388E3C", textAlign: "center", lineHeight: 20 },
  pointsPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFF3E0",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 6,
  },
  pointsPillText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#E65100" },
});
