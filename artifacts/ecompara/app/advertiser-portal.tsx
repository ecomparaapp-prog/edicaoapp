import { Feather, MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";

const BRAND_COLOR = "#CC0000";
const BRAND_DARK = "#A30000";

type Tab = "dashboard" | "campanhas" | "produtos" | "relatorio";

const MOCK_METRICS = [
  { label: "Impressões", value: "48.320", delta: "+12%", icon: "eye-outline", color: "#3B4FCC" },
  { label: "Cliques", value: "3.204", delta: "+8%", icon: "cursor-default-click-outline", color: "#7B61FF" },
  { label: "CTR", value: "6,6%", delta: "+0,4pp", icon: "chart-line", color: "#00B894" },
  { label: "Share de Prateleira", value: "23%", delta: "+5pp", icon: "trophy-outline", color: "#F39C12" },
];

const MOCK_CAMPAIGNS = [
  { id: "c1", name: "Lançamento Biscoito DF", status: "active", reach: "Distrito Federal", budget: "R$ 2.000/mês", impressions: "18.400", clicks: "1.240", format: "Busca Patrocinada" },
  { id: "c2", name: "Leite Integral — Verão", status: "paused", reach: "Regional", budget: "R$ 5.000/mês", impressions: "29.920", clicks: "1.964", format: "Banner na Home" },
  { id: "c3", name: "Promoção Arroz Premium", status: "pending", reach: "Nacional", budget: "R$ 12.000/mês", impressions: "—", clicks: "—", format: "Destaque de Preço" },
];

const MOCK_HEATMAP_REGIONS = [
  { name: "Taguatinga", pct: 87 },
  { name: "Ceilândia", pct: 74 },
  { name: "Águas Claras", pct: 68 },
  { name: "Plano Piloto", pct: 59 },
  { name: "Samambaia", pct: 51 },
  { name: "Santa Maria", pct: 43 },
];

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: "Ativa", color: "#00B894", bg: "#00B89418" },
  paused: { label: "Pausada", color: "#F39C12", bg: "#F39C1218" },
  pending: { label: "Em Análise", color: "#3B4FCC", bg: "#3B4FCC18" },
};

export default function AdvertiserPortalScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const C = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState<Tab>("dashboard");
  const [showNewCampaign, setShowNewCampaign] = useState(false);

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "dashboard", label: "Dashboard", icon: "view-dashboard-outline" },
    { id: "campanhas", label: "Campanhas", icon: "bullhorn-outline" },
    { id: "produtos", label: "Produtos", icon: "package-variant-closed" },
    { id: "relatorio", label: "Relatório", icon: "chart-bar" },
  ];

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      {/* Header */}
      <LinearGradient
        colors={[BRAND_COLOR, BRAND_DARK, "#1A2580"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Feather name="arrow-left" size={20} color="#fff" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerLabel}>PORTAL DO ANUNCIANTE</Text>
          <Text style={styles.headerCompany}>Minha Empresa</Text>
        </View>
        <View style={[styles.pendingBadge]}>
          <View style={styles.pendingDot} />
          <Text style={styles.pendingText}>Em análise</Text>
        </View>
      </LinearGradient>

      {/* Tabs */}
      <View style={[styles.tabBar, { backgroundColor: C.background, borderBottomColor: C.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 4 }}>
          {TABS.map((t) => (
            <Pressable
              key={t.id}
              style={[styles.tab, tab === t.id && { borderBottomColor: BRAND_COLOR }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setTab(t.id); }}
            >
              <MaterialCommunityIcons name={t.icon as any} size={15} color={tab === t.id ? BRAND_COLOR : C.textMuted} />
              <Text style={[styles.tabText, { color: tab === t.id ? BRAND_COLOR : C.textMuted }]}>{t.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        {tab === "dashboard" && <DashboardTab isDark={isDark} C={C} />}
        {tab === "campanhas" && <CampanhasTab isDark={isDark} C={C} onNew={() => setShowNewCampaign(true)} />}
        {tab === "produtos" && <ProdutosTab isDark={isDark} C={C} />}
        {tab === "relatorio" && <RelatorioTab isDark={isDark} C={C} />}
      </ScrollView>

      {showNewCampaign && (
        <NewCampaignModal isDark={isDark} C={C} onClose={() => setShowNewCampaign(false)} />
      )}
    </View>
  );
}

function DashboardTab({ isDark, C }: any) {
  return (
    <View style={{ gap: 20 }}>
      {/* Pending notice */}
      <View style={[styles.pendingNotice, { backgroundColor: isDark ? "#0E1033" : "#EEF1FF", borderColor: BRAND_COLOR + "30" }]}>
        <MaterialCommunityIcons name="clock-outline" size={20} color={BRAND_COLOR} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.pendingNoticeTitle, { color: C.text }]}>Conta em análise</Text>
          <Text style={[styles.pendingNoticeSub, { color: C.textMuted }]}>
            Nossa equipe está validando seu CNPJ. Você receberá um e-mail de ativação em até 24h.
          </Text>
        </View>
      </View>

      {/* Metrics */}
      <Text style={[styles.sectionTitle, { color: C.text }]}>Visão Geral (últimos 30 dias)</Text>
      <View style={styles.metricsGrid}>
        {MOCK_METRICS.map((m) => (
          <View key={m.label} style={[styles.metricCard, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
            <View style={[styles.metricIconWrap, { backgroundColor: m.color + "18" }]}>
              <MaterialCommunityIcons name={m.icon as any} size={18} color={m.color} />
            </View>
            <Text style={[styles.metricValue, { color: C.text }]}>{m.value}</Text>
            <Text style={[styles.metricLabel, { color: C.textMuted }]}>{m.label}</Text>
            <View style={[styles.metricDelta, { backgroundColor: "#00B89418" }]}>
              <Feather name="trending-up" size={9} color="#00B894" />
              <Text style={[styles.metricDeltaText, { color: "#00B894" }]}>{m.delta}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Heatmap */}
      <View style={[styles.heatmapCard, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <MaterialCommunityIcons name="map-marker-multiple" size={18} color={BRAND_COLOR} />
          <Text style={[styles.sectionTitle, { color: C.text }]}>Heatmap de Interesse — DF</Text>
        </View>
        {MOCK_HEATMAP_REGIONS.map((r) => (
          <View key={r.name} style={{ gap: 4, marginBottom: 10 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={[styles.heatmapRegion, { color: C.textSecondary }]}>{r.name}</Text>
              <Text style={[styles.heatmapPct, { color: BRAND_COLOR }]}>{r.pct}%</Text>
            </View>
            <View style={[styles.heatmapBar, { backgroundColor: C.border }]}>
              <View style={[styles.heatmapFill, { width: `${r.pct}%`, backgroundColor: BRAND_COLOR }]} />
            </View>
          </View>
        ))}
      </View>

      {/* Quick actions */}
      <Text style={[styles.sectionTitle, { color: C.text }]}>Ações Rápidas</Text>
      <View style={{ gap: 10 }}>
        {[
          { icon: "bullhorn-outline", label: "Criar nova campanha", sub: "Segmente por região e produto" },
          { icon: "package-variant-closed", label: "Cadastrar produtos (EANs)", sub: "Vincule seus SKUs às campanhas" },
          { icon: "file-chart-outline", label: "Ver relatório completo", sub: "Analytics detalhado por período" },
        ].map((a) => (
          <Pressable key={a.label} style={[styles.quickAction, { backgroundColor: isDark ? "#0E1033" : "#EEF1FF", borderColor: BRAND_COLOR + "20" }]}>
            <View style={[styles.qaIcon, { backgroundColor: BRAND_COLOR + "20" }]}>
              <MaterialCommunityIcons name={a.icon as any} size={20} color={BRAND_COLOR} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.qaLabel, { color: C.text }]}>{a.label}</Text>
              <Text style={[styles.qaSub, { color: C.textMuted }]}>{a.sub}</Text>
            </View>
            <Feather name="chevron-right" size={16} color={BRAND_COLOR} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function CampanhasTab({ isDark, C, onNew }: any) {
  return (
    <View style={{ gap: 16 }}>
      <Pressable
        style={[styles.newCampaignBtn, { backgroundColor: BRAND_COLOR }]}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onNew(); }}
      >
        <Feather name="plus" size={18} color="#fff" />
        <Text style={styles.newCampaignBtnText}>Nova Campanha</Text>
      </Pressable>

      {MOCK_CAMPAIGNS.map((camp) => {
        const meta = STATUS_META[camp.status];
        return (
          <View key={camp.id} style={[styles.campaignCard, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.campaignName, { color: C.text }]}>{camp.name}</Text>
                <Text style={[styles.campaignFormat, { color: C.textMuted }]}>{camp.format}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
                <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
              {[
                { icon: "map-marker", label: camp.reach },
                { icon: "currency-usd", label: camp.budget },
                { icon: "eye", label: `${camp.impressions} imp.` },
                { icon: "cursor-default-click", label: `${camp.clicks} cliques` },
              ].map((info) => (
                <View key={info.label} style={[styles.campaignMeta, { backgroundColor: C.backgroundSecondary }]}>
                  <MaterialCommunityIcons name={info.icon as any} size={11} color={C.textMuted} />
                  <Text style={[styles.campaignMetaText, { color: C.textSecondary }]}>{info.label}</Text>
                </View>
              ))}
            </View>

            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              <Pressable style={[styles.campBtn, { backgroundColor: BRAND_COLOR + "18", borderColor: BRAND_COLOR + "30" }]}>
                <Feather name="edit-2" size={12} color={BRAND_COLOR} />
                <Text style={[styles.campBtnText, { color: BRAND_COLOR }]}>Editar</Text>
              </Pressable>
              <Pressable style={[styles.campBtn, { backgroundColor: C.backgroundSecondary, borderColor: C.border }]}>
                <Feather name="bar-chart-2" size={12} color={C.textSecondary} />
                <Text style={[styles.campBtnText, { color: C.textSecondary }]}>Analytics</Text>
              </Pressable>
              {camp.status === "active" ? (
                <Pressable style={[styles.campBtn, { backgroundColor: "#F39C1218", borderColor: "#F39C1240" }]}>
                  <Feather name="pause" size={12} color="#F39C12" />
                  <Text style={[styles.campBtnText, { color: "#F39C12" }]}>Pausar</Text>
                </Pressable>
              ) : camp.status === "paused" ? (
                <Pressable style={[styles.campBtn, { backgroundColor: "#00B89418", borderColor: "#00B89440" }]}>
                  <Feather name="play" size={12} color="#00B894" />
                  <Text style={[styles.campBtnText, { color: "#00B894" }]}>Ativar</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function ProdutosTab({ isDark, C }: any) {
  const MOCK_SKUS = [
    { ean: "7891000052892", name: "Leite UHT Integral 1L", category: "Laticínios", linked: 2 },
    { ean: "7891000053508", name: "Leite Parmalat Desnatado 1L", category: "Laticínios", linked: 1 },
    { ean: "7898926720023", name: "Biscoito Mabel Cream Cracker 200g", category: "Biscoitos", linked: 0 },
    { ean: "7896004502301", name: "Queijo Minas Frescal 400g", category: "Frios", linked: 1 },
  ];
  return (
    <View style={{ gap: 14 }}>
      <Pressable
        style={[styles.newCampaignBtn, { backgroundColor: BRAND_COLOR }]}
        onPress={() => Alert.alert("Em breve", "Cadastro de EANs disponível após aprovação da conta.")}
      >
        <Feather name="plus" size={18} color="#fff" />
        <Text style={styles.newCampaignBtnText}>Adicionar Produto (EAN)</Text>
      </Pressable>

      {MOCK_SKUS.map((sku) => (
        <View key={sku.ean} style={[styles.skuCard, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
          <View style={[styles.skuIconWrap, { backgroundColor: BRAND_COLOR + "15" }]}>
            <MaterialCommunityIcons name="barcode" size={22} color={BRAND_COLOR} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.skuName, { color: C.text }]}>{sku.name}</Text>
            <Text style={[styles.skuEan, { color: C.textMuted }]}>EAN: {sku.ean}</Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 5 }}>
              <View style={[styles.skuTag, { backgroundColor: C.backgroundSecondary }]}>
                <Text style={[styles.skuTagText, { color: C.textSecondary }]}>{sku.category}</Text>
              </View>
              <View style={[styles.skuTag, { backgroundColor: sku.linked > 0 ? BRAND_COLOR + "15" : C.backgroundSecondary }]}>
                <Feather name="link" size={9} color={sku.linked > 0 ? BRAND_COLOR : C.textMuted} />
                <Text style={[styles.skuTagText, { color: sku.linked > 0 ? BRAND_COLOR : C.textMuted }]}>
                  {sku.linked} campanha{sku.linked !== 1 ? "s" : ""}
                </Text>
              </View>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

function RelatorioTab({ isDark, C }: any) {
  const WEEKS = ["Sem 1", "Sem 2", "Sem 3", "Sem 4"];
  const DATA = [
    { week: "Sem 1", imp: 9800, clk: 620 },
    { week: "Sem 2", imp: 12400, clk: 810 },
    { week: "Sem 3", imp: 11600, clk: 760 },
    { week: "Sem 4", imp: 14520, clk: 1014 },
  ];
  const maxImp = Math.max(...DATA.map((d) => d.imp));
  const BAR_H = 90;

  return (
    <View style={{ gap: 20 }}>
      <Text style={[styles.sectionTitle, { color: C.text }]}>Desempenho Mensal</Text>

      <View style={[styles.reportCard, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
        <View style={{ flexDirection: "row", alignItems: "flex-end", height: BAR_H + 28, justifyContent: "space-around" }}>
          {DATA.map((d) => {
            const h = Math.round((d.imp / maxImp) * BAR_H);
            return (
              <View key={d.week} style={{ alignItems: "center", gap: 4 }}>
                <Text style={{ fontSize: 9, color: C.textMuted, fontFamily: "Inter_500Medium" }}>{(d.imp / 1000).toFixed(1)}k</Text>
                <View style={{ width: 28, height: h, borderRadius: 6, backgroundColor: BRAND_COLOR }} />
                <Text style={{ fontSize: 10, color: C.textSecondary, fontFamily: "Inter_600SemiBold" }}>{d.week}</Text>
              </View>
            );
          })}
        </View>
        <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: BRAND_COLOR }} />
            <Text style={{ fontSize: 10, color: C.textMuted, fontFamily: "Inter_400Regular" }}>Impressões</Text>
          </View>
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <Text style={[styles.sectionTitle, { color: C.text }]}>Conversão de Intenção</Text>
        {[
          { label: "Viram o anúncio", value: "48.320", icon: "eye-outline", color: BRAND_COLOR },
          { label: "Clicaram no produto", value: "3.204", icon: "cursor-default-click-outline", color: "#7B61FF" },
          { label: "Buscaram 'onde encontrar'", value: "1.876", icon: "map-search-outline", color: "#00B894" },
          { label: "Adicionaram à lista", value: "924", icon: "cart-plus", color: "#F39C12" },
        ].map((r) => (
          <View key={r.label} style={[styles.convRow, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
            <View style={[styles.convIcon, { backgroundColor: r.color + "18" }]}>
              <MaterialCommunityIcons name={r.icon as any} size={18} color={r.color} />
            </View>
            <Text style={[styles.convLabel, { color: C.textSecondary }]}>{r.label}</Text>
            <Text style={[styles.convValue, { color: C.text }]}>{r.value}</Text>
          </View>
        ))}
      </View>

      <Pressable
        style={[styles.exportBtn, { borderColor: BRAND_COLOR }]}
        onPress={() => Alert.alert("Em breve", "Exportação de relatório disponível após ativação da conta.")}
      >
        <Feather name="download" size={16} color={BRAND_COLOR} />
        <Text style={[styles.exportBtnText, { color: BRAND_COLOR }]}>Exportar Relatório (CSV)</Text>
      </Pressable>
    </View>
  );
}

function NewCampaignModal({ isDark, C, onClose }: any) {
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("");
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.modalOverlay, { backgroundColor: "rgba(0,0,0,0.6)" }]}>
      <View style={[styles.modalBox, { backgroundColor: C.surface, paddingBottom: insets.bottom + 20 }]}>
        <View style={[styles.modalHandle, { backgroundColor: C.border }]} />
        <Text style={[styles.modalTitle, { color: C.text }]}>Nova Campanha</Text>
        <Text style={[styles.modalSub, { color: C.textMuted }]}>
          Configure o básico agora. Detalhes completos serão ajustados com nosso time.
        </Text>

        <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>NOME DA CAMPANHA</Text>
        <TextInput
          style={[styles.input, { backgroundColor: C.backgroundSecondary, color: C.text, borderColor: C.border, marginBottom: 14 }]}
          placeholder="Ex: Lançamento Biscoito DF — Fevereiro"
          placeholderTextColor={C.textMuted}
          value={name}
          onChangeText={setName}
        />

        <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>ORÇAMENTO MENSAL (R$)</Text>
        <TextInput
          style={[styles.input, { backgroundColor: C.backgroundSecondary, color: C.text, borderColor: C.border }]}
          placeholder="Ex: 2000"
          placeholderTextColor={C.textMuted}
          value={budget}
          onChangeText={setBudget}
          keyboardType="numeric"
        />

        <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
          <Pressable style={[styles.modalCancelBtn, { borderColor: C.border }]} onPress={onClose}>
            <Text style={[styles.modalCancelText, { color: C.textSecondary }]}>Cancelar</Text>
          </Pressable>
          <Pressable
            style={[styles.modalConfirmBtn, { backgroundColor: BRAND_COLOR }]}
            onPress={() => {
              if (!name.trim()) { Alert.alert("Nome obrigatório"); return; }
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              onClose();
              Alert.alert("Campanha criada!", `"${name}" foi enviada para aprovação. Você será notificado quando for ativada.`);
            }}
          >
            <Text style={styles.modalConfirmText}>Criar Campanha</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  headerLabel: { color: "rgba(255,255,255,0.65)", fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  headerCompany: { color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold", marginTop: 2 },
  backBtn: { padding: 4 },
  pendingBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  pendingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#FFD54F" },
  pendingText: { color: "#fff", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  tabBar: { borderBottomWidth: 1 },
  tab: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metricCard: { flex: 1, minWidth: "45%", borderRadius: 14, padding: 14, borderWidth: 1, gap: 4 },
  metricIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  metricValue: { fontSize: 20, fontFamily: "Inter_700Bold" },
  metricLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  metricDelta: { flexDirection: "row", alignItems: "center", gap: 3, alignSelf: "flex-start", paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, marginTop: 4 },
  metricDeltaText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  heatmapCard: { borderRadius: 14, padding: 16, borderWidth: 1 },
  heatmapRegion: { fontSize: 12, fontFamily: "Inter_500Medium" },
  heatmapPct: { fontSize: 12, fontFamily: "Inter_700Bold" },
  heatmapBar: { height: 6, borderRadius: 3, overflow: "hidden" },
  heatmapFill: { height: 6, borderRadius: 3 },
  quickAction: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  qaIcon: { width: 40, height: 40, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  qaLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  qaSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  pendingNotice: { flexDirection: "row", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, alignItems: "flex-start" },
  pendingNoticeTitle: { fontSize: 13, fontFamily: "Inter_700Bold", marginBottom: 3 },
  pendingNoticeSub: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  newCampaignBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 13 },
  newCampaignBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  campaignCard: { borderRadius: 16, padding: 16, borderWidth: 1 },
  campaignName: { fontSize: 14, fontFamily: "Inter_700Bold", marginBottom: 2 },
  campaignFormat: { fontSize: 11, fontFamily: "Inter_400Regular" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  campaignMeta: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  campaignMetaText: { fontSize: 10, fontFamily: "Inter_500Medium" },
  campBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  campBtnText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  skuCard: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  skuIconWrap: { width: 42, height: 42, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  skuName: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  skuEan: { fontSize: 10, fontFamily: "Inter_400Regular" },
  skuTag: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  skuTagText: { fontSize: 10, fontFamily: "Inter_500Medium" },
  reportCard: { borderRadius: 14, padding: 16, borderWidth: 1 },
  convRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, borderWidth: 1 },
  convIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  convLabel: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular" },
  convValue: { fontSize: 14, fontFamily: "Inter_700Bold" },
  exportBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 13, borderWidth: 1.5 },
  exportBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  modalOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end", zIndex: 99 },
  modalBox: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22 },
  modalHandle: { width: 38, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 18 },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 6 },
  modalSub: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18, marginBottom: 18 },
  fieldLabel: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular" },
  modalCancelBtn: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  modalCancelText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  modalConfirmBtn: { flex: 2, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  modalConfirmText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
});
