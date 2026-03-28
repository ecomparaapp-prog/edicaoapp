import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";

interface AuthGateProps {
  title?: string;
  description?: string;
  icon?: string;
  onBack?: () => void;
}

export function AuthGate({
  title = "Login necessário",
  description = "Você precisa estar logado para acessar esta funcionalidade.",
  icon = "lock-outline",
  onBack,
}: AuthGateProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const C = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: C.background, paddingTop: insets.top }]}>
      {/* Back button */}
      <Pressable
        style={[styles.backBtn, { paddingTop: 8 }]}
        onPress={() => (onBack ? onBack() : router.back())}
        hitSlop={12}
      >
        <Feather name="arrow-left" size={22} color={C.text} />
      </Pressable>

      <View style={styles.content}>
        <View style={[styles.iconCircle, { backgroundColor: isDark ? "#1A2340" : "#EEF2FF" }]}>
          <MaterialCommunityIcons name={icon as any} size={52} color="#6366F1" />
        </View>

        <Text style={[styles.title, { color: C.text }]}>{title}</Text>
        <Text style={[styles.desc, { color: C.textMuted }]}>{description}</Text>

        <Pressable
          style={[styles.loginBtn, { backgroundColor: C.primary }]}
          onPress={() => router.push("/(auth)/login")}
        >
          <MaterialCommunityIcons name="login" size={18} color="#fff" />
          <Text style={styles.loginBtnText}>Fazer Login</Text>
        </Pressable>

        <Pressable onPress={() => (onBack ? onBack() : router.back())} style={styles.backLink}>
          <Text style={[styles.backLinkText, { color: C.textMuted }]}>Voltar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backBtn: { paddingHorizontal: 16, paddingBottom: 4 },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 16,
    marginTop: -60,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  desc: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  loginBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  loginBtnText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  backLink: { marginTop: 4, padding: 8 },
  backLinkText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
