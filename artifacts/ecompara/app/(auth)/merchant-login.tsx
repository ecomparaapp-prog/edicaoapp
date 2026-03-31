import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { useApp } from "@/context/AppContext";

export default function MerchantLoginScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const C = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { merchantLogin, setActiveTab } = useApp();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 34 : insets.bottom;

  const handleLogin = async () => {
    if (!email.trim()) { setError("Informe o e-mail."); return; }
    if (!password) { setError("Informe a senha."); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setError("");
    const result = await merchantLogin(email.trim(), password);
    setLoading(false);
    if (result.ok) {
      setActiveTab("retailer");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.dismissAll();
    } else {
      setError(result.error || "E-mail ou senha inválidos.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: topPad, paddingBottom: bottomPad + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.topBar}>
          <Pressable
            style={[styles.backBtn, { backgroundColor: C.backgroundSecondary }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            hitSlop={8}
          >
            <Feather name="arrow-left" size={18} color={C.text} />
          </Pressable>
        </View>

        {/* Icon + título */}
        <View style={styles.heroArea}>
          <View style={[styles.heroIconWrap, { backgroundColor: "#CC000012", borderColor: "#CC000030", borderWidth: 1 }]}>
            <Feather name="store" size={32} color="#CC0000" />
          </View>
          <Text style={[styles.heroTitle, { color: C.text }]}>Área Supermercado</Text>
          <Text style={[styles.heroSub, { color: C.textMuted }]}>
            Acesse o portal exclusivo para supermercados parceiros
          </Text>
        </View>

        {/* Formulário */}
        <View style={[styles.formCard, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
          {/* Erro */}
          {!!error && (
            <View style={[styles.errorBox, { backgroundColor: "#FEF2F2" }]}>
              <Feather name="alert-circle" size={14} color="#CC0000" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* E-mail */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: C.textMuted }]}>E-MAIL</Text>
            <View style={[styles.inputWrap, { backgroundColor: C.backgroundSecondary, borderColor: C.border }]}>
              <Feather name="mail" size={16} color={C.textMuted} style={{ marginRight: 10 }} />
              <TextInput
                style={[styles.input, { color: C.text }]}
                placeholder="seu@supermercado.com.br"
                placeholderTextColor={C.textMuted}
                value={email}
                onChangeText={(v) => { setEmail(v); setError(""); }}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>
          </View>

          {/* Senha */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: C.textMuted }]}>SENHA</Text>
            <View style={[styles.inputWrap, { backgroundColor: C.backgroundSecondary, borderColor: C.border }]}>
              <Feather name="lock" size={16} color={C.textMuted} style={{ marginRight: 10 }} />
              <TextInput
                style={[styles.input, { color: C.text }]}
                placeholder="Senha do portal"
                placeholderTextColor={C.textMuted}
                value={password}
                onChangeText={(v) => { setPassword(v); setError(""); }}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <Pressable onPress={() => setShowPassword((p) => !p)} hitSlop={8}>
                <Feather name={showPassword ? "eye-off" : "eye"} size={16} color={C.textMuted} />
              </Pressable>
            </View>
          </View>

          {/* Botão entrar */}
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: loading ? "#CC000099" : "#CC0000" }]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <Text style={styles.submitBtnText}>Verificando...</Text>
            ) : (
              <>
                <Feather name="log-in" size={18} color="#fff" />
                <Text style={styles.submitBtnText}>Entrar na Área Supermercado</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Rodapé informativo */}
        <View style={[styles.infoBox, { backgroundColor: C.backgroundSecondary, borderColor: C.border }]}>
          <Feather name="info" size={14} color={C.textMuted} />
          <Text style={[styles.infoText, { color: C.textMuted }]}>
            Não tem acesso? Entre em contato com o suporte do eCompara para cadastrar seu supermercado.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    gap: 24,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  heroArea: {
    alignItems: "center",
    gap: 10,
    paddingTop: 8,
    paddingBottom: 4,
  },
  heroIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  heroSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 18,
  },
  formCard: {
    borderRadius: 20,
    padding: 20,
    gap: 16,
    borderWidth: 1,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    padding: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#CC0000",
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    padding: 0,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 4,
  },
  submitBtnText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
  },
});
