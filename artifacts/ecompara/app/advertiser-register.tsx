import { Feather, MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
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

const BRAND_COLOR = "#CC0000";
const BRAND_DARK = "#A30000";
const BRAND_LIGHT = "#FFF1F2";

const SEGMENTS = [
  "Indústria / Fabricante",
  "Distribuidora",
  "Varejo Estadual",
  "Varejo Nacional",
  "Agência de Marketing",
  "Outro",
];

const REACH_OPTIONS = [
  { id: "df", label: "Distrito Federal", sub: "Toda a região do DF", icon: "map-marker-radius" },
  { id: "regional", label: "Regional", sub: "Centro-Oeste + DF", icon: "map" },
  { id: "national", label: "Nacional", sub: "Todo o Brasil", icon: "earth" },
];

const AD_FORMATS = [
  { id: "banner", label: "Banner na Home", sub: "Destaque máximo na tela inicial", icon: "view-dashboard" },
  { id: "search", label: "Busca Patrocinada", sub: "Produto no topo da busca", icon: "magnify" },
  { id: "price", label: "Destaque de Preço", sub: "Selo 'Preço Especial' nas prateleiras", icon: "tag" },
];

const BUDGET_OPTIONS = [
  { id: "starter", label: "R$ 500 – R$ 2.000/mês", sub: "Ideal para testes e marcas regionais" },
  { id: "growth", label: "R$ 2.000 – R$ 10.000/mês", sub: "Alcance médio + analytics avançado" },
  { id: "enterprise", label: "R$ 10.000+/mês", sub: "Campanha nacional + gerente dedicado" },
];

const STEPS = ["Empresa", "Contato", "Campanha"] as const;

type FormData = {
  companyName: string;
  cnpj: string;
  segment: string;
  website: string;
  contactName: string;
  role: string;
  email: string;
  whatsapp: string;
  reach: string;
  adFormat: string;
  budget: string;
};

function formatCNPJ(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export default function AdvertiserRegisterScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const C = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<-1 | 0 | 1 | 2 | 3>(-1); // -1 = pitch
  const [submitting, setSubmitting] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const [form, setForm] = useState<FormData>({
    companyName: "",
    cnpj: "",
    segment: "",
    website: "",
    contactName: "",
    role: "",
    email: "",
    whatsapp: "",
    reach: "",
    adFormat: "",
    budget: "",
  });

  function animateNext() {
    Animated.sequence([
      Animated.timing(slideAnim, { toValue: -20, duration: 120, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  }

  function goNext() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    animateNext();
    setStep((s) => (s + 1) as any);
  }

  function goBack() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step <= 0) {
      router.back();
    } else {
      setStep((s) => (s - 1) as any);
    }
  }

  function validateStep(): boolean {
    if (step === 0) {
      if (!form.companyName.trim()) { Alert.alert("Campo obrigatório", "Informe o nome da empresa."); return false; }
      if (!form.segment) { Alert.alert("Campo obrigatório", "Selecione o segmento da empresa."); return false; }
      if (!form.cnpj || form.cnpj.replace(/\D/g, "").length < 14) { Alert.alert("CNPJ inválido", "Informe um CNPJ válido com 14 dígitos."); return false; }
    }
    if (step === 1) {
      if (!form.contactName.trim()) { Alert.alert("Campo obrigatório", "Informe o nome do responsável."); return false; }
      if (!form.email.trim() || !form.email.includes("@")) { Alert.alert("E-mail inválido", "Informe um e-mail corporativo válido."); return false; }
    }
    if (step === 2) {
      if (!form.reach) { Alert.alert("Campo obrigatório", "Selecione o alcance geográfico."); return false; }
      if (!form.budget) { Alert.alert("Campo obrigatório", "Selecione o orçamento estimado."); return false; }
    }
    return true;
  }

  async function handleSubmit() {
    if (!validateStep()) return;
    setSubmitting(true);
    try {
      const apiBase = process.env.EXPO_PUBLIC_API_URL ?? "https://ecompara.com.br/api";
      await fetch(`${apiBase}/advertisers/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    } catch {
      // silencioso — entra na fila mesmo assim
    } finally {
      setSubmitting(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep(3);
    }
  }

  if (step === -1) {
    return <PitchScreen onStart={goNext} onBack={() => router.back()} insets={insets} isDark={isDark} C={C} />;
  }

  if (step === 3) {
    return <SuccessScreen onPortal={() => router.replace("/advertiser-portal")} onHome={() => router.replace("/(tabs)/profile")} insets={insets} C={C} isDark={isDark} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      {/* Header */}
      <LinearGradient
        colors={[BRAND_COLOR, BRAND_DARK]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <Pressable onPress={goBack} style={styles.backBtn} hitSlop={12}>
          <Feather name="arrow-left" size={20} color="#fff" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerLabel}>Portal do Anunciante</Text>
          <Text style={styles.headerTitle}>{STEPS[step as number]}</Text>
        </View>
        <View style={styles.stepCounter}>
          <Text style={styles.stepCounterText}>{(step as number) + 1}/{STEPS.length}</Text>
        </View>
      </LinearGradient>

      {/* Progress bar */}
      <View style={[styles.progressBar, { backgroundColor: isDark ? "#222" : "#E8EAF6" }]}>
        <View style={[styles.progressFill, { width: `${(((step as number) + 1) / STEPS.length) * 100}%` }]} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Animated.View style={{ transform: [{ translateX: slideAnim }] }}>
            {step === 0 && <StepEmpresa form={form} setForm={setForm} isDark={isDark} C={C} />}
            {step === 1 && <StepContato form={form} setForm={setForm} isDark={isDark} C={C} />}
            {step === 2 && <StepCampanha form={form} setForm={setForm} isDark={isDark} C={C} />}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* CTA */}
      <View style={[styles.ctaBar, { backgroundColor: C.background, borderTopColor: C.border, paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          style={[styles.ctaBtn, { backgroundColor: BRAND_COLOR }]}
          onPress={step === 2 ? handleSubmit : () => { if (validateStep()) goNext(); }}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Text style={styles.ctaBtnText}>{step === 2 ? "Solicitar Acesso ao Painel" : "Continuar"}</Text>
              <Feather name={step === 2 ? "send" : "arrow-right"} size={16} color="#fff" />
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function PitchScreen({ onStart, onBack, insets, isDark, C }: any) {
  const BRANDS = ["Parmalat", "Mabel", "Piracanjuba", "Seara", "Nestlé", "BRF"];
  const PROPS = [
    { icon: "crosshairs-gps", title: "Alcance Geolocalizado", sub: "Exiba sua marca para quem compra na sua região" },
    { icon: "chart-line", title: "Analytics em Tempo Real", sub: "CTR, impressões, share de prateleira digital" },
    { icon: "trophy-outline", title: "Produto Patrocinado", sub: "Apareça no topo das buscas com selo 'Patrocinado'" },
  ];

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 20 }} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={[BRAND_COLOR, BRAND_DARK, "#1A2580"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.pitchHero, { paddingTop: insets.top + 16 }]}
        >
          <Pressable onPress={onBack} style={styles.backBtn} hitSlop={12}>
            <Feather name="x" size={20} color="rgba(255,255,255,0.8)" />
          </Pressable>
          <View style={styles.pitchBadge}>
            <MaterialCommunityIcons name="bullhorn" size={13} color={BRAND_COLOR} />
            <Text style={styles.pitchBadgeText}>PORTAL DO ANUNCIANTE</Text>
          </View>
          <Text style={styles.pitchHeadline}>Sua marca nas{"\n"}mãos de quem{"\n"}decide a compra</Text>
          <Text style={styles.pitchSub}>
            Leve seus produtos ao topo das buscas de milhares de consumidores em Brasília e no Brasil.
          </Text>
          <View style={styles.pitchStatsRow}>
            {[["50k+", "Usuários ativos"], ["200+", "Mercados mapeados"], ["98%", "Alcance no DF"]].map(([num, label]) => (
              <View key={num} style={styles.pitchStat}>
                <Text style={styles.pitchStatNum}>{num}</Text>
                <Text style={styles.pitchStatLabel}>{label}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        {/* Brands already advertising */}
        <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
          <Text style={[styles.sectionLabel, { color: C.textMuted }]}>MARCAS QUE JÁ ANUNCIAM</Text>
          <View style={styles.brandsRow}>
            {BRANDS.map((b) => (
              <View key={b} style={[styles.brandPill, { backgroundColor: isDark ? "#1A1D40" : BRAND_LIGHT, borderColor: BRAND_COLOR + "30" }]}>
                <Text style={[styles.brandPillText, { color: BRAND_COLOR }]}>{b}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Value props */}
        <View style={{ paddingHorizontal: 20, marginTop: 24, gap: 12 }}>
          <Text style={[styles.sectionLabel, { color: C.textMuted }]}>POR QUE ANUNCIAR NO eCOMPARA</Text>
          {PROPS.map((p) => (
            <View key={p.icon} style={[styles.propCard, { backgroundColor: isDark ? "#0E1033" : BRAND_LIGHT, borderColor: BRAND_COLOR + "20" }]}>
              <View style={[styles.propIconWrap, { backgroundColor: BRAND_COLOR + "18" }]}>
                <MaterialCommunityIcons name={p.icon as any} size={22} color={BRAND_COLOR} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.propTitle, { color: C.text }]}>{p.title}</Text>
                <Text style={[styles.propSub, { color: C.textMuted }]}>{p.sub}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* CTA */}
        <View style={{ paddingHorizontal: 20, marginTop: 28 }}>
          <Pressable style={[styles.ctaBtn, { backgroundColor: BRAND_COLOR }]} onPress={onStart}>
            <Text style={styles.ctaBtnText}>Começar Cadastro Empresarial</Text>
            <Feather name="arrow-right" size={16} color="#fff" />
          </Pressable>
          <Text style={[styles.pitchFootnote, { color: C.textMuted }]}>
            Sem compromisso. Nossa equipe analisará seu perfil e entrará em contato em até 24h.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function StepEmpresa({ form, setForm, isDark, C }: any) {
  return (
    <View style={{ gap: 20 }}>
      <View style={styles.stepIntro}>
        <MaterialCommunityIcons name="office-building" size={28} color={BRAND_COLOR} />
        <Text style={[styles.stepIntroTitle, { color: C.text }]}>Dados da Empresa</Text>
        <Text style={[styles.stepIntroSub, { color: C.textMuted }]}>
          Informações para emissão de nota fiscal e ativação da conta.
        </Text>
      </View>

      <Field label="Nome da Empresa *" C={C} isDark={isDark}>
        <TextInput
          style={[styles.input, { backgroundColor: C.backgroundSecondary, color: C.text, borderColor: C.border }]}
          placeholder="Ex: Parmalat Brasil S.A."
          placeholderTextColor={C.textMuted}
          value={form.companyName}
          onChangeText={(t: string) => setForm((f: FormData) => ({ ...f, companyName: t }))}
          returnKeyType="next"
        />
      </Field>

      <Field label="CNPJ *" C={C} isDark={isDark}>
        <TextInput
          style={[styles.input, { backgroundColor: C.backgroundSecondary, color: C.text, borderColor: C.border }]}
          placeholder="00.000.000/0001-00"
          placeholderTextColor={C.textMuted}
          value={form.cnpj}
          onChangeText={(t: string) => setForm((f: FormData) => ({ ...f, cnpj: formatCNPJ(t) }))}
          keyboardType="numeric"
          returnKeyType="next"
          maxLength={18}
        />
      </Field>

      <Field label="Segmento *" C={C} isDark={isDark}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
          {SEGMENTS.map((s) => (
            <Pressable
              key={s}
              style={[
                styles.chip,
                { borderColor: form.segment === s ? BRAND_COLOR : C.border, backgroundColor: form.segment === s ? BRAND_COLOR + "18" : C.backgroundSecondary },
              ]}
              onPress={() => setForm((f: FormData) => ({ ...f, segment: s }))}
            >
              {form.segment === s && <Feather name="check" size={11} color={BRAND_COLOR} />}
              <Text style={[styles.chipText, { color: form.segment === s ? BRAND_COLOR : C.textSecondary }]}>{s}</Text>
            </Pressable>
          ))}
        </View>
      </Field>

      <Field label="Site da Empresa (opcional)" C={C} isDark={isDark}>
        <TextInput
          style={[styles.input, { backgroundColor: C.backgroundSecondary, color: C.text, borderColor: C.border }]}
          placeholder="https://www.suaempresa.com.br"
          placeholderTextColor={C.textMuted}
          value={form.website}
          onChangeText={(t: string) => setForm((f: FormData) => ({ ...f, website: t }))}
          keyboardType="url"
          autoCapitalize="none"
        />
      </Field>
    </View>
  );
}

function StepContato({ form, setForm, isDark, C }: any) {
  const ROLES = ["Brand Manager", "Gerente de Trade Marketing", "Diretor de Marketing", "Gerente Comercial", "Analista de Marketing", "Outro"];
  return (
    <View style={{ gap: 20 }}>
      <View style={styles.stepIntro}>
        <MaterialCommunityIcons name="account-tie" size={28} color={BRAND_COLOR} />
        <Text style={[styles.stepIntroTitle, { color: C.text }]}>Responsável pela Conta</Text>
        <Text style={[styles.stepIntroSub, { color: C.textMuted }]}>
          Quem será o ponto de contato da campanha?
        </Text>
      </View>

      <Field label="Nome Completo *" C={C} isDark={isDark}>
        <TextInput
          style={[styles.input, { backgroundColor: C.backgroundSecondary, color: C.text, borderColor: C.border }]}
          placeholder="Nome do responsável"
          placeholderTextColor={C.textMuted}
          value={form.contactName}
          onChangeText={(t: string) => setForm((f: FormData) => ({ ...f, contactName: t }))}
          returnKeyType="next"
        />
      </Field>

      <Field label="Cargo *" C={C} isDark={isDark}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
          {ROLES.map((r) => (
            <Pressable
              key={r}
              style={[
                styles.chip,
                { borderColor: form.role === r ? BRAND_COLOR : C.border, backgroundColor: form.role === r ? BRAND_COLOR + "18" : C.backgroundSecondary },
              ]}
              onPress={() => setForm((f: FormData) => ({ ...f, role: r }))}
            >
              {form.role === r && <Feather name="check" size={11} color={BRAND_COLOR} />}
              <Text style={[styles.chipText, { color: form.role === r ? BRAND_COLOR : C.textSecondary }]}>{r}</Text>
            </Pressable>
          ))}
        </View>
      </Field>

      <Field label="E-mail Corporativo *" C={C} isDark={isDark}>
        <TextInput
          style={[styles.input, { backgroundColor: C.backgroundSecondary, color: C.text, borderColor: C.border }]}
          placeholder="voce@empresa.com.br"
          placeholderTextColor={C.textMuted}
          value={form.email}
          onChangeText={(t: string) => setForm((f: FormData) => ({ ...f, email: t }))}
          keyboardType="email-address"
          autoCapitalize="none"
          returnKeyType="next"
        />
      </Field>

      <Field label="WhatsApp (opcional)" C={C} isDark={isDark}>
        <TextInput
          style={[styles.input, { backgroundColor: C.backgroundSecondary, color: C.text, borderColor: C.border }]}
          placeholder="(61) 99999-9999"
          placeholderTextColor={C.textMuted}
          value={form.whatsapp}
          onChangeText={(t: string) => setForm((f: FormData) => ({ ...f, whatsapp: t }))}
          keyboardType="phone-pad"
        />
      </Field>

      <View style={[styles.infoBox, { backgroundColor: isDark ? "#0E1033" : BRAND_LIGHT, borderColor: BRAND_COLOR + "30" }]}>
        <Feather name="shield" size={13} color={BRAND_COLOR} />
        <Text style={[styles.infoBoxText, { color: C.textSecondary }]}>
          Seus dados são protegidos pela LGPD e usados apenas para gestão da sua conta de anunciante.
        </Text>
      </View>
    </View>
  );
}

function StepCampanha({ form, setForm, isDark, C }: any) {
  return (
    <View style={{ gap: 24 }}>
      <View style={styles.stepIntro}>
        <MaterialCommunityIcons name="rocket-launch-outline" size={28} color={BRAND_COLOR} />
        <Text style={[styles.stepIntroTitle, { color: C.text }]}>Preferências de Campanha</Text>
        <Text style={[styles.stepIntroSub, { color: C.textMuted }]}>
          Configure o perfil inicial para nossa equipe preparar uma proposta personalizada.
        </Text>
      </View>

      <View style={{ gap: 10 }}>
        <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>ALCANCE GEOGRÁFICO *</Text>
        {REACH_OPTIONS.map((o) => (
          <Pressable
            key={o.id}
            style={[
              styles.optionCard,
              { borderColor: form.reach === o.id ? BRAND_COLOR : C.border, backgroundColor: form.reach === o.id ? (isDark ? "#0E1033" : BRAND_LIGHT) : C.surfaceElevated },
            ]}
            onPress={() => setForm((f: FormData) => ({ ...f, reach: o.id }))}
          >
            <View style={[styles.optionIconWrap, { backgroundColor: form.reach === o.id ? BRAND_COLOR + "20" : C.backgroundTertiary }]}>
              <MaterialCommunityIcons name={o.icon as any} size={20} color={form.reach === o.id ? BRAND_COLOR : C.textMuted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.optionLabel, { color: C.text }]}>{o.label}</Text>
              <Text style={[styles.optionSub, { color: C.textMuted }]}>{o.sub}</Text>
            </View>
            <View style={[styles.optionRadio, { borderColor: form.reach === o.id ? BRAND_COLOR : C.border }]}>
              {form.reach === o.id && <View style={[styles.optionRadioFill, { backgroundColor: BRAND_COLOR }]} />}
            </View>
          </Pressable>
        ))}
      </View>

      <View style={{ gap: 10 }}>
        <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>FORMATO DE ANÚNCIO</Text>
        {AD_FORMATS.map((f) => (
          <Pressable
            key={f.id}
            style={[
              styles.optionCard,
              { borderColor: form.adFormat === f.id ? BRAND_COLOR : C.border, backgroundColor: form.adFormat === f.id ? (isDark ? "#0E1033" : BRAND_LIGHT) : C.surfaceElevated },
            ]}
            onPress={() => setForm((ff: FormData) => ({ ...ff, adFormat: f.id }))}
          >
            <View style={[styles.optionIconWrap, { backgroundColor: form.adFormat === f.id ? BRAND_COLOR + "20" : C.backgroundTertiary }]}>
              <MaterialCommunityIcons name={f.icon as any} size={20} color={form.adFormat === f.id ? BRAND_COLOR : C.textMuted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.optionLabel, { color: C.text }]}>{f.label}</Text>
              <Text style={[styles.optionSub, { color: C.textMuted }]}>{f.sub}</Text>
            </View>
            <View style={[styles.optionRadio, { borderColor: form.adFormat === f.id ? BRAND_COLOR : C.border }]}>
              {form.adFormat === f.id && <View style={[styles.optionRadioFill, { backgroundColor: BRAND_COLOR }]} />}
            </View>
          </Pressable>
        ))}
      </View>

      <View style={{ gap: 10 }}>
        <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>ORÇAMENTO MENSAL ESTIMADO *</Text>
        {BUDGET_OPTIONS.map((b) => (
          <Pressable
            key={b.id}
            style={[
              styles.optionCard,
              { borderColor: form.budget === b.id ? BRAND_COLOR : C.border, backgroundColor: form.budget === b.id ? (isDark ? "#0E1033" : BRAND_LIGHT) : C.surfaceElevated },
            ]}
            onPress={() => setForm((f: FormData) => ({ ...f, budget: b.id }))}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.optionLabel, { color: C.text }]}>{b.label}</Text>
              <Text style={[styles.optionSub, { color: C.textMuted }]}>{b.sub}</Text>
            </View>
            <View style={[styles.optionRadio, { borderColor: form.budget === b.id ? BRAND_COLOR : C.border }]}>
              {form.budget === b.id && <View style={[styles.optionRadioFill, { backgroundColor: BRAND_COLOR }]} />}
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function SuccessScreen({ onPortal, onHome, insets, C, isDark }: any) {
  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <ScrollView contentContainerStyle={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
        <LinearGradient
          colors={[BRAND_COLOR + "20", BRAND_COLOR + "08"]}
          style={styles.successCircle}
        >
          <MaterialCommunityIcons name="check-decagram" size={56} color={BRAND_COLOR} />
        </LinearGradient>
        <Text style={[styles.successTitle, { color: C.text }]}>Solicitação Enviada!</Text>
        <Text style={[styles.successSub, { color: C.textMuted }]}>
          Nossa equipe comercial analisará seu perfil e entrará em contato em até{" "}
          <Text style={{ fontFamily: "Inter_700Bold", color: BRAND_COLOR }}>24 horas úteis</Text>{" "}
          pelo e-mail informado.
        </Text>

        <View style={[styles.successCard, { backgroundColor: isDark ? "#0E1033" : BRAND_LIGHT, borderColor: BRAND_COLOR + "30" }]}>
          <Text style={[styles.successCardTitle, { color: C.text }]}>Próximos passos</Text>
          {[
            "Análise do CNPJ e validação da conta",
            "Reunião com nosso time de AdTech",
            "Configuração do Painel do Anunciante",
            "Lançamento da primeira campanha",
          ].map((s, i) => (
            <View key={i} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
              <View style={[styles.successStep, { backgroundColor: BRAND_COLOR }]}>
                <Text style={styles.successStepNum}>{i + 1}</Text>
              </View>
              <Text style={[styles.successStepText, { color: C.textSecondary }]}>{s}</Text>
            </View>
          ))}
        </View>

        <Pressable style={[styles.ctaBtn, { backgroundColor: BRAND_COLOR, marginTop: 28 }]} onPress={onPortal}>
          <MaterialCommunityIcons name="view-dashboard" size={16} color="#fff" />
          <Text style={styles.ctaBtnText}>Acessar Painel (Preview)</Text>
        </Pressable>

        <Pressable style={[styles.ctaBtnOutline, { borderColor: BRAND_COLOR, marginTop: 12 }]} onPress={onHome}>
          <Text style={[styles.ctaBtnOutlineText, { color: BRAND_COLOR }]}>Voltar ao Perfil</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Field({ label, children, C, isDark }: any) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>{label.toUpperCase()}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  headerLabel: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontFamily: "Inter_500Medium" },
  headerTitle: { color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold", marginTop: 1 },
  backBtn: { padding: 4 },
  stepCounter: { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  stepCounterText: { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },
  progressBar: { height: 3, width: "100%" },
  progressFill: { height: 3, backgroundColor: BRAND_COLOR },
  ctaBar: { paddingHorizontal: 20, paddingTop: 14, borderTopWidth: 1 },
  ctaBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 15, borderRadius: 14,
  },
  ctaBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  ctaBtnOutline: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, width: "100%" },
  ctaBtnOutlineText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  stepIntro: { alignItems: "center", gap: 8, paddingVertical: 8 },
  stepIntroTitle: { fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "center" },
  stepIntroSub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 19 },
  fieldLabel: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular" },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  optionCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1.5 },
  optionIconWrap: { width: 40, height: 40, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  optionLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  optionSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  optionRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  optionRadioFill: { width: 10, height: 10, borderRadius: 5 },
  infoBox: { flexDirection: "row", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, alignItems: "flex-start" },
  infoBoxText: { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },
  // Pitch
  pitchHero: { paddingHorizontal: 20, paddingBottom: 32 },
  pitchBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#fff", alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, marginTop: 16, marginBottom: 20 },
  pitchBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold", color: BRAND_COLOR, letterSpacing: 1 },
  pitchHeadline: { fontSize: 32, fontFamily: "Inter_700Bold", color: "#fff", lineHeight: 38 },
  pitchSub: { fontSize: 14, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)", lineHeight: 20, marginTop: 12, marginBottom: 24 },
  pitchStatsRow: { flexDirection: "row", gap: 20 },
  pitchStat: { alignItems: "center" },
  pitchStatNum: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#fff" },
  pitchStatLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)", marginTop: 2 },
  sectionLabel: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1.2, marginBottom: 10 },
  brandsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  brandPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  brandPillText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  propCard: { flexDirection: "row", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, alignItems: "center" },
  propIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  propTitle: { fontSize: 14, fontFamily: "Inter_700Bold", marginBottom: 3 },
  propSub: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  pitchFootnote: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 12, lineHeight: 16 },
  // Success
  successCircle: { width: 100, height: 100, borderRadius: 50, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  successTitle: { fontSize: 24, fontFamily: "Inter_700Bold", textAlign: "center", marginBottom: 10 },
  successSub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 21, marginBottom: 24 },
  successCard: { borderRadius: 16, padding: 18, borderWidth: 1, gap: 14, width: "100%" },
  successCardTitle: { fontSize: 14, fontFamily: "Inter_700Bold", marginBottom: 4 },
  successStep: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", marginTop: 1 },
  successStepNum: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" },
  successStepText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
});
