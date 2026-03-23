import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";

const FAQ = [
  {
    q: "Como funciona a comparação de preços?",
    a: "Escaneie o código de barras de um produto ou pesquise pelo nome. O app mostra o preço desse produto nas lojas próximas a você, ordenados do mais barato ao mais caro.",
  },
  {
    q: "Como atualizo um preço incorreto?",
    a: "Na tela do produto, toque em 'Atualizar preço' ao lado da loja com o preço errado. Insira o valor correto e confirme. Você ganha pontos por cada contribuição válida.",
  },
  {
    q: "O que são os pontos do ranking?",
    a: "Você ganha pontos ao atualizar preços, escanear produtos e contribuir com a comunidade. Os pontos determinam sua posição no ranking e podem ser trocados por vantagens futuramente.",
  },
  {
    q: "Como reivindicar minha loja?",
    a: "Na tela de detalhes de uma loja, toque em 'Este é meu negócio'. Preencha seus dados de contato e aguarde nossa verificação. Lojistas verificados têm destaque no app.",
  },
  {
    q: "O app funciona sem internet?",
    a: "O app precisa de conexão para carregar preços e lojas próximas. Porém, a lista de compras fica salva localmente e pode ser acessada offline.",
  },
  {
    q: "Como desativo minha conta?",
    a: "Acesse Perfil → Privacidade → Excluir minha conta. A exclusão é processada em até 30 dias, período em que você pode cancelar a solicitação.",
  },
];

export default function HelpScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const C = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const topPad = isWeb ? 67 : insets.top;
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (i: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOpenIndex(openIndex === i ? null : i);
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
        <Text style={[styles.title, { color: C.text }]}>Ajuda</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.infoCard, { backgroundColor: C.primary + "12", borderColor: C.primary + "30" }]}>
          <Feather name="help-circle" size={18} color={C.primary} />
          <Text style={[styles.infoText, { color: C.text }]}>
            Encontre respostas rápidas abaixo ou entre em contato com nossa equipe.
          </Text>
        </View>

        <Text style={[styles.groupTitle, { color: C.textSecondary }]}>PERGUNTAS FREQUENTES</Text>

        <View style={[styles.faqContainer, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
          {FAQ.map((item, i) => (
            <View key={i}>
              {i > 0 && <View style={[styles.divider, { backgroundColor: C.border }]} />}
              <Pressable style={styles.faqRow} onPress={() => toggle(i)}>
                <Text style={[styles.faqQ, { color: C.text, flex: 1 }]}>{item.q}</Text>
                <Feather
                  name={openIndex === i ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={C.textMuted}
                />
              </Pressable>
              {openIndex === i && (
                <Text style={[styles.faqA, { color: C.textSecondary, borderTopColor: C.border }]}>
                  {item.a}
                </Text>
              )}
            </View>
          ))}
        </View>

        <Text style={[styles.groupTitle, { color: C.textSecondary }]}>SUPORTE</Text>

        <View style={[styles.section, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
          <Pressable
            style={styles.row}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Linking.openURL("mailto:suporte@ecompara.com.br").catch(() =>
                Alert.alert("Erro", "Não foi possível abrir o cliente de e-mail.")
              );
            }}
          >
            <View style={[styles.iconWrap, { backgroundColor: C.backgroundTertiary }]}>
              <Feather name="mail" size={16} color={C.textSecondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: C.text }]}>Enviar e-mail</Text>
              <Text style={[styles.rowSub, { color: C.textMuted }]}>suporte@ecompara.com.br</Text>
            </View>
            <Feather name="chevron-right" size={16} color={C.textMuted} />
          </Pressable>

          <View style={[styles.divider, { backgroundColor: C.border }]} />

          <Pressable
            style={styles.row}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Alert.alert("Chat de suporte", "Nossa equipe está disponível de segunda a sexta, das 9h às 18h.", [
                { text: "Fechar" },
                {
                  text: "Iniciar chat",
                  onPress: () => Linking.openURL("https://wa.me/5511999999999").catch(() => null),
                },
              ]);
            }}
          >
            <View style={[styles.iconWrap, { backgroundColor: C.backgroundTertiary }]}>
              <Feather name="message-circle" size={16} color={C.textSecondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: C.text }]}>Chat via WhatsApp</Text>
              <Text style={[styles.rowSub, { color: C.textMuted }]}>Segunda a sexta, 9h – 18h</Text>
            </View>
            <Feather name="chevron-right" size={16} color={C.textMuted} />
          </Pressable>

          <View style={[styles.divider, { backgroundColor: C.border }]} />

          <Pressable
            style={styles.row}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Linking.openURL("https://ecompara.com.br/termos").catch(() => null);
            }}
          >
            <View style={[styles.iconWrap, { backgroundColor: C.backgroundTertiary }]}>
              <Feather name="file-text" size={16} color={C.textSecondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: C.text }]}>Termos de uso</Text>
              <Text style={[styles.rowSub, { color: C.textMuted }]}>Leia nossa política e termos</Text>
            </View>
            <Feather name="chevron-right" size={16} color={C.textMuted} />
          </Pressable>
        </View>

        <View style={[styles.versionBox, { borderColor: C.border }]}>
          <Text style={[styles.versionText, { color: C.textMuted }]}>eCompara versão 1.0.0</Text>
          <Text style={[styles.versionText, { color: C.textMuted }]}>© 2025 eCompara</Text>
        </View>
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
  groupTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, marginBottom: -4 },
  faqContainer: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  faqRow: { flexDirection: "row", alignItems: "center", padding: 16, gap: 10 },
  faqQ: { fontSize: 14, fontFamily: "Inter_600SemiBold", lineHeight: 20 },
  faqA: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    paddingTop: 12,
  },
  section: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rowLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  rowSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  divider: { height: 1, marginVertical: 2 },
  versionBox: { alignItems: "center", gap: 4, paddingVertical: 12, borderTopWidth: 1, marginTop: 4 },
  versionText: { fontSize: 12, fontFamily: "Inter_400Regular" },
});
