import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { useApp, type GameEntry, type DailyMission, type PointsHistoryEntry } from "@/context/AppContext";

const REDEEM_OPTIONS = [
  { id: "r1", points: 500, value: "R$ 5,00", icon: "gift" as const },
  { id: "r2", points: 1000, value: "R$ 12,00", icon: "gift" as const },
  { id: "r3", points: 2500, value: "R$ 35,00", icon: "gift" as const },
  { id: "r4", points: 5000, value: "R$ 80,00", icon: "gift" as const },
];

const POINTS_TABLE = [
  { action: "Indicar App via Link", base: "500 pts", bonus: "+200 pts se indicado validar 1ª nota", trigger: "Cadastro completo do indicado" },
  { action: "Indicar Supermercado", base: "1.000 pts", bonus: 'Selo "Embaixador" no perfil', trigger: "Após mercado ser verificado/assinar" },
  { action: "Cadastrar Produto (Individual)", base: "50 pts", bonus: "Máx. 10/dia em mercados Shadow; 35 pts em parceiros", trigger: "Validado pelo mercado/usuários" },
  { action: "Cadastrar Cupom (NFC-e)", base: "150 pts", bonus: "2x XP se contiver >10 itens", trigger: "Em mercados Shadow (não participantes)" },
  { action: "Confirmar Preço", base: "5 pts/item", bonus: "Se o preço estiver desatualizado", trigger: "Validação de dados existentes" },
  { action: "Finalizar Lista no Local", base: "200 pts", bonus: "+100 pts em mercado parceiro", trigger: "Check-out via GPS/Geofencing" },
  { action: "Finalizar Cadastro", base: "250 pts", bonus: 'Selo "Perfil Verificado"', trigger: "Preenchimento de KYC/Perfil" },
  { action: "Favoritar Mercado", base: "20 pts", bonus: "Notificações exclusivas da loja", trigger: "Bookmark de estabelecimento" },
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
  const slideAnim = useRef(new Animated.Value(800)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: 800, duration: 220, useNativeDriver: true }).start();
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={[styles.sheetOverlay, { backgroundColor: C.overlay }]} onPress={onClose}>
        <Animated.View
          style={[styles.sheetContainer, { backgroundColor: C.surface, transform: [{ translateY: slideAnim }] }]}
          onStartShouldSetResponder={() => true}
        >
          <View style={[styles.sheetHandle, { backgroundColor: C.border }]} />
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: C.text }]}>Como Pontuar</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={22} color={C.textMuted} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
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
      </Pressable>
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
        <FlatList
          data={REDEEM_OPTIONS}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const canRedeem = userPoints >= item.points;
            return (
              <Pressable
                style={[styles.redeemCard, { backgroundColor: C.surfaceElevated, borderColor: canRedeem ? C.primary : C.border, opacity: canRedeem ? 1 : 0.55 }]}
                onPress={() => {
                  if (!canRedeem) { showToast(`Faltam ${(item.points - userPoints).toLocaleString("pt-BR")} pontos`); return; }
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  showToast(`Resgate de ${item.value} solicitado!`);
                }}
              >
                <View style={[styles.redeemIcon, { backgroundColor: canRedeem ? C.primary : C.backgroundTertiary }]}>
                  <Feather name="gift" size={22} color="#fff" />
                </View>
                <View style={styles.redeemInfo}>
                  <Text style={[styles.redeemValue, { color: C.text }]}>{item.value}</Text>
                  <Text style={[styles.redeemPoints, { color: C.primary }]}>{item.points.toLocaleString("pt-BR")} pontos</Text>
                </View>
                {canRedeem && (
                  <View style={[styles.redeemBadge, { backgroundColor: C.primary }]}>
                    <Text style={styles.redeemBadgeText}>Resgatar</Text>
                  </View>
                )}
              </Pressable>
            );
          }}
          contentContainerStyle={{ padding: 16, paddingBottom: bottomPad, gap: 10 }}
          ListHeaderComponent={() => (
            <View style={[styles.redeemHeader, { backgroundColor: isDark ? "#1A0000" : "#FFF8F8", borderColor: C.primary + "30" }]}>
              <Feather name="dollar-sign" size={15} color={C.primary} />
              <View>
                <Text style={[styles.redeemHeaderTitle, { color: C.text }]}>Seus pontos: {userPoints.toLocaleString("pt-BR")}</Text>
                <Text style={[styles.redeemHeaderSub, { color: C.textMuted }]}>Resgate por dinheiro real via PIX</Text>
              </View>
            </View>
          )}
        />
      )}

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
  sectionTab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 9 },
  sectionTabText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
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
  redeemHeader: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, padding: 14, borderWidth: 1, marginBottom: 12 },
  redeemHeaderTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  redeemHeaderSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  sheetOverlay: { flex: 1, justifyContent: "flex-end" },
  sheetContainer: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, maxHeight: "88%", paddingBottom: 0 },
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
