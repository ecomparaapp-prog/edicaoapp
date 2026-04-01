import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Alert,
  ActivityIndicator,
  Animated,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
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
import {
  fetchAlerts,
  resolveAlert,
  seedAlerts,
  updateAlertStatus,
  type MerchantAlert,
} from "@/services/alertService";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  IN_PROGRESS: "Em andamento",
  RESOLVED: "Resolvido",
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: "#FEF9C3", text: "#854D0E" },
  IN_PROGRESS: { bg: "#DBEAFE", text: "#1E40AF" },
  RESOLVED: { bg: "#DCFCE7", text: "#166534" },
};

const TYPE_COLORS: Record<string, { bg: string; icon: string; feather: string }> = {
  price_divergence: { bg: "#FEF2F2", icon: "#CC0000", feather: "alert-triangle" },
  ranking_drop: { bg: "#FFF7ED", icon: "#D97706", feather: "trending-down" },
  price_report: { bg: "#FEF2F2", icon: "#CC0000", feather: "alert-circle" },
  competitiveness: { bg: "#FFF7ED", icon: "#D97706", feather: "bar-chart-2" },
  plan_expiry: { bg: "#FEF2F2", icon: "#CC0000", feather: "lock" },
  nps_negative: { bg: "#FEF2F2", icon: "#CC0000", feather: "message-circle" },
  stock_rupture: { bg: "#FFF7ED", icon: "#D97706", feather: "package" },
  new_follower: { bg: "#F0FDF4", icon: "#16A34A", feather: "users" },
  nfce_validated: { bg: "#F0FDF4", icon: "#16A34A", feather: "check-circle" },
};

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export default function MerchantAlertsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const C = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { merchantSession } = useApp();

  const [alerts, setAlerts] = useState<MerchantAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "resolved">("all");
  const [selectedAlert, setSelectedAlert] = useState<MerchantAlert | null>(null);
  const [actionNote, setActionNote] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [resolving, setResolving] = useState(false);
  const slideAnim = useRef(new Animated.Value(400)).current;

  const token = merchantSession?.token ?? "";

  const load = useCallback(async (isRefresh = false) => {
    if (!token) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      await seedAlerts(token);
      const data = await fetchAlerts(token);
      setAlerts(data.alerts);
    } catch (e) {
      console.warn("Erro ao carregar alertas:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!token) return;
    const interval = setInterval(async () => {
      try {
        const data = await fetchAlerts(token);
        setAlerts(data.alerts);
      } catch {}
    }, 15000);
    return () => clearInterval(interval);
  }, [token]);

  const openAlert = (alert: MerchantAlert) => {
    setSelectedAlert(alert);
    setActionNote("");
    setNewPrice(String((alert.metadata?.reportedPrice as number) ?? ""));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 100,
      friction: 12,
    }).start();
  };

  const closeModal = () => {
    Animated.timing(slideAnim, {
      toValue: 400,
      duration: 220,
      useNativeDriver: true,
    }).start(() => setSelectedAlert(null));
  };

  const handleResolve = async (body: { actionNote?: string; newPrice?: number; ean?: string } = {}) => {
    if (!selectedAlert || !token) return;
    setResolving(true);
    try {
      const data = await resolveAlert(token, selectedAlert.id, body);
      setAlerts((prev) => prev.map((a) => (a.id === selectedAlert.id ? data.alert : a)));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      closeModal();
    } catch (e: any) {
      Alert.alert("Erro", e.message || "Falha ao resolver alerta");
    } finally {
      setResolving(false);
    }
  };

  const handleStatusChange = async (alert: MerchantAlert, status: "IN_PROGRESS" | "RESOLVED") => {
    if (!token) return;
    try {
      const data = await updateAlertStatus(token, alert.id, status);
      setAlerts((prev) => prev.map((a) => (a.id === alert.id ? data.alert : a)));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    }
  };

  const filtered = alerts.filter((a) => {
    if (filter === "pending") return a.status !== "RESOLVED";
    if (filter === "resolved") return a.status === "RESOLVED";
    return true;
  });

  const pendingCount = alerts.filter((a) => a.status !== "RESOLVED").length;
  const resolvedCount = alerts.filter((a) => a.status === "RESOLVED").length;

  const renderAlertCard = (alert: MerchantAlert) => {
    const tc = TYPE_COLORS[alert.type] ?? TYPE_COLORS.price_divergence;
    const sc = STATUS_COLORS[alert.status];
    const isResolved = alert.status === "RESOLVED";

    return (
      <TouchableOpacity
        key={alert.id}
        style={[
          styles.alertCard,
          {
            borderLeftColor: alert.priority === "high" ? "#CC0000" : alert.priority === "medium" ? "#D97706" : "#16A34A",
            opacity: isResolved ? 0.6 : 1,
          },
        ]}
        onPress={() => openAlert(alert)}
        activeOpacity={0.85}
      >
        <View style={[styles.alertIconWrap, { backgroundColor: tc.bg }]}>
          <Feather name={tc.feather as any} size={18} color={tc.icon} />
        </View>
        <View style={styles.alertBody}>
          <View style={styles.alertTitleRow}>
            <Text style={styles.alertTitle} numberOfLines={2}>{alert.title}</Text>
            <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
              <Text style={[styles.statusBadgeText, { color: sc.text }]}>{STATUS_LABELS[alert.status]}</Text>
            </View>
          </View>
          <Text style={styles.alertDesc} numberOfLines={2}>{alert.description}</Text>
          {isResolved ? (
            <View style={styles.resolvedRow}>
              <Feather name="check-circle" size={11} color="#16A34A" />
              <Text style={styles.resolvedText}>
                Resolvido por {alert.resolved_by ?? "sistema"}
              </Text>
            </View>
          ) : (
            <View style={styles.alertActions}>
              <TouchableOpacity style={styles.actionBtnPrimary} onPress={() => openAlert(alert)}>
                <Text style={styles.actionBtnPrimaryText}>Resolver</Text>
              </TouchableOpacity>
              {alert.status === "PENDING" && (
                <TouchableOpacity style={styles.actionBtnSecondary} onPress={() => handleStatusChange(alert, "IN_PROGRESS")}>
                  <Text style={styles.actionBtnSecondaryText}>Em andamento</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.actionBtnGhost} onPress={() => handleStatusChange(alert, "RESOLVED")}>
                <Text style={styles.actionBtnGhostText}>Ignorar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        <Text style={styles.alertTime}>{timeAgo(alert.created_at)}</Text>
      </TouchableOpacity>
    );
  };

  const renderDrawerContent = () => {
    if (!selectedAlert) return null;
    const meta = selectedAlert.metadata ?? {};
    const isResolved = selectedAlert.status === "RESOLVED";
    const tc = TYPE_COLORS[selectedAlert.type] ?? TYPE_COLORS.price_divergence;
    const isPriceAlert = selectedAlert.type === "price_divergence" || selectedAlert.type === "price_report";
    const isCompetitiveness = selectedAlert.type === "competitiveness";
    const isRanking = selectedAlert.type === "ranking_drop";

    return (
      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
        {isResolved && (
          <View style={styles.resolvedBanner}>
            <Feather name="check-circle" size={16} color="#166534" />
            <View style={{ flex: 1 }}>
              <Text style={styles.resolvedBannerTitle}>Alerta Resolvido</Text>
              <Text style={styles.resolvedBannerSub}>
                Por {selectedAlert.resolved_by ?? "sistema"}{selectedAlert.resolved_at ? ` em ${new Date(selectedAlert.resolved_at).toLocaleString("pt-BR")}` : ""}
              </Text>
              {selectedAlert.action_note ? (
                <Text style={styles.resolvedBannerNote}>"{selectedAlert.action_note}"</Text>
              ) : null}
            </View>
          </View>
        )}

        <Text style={styles.drawerSectionLabel}>Descricao</Text>
        <Text style={styles.drawerDesc}>{selectedAlert.description}</Text>

        {(isPriceAlert) && !isResolved && (
          <>
            <Text style={styles.drawerSectionLabel}>Detalhes do Produto</Text>
            <View style={styles.infoCard}>
              {meta.productName ? <View style={styles.infoRow}><Text style={styles.infoLabel}>Produto</Text><Text style={styles.infoVal}>{String(meta.productName)}</Text></View> : null}
              {meta.ean ? <View style={styles.infoRow}><Text style={styles.infoLabel}>EAN</Text><Text style={[styles.infoVal, { fontFamily: "monospace" }]}>{String(meta.ean)}</Text></View> : null}
              {meta.currentPrice ? <View style={styles.infoRow}><Text style={styles.infoLabel}>Preco atual</Text><Text style={styles.infoVal}>R$ {Number(meta.currentPrice).toFixed(2).replace(".", ",")}</Text></View> : null}
              {meta.reportedPrice ? <View style={styles.infoRow}><Text style={styles.infoLabel}>Preco reportado</Text><Text style={[styles.infoVal, { color: "#CC0000" }]}>R$ {Number(meta.reportedPrice).toFixed(2).replace(".", ",")}</Text></View> : null}
            </View>
            <Text style={styles.drawerSectionLabel}>Confirmar Novo Preco</Text>
            <View style={styles.priceInputRow}>
              <Text style={styles.pricePrefix}>R$</Text>
              <TextInput
                style={styles.priceField}
                value={newPrice}
                onChangeText={setNewPrice}
                keyboardType="decimal-pad"
                placeholder="0,00"
                placeholderTextColor="#94A3B8"
              />
            </View>
          </>
        )}

        {isRanking && !isResolved && (
          <>
            <Text style={styles.drawerSectionLabel}>Posicionamento</Text>
            <View style={styles.infoCard}>
              {meta.productName ? <View style={styles.infoRow}><Text style={styles.infoLabel}>Produto</Text><Text style={styles.infoVal}>{String(meta.productName)}</Text></View> : null}
              {meta.oldRank ? <View style={styles.infoRow}><Text style={styles.infoLabel}>Posicao anterior</Text><Text style={styles.infoVal}>#{String(meta.oldRank)}</Text></View> : null}
              {meta.newRank ? <View style={styles.infoRow}><Text style={styles.infoLabel}>Posicao atual</Text><Text style={[styles.infoVal, { color: "#CC0000" }]}>#{String(meta.newRank)}</Text></View> : null}
              {meta.priceDiff ? <View style={styles.infoRow}><Text style={styles.infoLabel}>Diferenca</Text><Text style={[styles.infoVal, { color: "#CC0000" }]}>R$ {Number(meta.priceDiff).toFixed(2).replace(".", ",")} a mais</Text></View> : null}
            </View>
          </>
        )}

        {isCompetitiveness && !isResolved && (
          <>
            <Text style={styles.drawerSectionLabel}>Indice de Competitividade</Text>
            <View style={styles.compCard}>
              <View style={styles.compRow}>
                <Text style={styles.compLabel}>Seu preco</Text>
                <Text style={[styles.compVal, { color: "#CC0000" }]}>
                  R$ {meta.yourPrice ? Number(meta.yourPrice).toFixed(2).replace(".", ",") : "--"}
                </Text>
              </View>
              <View style={styles.compRow}>
                <Text style={styles.compLabel}>Media regional</Text>
                <Text style={[styles.compVal, { color: "#16A34A" }]}>
                  R$ {meta.avgPrice ? Number(meta.avgPrice).toFixed(2).replace(".", ",") : "--"}
                </Text>
              </View>
              <View style={styles.compBarWrap}>
                <View style={[styles.compBarFill, { width: `${Math.min(100, Number(meta.diff ?? 0))}%` as any }]} />
              </View>
              <Text style={styles.compDiff}>{meta.diff ?? 0}% acima da media</Text>
            </View>
          </>
        )}

        {!isResolved && (
          <>
            <Text style={styles.drawerSectionLabel}>Nota Interna (opcional)</Text>
            <TextInput
              style={styles.noteInput}
              value={actionNote}
              onChangeText={setActionNote}
              placeholder="Adicione uma observacao..."
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={3}
            />
          </>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>
    );
  };

  const renderDrawerFooter = () => {
    if (!selectedAlert || selectedAlert.status === "RESOLVED") {
      return (
        <TouchableOpacity style={styles.btnSecondary} onPress={closeModal}>
          <Text style={styles.btnSecondaryText}>Fechar</Text>
        </TouchableOpacity>
      );
    }
    const isPriceAlert = selectedAlert.type === "price_divergence" || selectedAlert.type === "price_report";
    const isPlan = selectedAlert.type === "plan_expiry";

    if (isPriceAlert) {
      return (
        <View style={styles.footerRow}>
          <TouchableOpacity
            style={[styles.btnSecondary, { flex: 1 }]}
            onPress={() => handleResolve({ actionNote })}
            disabled={resolving}
          >
            <Text style={styles.btnSecondaryText}>Re-validar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btnPrimary, { flex: 1 }]}
            onPress={() => {
              const price = parseFloat(newPrice.replace(",", "."));
              handleResolve({
                newPrice: isNaN(price) ? undefined : price,
                ean: String(selectedAlert.metadata?.ean ?? ""),
                actionNote,
              });
            }}
            disabled={resolving}
          >
            {resolving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.btnPrimaryText}>Confirmar Preco</Text>
            )}
          </TouchableOpacity>
        </View>
      );
    }

    if (isPlan) {
      return (
        <View style={styles.footerRow}>
          <TouchableOpacity style={[styles.btnSecondary, { flex: 1 }]} onPress={closeModal}>
            <Text style={styles.btnSecondaryText}>Ver Plano</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btnPrimary, { flex: 1 }]} onPress={() => handleResolve({ actionNote: "Visualizado" })} disabled={resolving}>
            <Text style={styles.btnPrimaryText}>Ciente</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.footerRow}>
        <TouchableOpacity style={[styles.btnSecondary, { flex: 1 }]} onPress={closeModal}>
          <Text style={styles.btnSecondaryText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btnPrimary, { flex: 1 }]} onPress={() => handleResolve({ actionNote })} disabled={resolving}>
          {resolving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnPrimaryText}>Marcar Resolvido</Text>}
        </TouchableOpacity>
      </View>
    );
  };

  const topPad = isWeb ? 67 : insets.top;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Central de Alertas</Text>
          <Text style={styles.headerSub}>Notificacoes e avisos de performance</Text>
        </View>
        {pendingCount > 0 && (
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{pendingCount}</Text>
          </View>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {(["all", "pending", "resolved"] as const).map((f) => {
          const counts = { all: alerts.length, pending: pendingCount, resolved: resolvedCount };
          return (
            <TouchableOpacity
              key={f}
              style={[styles.filterTab, filter === f && styles.filterTabActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>
                {f === "all" ? "Todos" : f === "pending" ? "Pendentes" : "Resolvidos"}
              </Text>
              <View style={[styles.filterCount, filter === f && styles.filterCountActive]}>
                <Text style={[styles.filterCountText, filter === f && styles.filterCountTextActive]}>{counts[f]}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#CC0000" size="large" />
          <Text style={styles.loadingText}>Carregando alertas...</Text>
        </View>
      ) : filtered.length === 0 ? (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#CC0000" />}
          contentContainerStyle={styles.centered}
        >
          <View style={styles.emptyIcon}>
            <Feather name="check-circle" size={28} color="#16A34A" />
          </View>
          <Text style={styles.emptyTitle}>Nenhum alerta</Text>
          <Text style={styles.emptyDesc}>Tudo certo por aqui.</Text>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#CC0000" />}
          showsVerticalScrollIndicator={false}
        >
          {filtered.map(renderAlertCard)}
        </ScrollView>
      )}

      {/* Action Drawer Modal */}
      <Modal visible={!!selectedAlert} transparent animationType="none" onRequestClose={closeModal}>
        <Pressable style={styles.modalOverlay} onPress={closeModal} />
        <Animated.View style={[styles.drawer, { transform: [{ translateY: slideAnim }], paddingBottom: insets.bottom + 16 }]}>
          {selectedAlert && (
            <>
              <View style={styles.drawerHandle} />
              <View style={styles.drawerHeader}>
                <View style={[styles.drawerIconWrap, { backgroundColor: (TYPE_COLORS[selectedAlert.type] ?? TYPE_COLORS.price_divergence).bg }]}>
                  <Feather
                    name={(TYPE_COLORS[selectedAlert.type] ?? TYPE_COLORS.price_divergence).feather as any}
                    size={20}
                    color={(TYPE_COLORS[selectedAlert.type] ?? TYPE_COLORS.price_divergence).icon}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.drawerTitle} numberOfLines={2}>{selectedAlert.title}</Text>
                  <Text style={styles.drawerSubtitle}>
                    {STATUS_LABELS[selectedAlert.status]} · {timeAgo(selectedAlert.created_at)}
                  </Text>
                </View>
                <TouchableOpacity onPress={closeModal}>
                  <Feather name="x" size={20} color="#64748B" />
                </TouchableOpacity>
              </View>
              <View style={styles.drawerBody}>
                {renderDrawerContent()}
              </View>
              <View style={styles.drawerFooter}>
                {renderDrawerFooter()}
              </View>
            </>
          )}
        </Animated.View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },
  header: { backgroundColor: "#0F172A", paddingHorizontal: 16, paddingBottom: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#fff" },
  headerSub: { fontSize: 11, color: "#94A3B8", marginTop: 1 },
  headerBadge: { backgroundColor: "#CC0000", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  headerBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  filterRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  filterTab: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: "#E2E8F0", backgroundColor: "#fff" },
  filterTabActive: { backgroundColor: "#0F172A", borderColor: "#0F172A" },
  filterTabText: { fontSize: 12, fontWeight: "600", color: "#64748B" },
  filterTabTextActive: { color: "#fff" },
  filterCount: { backgroundColor: "#CC0000", borderRadius: 8, minWidth: 16, height: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  filterCountActive: { backgroundColor: "rgba(255,255,255,0.25)" },
  filterCountText: { color: "#fff", fontSize: 9, fontWeight: "700" },
  filterCountTextActive: { color: "#fff" },
  alertCard: { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: "row", gap: 12, borderLeftWidth: 3, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  alertIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  alertBody: { flex: 1 },
  alertTitleRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginBottom: 3 },
  alertTitle: { flex: 1, fontSize: 13, fontWeight: "600", color: "#0F172A" },
  statusBadge: { borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2 },
  statusBadgeText: { fontSize: 9, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  alertDesc: { fontSize: 12, color: "#475569", lineHeight: 17 },
  alertActions: { flexDirection: "row", gap: 6, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#E2E8F0" },
  actionBtnPrimary: { backgroundColor: "#CC0000", borderRadius: 7, paddingHorizontal: 12, paddingVertical: 6 },
  actionBtnPrimaryText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  actionBtnSecondary: { backgroundColor: "#F1F5F9", borderRadius: 7, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: "#E2E8F0" },
  actionBtnSecondaryText: { color: "#475569", fontSize: 11, fontWeight: "600" },
  actionBtnGhost: { paddingHorizontal: 8, paddingVertical: 6 },
  actionBtnGhostText: { color: "#94A3B8", fontSize: 11 },
  resolvedRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  resolvedText: { fontSize: 11, color: "#16A34A" },
  alertTime: { fontSize: 11, color: "#94A3B8", flexShrink: 0 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  loadingText: { marginTop: 12, fontSize: 14, color: "#64748B" },
  emptyIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: "#F0FDF4", alignItems: "center", justifyContent: "center", marginBottom: 14 },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: "#0F172A", marginBottom: 4 },
  emptyDesc: { fontSize: 13, color: "#64748B" },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  drawer: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "88%", shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 16 },
  drawerHandle: { width: 36, height: 4, backgroundColor: "#CBD5E1", borderRadius: 2, alignSelf: "center", marginTop: 10, marginBottom: 4 },
  drawerHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  drawerIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  drawerTitle: { fontSize: 14, fontWeight: "700", color: "#0F172A", flex: 1 },
  drawerSubtitle: { fontSize: 11, color: "#64748B", marginTop: 2 },
  drawerBody: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  drawerSectionLabel: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, color: "#64748B", marginBottom: 8, marginTop: 4 },
  drawerDesc: { fontSize: 13, color: "#475569", lineHeight: 19, marginBottom: 16 },
  infoCard: { backgroundColor: "#F8FAFC", borderRadius: 10, padding: 12, marginBottom: 14 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  infoLabel: { fontSize: 12, color: "#64748B" },
  infoVal: { fontSize: 12, fontWeight: "600", color: "#0F172A" },
  priceInputRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  pricePrefix: { fontSize: 16, fontWeight: "700", color: "#64748B" },
  priceField: { flex: 1, borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, fontWeight: "700", color: "#0F172A" },
  noteInput: { borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: "#0F172A", minHeight: 70, textAlignVertical: "top" },
  resolvedBanner: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: "#F0FDF4", borderRadius: 10, padding: 12, marginBottom: 14 },
  resolvedBannerTitle: { fontSize: 13, fontWeight: "600", color: "#166534" },
  resolvedBannerSub: { fontSize: 11, color: "#166534", marginTop: 1 },
  resolvedBannerNote: { fontSize: 11, color: "#166534", marginTop: 2, fontStyle: "italic" },
  compCard: { backgroundColor: "#F8FAFC", borderRadius: 10, padding: 14, marginBottom: 14 },
  compRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  compLabel: { fontSize: 12, color: "#64748B" },
  compVal: { fontSize: 12, fontWeight: "700" },
  compBarWrap: { height: 8, backgroundColor: "#E2E8F0", borderRadius: 4, overflow: "hidden", marginVertical: 8 },
  compBarFill: { height: "100%", backgroundColor: "#CC0000", borderRadius: 4 },
  compDiff: { fontSize: 12, color: "#CC0000", fontWeight: "700", textAlign: "center" },
  drawerFooter: { padding: 16, borderTopWidth: 1, borderTopColor: "#E2E8F0" },
  footerRow: { flexDirection: "row", gap: 10 },
  btnPrimary: { backgroundColor: "#CC0000", borderRadius: 10, padding: 14, alignItems: "center", justifyContent: "center" },
  btnPrimaryText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  btnSecondary: { borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 10, padding: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#F8FAFC" },
  btnSecondaryText: { color: "#475569", fontSize: 14, fontWeight: "600" },
});
