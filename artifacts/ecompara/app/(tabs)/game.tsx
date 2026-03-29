import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { useApp, type GameEntry, type DailyMission, type PointsHistoryEntry } from "@/context/AppContext";
import { fetchMyPrizes, redeemPrize, getCountdownToFriday, type WeeklyWinnerEntry } from "@/services/prizesService";

const REDEEM_OPTIONS = [
  { id: "r1", points: 500, value: "R$ 5,00", icon: "gift" as const },
  { id: "r2", points: 1000, value: "R$ 12,00", icon: "gift" as const },
  { id: "r3", points: 2500, value: "R$ 35,00", icon: "gift" as const },
  { id: "r4", points: 5000, value: "R$ 80,00", icon: "gift" as const },
];

const POINTS_TABLE = [
  { action: "Indicar Amigo (Referral)", base: "2.000 pts", bonus: "Máx. 5 indicações recompensadas · CPF único verificado", trigger: "Amigo completa cadastro com CPF válido" },
  { action: "Indicar Supermercado", base: "1.000 pts", bonus: "Pontos revertidos se denúncias de fraude (≥3)", trigger: "Mercado ainda não mapeado confirmado" },
  { action: "Registrar Novo Produto (OCR/manual)", base: "30 pts", bonus: "Produto ainda não cadastrado naquele mercado", trigger: "Preço novo em mercado shadow" },
  { action: "Confirmar Preço Existente", base: "15 pts", bonus: "Recompensa reduzida — dado já estava no cache", trigger: "Confirmar preço recente (≤5 dias)" },
  { action: "Envio Preço (mercado parceiro)", base: "10 pts", bonus: "30 pts se auto-validado por 3 usuários em 24 h", trigger: "Registro em mercado parceiro verificado" },
  { action: "Cadastrar Nota Fiscal (NFC-e)", base: "150 pts", bonus: "2× XP se >10 itens · 1,2× XP no fim de semana", trigger: "Chave de acesso processada com sucesso (sem duplicatas)" },
  { action: "Finalizar Lista no Local", base: "200 pts", bonus: "+100 pts em mercado parceiro", trigger: "Check-out via GPS/Geofencing" },
  { action: "Finalizar Cadastro do Perfil", base: "250 pts", bonus: 'Concedido uma única vez · Requer nome, CPF, telefone, endereço e chave PIX', trigger: "Perfil 100% preenchido" },
  { action: "Favoritar Mercado", base: "20 pts", bonus: "Receba notificações exclusivas da loja", trigger: "Bookmark de estabelecimento" },
  { action: "Combo Diário (Streak)", base: "+50 pts", bonus: "Aumenta progressivamente (7 dias = 500 pts)", trigger: "Login e 1 ação diária" },
];

function getLevelTier(level: number): { name: string; color: string; icon: React.ReactNode } {
  if (level >= 31) {
    return {
      name: "Mestre da Economia",
      color: "#FF6B6B",
      icon: <MaterialCommunityIcons name="crown" size={14} color="#FF6B6B" />,
    };
  }
  if (level >= 11) {
    return {
      name: "Fiscal",
      color: "#D4AF37",
      icon: <Feather name="clipboard" size={13} color="#D4AF37" />,
    };
  }
  return {
    name: "Aprendiz",
    color: "#9E9E9E",
    icon: <Feather name="shopping-cart" size={13} color="#9E9E9E" />,
  };
}

function getRankColor(rank: number) {
  if (rank === 1) return "#FFD700";
  if (rank === 2) return "#C0C0C0";
  if (rank === 3) return "#CD7F32";
  return null;
}

function PointsTableSheet({ visible, onClose, C, isDark }: { visible: boolean; onClose: () => void; C: typeof Colors.light; isDark: boolean }) {
  const { height: screenHeight } = useWindowDimensions();
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 60, friction: 12, overshootClamping: false }),
        Animated.timing(backdropAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: screenHeight, duration: 260, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {/* Backdrop — tapping it closes the sheet */}
      <Animated.View
        style={[StyleSheet.absoluteFillObject, { backgroundColor: C.overlay, opacity: backdropAnim }]}
        pointerEvents={visible ? "auto" : "none"}
      >
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
      </Animated.View>

      {/* Sheet — sits at the bottom, never blocks its own scroll */}
      <Animated.View
        style={[
          styles.sheetContainer,
          {
            backgroundColor: C.surface,
            transform: [{ translateY: slideAnim }],
            maxHeight: screenHeight * 0.82,
          },
        ]}
      >
        {/* Drag handle */}
        <View style={[styles.sheetHandle, { backgroundColor: C.border }]} />

        {/* Header */}
        <View style={styles.sheetHeader}>
          <Text style={[styles.sheetTitle, { color: C.text }]}>Como Pontuar</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="x" size={22} color={C.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Scrollable content — gets full gesture ownership */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          bounces
          alwaysBounceVertical
          overScrollMode="always"
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 48 }}
        >
          <View style={[styles.ruleBox, { backgroundColor: isDark ? "#1A1A00" : "#FFFBEA", borderColor: "#D4AF37" + "60" }]}>
            <Feather name="info" size={13} color="#D4AF37" />
            <Text style={[styles.ruleText, { color: C.textSecondary }]}>
              Fim de semana: Cupons valem 1.2x XP  •  Máx. 3 confirmações/hora  •  Trava GPS: ações OCR/Check a até 200m
            </Text>
          </View>
          {POINTS_TABLE.map((row, i) => (
            <View key={i} style={[styles.tableRow, { borderColor: C.border, backgroundColor: i % 2 === 0 ? C.surface : (isDark ? "#161616" : "#FAFAFA") }]}>
              <View style={[styles.tableIcon, { backgroundColor: C.primary + "18" }]}>
                <Feather name="zap" size={13} color={C.primary} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[styles.tableAction, { color: C.text }]}>{row.action}</Text>
                <Text style={[styles.tableBase, { color: C.primary }]}>{row.base}</Text>
                {row.bonus ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Feather name="star" size={10} color="#D4AF37" />
                    <Text style={[styles.tableBonus, { color: C.textSecondary }]}>{row.bonus}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          ))}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => (w[0] ?? "").toUpperCase())
    .join("");
}

function LeaderRow({ item, index, isMe, C }: { item: GameEntry; index: number; isMe: boolean; C: typeof Colors.light }) {
  const rankColor = getRankColor(item.rank);
  const tier = getLevelTier(item.level);
  const initials = getInitials(item.userName);

  return (
    <View style={[
      styles.leaderItem,
      {
        backgroundColor: isMe ? C.primary + "14" : C.surfaceElevated,
        borderColor: isMe ? C.primary : rankColor ?? C.border,
        borderWidth: isMe ? 2 : rankColor ? 1.5 : 1,
      },
    ]}>
      {/* Rank number circle */}
      <View style={[
        styles.rankBadge,
        { backgroundColor: rankColor ? rankColor + "25" : C.backgroundTertiary },
      ]}>
        <Text style={[
          styles.rankNum,
          { color: rankColor ?? (isMe ? C.primary : C.textSecondary), fontSize: item.rank >= 10 ? 11 : 14 },
        ]}>
          {item.rank}
        </Text>
      </View>

      {/* Initials avatar */}
      <View style={[
        styles.avatar,
        { backgroundColor: rankColor ? rankColor + "20" : (isMe ? C.primary + "18" : C.backgroundTertiary), borderColor: rankColor ?? (isMe ? C.primary : C.border), borderWidth: 1.5 },
      ]}>
        <Text style={[styles.avatarInitials, { color: rankColor ?? (isMe ? C.primary : C.textSecondary) }]}>
          {initials}
        </Text>
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
          <Text style={[styles.leaderName, { color: C.text }]} numberOfLines={1}>{item.userName}</Text>
          {item.title && (
            <View style={[styles.titleBadge, { backgroundColor: "#FFD70022", borderColor: "#FFD700" }]}>
              <Feather name="award" size={9} color="#D4AF37" />
              <Text style={[styles.titleText, { color: "#B8860B" }]}>{item.title}</Text>
            </View>
          )}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          {tier.icon}
          <Text style={[styles.leaderLevel, { color: tier.color }]}>Nv.{item.level} {tier.name}</Text>
        </View>
      </View>

      <View style={{ alignItems: "flex-end", gap: 1 }}>
        <Text style={[styles.pointsNum, { color: rankColor ?? C.primary }]}>
          {item.weeklyPoints.toLocaleString("pt-BR")}
        </Text>
        <Text style={[styles.pointsLabel, { color: C.textMuted }]}>pts semana</Text>
      </View>
    </View>
  );
}

function MissionRow({ item, C, isDark }: { item: DailyMission; C: typeof Colors.light; isDark: boolean }) {
  return (
    <View style={[styles.missionRow, { backgroundColor: C.surfaceElevated, borderColor: item.completed ? C.success + "60" : C.border }]}>
      <View style={[styles.missionCheck, { backgroundColor: item.completed ? C.success : C.backgroundTertiary, borderColor: item.completed ? C.success : C.border }]}>
        {item.completed && <Feather name="check" size={13} color="#fff" />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.missionLabel, { color: item.completed ? C.textMuted : C.text, textDecorationLine: item.completed ? "line-through" : "none" }]}>
          {item.label}
        </Text>
      </View>
      <View style={[styles.missionPts, { backgroundColor: item.completed ? C.success + "18" : C.primary + "18" }]}>
        <Text style={[styles.missionPtsText, { color: item.completed ? C.success : C.primary }]}>+{item.points} pts</Text>
      </View>
    </View>
  );
}

function HistoryRow({ item, C }: { item: PointsHistoryEntry; C: typeof Colors.light }) {
  return (
    <View style={[styles.historyRow, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
      <View style={[styles.historyIcon, { backgroundColor: C.primary + "18" }]}>
        <Feather name={item.icon as any} size={15} color={C.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.historyAction, { color: C.text }]}>{item.action}</Text>
        {item.multiplier && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Feather name="star" size={10} color="#D4AF37" />
            <Text style={[styles.historyMult, { color: "#D4AF37" }]}>{item.multiplier}</Text>
          </View>
        )}
        <Text style={[styles.historyDate, { color: C.textMuted }]}>{item.date}</Text>
      </View>
      <Text style={[styles.historyPts, { color: C.primary }]}>+{item.points}</Text>
    </View>
  );
}

export default function GameScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const C = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { leaderboard, user, pointsHistory, dailyMissions, streak } = useApp();

  const [activeSection, setActiveSection] = useState<"ranking" | "missoes" | "extrato" | "resgatar">("ranking");
  const [regionFilter, setRegionFilter] = useState<"brasilia" | "santa-maria">("brasilia");
  const [showPointsSheet, setShowPointsSheet] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const toastAnim = useRef(new Animated.Value(0)).current;

  // Weekly prize state
  const [prizeEntry, setPrizeEntry] = useState<WeeklyWinnerEntry | null>(null);
  const [prizeLoading, setPrizeLoading] = useState(false);
  const [showPixModal, setShowPixModal] = useState(false);
  const [pixKey, setPixKey] = useState("");
  const [pixSubmitting, setPixSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(getCountdownToFriday());

  useEffect(() => {
    if (!user?.id) return;
    setPrizeLoading(true);
    fetchMyPrizes(user.id).then((res) => {
      setPrizeEntry(res.winner);
      setPrizeLoading(false);
    });
  }, [user?.id]);

  useEffect(() => {
    const timer = setInterval(() => setCountdown(getCountdownToFriday()), 60000);
    return () => clearInterval(timer);
  }, []);

  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 84 : 90;

  const userPoints = user?.points || 320;
  const userRank = user?.rank || 12;

  const filteredLeaderboard = leaderboard.filter((e) => e.region === regionFilter).slice(0, 10);
  const nextAbove = filteredLeaderboard.find((e) => e.rank === userRank - 1);
  const pointsToNextRank = nextAbove ? Math.max(0, nextAbove.weeklyPoints - userPoints) : null;
  const isInTop3 = userRank <= 3;

  const completedMissions = dailyMissions.filter((m) => m.completed).length;
  const missionPtsTotal = dailyMissions.reduce((sum, m) => sum + (m.completed ? m.points : 0), 0);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    toastAnim.setValue(0);
    Animated.sequence([
      Animated.spring(toastAnim, { toValue: 1, useNativeDriver: true, tension: 70, friction: 9 }),
      Animated.delay(1800),
      Animated.timing(toastAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => setToastVisible(false));
  };

  const renderSectionTab = (id: typeof activeSection, label: string, iconName: string, iconLib: "feather" | "ionicons" = "feather") => {
    const active = activeSection === id;
    return (
      <Pressable
        key={id}
        style={[styles.sectionTab, active && { backgroundColor: C.primary }]}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveSection(id); }}
      >
        {iconLib === "ionicons"
          ? <Ionicons name={iconName as any} size={15} color={active ? "#fff" : C.textMuted} />
          : <Feather name={iconName as any} size={15} color={active ? "#fff" : C.textMuted} />
        }
        <Text style={[styles.sectionTabText, { color: active ? "#fff" : C.textMuted }]}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      {/* XP Toast */}
      {toastVisible && (
        <Animated.View style={[styles.toast, {
          backgroundColor: C.success,
          opacity: toastAnim,
          transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
          top: topPad + 8,
        }]}>
          <Feather name="zap" size={14} color="#fff" />
          <Text style={styles.toastText}>{toastMsg}</Text>
        </Animated.View>
      )}

      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: C.background }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: C.text }]}>Ranking</Text>
          {isInTop3
            ? <Text style={[styles.subtitle, { color: "#D4AF37" }]}>Você está no pódio! Parabéns!</Text>
            : pointsToNextRank !== null
              ? <Text style={[styles.subtitle, { color: C.textMuted }]}>
                  Você está em #{userRank}! Só mais {pointsToNextRank.toLocaleString("pt-BR")} pts para subir
                </Text>
              : <Text style={[styles.subtitle, { color: C.textMuted }]}>Atualize preços e ganhe pontos</Text>
          }
        </View>
        <TouchableOpacity
          style={[styles.howBtn, { backgroundColor: C.primary + "18", borderColor: C.primary + "40" }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowPointsSheet(true); }}
        >
          <Feather name="help-circle" size={14} color={C.primary} />
          <Text style={[styles.howBtnText, { color: C.primary }]}>Como Pontuar</Text>
        </TouchableOpacity>
      </View>

      {/* User Points Card */}
      <LinearGradient
        colors={["#CC0000", "#8B0000"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[styles.pointsCard, { marginHorizontal: 16, marginBottom: 12 }]}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.myPointsLabel}>Seus pontos</Text>
          <Text style={styles.myPointsNum}>{userPoints.toLocaleString("pt-BR")}</Text>
          <Text style={styles.myRankLabel}>Posição #{userRank} · Nv.{getLevelTier(user ? Math.floor(userPoints / 300) + 1 : 1).name}</Text>
          {/* Streak Bar */}
          <View style={styles.streakRow}>
            <Ionicons name="flame" size={15} color="#FFA726" />
            <Text style={styles.streakText}>Streak: {streak} dias seguidos</Text>
            <View style={styles.streakDots}>
              {[1,2,3,4,5,6,7].map((d) => (
                <View key={d} style={[styles.streakDot, { backgroundColor: d <= streak ? "#FFA726" : "rgba(255,255,255,0.2)" }]} />
              ))}
            </View>
          </View>
        </View>
        <View style={styles.pointsActions}>
          <View style={styles.statBlock}>
            <Text style={styles.statNum}>{user?.totalPriceUpdates || 16}</Text>
            <Text style={styles.statLabel}>Atualizações</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: "rgba(255,255,255,0.2)" }]} />
          <View style={styles.statBlock}>
            <Text style={styles.statNum}>{completedMissions}/{dailyMissions.length}</Text>
            <Text style={styles.statLabel}>Missões hoje</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Section Tabs — compact pill bar */}
      <View style={[styles.sectionTabs, { marginHorizontal: 16, marginBottom: 12, backgroundColor: isDark ? C.backgroundSecondary : "#F0F0F0" }]}>
        {renderSectionTab("ranking", "Ranking", "trophy-outline", "ionicons")}
        {renderSectionTab("missoes", "Missões", "target")}
        {renderSectionTab("extrato", "Extrato", "list")}
        {renderSectionTab("resgatar", "Resgatar", "gift")}
      </View>

      {/* RANKING TAB */}
      {activeSection === "ranking" && (
        <FlatList
          data={filteredLeaderboard}
          keyExtractor={(item) => item.userId}
          renderItem={({ item, index }) => <LeaderRow item={item} index={index} isMe={item.rank === userRank} C={C} />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: bottomPad, gap: 8 }}
          ListHeaderComponent={() => (
            /* Region Filter */
            <View style={[styles.regionFilter, { backgroundColor: C.backgroundSecondary, marginBottom: 12 }]}>
              <Pressable
                style={[styles.regionBtn, regionFilter === "brasilia" && { backgroundColor: C.primary }]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setRegionFilter("brasilia"); }}
              >
                <Feather name="globe" size={12} color={regionFilter === "brasilia" ? "#fff" : C.textSecondary} />
                <Text style={[styles.regionBtnText, { color: regionFilter === "brasilia" ? "#fff" : C.textSecondary }]}>Brasília</Text>
              </Pressable>
              <Pressable
                style={[styles.regionBtn, regionFilter === "santa-maria" && { backgroundColor: C.primary }]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setRegionFilter("santa-maria"); }}
              >
                <Feather name="map-pin" size={12} color={regionFilter === "santa-maria" ? "#fff" : C.textSecondary} />
                <Text style={[styles.regionBtnText, { color: regionFilter === "santa-maria" ? "#fff" : C.textSecondary }]}>Santa Maria (RA)</Text>
              </Pressable>
            </View>
          )}
          ListFooterComponent={() => (
            <View style={[styles.legendFooter, { borderTopColor: C.border }]}>
              <Text style={[styles.legendFooterTitle, { color: C.textMuted }]}>Níveis</Text>
              <View style={styles.legendFooterRow}>
                {[
                  { icon: <Feather name="shopping-cart" size={12} color="#9E9E9E" />, label: "Aprendiz (Nv.1-10)", color: "#9E9E9E" },
                  { icon: <Feather name="clipboard" size={12} color="#D4AF37" />, label: "Fiscal (Nv.11-30)", color: "#D4AF37" },
                  { icon: <MaterialCommunityIcons name="crown" size={12} color="#FF6B6B" />, label: "Mestre (Nv.31+)", color: "#FF6B6B" },
                ].map((l, i) => (
                  <View key={i} style={styles.legendItem}>
                    {l.icon}
                    <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: l.color }}>{l.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        />
      )}

      {/* MISSÕES TAB */}
      {activeSection === "missoes" && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPad, gap: 10 }}>
          {/* Streak Card */}
          <LinearGradient
            colors={["#E65100", "#FF6D00"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.streakCard}
          >
            <Ionicons name="flame" size={32} color="#FFF" />
            <View>
              <Text style={styles.streakCardTitle}>{streak} dias seguidos 🔥</Text>
              <Text style={styles.streakCardSub}>
                {streak >= 7 ? "Incrível! Você ganhou 500 pts de bônus!" : `Mais ${7 - streak} dias para 500 pts de bônus!`}
              </Text>
            </View>
          </LinearGradient>

          {/* Summary */}
          <View style={[styles.missionSummary, { backgroundColor: C.surfaceElevated, borderColor: C.success + "60" }]}>
            <Feather name="check-circle" size={16} color={C.success} />
            <Text style={[styles.missionSummaryText, { color: C.text }]}>
              {completedMissions} de {dailyMissions.length} missões concluídas hoje · {missionPtsTotal.toLocaleString("pt-BR")} pts ganhos
            </Text>
          </View>

          <Text style={[styles.sectionLabel, { color: C.textMuted }]}>MISSÕES DIÁRIAS</Text>

          {dailyMissions.map((m) => <MissionRow key={m.id} item={m} C={C} isDark={isDark} />)}

          <View style={[styles.antifraudBox, { backgroundColor: isDark ? "#0A0A0A" : "#F5F5F5", borderColor: C.border }]}>
            <Text style={[styles.antifraudTitle, { color: C.text }]}>Regras Anti-Fraude</Text>
            {[
              "GPS obrigatório: ações de OCR e Check só valem se você estiver a ≤200m do mercado",
              "Máximo de 15 envios de cupom por dia",
              "Máximo de 3 confirmações de preço por hora",
              "Fim de semana: Cupons NFC-e valem 1.2x XP",
              "Penalidade: preços incorretos reduzem sua pontuação",
            ].map((rule, i) => (
              <View key={i} style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                <Feather name="shield" size={12} color={C.textMuted} style={{ marginTop: 1 }} />
                <Text style={[styles.antifraudRule, { color: C.textSecondary }]}>{rule}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {/* EXTRATO TAB */}
      {activeSection === "extrato" && (
        <FlatList
          data={pointsHistory}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <HistoryRow item={item} C={C} />}
          contentContainerStyle={{ padding: 16, paddingBottom: bottomPad, gap: 8 }}
          ListHeaderComponent={() => (
            <View style={[styles.extratoHeader, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
              <View>
                <Text style={[styles.extratoTitle, { color: C.text }]}>Extrato de Pontos</Text>
                <Text style={[styles.extratoSub, { color: C.textMuted }]}>Histórico de todas as suas ações</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[styles.extratoTotal, { color: C.primary }]}>{userPoints.toLocaleString("pt-BR")}</Text>
                <Text style={[styles.extratoTotalLabel, { color: C.textMuted }]}>pts totais</Text>
              </View>
            </View>
          )}
        />
      )}

      {/* RESGATAR TAB */}
      {activeSection === "resgatar" && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPad, gap: 12 }}>
          {/* Points balance row */}
          <View style={[styles.redeemHeader, { backgroundColor: isDark ? "#1A0000" : "#FFF8F8", borderColor: C.primary + "30" }]}>
            <Feather name="dollar-sign" size={15} color={C.primary} />
            <View>
              <Text style={[styles.redeemHeaderTitle, { color: C.text }]}>Seus pontos: {userPoints.toLocaleString("pt-BR")}</Text>
              <Text style={[styles.redeemHeaderSub, { color: C.textMuted }]}>Prêmios exclusivos para vencedores do ranking semanal</Text>
            </View>
          </View>

          {/* Weekly Prize Card */}
          {prizeEntry && prizeEntry.status === "pending" ? (
            <LinearGradient
              colors={prizeEntry.rank === 1 ? ["#B8860B", "#FFD700"] : prizeEntry.rank <= 3 ? ["#1565C0", "#42A5F5"] : ["#2E7D32", "#66BB6A"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.weeklyPrizeCard}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <MaterialCommunityIcons name="trophy" size={28} color="#fff" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.weeklyPrizeTitle}>
                    🏆 Você ficou em {prizeEntry.rank}º lugar!
                  </Text>
                  <Text style={styles.weeklyPrizeAmount}>
                    R$ {prizeEntry.prizeAmount.toFixed(2).replace(".", ",")} via PIX
                  </Text>
                  <Text style={styles.weeklyPrizeSub}>
                    Semana de {prizeEntry.weekStart} · {prizeEntry.weeklyPoints.toLocaleString("pt-BR")} pts
                  </Text>
                </View>
              </View>
              <Pressable
                style={styles.weeklyPrizeBtn}
                onPress={() => { setPixKey(""); setShowPixModal(true); }}
              >
                <Feather name="send" size={14} color="#fff" />
                <Text style={styles.weeklyPrizeBtnText}>Resgatar via PIX</Text>
              </Pressable>
            </LinearGradient>
          ) : prizeEntry && (prizeEntry.status === "claimed" || prizeEntry.status === "paid") ? (
            <View style={[styles.weeklyPrizeCard, { backgroundColor: C.success + "18", borderWidth: 1, borderColor: C.success + "50" }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Feather name="check-circle" size={24} color={C.success} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.weeklyPrizeTitle, { color: C.text }]}>
                    {prizeEntry.status === "paid" ? "Pagamento realizado! ✓" : "Resgate solicitado!"}
                  </Text>
                  <Text style={[styles.weeklyPrizeSub, { color: C.textMuted }]}>
                    {prizeEntry.status === "paid"
                      ? `R$ ${prizeEntry.prizeAmount.toFixed(2).replace(".", ",")} enviado via PIX`
                      : "Pagamento PIX em até 48 horas"}
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            /* No prize or expired — show countdown */
            <View style={[styles.weeklyCountdownCard, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <MaterialCommunityIcons name="trophy-outline" size={20} color={C.primary} />
                <Text style={[styles.weeklyCountdownTitle, { color: C.text }]}>Prêmio Semanal</Text>
              </View>
              <Text style={[styles.weeklyCountdownSub, { color: C.textMuted }]}>
                Top 10 ganham prêmios em dinheiro toda sexta-feira
              </Text>
              <View style={styles.weeklyTiers}>
                {[{ pos: "1º", prize: "R$ 500", color: "#FFD700" }, { pos: "2º", prize: "R$ 200", color: "#C0C0C0" }, { pos: "3º", prize: "R$ 100", color: "#CD7F32" }, { pos: "4–10º", prize: "R$ 50", color: C.primary }].map((t) => (
                  <View key={t.pos} style={styles.weeklyTierItem}>
                    <Text style={[styles.weeklyTierPos, { color: t.color }]}>{t.pos}</Text>
                    <Text style={[styles.weeklyTierPrize, { color: C.text }]}>{t.prize}</Text>
                  </View>
                ))}
              </View>
              <View style={[styles.weeklyCountdownRow, { borderTopColor: C.border }]}>
                <Feather name="clock" size={13} color={C.textMuted} />
                <Text style={[styles.weeklyCountdownTime, { color: C.textMuted }]}>
                  Próximo reset em {countdown.days}d {countdown.hours}h {countdown.minutes}m
                </Text>
              </View>
            </View>
          )}

          {/* Info box */}
          <View style={[styles.redeemInfoBox, { backgroundColor: isDark ? "#0D0D0D" : "#F5F5F5", borderColor: C.border }]}>
            <Feather name="info" size={14} color={C.textMuted} />
            <Text style={[styles.redeemInfoText, { color: C.textSecondary }]}>
              Os prêmios são concedidos automaticamente aos vencedores do Top 10 toda sexta-feira. Acumule pontos atualizando preços e completando missões para entrar no ranking.
            </Text>
          </View>
        </ScrollView>
      )}

      {/* PIX Key Redemption Modal */}
      <Modal visible={showPixModal} transparent animationType="fade" onRequestClose={() => setShowPixModal(false)}>
        <Pressable style={[styles.sheetOverlay, { backgroundColor: C.overlay }]} onPress={() => setShowPixModal(false)}>
          <View style={[styles.pixModal, { backgroundColor: C.surface }]} onStartShouldSetResponder={() => true}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <MaterialCommunityIcons name="trophy" size={22} color={C.primary} />
              <Text style={[styles.pixModalTitle, { color: C.text }]}>
                Resgatar R$ {prizeEntry?.prizeAmount?.toFixed(2)?.replace(".", ",")}
              </Text>
            </View>
            <Text style={[styles.pixModalSub, { color: C.textMuted }]}>
              Insira sua chave PIX para receber o pagamento em até 48 horas.
            </Text>
            <TextInput
              style={[styles.pixInput, { backgroundColor: C.backgroundSecondary, borderColor: C.border, color: C.text }]}
              placeholder="CPF, e-mail, telefone ou chave aleatória"
              placeholderTextColor={C.textMuted}
              value={pixKey}
              onChangeText={setPixKey}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={[styles.pixModalHint, { color: C.textMuted }]}>
              Verifique sua chave PIX antes de confirmar. Pagamentos enviados para chave incorreta não são estornados.
            </Text>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
              <Pressable
                style={[styles.pixBtn, { flex: 1, backgroundColor: C.backgroundTertiary }]}
                onPress={() => setShowPixModal(false)}
              >
                <Text style={[styles.pixBtnText, { color: C.text }]}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.pixBtn, { flex: 1, backgroundColor: C.primary, opacity: (!pixKey.trim() || pixSubmitting) ? 0.5 : 1 }]}
                disabled={!pixKey.trim() || pixSubmitting}
                onPress={async () => {
                  if (!prizeEntry || !user?.id || !pixKey.trim()) return;
                  setPixSubmitting(true);
                  const result = await redeemPrize(user.id, prizeEntry.id, pixKey.trim());
                  setPixSubmitting(false);
                  setShowPixModal(false);
                  if (result.ok) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    showToast(result.message ?? "Resgate solicitado! PIX em até 48h.");
                    setPrizeEntry({ ...prizeEntry, status: "claimed", claimedAt: new Date().toISOString() });
                  } else {
                    showToast(result.error ?? "Erro ao resgatar.");
                  }
                }}
              >
                <Text style={[styles.pixBtnText, { color: "#fff" }]}>{pixSubmitting ? "Enviando…" : "Confirmar PIX"}</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      <PointsTableSheet visible={showPointsSheet} onClose={() => setShowPointsSheet(false)} C={C} isDark={isDark} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 10, flexDirection: "row", alignItems: "flex-start", gap: 8 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2, lineHeight: 16 },
  howBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, borderWidth: 1, marginTop: 2 },
  howBtnText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  pointsCard: { borderRadius: 18, padding: 18 },
  myPointsLabel: { color: "rgba(255,255,255,0.75)", fontSize: 12, fontFamily: "Inter_500Medium" },
  myPointsNum: { color: "#fff", fontSize: 38, fontFamily: "Inter_700Bold", lineHeight: 44 },
  myRankLabel: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  streakRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8 },
  streakText: { color: "rgba(255,255,255,0.85)", fontSize: 11, fontFamily: "Inter_500Medium" },
  streakDots: { flexDirection: "row", gap: 3, marginLeft: 4 },
  streakDot: { width: 7, height: 7, borderRadius: 4 },
  pointsActions: { flexDirection: "row", marginTop: 12, gap: 14, alignItems: "center" },
  statBlock: { alignItems: "center" },
  statNum: { color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold" },
  statLabel: { color: "rgba(255,255,255,0.65)", fontSize: 10, fontFamily: "Inter_400Regular" },
  divider: { width: 1, height: 26 },
  sectionTabs: { flexDirection: "row", borderRadius: 12, padding: 4, gap: 3 },
  sectionTabRow: { flexDirection: "row", gap: 3 },
  sectionTab: { flex: 1, flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, paddingVertical: 8, paddingHorizontal: 2, borderRadius: 9 },
  sectionTabText: { fontFamily: "Inter_600SemiBold", fontSize: 10, textAlign: "center" },
  regionFilter: { flexDirection: "row", borderRadius: 10, padding: 3, gap: 3 },
  regionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 7, borderRadius: 8 },
  regionBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  legendFooter: { marginTop: 8, paddingTop: 14, borderTopWidth: 1, gap: 8 },
  legendFooterTitle: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1, textTransform: "uppercase" },
  legendFooterRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  leaderItem: { flexDirection: "row", alignItems: "center", borderRadius: 14, padding: 12, gap: 10 },
  rankBadge: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  rankNum: { fontSize: 13, fontFamily: "Inter_700Bold" },
  avatarInitials: { fontSize: 15, fontFamily: "Inter_700Bold" },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  leaderName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  leaderLevel: { fontSize: 10, fontFamily: "Inter_500Medium" },
  titleBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5, borderWidth: 1 },
  titleText: { fontSize: 9, fontFamily: "Inter_600SemiBold" },
  pointsNum: { fontSize: 16, fontFamily: "Inter_700Bold" },
  pointsLabel: { fontSize: 9, fontFamily: "Inter_400Regular" },
  sectionLabel: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1.2, marginBottom: 2, marginTop: 4 },
  streakCard: { borderRadius: 14, padding: 16, flexDirection: "row", alignItems: "center", gap: 14 },
  streakCardTitle: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  streakCardSub: { color: "rgba(255,255,255,0.8)", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  missionSummary: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
  missionSummaryText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  missionRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1 },
  missionCheck: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", borderWidth: 1.5 },
  missionLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  missionPts: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  missionPtsText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  antifraudBox: { borderRadius: 12, padding: 14, borderWidth: 1, gap: 8, marginTop: 4 },
  antifraudTitle: { fontSize: 13, fontFamily: "Inter_700Bold", marginBottom: 4 },
  antifraudRule: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  historyRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 13, borderRadius: 13, borderWidth: 1 },
  historyIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  historyAction: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  historyMult: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 1 },
  historyDate: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  historyPts: { fontSize: 16, fontFamily: "Inter_700Bold" },
  extratoHeader: { borderRadius: 14, padding: 16, borderWidth: 1, marginBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  extratoTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  extratoSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  extratoTotal: { fontSize: 22, fontFamily: "Inter_700Bold" },
  extratoTotalLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },
  redeemCard: { flexDirection: "row", alignItems: "center", borderRadius: 14, padding: 16, borderWidth: 1.5, gap: 12 },
  redeemIcon: { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  redeemInfo: { flex: 1 },
  redeemValue: { fontSize: 18, fontFamily: "Inter_700Bold" },
  redeemPoints: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2 },
  redeemBadge: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  redeemBadgeText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  redeemHeader: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, padding: 14, borderWidth: 1 },
  redeemHeaderTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  redeemHeaderSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  redeemInfoBox: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: 12, padding: 14, borderWidth: 1 },
  redeemInfoText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  sheetOverlay: { flex: 1, justifyContent: "flex-end" },
  sheetContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 16,
  },
  sheetHandle: { width: 38, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  sheetTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  ruleBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 14 },
  ruleText: { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },
  tableRow: { flexDirection: "row", alignItems: "flex-start", padding: 12, borderBottomWidth: 1, gap: 10 },
  tableIcon: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center", marginTop: 1 },
  tableAction: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  tableBase: { fontSize: 13, fontFamily: "Inter_700Bold" },
  tableBonus: { fontSize: 11, fontFamily: "Inter_400Regular" },
  weeklyPrizeCard: { borderRadius: 16, padding: 16, gap: 12, marginBottom: 4 },
  weeklyPrizeTitle: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  weeklyPrizeAmount: { color: "#fff", fontSize: 24, fontFamily: "Inter_700Bold", lineHeight: 28, marginTop: 2 },
  weeklyPrizeSub: { color: "rgba(255,255,255,0.75)", fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  weeklyPrizeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "rgba(255,255,255,0.22)", borderRadius: 10, paddingVertical: 11, paddingHorizontal: 16 },
  weeklyPrizeBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  weeklyCountdownCard: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 0, marginBottom: 4 },
  weeklyCountdownTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  weeklyCountdownSub: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17, marginBottom: 12 },
  weeklyTiers: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  weeklyTierItem: { alignItems: "center", flex: 1 },
  weeklyTierPos: { fontSize: 13, fontFamily: "Inter_700Bold" },
  weeklyTierPrize: { fontSize: 11, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  weeklyCountdownRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 10, borderTopWidth: 1 },
  weeklyCountdownTime: { fontSize: 12, fontFamily: "Inter_500Medium" },
  pixModal: { margin: 24, borderRadius: 18, padding: 22, gap: 10 },
  pixModalTitle: { fontSize: 17, fontFamily: "Inter_700Bold", flex: 1 },
  pixModalSub: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  pixInput: { borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: "Inter_400Regular" },
  pixModalHint: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },
  pixBtn: { borderRadius: 11, paddingVertical: 12, alignItems: "center" },
  pixBtnText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  toast: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    zIndex: 999,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 10,
  },
  toastText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
