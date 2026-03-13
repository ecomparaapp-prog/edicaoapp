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

export default function LoginScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const C = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { setUser } = useApp();
  const [loading, setLoading] = useState(false);

  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 34 : insets.bottom;

  const handleGoogleLogin = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1200));

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
    setLoading(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.dismissAll();
  };

  return (
    <View style={[styles.container, { backgroundColor: C.background, paddingTop: topPad, paddingBottom: bottomPad }]}>
      <Pressable
        style={[styles.closeBtn, { backgroundColor: C.backgroundSecondary }]}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
      >
        <Feather name="x" size={20} color={C.text} />
      </Pressable>

      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.logoArea}>
          <View style={[styles.logoCircle, { backgroundColor: C.primary }]}>
            <Feather name="shopping-cart" size={36} color="#fff" />
          </View>
          <View style={styles.logoTextRow}>
            <Text style={[styles.logoText, { color: C.text }]}>ecompa</Text>
            <Text style={[styles.logoTextRed, { color: C.primary }]}>ra</Text>
          </View>
          <Text style={[styles.tagline, { color: C.textMuted }]}>
            Compare preços, economize mais
          </Text>
        </View>

        {/* Benefits */}
        <View style={[styles.benefitsCard, { backgroundColor: C.backgroundSecondary }]}>
          {[
            { icon: "map-pin", text: "Encontre os melhores preços num raio de até 10km" },
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
        <Pressable
          style={[styles.googleBtn, { backgroundColor: loading ? C.primary + "80" : C.primary }]}
          onPress={handleGoogleLogin}
          disabled={loading}
        >
          {loading ? (
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
        <Text style={[styles.terms, { color: C.textMuted }]}>
          Ao entrar, você concorda com os Termos de Uso e Política de Privacidade do eCompara.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  closeBtn: { position: "absolute", top: 60, right: 24, width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", zIndex: 10 },
  content: { flex: 1, justifyContent: "center", gap: 32 },
  logoArea: { alignItems: "center", gap: 8 },
  logoCircle: { width: 80, height: 80, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  logoTextRow: { flexDirection: "row" },
  logoText: { fontSize: 34, fontFamily: "Inter_700Bold" },
  logoTextRed: { fontSize: 34, fontFamily: "Inter_700Bold" },
  tagline: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  benefitsCard: { borderRadius: 18, padding: 20, gap: 14 },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  benefitIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  benefitText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  footer: { gap: 14, paddingBottom: 8 },
  googleBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, borderRadius: 16, paddingVertical: 16 },
  googleIconBg: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  googleBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  terms: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 16 },
});
