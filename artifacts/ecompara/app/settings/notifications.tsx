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

type NotifKey =
  | "priceDrops"
  | "nearbyPromotions"
  | "listReminders"
  | "weeklyDigest"
  | "newStores"
  | "appUpdates";

const NOTIF_GROUPS: {
  title: string;
  items: { key: NotifKey; icon: string; label: string; sub: string }[];
}[] = [
  {
    title: "PREÇOS E PROMOÇÕES",
    items: [
      {
        key: "priceDrops",
        icon: "trending-down",
        label: "Alertas de queda de preço",
        sub: "Notifica quando produtos da sua lista ficam mais baratos",
      },
      {
        key: "nearbyPromotions",
        icon: "tag",
        label: "Promoções próximas",
        sub: "Ofertas de lojas a menos de 5 km de você",
      },
    ],
  },
  {
    title: "LISTA DE COMPRAS",
    items: [
      {
        key: "listReminders",
        icon: "shopping-bag",
        label: "Lembretes de lista",
        sub: "Aviso para não esquecer de fazer suas compras",
      },
      {
        key: "weeklyDigest",
        icon: "calendar",
        label: "Resumo semanal",
        sub: "Relatório dos melhores preços da semana na sua região",
      },
    ],
  },
  {
    title: "GERAL",
    items: [
      {
        key: "newStores",
        icon: "map-pin",
        label: "Novas lojas na área",
        sub: "Quando um novo supermercado é cadastrado perto de você",
      },
      {
        key: "appUpdates",
        icon: "bell",
        label: "Novidades do app",
        sub: "Atualizações de funcionalidades e melhorias",
      },
    ],
  },
];

export default function NotificationsSettingsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const C = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const topPad = isWeb ? 67 : insets.top;

  const [settings, setSettings] = useState<Record<NotifKey, boolean>>({
    priceDrops: true,
    nearbyPromotions: true,
    listReminders: false,
    weeklyDigest: true,
    newStores: false,
    appUpdates: true,
  });

  const toggle = (key: NotifKey) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const allOn = Object.values(settings).every(Boolean);

  const toggleAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newVal = !allOn;
    setSettings({
      priceDrops: newVal,
      nearbyPromotions: newVal,
      listReminders: newVal,
      weeklyDigest: newVal,
      newStores: newVal,
      appUpdates: newVal,
    });
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
        <Text style={[styles.title, { color: C.text }]}>Notificações</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.section, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
          <View style={styles.row}>
            <View style={[styles.iconWrap, { backgroundColor: C.primary + "18" }]}>
              <Feather name="bell" size={18} color={C.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: C.text }]}>Ativar todas as notificações</Text>
              <Text style={[styles.rowSub, { color: C.textMuted }]}>Liga ou desliga todas de uma vez</Text>
            </View>
            <Switch
              value={allOn}
              onValueChange={toggleAll}
              trackColor={{ false: C.border, true: C.primary }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {NOTIF_GROUPS.map((group) => (
          <View key={group.title} style={[styles.section, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
            <Text style={[styles.sectionTitle, { color: C.textSecondary }]}>{group.title}</Text>
            {group.items.map((item, i) => (
              <View key={item.key}>
                {i > 0 && <View style={[styles.divider, { backgroundColor: C.border }]} />}
                <View style={styles.row}>
                  <View style={[styles.iconWrap, { backgroundColor: C.backgroundTertiary }]}>
                    <Feather name={item.icon as any} size={16} color={C.textSecondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowLabel, { color: C.text }]}>{item.label}</Text>
                    <Text style={[styles.rowSub, { color: C.textMuted }]}>{item.sub}</Text>
                  </View>
                  <Switch
                    value={settings[item.key]}
                    onValueChange={() => toggle(item.key)}
                    trackColor={{ false: C.border, true: C.primary }}
                    thumbColor="#fff"
                  />
                </View>
              </View>
            ))}
          </View>
        ))}

        <Pressable
          style={[styles.saveBtn, { backgroundColor: C.primary }]}
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert("Salvo", "Suas preferências de notificação foram salvas.", [
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
