import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { useApp, type GameEntry } from "@/context/AppContext";

const REDEEM_OPTIONS = [
  { id: "r1", points: 500, value: "R$ 5,00", icon: "gift" as const },
  { id: "r2", points: 1000, value: "R$ 12,00", icon: "gift" as const },
  { id: "r3", points: 2500, value: "R$ 35,00", icon: "gift" as const },
  { id: "r4", points: 5000, value: "R$ 80,00", icon: "gift" as const },
];

export default function GameScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const C = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { leaderboard, user } = useApp();
  const [activeSection, setActiveSection] = useState<"ranking" | "redeem">("ranking");

  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 84 : 90;

  const userPoints = user?.points || 320;
  const userRank = user?.rank || 12;

  const getRankColor = (rank: number) => {
    if (rank === 1) return "#FFD700";
    if (rank === 2) return "#C0C0C0";
    if (rank === 3) return "#CD7F32";
    return C.textMuted;
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return "trophy";
    if (rank === 2) return "medal";
    if (rank === 3) return "medal";
    return null;
  };

  const renderLeaderItem = ({ item, index }: { item: GameEntry; index: number }) => (
    <View
      style={[
        styles.leaderItem,
        { backgroundColor: C.surfaceElevated, borderColor: index < 3 ? getRankColor(item.rank) : C.border, borderWidth: index < 3 ? 1.5 : 1 },
      ]}
    >
      <View style={[styles.rankBadge, { backgroundColor: index < 3 ? getRankColor(item.rank) : C.backgroundTertiary }]}>
        <Text style={[styles.rankNum, { color: index < 3 ? "#000" : C.textSecondary }]}>
          {item.rank}
        </Text>
      </View>
      <View style={[styles.avatar, { backgroundColor: C.backgroundTertiary }]}>
        <Feather name="user" size={18} color={index < 3 ? getRankColor(item.rank) : C.textMuted} />
      </View>
      <View style={styles.leaderInfo}>
        <Text style={[styles.leaderName, { color: C.text }]}>{item.userName}</Text>
        <Text style={[styles.leaderUpdates, { color: C.textMuted }]}>
          {item.verifiedUpdates} preços verificados
        </Text>
      </View>
      <View style={styles.pointsBlock}>
        <Text style={[styles.pointsNum, { color: index < 3 ? getRankColor(item.rank) : C.primary }]}>
          {item.points.toLocaleString("pt-BR")}
        </Text>
        <Text style={[styles.pointsLabel, { color: C.textMuted }]}>pts</Text>
      </View>
    </View>
  );

  const renderRedeemItem = ({ item }: { item: typeof REDEEM_OPTIONS[0] }) => {
    const canRedeem = userPoints >= item.points;
    return (
      <Pressable
        style={[styles.redeemCard, { backgroundColor: C.surfaceElevated, borderColor: canRedeem ? C.primary : C.border, opacity: canRedeem ? 1 : 0.5 }]}
        onPress={() => {
          if (!canRedeem) {
            Alert.alert("Pontos insuficientes", `Você precisa de ${item.points} pontos para resgatar.`);
            return;
          }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert("Resgate solicitado!", `Você resgatou ${item.value}! O pagamento será processado em até 3 dias úteis.`);
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
  };

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: C.background }]}>
        <View>
          <Text style={[styles.title, { color: C.text }]}>Ranking</Text>
          <Text style={[styles.subtitle, { color: C.textMuted }]}>Atualize preços e ganhe pontos</Text>
        </View>
      </View>

      {/* User Points Card */}
      <View style={[styles.pointsCard, { backgroundColor: C.primary, marginHorizontal: 16, marginBottom: 16 }]}>
        <View>
          <Text style={styles.myPointsLabel}>Seus pontos</Text>
          <Text style={styles.myPointsNum}>{userPoints.toLocaleString("pt-BR")}</Text>
          <Text style={styles.myRankLabel}>Posição #{userRank} no ranking</Text>
        </View>
        <View style={styles.pointsActions}>
          <View style={styles.statBlock}>
            <Text style={styles.statNum}>{user?.totalPriceUpdates || 16}</Text>
            <Text style={styles.statLabel}>Atualizações</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: "rgba(255,255,255,0.2)" }]} />
          <View style={styles.statBlock}>
            <Text style={styles.statNum}>+10</Text>
            <Text style={styles.statLabel}>pts/atualiz.</Text>
          </View>
        </View>
      </View>

      {/* Section Tabs */}
      <View style={[styles.sectionTabs, { backgroundColor: C.backgroundSecondary, marginHorizontal: 16, marginBottom: 12 }]}>
        <Pressable
          style={[styles.sectionTab, activeSection === "ranking" && { backgroundColor: C.primary }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveSection("ranking"); }}
        >
          <Ionicons name="trophy-outline" size={14} color={activeSection === "ranking" ? "#fff" : C.textSecondary} />
          <Text style={[styles.sectionTabText, { color: activeSection === "ranking" ? "#fff" : C.textSecondary }]}>Ranking</Text>
        </Pressable>
        <Pressable
          style={[styles.sectionTab, activeSection === "redeem" && { backgroundColor: C.primary }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveSection("redeem"); }}
        >
          <Feather name="gift" size={14} color={activeSection === "redeem" ? "#fff" : C.textSecondary} />
          <Text style={[styles.sectionTabText, { color: activeSection === "redeem" ? "#fff" : C.textSecondary }]}>Resgatar</Text>
        </Pressable>
      </View>

      {activeSection === "ranking" ? (
        <FlatList
          data={leaderboard}
          keyExtractor={(item) => item.userId}
          renderItem={renderLeaderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: bottomPad, gap: 8 }}
          scrollEnabled={!!leaderboard.length}
          ListHeaderComponent={() => (
            <View style={[styles.howItWorks, { backgroundColor: isDark ? C.backgroundTertiary : "#FFF8F8", borderColor: C.primary + "30" }]}>
              <Feather name="info" size={14} color={C.primary} />
              <Text style={[styles.howItWorksText, { color: C.textSecondary }]}>
                Atualize preços nos supermercados e ganhe 10 pts por verificação aprovada
              </Text>
            </View>
          )}
        />
      ) : (
        <FlatList
          data={REDEEM_OPTIONS}
          keyExtractor={(item) => item.id}
          renderItem={renderRedeemItem}
          contentContainerStyle={{ padding: 16, paddingBottom: bottomPad, gap: 10 }}
          scrollEnabled
          ListHeaderComponent={() => (
            <View style={[styles.redeemHeader, { backgroundColor: isDark ? C.backgroundTertiary : "#FFF8F8", borderColor: C.primary + "30" }]}>
              <Text style={[styles.redeemHeaderTitle, { color: C.text }]}>Seus pontos: {userPoints.toLocaleString("pt-BR")}</Text>
              <Text style={[styles.redeemHeaderSub, { color: C.textMuted }]}>Resgate por dinheiro real via PIX</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 8 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  pointsCard: { borderRadius: 18, padding: 20 },
  myPointsLabel: { color: "rgba(255,255,255,0.8)", fontSize: 12, fontFamily: "Inter_500Medium" },
  myPointsNum: { color: "#fff", fontSize: 42, fontFamily: "Inter_700Bold", lineHeight: 48 },
  myRankLabel: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  pointsActions: { flexDirection: "row", marginTop: 16, gap: 16, alignItems: "center" },
  statBlock: { alignItems: "center" },
  statNum: { color: "#fff", fontSize: 20, fontFamily: "Inter_700Bold" },
  statLabel: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontFamily: "Inter_400Regular" },
  divider: { width: 1, height: 28 },
  sectionTabs: { flexDirection: "row", borderRadius: 12, padding: 4 },
  sectionTab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8, borderRadius: 9 },
  sectionTabText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  leaderItem: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  rankBadge: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  rankNum: { fontSize: 13, fontFamily: "Inter_700Bold" },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  leaderInfo: { flex: 1 },
  leaderName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  leaderUpdates: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  pointsBlock: { alignItems: "flex-end" },
  pointsNum: { fontSize: 16, fontFamily: "Inter_700Bold" },
  pointsLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },
  howItWorks: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 12 },
  howItWorksText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 16 },
  redeemCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    gap: 12,
  },
  redeemIcon: { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  redeemInfo: { flex: 1 },
  redeemValue: { fontSize: 18, fontFamily: "Inter_700Bold" },
  redeemPoints: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2 },
  redeemBadge: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  redeemBadgeText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  redeemHeader: { borderRadius: 12, padding: 14, borderWidth: 1, marginBottom: 12 },
  redeemHeaderTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  redeemHeaderSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
});
