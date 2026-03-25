import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";

const RADIUS_OPTIONS = [1, 2.5, 5];

export default function LocationSettingsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const C = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const [gpsEnabled, setGpsEnabled] = useState(true);
  const [selectedRadius, setSelectedRadius] = useState(5);
  const [city, setCity] = useState("São Paulo, SP");
  const [loading, setLoading] = useState(false);

  const topPad = isWeb ? 67 : insets.top;

  const handleDetectLocation = async () => {
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permissão negada",
          "Habilite a localização nas configurações do seu dispositivo para usar este recurso."
        );
        setLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [geo] = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      if (geo) {
        const label = [geo.city, geo.region].filter(Boolean).join(", ");
        setCity(label || "Localização detectada");
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Erro", "Não foi possível detectar sua localização.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: C.background, borderBottomColor: C.border }]}>
        <Pressable
          style={[styles.backBtn, { backgroundColor: C.backgroundSecondary }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
        >
          <Feather name="chevron-left" size={20} color={C.text} />
        </Pressable>
        <Text style={[styles.title, { color: C.text }]}>Localização</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.section, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
          <View style={styles.row}>
            <View style={[styles.iconWrap, { backgroundColor: C.primary + "18" }]}>
              <Feather name="map-pin" size={18} color={C.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: C.text }]}>Localização automática (GPS)</Text>
              <Text style={[styles.rowSub, { color: C.textMuted }]}>Usa o GPS do dispositivo para encontrar lojas próximas</Text>
            </View>
            <Switch
              value={gpsEnabled}
              onValueChange={(v) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setGpsEnabled(v); }}
              trackColor={{ false: C.border, true: C.primary }}
              thumbColor="#fff"
            />
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
          <Text style={[styles.sectionTitle, { color: C.textSecondary }]}>CIDADE ATUAL</Text>
          <View style={styles.cityRow}>
            <View style={[styles.iconWrap, { backgroundColor: C.backgroundTertiary }]}>
              <Feather name="navigation" size={18} color={C.textSecondary} />
            </View>
            <Text style={[styles.cityText, { color: C.text }]}>{city}</Text>
          </View>
          <Pressable
            style={[styles.detectBtn, { backgroundColor: gpsEnabled ? C.primary : C.backgroundTertiary, opacity: loading ? 0.6 : 1 }]}
            onPress={handleDetectLocation}
            disabled={!gpsEnabled || loading}
          >
            <Feather name="crosshair" size={15} color={gpsEnabled ? "#fff" : C.textMuted} />
            <Text style={[styles.detectBtnText, { color: gpsEnabled ? "#fff" : C.textMuted }]}>
              {loading ? "Detectando..." : "Detectar localização"}
            </Text>
          </Pressable>
        </View>

        <View style={[styles.section, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
          <Text style={[styles.sectionTitle, { color: C.textSecondary }]}>RAIO DE BUSCA</Text>
          <Text style={[styles.sectionDesc, { color: C.textMuted }]}>Distância máxima para mostrar lojas</Text>
          <View style={styles.radiusRow}>
            {RADIUS_OPTIONS.map((r) => (
              <Pressable
                key={r}
                style={[
                  styles.radiusChip,
                  {
                    backgroundColor: selectedRadius === r ? C.primary : C.backgroundTertiary,
                    borderColor: selectedRadius === r ? C.primary : C.border,
                  },
                ]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedRadius(r); }}
              >
                <Text style={[styles.radiusText, { color: selectedRadius === r ? "#fff" : C.textSecondary }]}>
                  {r} km
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Pressable
          style={[styles.saveBtn, { backgroundColor: C.primary }]}
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert("Salvo", "Suas preferências de localização foram salvas.", [
              { text: "OK", onPress: () => router.back() },
            ]);
          }}
        >
          <Feather name="check" size={16} color="#fff" />
          <Text style={styles.saveBtnText}>Salvar preferências</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontFamily: "Inter_700Bold" },
  content: { padding: 16, gap: 14 },
  section: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 14,
  },
  sectionTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, marginBottom: -6 },
  sectionDesc: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: -8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconWrap: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rowLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  rowSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  cityRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  cityText: { fontSize: 15, fontFamily: "Inter_600SemiBold", flex: 1 },
  detectBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    paddingVertical: 12,
  },
  detectBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  radiusRow: { flexDirection: "row", gap: 8 },
  radiusChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  radiusText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 15,
    marginTop: 4,
  },
  saveBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
});
