import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
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

type PrivacyKey =
  | "shareShoppingData"
  | "shareExactLocation"
  | "anonymousContribution"
  | "personalizedAds"
  | "analyticsCollection";

const PRIVACY_OPTIONS: { key: PrivacyKey; icon: string; label: string; sub: string }[] = [
  {
    key: "shareShoppingData",
    icon: "shopping-cart",
    label: "Compartilhar dados de compra",
    sub: "Ajuda a melhorar as comparações de preços da comunidade",
  },
  {
    key: "shareExactLocation",
    icon: "map-pin",
    label: "Compartilhar localização exata",
    sub: "Permite mostrar lojas ainda mais próximas de você",
  },
  {
    key: "anonymousContribution",
    icon: "eye-off",
    label: "Contribuição anônima",
    sub: "Suas atualizações de preço não exibem seu nome publicamente",
  },
  {
    key: "personalizedAds",
    icon: "target",
    label: "Anúncios personalizados",
    sub: "Receba ofertas relevantes com base no seu histórico de buscas",
  },
  {
    key: "analyticsCollection",
    icon: "bar-chart-2",
    label: "Coleta de dados de uso",
    sub: "Nos ajuda a entender como o app é usado para melhorias",
  },
];

export default function PrivacySettingsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const C = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const topPad = isWeb ? 67 : insets.top;

  const [settings, setSettings] = useState<Record<PrivacyKey, boolean>>({
    shareShoppingData: true,
    shareExactLocation: false,
    anonymousContribution: true,
    personalizedAds: false,
    analyticsCollection: true,
  });

  const toggle = (key: PrivacyKey) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
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
        <Text style={[styles.title, { color: C.text }]}>Privacidade</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.infoCard, { backgroundColor: C.primary + "12", borderColor: C.primary + "30" }]}>
          <Feather name="shield" size={18} color={C.primary} />
          <Text style={[styles.infoText, { color: C.text }]}>
            Seus dados são armazenados com segurança e nunca vendidos a terceiros.
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
          <Text style={[styles.sectionTitle, { color: C.textSecondary }]}>PREFERÊNCIAS DE DADOS</Text>
          {PRIVACY_OPTIONS.map((opt, i) => (
            <View key={opt.key}>
              {i > 0 && <View style={[styles.divider, { backgroundColor: C.border }]} />}
              <View style={styles.row}>
                <View style={[styles.iconWrap, { backgroundColor: C.backgroundTertiary }]}>
                  <Feather name={opt.icon as any} size={16} color={C.textSecondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowLabel, { color: C.text }]}>{opt.label}</Text>
                  <Text style={[styles.rowSub, { color: C.textMuted }]}>{opt.sub}</Text>
                </View>
                <Switch
                  value={settings[opt.key]}
                  onValueChange={() => toggle(opt.key)}
                  trackColor={{ false: C.border, true: C.primary }}
                  thumbColor="#fff"
                />
              </View>
            </View>
          ))}
        </View>

        <View style={[styles.section, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
          <Text style={[styles.sectionTitle, { color: C.textSecondary }]}>DADOS DA CONTA</Text>
          <Pressable
            style={styles.row}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              Alert.alert("Exportar dados", "Seus dados serão enviados para o e-mail cadastrado em até 48 horas.", [
                { text: "Cancelar", style: "cancel" },
                { text: "Solicitar", onPress: () => Alert.alert("Solicitação enviada!") },
              ]);
            }}
          >
            <View style={[styles.iconWrap, { backgroundColor: C.backgroundTertiary }]}>
              <Feather name="download" size={16} color={C.textSecondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: C.text }]}>Exportar meus dados</Text>
              <Text style={[styles.rowSub, { color: C.textMuted }]}>Receba uma cópia de todos os seus dados</Text>
            </View>
            <Feather name="chevron-right" size={16} color={C.textMuted} />
          </Pressable>
          <View style={[styles.divider, { backgroundColor: C.border }]} />
          <Pressable
            style={styles.row}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              Alert.alert(
                "Excluir conta",
                "Esta ação é irreversível. Todos os seus dados serão apagados permanentemente.",
                [
                  { text: "Cancelar", style: "cancel" },
                  { text: "Excluir", style: "destructive", onPress: () => Alert.alert("Solicitação registrada", "Sua conta será excluída em até 30 dias.") },
                ]
              );
            }}
          >
            <View style={[styles.iconWrap, { backgroundColor: "#CC000018" }]}>
              <Feather name="trash-2" size={16} color="#CC0000" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: "#CC0000" }]}>Excluir minha conta</Text>
              <Text style={[styles.rowSub, { color: C.textMuted }]}>Remove permanentemente sua conta e dados</Text>
            </View>
            <Feather name="chevron-right" size={16} color="#CC000080" />
          </Pressable>
        </View>

        <Pressable
          style={[styles.saveBtn, { backgroundColor: C.primary }]}
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert("Salvo", "Suas preferências de privacidade foram salvas.", [
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
  infoCard: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, borderRadius: 14, borderWidth: 1 },
  infoText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  section: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 14 },
  sectionTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rowLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  rowSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2, lineHeight: 17 },
  divider: { height: 1, marginVertical: 2 },
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
