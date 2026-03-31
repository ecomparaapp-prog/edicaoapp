import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { useApp, type User } from "@/context/AppContext";

type LoginMode = "customer" | "retailer";

export default function LoginScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const C = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { setUser, setActiveTab } = useApp();
  const [loading, setLoading] = useState<LoginMode | null>(null);

  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 34 : insets.bottom;

  const handleLogin = async (mode: LoginMode) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(mode);
    await new Promise((r) => setTimeout(r, 1200));

    if (mode === "customer") {
      const mockUser: User = {
        id: "u_local_" + Date.now(),
        name: "João da Silva",
        email: "joao.silva@gmail.com",
        photo: "",
        role: "customer",
        points: 320,
        rank: 12,
        totalPriceUpdates: 16,
      };
      await setUser(mockUser);
      setLoading(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.dismissAll();
    } else {
      const mockRetailer: User = {
        id: "r_local_" + Date.now(),
        name: "Supermercado Demo",
        email: "contato@supermercadodemo.com.br",
        photo: "",
        role: "retailer",
        points: 0,
        rank: 0,
        totalPriceUpdates: 0,
      };
      await setUser(mockRetailer);
      setActiveTab("retailer");
      setLoading(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.dismissAll();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: C.background, paddingTop: topPad, paddingBottom: bottomPad }]}>

      {/* Top bar — close button fora da área do logo */}
      <View style={styles.topBar}>
        <Pressable
          style={[styles.closeBtn, { backgroundColor: C.backgroundSecondary }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.replace("/(tabs)/"); }}
          hitSlop={8}
        >
          <Feather name="x" size={18} color={C.text} />
        </Pressable>
      </View>

      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.logoArea}>
          <Image
            source={
              isDark
                ? require("@/assets/images/logo-light.png")
                : require("@/assets/images/logo-dark.png")
            }
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={[styles.taglineMain, { color: C.primary }]}>
            O Waze dos supermercados
          </Text>
          <Text style={[styles.taglineSub, { color: C.textMuted }]}>
            Compare preços, economize mais
          </Text>
        </View>

        {/* Benefits */}
        <View style={[styles.benefitsCard, { backgroundColor: C.backgroundSecondary }]}>
          {[
            { icon: "map-pin", text: "Encontre os melhores preços num raio de até 50km" },
            { icon: "shopping-cart", text: "Monte sua lista e compare automaticamente" },
            { icon: "award", text: "Ganhe pontos atualizando preços e troque por dinheiro real" },
          ].map((b, i) => (
            <View key={i} style={styles.benefitRow}>
              <View style={[styles.benefitIcon, { backgroundColor: C.primary + "20" }]}>
                <Feather name={b.icon as any} size={16} color={C.primary} />
              </View>
              <Text style={[styles.benefitText, { color: C.textSecondary }]}>{b.text}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        {/* Botão cliente — Google */}
        <Pressable
          style={[styles.googleBtn, { backgroundColor: loading ? C.primary + "80" : C.primary }]}
          onPress={() => handleLogin("customer")}
          disabled={loading !== null}
        >
          {loading === "customer" ? (
            <Text style={styles.googleBtnText}>Entrando...</Text>
          ) : (
            <>
              <View style={[styles.googleIconBg, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
                <Feather name="log-in" size={18} color="#fff" />
              </View>
              <Text style={styles.googleBtnText}>Continuar com Google</Text>
            </>
          )}
        </Pressable>

        {/* Divisor */}
        <View style={styles.dividerRow}>
          <View style={[styles.dividerLine, { backgroundColor: C.border }]} />
          <Text style={[styles.dividerText, { color: C.textMuted }]}>ou</Text>
          <View style={[styles.dividerLine, { backgroundColor: C.border }]} />
        </View>

        {/* Botão Área Supermercado */}
        <Pressable
          style={[
            styles.retailerBtn,
            {
              backgroundColor: isDark ? "#1A1A1A" : "#FFF",
              borderColor: "#8B0000",
              opacity: loading ? 0.6 : 1,
            },
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/(auth)/merchant-login");
          }}
          disabled={loading !== null}
        >
          <View style={[styles.retailerIconBg, { backgroundColor: "#8B000015" }]}>
            <Feather name="store" size={18} color="#8B0000" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.retailerBtnText, { color: "#8B0000" }]}>Área Supermercado</Text>
            <Text style={[styles.retailerBtnSub, { color: C.textMuted }]}>Área exclusiva para supermercados parceiros</Text>
          </View>
          <Feather name="chevron-right" size={16} color="#8B0000" />
        </Pressable>

        <Text style={[styles.terms, { color: C.textMuted }]}>
          Ao entrar, você concorda com os Termos de Uso e Política de Privacidade do eCompara.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  topBar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingTop: 8,
    paddingBottom: 4,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
  },
  content: { flex: 1, justifyContent: "center", gap: 32 },
  logoArea: { alignItems: "center", gap: 6 },
  logoImage: { width: 260, height: 66 },
  taglineMain: { fontSize: 16, fontFamily: "Inter_600SemiBold", textAlign: "center", marginTop: 4 },
  taglineSub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  benefitsCard: { borderRadius: 18, padding: 20, gap: 14 },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  benefitIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  benefitText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  footer: { gap: 12, paddingBottom: 8 },
  googleBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 12, borderRadius: 16, paddingVertical: 16,
  },
  googleIconBg: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  googleBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  retailerBtn: {
    flexDirection: "row", alignItems: "center",
    gap: 12, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16,
    borderWidth: 1.5,
  },
  retailerIconBg: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  retailerBtnText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  retailerBtnSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  terms: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 16 },
});
