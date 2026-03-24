import { Feather, Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
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
import {
  fetchMissionQueue,
  validatePrice,
  type MissionQueueItem,
} from "@/services/missionService";
import { useApp } from "@/context/AppContext";

const CESTA_KEYWORDS = ["leite", "arroz", "feijão", "feijao", "óleo", "oleo", "pão", "pao", "açúcar", "acucar"];

function formatCurrency(val: number) {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const diffH = Math.floor((Date.now() - d.getTime()) / 3600000);
  if (diffH < 1) return "Há menos de 1h";
  if (diffH < 24) return `Há ${diffH}h`;
  return `Há ${Math.floor(diffH / 24)}d`;
}

export default function MissionDetailScreen() {
  const { placeId, placeName, xpMultiplier } = useLocalSearchParams<{
    placeId: string;
    placeName: string;
    xpMultiplier?: string;
  }>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const C = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top;
  const { user } = useApp();

  const multiplier = xpMultiplier ? parseFloat(xpMultiplier) : 2;
  const baseXP = 10;
  const missionXP = baseXP * multiplier;

  const [queue, setQueue] = useState<MissionQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [validated, setValidated] = useState<Record<number, "confirm" | "dispute">>({});
  const [totalXP, setTotalXP] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [validating, setValidating] = useState(false);

  // Animations
  const successScale = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;
  const xpAnim = useRef(new Animated.Value(0)).current;
  const [xpPopupText, setXpPopupText] = useState("");

  useEffect(() => {
    if (placeId) {
      fetchMissionQueue(placeId).then((q) => {
        setQueue(q);
        setLoading(false);
      });
    }
  }, [placeId]);

  const currentItem = queue[currentIdx];
  const totalItems = queue.length;
  const completedCount = Object.keys(validated).length;
  const allDone = completedCount >= totalItems && totalItems > 0;

  useEffect(() => {
    if (allDone) {
      setTimeout(() => showSuccessAnimation(), 300);
    }
  }, [allDone]);

  function showSuccessAnimation() {
    setShowSuccess(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.spring(successScale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 50,
      friction: 6,
    }).start();
  }

  function showXpPopup(xp: number) {
    setXpPopupText(`+${xp} XP`);
    xpAnim.setValue(0);
    Animated.sequence([
      Animated.timing(xpAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(800),
      Animated.timing(xpAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }

  async function handleValidate(vote: "confirm" | "dispute") {
    if (!currentItem || validating) return;
    setValidating(true);
    Haptics.impactAsync(vote === "confirm" ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);

    const result = await validatePrice(currentItem.reportId, vote, true);
    setValidating(false);

    if (!result.ok) return;

    const earned = result.xpEarned ?? missionXP;
    setValidated((prev) => ({ ...prev, [currentItem.reportId]: vote }));
    setTotalXP((prev) => prev + earned);
    showXpPopup(earned);

    // Slide to next card
    Animated.sequence([
      Animated.timing(cardAnim, {
        toValue: vote === "confirm" ? 300 : -300,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      cardAnim.setValue(0);
      if (currentIdx < totalItems - 1) {
        setCurrentIdx((i) => i + 1);
      }
    });
  }

  function handleSkip() {
    if (currentIdx < totalItems - 1) {
      setCurrentIdx((i) => i + 1);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: C.background, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={C.primary} />
        <Text style={[styles.loadingText, { color: C.textMuted }]}>Carregando missão…</Text>
      </View>
    );
  }

  if (!queue.length) {
    return (
      <View style={[styles.container, { backgroundColor: C.background }]}>
        <View style={[styles.headerRow, { paddingTop: topPad + 12, borderBottomColor: C.border }]}>
          <Pressable style={[styles.backBtn, { backgroundColor: C.backgroundSecondary }]} onPress={() => router.back()}>
            <Feather name="arrow-left" size={20} color={C.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: C.text }]}>{placeName}</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.emptyCenter}>
          <Feather name="check-circle" size={56} color={C.success} />
          <Text style={[styles.emptyTitle, { color: C.text }]}>Nenhuma missão pendente</Text>
          <Text style={[styles.emptySub, { color: C.textMuted }]}>
            Todos os preços desta loja estão atualizados. Volte mais tarde!
          </Text>
          <Pressable style={[styles.btnBack, { backgroundColor: C.primary }]} onPress={() => router.back()}>
            <Text style={styles.btnBackText}>Voltar</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      {/* Header */}
      <View style={[styles.headerRow, { paddingTop: topPad + 12, borderBottomColor: C.border, backgroundColor: C.background }]}>
        <Pressable style={[styles.backBtn, { backgroundColor: C.backgroundSecondary }]} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={C.text} />
        </Pressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={[styles.headerTitle, { color: C.text }]} numberOfLines={1}>{placeName}</Text>
          <Text style={[styles.headerSub, { color: C.textMuted }]}>Missão Relâmpago</Text>
        </View>
        <View style={[styles.xpPill, { backgroundColor: "#CC000015" }]}>
          <Ionicons name="star" size={11} color="#CC0000" />
          <Text style={[styles.xpPillText, { color: "#CC0000" }]}>x{multiplier} XP</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={[styles.progressWrap, { backgroundColor: C.backgroundSecondary }]}>
        <View style={[styles.progressBar, { backgroundColor: C.backgroundTertiary }]}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                backgroundColor: C.primary,
                width: `${Math.round((completedCount / totalItems) * 100)}%`,
              },
            ]}
          />
        </View>
        <Text style={[styles.progressText, { color: C.textMuted }]}>
          {completedCount}/{totalItems} validados • {totalXP} XP ganhos
        </Text>
      </View>

      {/* XP popup */}
      <Animated.View
        style={[
          styles.xpPopup,
          {
            opacity: xpAnim,
            transform: [{ translateY: xpAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -20] }) }],
          },
        ]}
        pointerEvents="none"
      >
        <Text style={styles.xpPopupText}>{xpPopupText}</Text>
      </Animated.View>

      {/* Card area */}
      {!allDone && currentItem && (
        <View style={styles.cardArea}>
          <Animated.View
            style={[
              styles.card,
              {
                backgroundColor: C.surfaceElevated,
                borderColor: currentItem.isPriority ? "#CC000040" : C.border,
                transform: [{ translateX: cardAnim }],
              },
            ]}
          >
            {/* Priority badge */}
            {currentItem.isPriority && (
              <View style={[styles.priorityBadge, { backgroundColor: "#CC0000" }]}>
                <Ionicons name="star" size={10} color="#fff" />
                <Text style={styles.priorityText}>Cesta Básica</Text>
              </View>
            )}

            {/* Reason */}
            <View style={[
              styles.reasonBadge,
              { backgroundColor: currentItem.reason === "stale" ? "#FF980015" : "#F4433615" }
            ]}>
              <Feather
                name={currentItem.reason === "stale" ? "clock" : "alert-triangle"}
                size={12}
                color={currentItem.reason === "stale" ? "#FF9800" : "#F44336"}
              />
              <Text style={[
                styles.reasonText,
                { color: currentItem.reason === "stale" ? "#FF9800" : "#F44336" }
              ]}>
                {currentItem.reason === "stale"
                  ? `Atualizado ${formatTime(currentItem.reportedAt)} — pode estar desatualizado`
                  : "Usuários reportaram divergência neste preço"}
              </Text>
            </View>

            <Text style={[styles.productName, { color: C.text }]} numberOfLines={2}>
              {currentItem.productName}
            </Text>
            {currentItem.brand && (
              <Text style={[styles.productBrand, { color: C.textMuted }]}>{currentItem.brand}</Text>
            )}

            <View style={styles.priceRow}>
              <Text style={[styles.reportedLabel, { color: C.textMuted }]}>Preço reportado</Text>
              <Text style={[styles.priceValue, { color: C.primary }]}>
                {formatCurrency(currentItem.price)}
              </Text>
            </View>

            <View style={styles.voteBar}>
              <View style={[styles.voteStat, { backgroundColor: "#4CAF5010" }]}>
                <Feather name="thumbs-up" size={12} color="#4CAF50" />
                <Text style={[styles.voteCount, { color: "#4CAF50" }]}>{currentItem.upvotes}</Text>
              </View>
              <View style={[styles.voteStat, { backgroundColor: "#F4433610" }]}>
                <Feather name="thumbs-down" size={12} color="#F44336" />
                <Text style={[styles.voteCount, { color: "#F44336" }]}>{currentItem.downvotes}</Text>
              </View>
              <Text style={[styles.cardCount, { color: C.textMuted }]}>
                {currentIdx + 1} / {totalItems}
              </Text>
            </View>
          </Animated.View>

          {/* Action buttons */}
          <View style={styles.actionRow}>
            <Pressable
              style={[styles.actionBtn, styles.disputeBtn, { opacity: validating ? 0.5 : 1 }]}
              onPress={() => handleValidate("dispute")}
              disabled={validating}
            >
              <Feather name="x" size={28} color="#F44336" />
              <Text style={styles.disputeBtnText}>Errado</Text>
            </Pressable>

            <Pressable style={styles.skipBtn} onPress={handleSkip}>
              <Feather name="skip-forward" size={18} color={C.textMuted} />
              <Text style={[styles.skipText, { color: C.textMuted }]}>Pular</Text>
            </Pressable>

            <Pressable
              style={[styles.actionBtn, styles.confirmBtn, { opacity: validating ? 0.5 : 1 }]}
              onPress={() => handleValidate("confirm")}
              disabled={validating}
            >
              <Feather name="check" size={28} color="#4CAF50" />
              <Text style={styles.confirmBtnText}>Correto</Text>
            </Pressable>
          </View>

          <Text style={[styles.swipeHint, { color: C.textMuted }]}>
            Toque em ✓ se o preço estiver correto, ou ✗ se estiver errado
          </Text>
        </View>
      )}

      {/* Success overlay */}
      {showSuccess && (
        <View style={[styles.successOverlay, { backgroundColor: C.background }]}>
          <Animated.View style={[styles.successContent, { transform: [{ scale: successScale }] }]}>
            <View style={[styles.successRing, { borderColor: "#FFD700" }]}>
              <Ionicons name="trophy" size={64} color="#FFD700" />
            </View>
            <Text style={[styles.successTitle, { color: C.text }]}>Missão Cumprida!</Text>
            <Text style={[styles.successSub, { color: C.textMuted }]}>
              Você validou {completedCount} preços e ajudou sua vizinhança.
            </Text>

            <View style={[styles.xpCard, { backgroundColor: "#FFD70015", borderColor: "#FFD70040" }]}>
              <Ionicons name="star" size={20} color="#FFD700" />
              <View>
                <Text style={[styles.xpTotal, { color: "#D4AF37" }]}>+{totalXP} XP</Text>
                <Text style={[styles.xpBonus, { color: C.textMuted }]}>
                  Inclui bônus x{multiplier} de Missão Relâmpago
                </Text>
              </View>
            </View>

            <View style={[styles.sealCard, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
              <Feather name="shield" size={20} color={C.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.sealTitle, { color: C.text }]}>Fiscal de Elite</Text>
                <Text style={[styles.sealSub, { color: C.textMuted }]}>
                  Continue validando preços para conquistar este selo!
                </Text>
              </View>
            </View>

            <Pressable
              style={[styles.successBtn, { backgroundColor: C.primary }]}
              onPress={() => router.replace("/(tabs)")}
            >
              <Feather name="home" size={16} color="#fff" />
              <Text style={styles.successBtnText}>Voltar ao início</Text>
            </Pressable>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 16, fontFamily: "Inter_700Bold", flex: 1, textAlign: "center" },
  headerSub: { fontSize: 11, fontFamily: "Inter_400Regular" },
  xpPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20,
  },
  xpPillText: { fontSize: 12, fontFamily: "Inter_700Bold" },

  progressWrap: { paddingHorizontal: 16, paddingVertical: 10, gap: 6 },
  progressBar: { height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  progressText: { fontSize: 11, fontFamily: "Inter_400Regular" },

  xpPopup: {
    position: "absolute", top: 140, alignSelf: "center",
    zIndex: 100, pointerEvents: "none",
  },
  xpPopupText: {
    fontSize: 28, fontFamily: "Inter_700Bold",
    color: "#FFD700", textShadowColor: "rgba(0,0,0,0.3)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4,
  },

  cardArea: {
    flex: 1, paddingHorizontal: 20, paddingTop: 16, gap: 20,
    alignItems: "center",
  },
  card: {
    width: "100%", borderRadius: 20, borderWidth: 1.5,
    padding: 20, gap: 12, elevation: 4,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8,
  },
  priorityBadge: {
    flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start",
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20,
  },
  priorityText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#fff" },
  reasonBadge: {
    flexDirection: "row", alignItems: "flex-start", gap: 6,
    padding: 10, borderRadius: 10,
  },
  reasonText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 16 },

  productName: { fontSize: 22, fontFamily: "Inter_700Bold", lineHeight: 28 },
  productBrand: { fontSize: 13, fontFamily: "Inter_400Regular" },

  priceRow: { gap: 2, marginTop: 4 },
  reportedLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  priceValue: { fontSize: 36, fontFamily: "Inter_700Bold" },

  voteBar: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  voteStat: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  voteCount: { fontSize: 12, fontFamily: "Inter_700Bold" },
  cardCount: { flex: 1, textAlign: "right", fontSize: 11, fontFamily: "Inter_400Regular" },

  actionRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 20, width: "100%",
  },
  actionBtn: {
    width: 76, height: 76, borderRadius: 38,
    alignItems: "center", justifyContent: "center", gap: 4,
    elevation: 3, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6,
  },
  confirmBtn: { backgroundColor: "#4CAF5015", borderWidth: 2, borderColor: "#4CAF50" },
  disputeBtn: { backgroundColor: "#F4433615", borderWidth: 2, borderColor: "#F44336" },
  confirmBtnText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#4CAF50" },
  disputeBtnText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#F44336" },
  skipBtn: { alignItems: "center", gap: 4 },
  skipText: { fontSize: 10, fontFamily: "Inter_400Regular" },

  swipeHint: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center" },

  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50, alignItems: "center", justifyContent: "center", padding: 24,
  },
  successContent: { alignItems: "center", gap: 16, width: "100%" },
  successRing: {
    width: 110, height: 110, borderRadius: 55,
    borderWidth: 3, alignItems: "center", justifyContent: "center",
    shadowColor: "#FFD700", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 20,
  },
  successTitle: { fontSize: 28, fontFamily: "Inter_700Bold" },
  successSub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  xpCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 16, borderRadius: 14, borderWidth: 1, width: "100%",
  },
  xpTotal: { fontSize: 28, fontFamily: "Inter_700Bold" },
  xpBonus: { fontSize: 11, fontFamily: "Inter_400Regular" },
  sealCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 14, borderRadius: 12, borderWidth: 1, width: "100%",
  },
  sealTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  sealSub: { fontSize: 11, fontFamily: "Inter_400Regular" },
  successBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 28, paddingVertical: 14, borderRadius: 12,
    width: "100%", justifyContent: "center",
  },
  successBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 },

  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 12 },
  emptyCenter: {
    flex: 1, alignItems: "center", justifyContent: "center",
    padding: 32, gap: 12,
  },
  emptyTitle: { fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "center" },
  emptySub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  btnBack: { borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  btnBackText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 },
});
