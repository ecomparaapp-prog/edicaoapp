import { Feather, MaterialIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import React, { useState, useRef, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
type Region = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import {
  lookupCNPJ,
  registerMerchant,
  verifyMerchantCode,
  resendVerificationCode,
  type OperatingHours,
  type DayHours,
} from "@/services/merchantService";

// ── Types ────────────────────────────────────────────────────────────────────

const STEPS = ["Identificação", "Localização", "Perfil", "Verificação"] as const;
type Step = 0 | 1 | 2 | 3 | 4; // 4 = success

const DEFAULT_DAY: DayHours = { open: "08:00", close: "22:00", closed: false };
const DEFAULT_HOURS: OperatingHours = {
  monday: { ...DEFAULT_DAY },
  tuesday: { ...DEFAULT_DAY },
  wednesday: { ...DEFAULT_DAY },
  thursday: { ...DEFAULT_DAY },
  friday: { ...DEFAULT_DAY },
  saturday: { open: "08:00", close: "18:00", closed: false },
  sunday: { open: "08:00", close: "14:00", closed: false },
  holidays: { open: "09:00", close: "14:00", closed: false },
};

const DAY_LABELS: Record<keyof OperatingHours, string> = {
  monday: "Segunda",
  tuesday: "Terça",
  wednesday: "Quarta",
  thursday: "Quinta",
  friday: "Sexta",
  saturday: "Sábado",
  sunday: "Domingo",
  holidays: "Feriados",
};

const CARD_BRANDS = [
  "Visa",
  "Mastercard",
  "Elo",
  "American Express",
  "Hipercard",
  "PIX",
  "Dinheiro",
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCNPJ(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function formatCEP(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  return d.replace(/^(\d{5})(\d)/, "$1-$2");
}

function formatPhone(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/^(\d{2})(\d{4})(\d)/, "($1) $2-$3");
  return d.replace(/^(\d{2})(\d{5})(\d)/, "($1) $2-$3");
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function MerchantRegisterScreen() {
  const { googlePlaceId, placeName, placeLat, placeLng } =
    useLocalSearchParams<{
      googlePlaceId?: string;
      placeName?: string;
      placeLat?: string;
      placeLng?: string;
    }>();

  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const C = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top;

  const [step, setStep] = useState<Step>(0);
  const scrollRef = useRef<ScrollView>(null);

  // ── Bloco A ──
  const [cnpjRaw, setCnpjRaw] = useState("");
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cnpjFetched, setCnpjFetched] = useState(false);
  const [razaoSocial, setRazaoSocial] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState(placeName ?? "");
  const [inscricaoEstadual, setInscricaoEstadual] = useState("");

  // ── Bloco B ──
  const [cep, setCep] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState<number>(
    placeLat ? parseFloat(placeLat) : -15.8634,
  );
  const [lng, setLng] = useState<number>(
    placeLng ? parseFloat(placeLng) : -47.9968,
  );
  const [pinMoved, setPinMoved] = useState(false);
  const [hours, setHours] = useState<OperatingHours>(DEFAULT_HOURS);
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  // ── Bloco C ──
  const [parking, setParking] = useState<"none" | "free" | "paid">("none");
  const [cardBrands, setCardBrands] = useState<string[]>([
    "Visa",
    "Mastercard",
    "PIX",
    "Dinheiro",
  ]);
  const [delivery, setDelivery] = useState<"none" | "own" | "app">("none");
  const [logoUri, setLogoUri] = useState<string | null>(null);

  // ── Step 4 ──
  const [verifyMethod, setVerifyMethod] = useState<"email" | "phone">("email");
  const [verifyContact, setVerifyContact] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [registrationId, setRegistrationId] = useState<number | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [codeSent, setCodeSent] = useState(false);

  // ── CNPJ Lookup ──
  const handleCNPJLookup = async () => {
    const clean = cnpjRaw.replace(/\D/g, "");
    if (clean.length !== 14) {
      Alert.alert("CNPJ inválido", "Digite todos os 14 dígitos do CNPJ.");
      return;
    }
    setCnpjLoading(true);
    const result = await lookupCNPJ(clean);
    setCnpjLoading(false);
    if (result.error) {
      Alert.alert("Erro na consulta", result.error);
      return;
    }
    if (result.data) {
      setRazaoSocial(result.data.razaoSocial);
      setNomeFantasia(result.data.nomeFantasia || result.data.razaoSocial);
      if (result.data.cep) setCep(formatCEP(result.data.cep));
      if (result.data.address) setAddress(result.data.address);
      if (result.data.phone) setPhone(formatPhone(result.data.phone.replace(/\D/g, "")));
      setCnpjFetched(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  // ── Image Picker ──
  const handlePickLogo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permissão negada", "Precisamos de acesso à galeria para escolher o logo.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setLogoUri(result.assets[0].uri);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  // ── Hours helpers ──
  const setDayHours = (
    day: keyof OperatingHours,
    field: keyof DayHours,
    value: string | boolean,
  ) => {
    setHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  };

  const toggleCard = (brand: string) => {
    setCardBrands((prev) =>
      prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand],
    );
  };

  // ── Validation ──
  const validateStep = (s: number): boolean => {
    if (s === 0) {
      if (cnpjRaw.replace(/\D/g, "").length !== 14) {
        Alert.alert("CNPJ obrigatório", "Digite e consulte o CNPJ antes de continuar.");
        return false;
      }
      if (!razaoSocial.trim()) {
        Alert.alert("Campo obrigatório", "Razão Social é obrigatória.");
        return false;
      }
      if (!nomeFantasia.trim()) {
        Alert.alert("Campo obrigatório", "Nome Fantasia é obrigatório.");
        return false;
      }
    }
    if (s === 3) {
      if (!verifyContact.trim()) {
        Alert.alert(
          "Contato obrigatório",
          verifyMethod === "email"
            ? "Informe um e-mail corporativo."
            : "Informe o telefone fixo da empresa.",
        );
        return false;
      }
      if (verifyMethod === "email" && !verifyContact.includes("@")) {
        Alert.alert("E-mail inválido", "Informe um e-mail válido.");
        return false;
      }
    }
    return true;
  };

  const goNext = () => {
    if (!validateStep(step)) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step < 3) {
      setStep((s) => (s + 1) as Step);
      setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 100);
    } else {
      handleSubmit();
    }
  };

  const goBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step === 0) router.back();
    else setStep((s) => (s - 1) as Step);
    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 100);
  };

  // ── Submit ──
  const handleSubmit = async () => {
    setSubmitting(true);
    const result = await registerMerchant({
      googlePlaceId: googlePlaceId ?? undefined,
      cnpj: cnpjRaw.replace(/\D/g, ""),
      razaoSocial,
      nomeFantasia,
      inscricaoEstadual: inscricaoEstadual || undefined,
      cep: cep.replace(/\D/g, "") || undefined,
      address: address || undefined,
      lat: pinMoved ? lat : undefined,
      lng: pinMoved ? lng : undefined,
      operatingHours: hours,
      phone: phone || undefined,
      whatsapp: whatsapp || undefined,
      parking,
      cardBrands,
      delivery,
      logoUrl: logoUri ?? undefined,
      verificationMethod: verifyMethod,
      verificationContact: verifyContact.trim(),
    });
    setSubmitting(false);

    if (result.error) {
      Alert.alert("Erro ao cadastrar", result.error);
      return;
    }
    if (result.registrationId) {
      setRegistrationId(result.registrationId);
      setDevCode(result.devCode ?? null);
      setCodeSent(true);
      setStep(4 as Step);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  // ── Verify Code ──
  const handleVerify = async () => {
    if (!codeInput.trim() || codeInput.trim().length !== 4) {
      Alert.alert("Código inválido", "Digite o código de 4 dígitos.");
      return;
    }
    if (!registrationId) return;
    setVerifying(true);
    const result = await verifyMerchantCode(registrationId, codeInput.trim());
    setVerifying(false);
    if (result.error) {
      Alert.alert("Código incorreto", result.error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setStep(5 as Step);
  };

  const handleResend = async () => {
    if (!registrationId) return;
    const result = await resendVerificationCode(registrationId);
    if (result.error) {
      Alert.alert("Erro", result.error);
      return;
    }
    setDevCode(result.devCode ?? null);
    Alert.alert("Código reenviado", "Um novo código foi enviado.");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  // ── Success ──
  if ((step as number) === 5) {
    return (
      <View style={[styles.container, { backgroundColor: C.background, paddingTop: topPad }]}>
        <View style={styles.successWrap}>
          <View style={[styles.successIcon, { backgroundColor: C.success + "18" }]}>
            <Feather name="check-circle" size={64} color={C.success} />
          </View>
          <Text style={[styles.successTitle, { color: C.text }]}>Cadastro enviado!</Text>
          <Text style={[styles.successSub, { color: C.textMuted }]}>
            Verificação concluída com sucesso. Nossa equipe irá analisar o seu cadastro e você receberá uma resposta em até 2 dias úteis.
          </Text>
          <Pressable
            style={[styles.btnPrimary, { backgroundColor: C.primary, marginTop: 32 }]}
            onPress={() => router.replace("/(tabs)")}
          >
            <Text style={styles.btnPrimaryText}>Voltar ao início</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Code Entry (step 4 after submit) ──
  if ((step as number) === 4) {
    return (
      <View style={[styles.container, { backgroundColor: C.background }]}>
        <View style={[styles.headerRow, { paddingTop: topPad + 12, borderBottomColor: C.border, backgroundColor: C.background }]}>
          <Pressable style={[styles.backBtn, { backgroundColor: C.backgroundSecondary }]} onPress={goBack} hitSlop={8}>
            <Feather name="arrow-left" size={20} color={C.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: C.text }]}>Verificação de Posse</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 24, gap: 20 }}>
          <View style={[styles.verifyCard, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
            <View style={[styles.verifyIcon, { backgroundColor: verifyMethod === "email" ? "#2196F320" : "#4CAF5020" }]}>
              <Feather
                name={verifyMethod === "email" ? "mail" : "phone"}
                size={28}
                color={verifyMethod === "email" ? "#2196F3" : "#4CAF50"}
              />
            </View>
            <Text style={[styles.verifyTitle, { color: C.text }]}>
              {verifyMethod === "email" ? "Verifique seu e-mail" : "Aguarde a ligação"}
            </Text>
            <Text style={[styles.verifySub, { color: C.textMuted }]}>
              {verifyMethod === "email"
                ? `Enviamos um código de 4 dígitos para ${verifyContact}. Verifique também a pasta de spam.`
                : `Realizaremos uma ligação automática para ${verifyContact} com um código de 4 dígitos.`}
            </Text>

            {devCode && (
              <View style={[styles.devCodeBanner, { backgroundColor: "#FF980020", borderColor: "#FF980040" }]}>
                <Feather name="code" size={14} color="#FF9800" />
                <Text style={[styles.devCodeText, { color: "#FF9800" }]}>
                  Ambiente dev — código: <Text style={{ fontFamily: "Inter_700Bold" }}>{devCode}</Text>
                </Text>
              </View>
            )}
          </View>

          <View style={{ gap: 8 }}>
            <Text style={[styles.label, { color: C.textSecondary }]}>Código de 4 dígitos</Text>
            <TextInput
              style={[styles.codeInput, { backgroundColor: C.surfaceElevated, borderColor: C.border, color: C.text }]}
              value={codeInput}
              onChangeText={(t) => setCodeInput(t.replace(/\D/g, "").slice(0, 4))}
              placeholder="_ _ _ _"
              placeholderTextColor={C.textMuted}
              keyboardType="number-pad"
              maxLength={4}
              textAlign="center"
            />
          </View>

          <Pressable
            style={[styles.btnPrimary, { backgroundColor: C.primary, opacity: verifying ? 0.7 : 1 }]}
            onPress={handleVerify}
            disabled={verifying}
          >
            {verifying ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnPrimaryText}>Confirmar código</Text>
            )}
          </Pressable>

          <Pressable style={styles.resendBtn} onPress={handleResend}>
            <Text style={[styles.resendText, { color: C.primary }]}>Reenviar código</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      {/* Header */}
      <View style={[styles.headerRow, { paddingTop: topPad + 12, borderBottomColor: C.border, backgroundColor: C.background }]}>
        <Pressable style={[styles.backBtn, { backgroundColor: C.backgroundSecondary }]} onPress={goBack} hitSlop={8}>
          <Feather name="arrow-left" size={20} color={C.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: C.text }]}>Cadastro de Lojista</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Step indicator */}
      <View style={[styles.stepBar, { backgroundColor: C.background }]}>
        {STEPS.map((label, i) => (
          <View key={i} style={styles.stepItem}>
            <View style={[
              styles.stepDot,
              {
                backgroundColor:
                  i < step ? C.success :
                  i === step ? C.primary :
                  C.backgroundTertiary,
                borderColor:
                  i < step ? C.success :
                  i === step ? C.primary :
                  C.border,
              },
            ]}>
              {i < step ? (
                <Feather name="check" size={10} color="#fff" />
              ) : (
                <Text style={[styles.stepNum, { color: i === step ? "#fff" : C.textMuted }]}>{i + 1}</Text>
              )}
            </View>
            <Text style={[styles.stepLabel, { color: i === step ? C.primary : C.textMuted }]}>{label}</Text>
            {i < STEPS.length - 1 && (
              <View style={[styles.stepLine, { backgroundColor: i < step ? C.success : C.border }]} />
            )}
          </View>
        ))}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>

          {/* ── STEP 0: Bloco A – Identificação Fiscal ── */}
          {step === 0 && (
            <StepA
              C={C} isDark={isDark}
              cnpjRaw={cnpjRaw} setCnpjRaw={setCnpjRaw}
              cnpjLoading={cnpjLoading} cnpjFetched={cnpjFetched}
              handleCNPJLookup={handleCNPJLookup}
              razaoSocial={razaoSocial} setRazaoSocial={setRazaoSocial}
              nomeFantasia={nomeFantasia} setNomeFantasia={setNomeFantasia}
              inscricaoEstadual={inscricaoEstadual} setInscricaoEstadual={setInscricaoEstadual}
            />
          )}

          {/* ── STEP 1: Bloco B – Localização e Operação ── */}
          {step === 1 && (
            <StepB
              C={C} isDark={isDark}
              cep={cep} setCep={setCep}
              address={address} setAddress={setAddress}
              lat={lat} lng={lng}
              setLat={setLat} setLng={setLng}
              setPinMoved={setPinMoved}
              hours={hours} setDayHours={setDayHours}
              phone={phone} setPhone={setPhone}
              whatsapp={whatsapp} setWhatsapp={setWhatsapp}
            />
          )}

          {/* ── STEP 2: Bloco C – Perfil e Comodidades ── */}
          {step === 2 && (
            <StepC
              C={C} isDark={isDark}
              parking={parking} setParking={setParking}
              cardBrands={cardBrands} toggleCard={toggleCard}
              delivery={delivery} setDelivery={setDelivery}
              logoUri={logoUri} handlePickLogo={handlePickLogo}
            />
          )}

          {/* ── STEP 3: Verificação ── */}
          {step === 3 && (
            <StepVerification
              C={C}
              verifyMethod={verifyMethod} setVerifyMethod={setVerifyMethod}
              verifyContact={verifyContact} setVerifyContact={setVerifyContact}
              razaoSocial={razaoSocial}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom CTA */}
      <View style={[styles.bottomCTA, { backgroundColor: C.background, borderTopColor: C.border, paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={[styles.btnPrimary, { backgroundColor: C.primary, opacity: submitting ? 0.7 : 1 }]}
          onPress={goNext}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.btnPrimaryText}>
                {step === 3 ? "Enviar cadastro" : "Continuar"}
              </Text>
              {step < 3 && <Feather name="arrow-right" size={18} color="#fff" />}
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

// ── Step A ──────────────────────────────────────────────────────────────────

function StepA({ C, isDark, cnpjRaw, setCnpjRaw, cnpjLoading, cnpjFetched, handleCNPJLookup, razaoSocial, setRazaoSocial, nomeFantasia, setNomeFantasia, inscricaoEstadual, setInscricaoEstadual }: any) {
  return (
    <>
      <SectionHeader C={C} icon="briefcase" title="Bloco A" subtitle="Identificação Fiscal (obrigatório)" />

      <FieldGroup C={C} label="CNPJ *">
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput
            style={[styles.input, { flex: 1, backgroundColor: C.surfaceElevated, borderColor: cnpjFetched ? C.success : C.border, color: C.text }]}
            value={cnpjRaw}
            onChangeText={(t) => { setCnpjRaw(formatCNPJ(t)); }}
            placeholder="00.000.000/0000-00"
            placeholderTextColor={C.textMuted}
            keyboardType="numeric"
            maxLength={18}
          />
          <Pressable
            style={[styles.lookupBtn, { backgroundColor: cnpjFetched ? C.success : C.primary, opacity: cnpjLoading ? 0.7 : 1 }]}
            onPress={handleCNPJLookup}
            disabled={cnpjLoading}
          >
            {cnpjLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : cnpjFetched ? (
              <Feather name="check" size={18} color="#fff" />
            ) : (
              <Text style={styles.lookupBtnTxt}>Consultar</Text>
            )}
          </Pressable>
        </View>
        {cnpjFetched && (
          <View style={[styles.cnpjSuccess, { backgroundColor: C.success + "12" }]}>
            <Feather name="check-circle" size={13} color={C.success} />
            <Text style={[styles.cnpjSuccessText, { color: C.success }]}>CNPJ ativo — dados preenchidos automaticamente</Text>
          </View>
        )}
      </FieldGroup>

      <FieldGroup C={C} label="Razão Social *">
        <TextInput
          style={[styles.input, { backgroundColor: C.surfaceElevated, borderColor: C.border, color: C.text }]}
          value={razaoSocial}
          onChangeText={setRazaoSocial}
          placeholder="Como consta na Receita Federal"
          placeholderTextColor={C.textMuted}
          autoCapitalize="words"
        />
      </FieldGroup>

      <FieldGroup C={C} label="Nome Fantasia *">
        <TextInput
          style={[styles.input, { backgroundColor: C.surfaceElevated, borderColor: C.border, color: C.text }]}
          value={nomeFantasia}
          onChangeText={setNomeFantasia}
          placeholder="Como aparecerá no app"
          placeholderTextColor={C.textMuted}
          autoCapitalize="words"
        />
      </FieldGroup>

      <FieldGroup C={C} label="Inscrição Estadual" hint="Opcional">
        <TextInput
          style={[styles.input, { backgroundColor: C.surfaceElevated, borderColor: C.border, color: C.text }]}
          value={inscricaoEstadual}
          onChangeText={setInscricaoEstadual}
          placeholder="Ex: 123.456.789.112"
          placeholderTextColor={C.textMuted}
          keyboardType="default"
        />
      </FieldGroup>
    </>
  );
}

// ── Step B ──────────────────────────────────────────────────────────────────

function StepB({ C, isDark, cep, setCep, address, setAddress, lat, lng, setLat, setLng, setPinMoved, hours, setDayHours, phone, setPhone, whatsapp, setWhatsapp }: any) {
  const region: Region = {
    latitude: lat,
    longitude: lng,
    latitudeDelta: 0.004,
    longitudeDelta: 0.004,
  };

  return (
    <>
      <SectionHeader C={C} icon="map-pin" title="Bloco B" subtitle="Localização e Operação" />

      <View style={{ flexDirection: "row", gap: 12 }}>
        <FieldGroup C={C} label="CEP" style={{ flex: 1 }}>
          <TextInput
            style={[styles.input, { backgroundColor: C.surfaceElevated, borderColor: C.border, color: C.text }]}
            value={cep}
            onChangeText={(t) => setCep(formatCEP(t))}
            placeholder="00000-000"
            placeholderTextColor={C.textMuted}
            keyboardType="numeric"
            maxLength={9}
          />
        </FieldGroup>
      </View>

      <FieldGroup C={C} label="Endereço completo">
        <TextInput
          style={[styles.input, styles.textArea, { backgroundColor: C.surfaceElevated, borderColor: C.border, color: C.text }]}
          value={address}
          onChangeText={setAddress}
          placeholder="Rua, número, complemento, bairro, cidade, UF"
          placeholderTextColor={C.textMuted}
          multiline
          numberOfLines={2}
          autoCapitalize="sentences"
        />
      </FieldGroup>

      {/* Map pin */}
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={[styles.label, { color: C.textSecondary }]}>Ajustar posição no mapa</Text>
          <View style={[styles.optionalBadge, { backgroundColor: C.backgroundTertiary }]}>
            <Text style={[styles.optionalText, { color: C.textMuted }]}>arraste o pino</Text>
          </View>
        </View>
        <View style={[styles.mapWrap, { borderColor: C.border }]}>
          {Platform.OS !== "web" ? (() => {
            const RNMaps = require("react-native-maps");
            const MapViewComp = RNMaps.default;
            const MarkerComp = RNMaps.Marker;
            return (
              <MapViewComp
                style={styles.map}
                initialRegion={region}
                showsUserLocation={false}
                scrollEnabled={true}
              >
                <MarkerComp
                  coordinate={{ latitude: lat, longitude: lng }}
                  draggable
                  onDragEnd={(e: any) => {
                    setLat(e.nativeEvent.coordinate.latitude);
                    setLng(e.nativeEvent.coordinate.longitude);
                    setPinMoved(true);
                  }}
                  pinColor="#CC0000"
                />
              </MapViewComp>
            );
          })() : (
            <View style={[styles.map, { alignItems: "center", justifyContent: "center" }]}>
              <Feather name="map" size={32} color="#CC0000" />
              <Text style={{ color: "#888", marginTop: 8, fontSize: 13 }}>Mapa disponível no app nativo</Text>
            </View>
          )}
        </View>
        <Text style={[styles.mapHint, { color: C.textMuted }]}>
          Segure e arraste o pino para a entrada exata da loja.
        </Text>
      </View>

      {/* Operating hours */}
      <View style={{ gap: 10 }}>
        <SectionHeader C={C} icon="clock" title="Horário de Funcionamento" subtitle="Incluindo feriados" />
        {(Object.keys(hours) as (keyof OperatingHours)[]).map((day) => (
          <DayHoursRow
            key={day}
            C={C}
            label={DAY_LABELS[day]}
            value={hours[day]}
            onChange={(field: keyof DayHours, val: string | boolean) => setDayHours(day, field, val)}
          />
        ))}
      </View>

      <FieldGroup C={C} label="Telefone / WhatsApp">
        <TextInput
          style={[styles.input, { backgroundColor: C.surfaceElevated, borderColor: C.border, color: C.text }]}
          value={phone}
          onChangeText={(t) => setPhone(formatPhone(t))}
          placeholder="(00) 0000-0000"
          placeholderTextColor={C.textMuted}
          keyboardType="phone-pad"
          maxLength={15}
        />
      </FieldGroup>

      <FieldGroup C={C} label="WhatsApp (se diferente)">
        <TextInput
          style={[styles.input, { backgroundColor: C.surfaceElevated, borderColor: C.border, color: C.text }]}
          value={whatsapp}
          onChangeText={(t) => setWhatsapp(formatPhone(t))}
          placeholder="(00) 00000-0000"
          placeholderTextColor={C.textMuted}
          keyboardType="phone-pad"
          maxLength={15}
        />
      </FieldGroup>
    </>
  );
}

// ── Day hours row ─────────────────────────────────────────────────────────────

function DayHoursRow({ C, label, value, onChange }: { C: any; label: string; value: DayHours; onChange: (f: keyof DayHours, v: string | boolean) => void }) {
  return (
    <View style={[styles.dayRow, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
      <View style={{ width: 68 }}>
        <Text style={[styles.dayLabel, { color: C.text }]}>{label}</Text>
      </View>
      {value.closed ? (
        <Text style={[styles.closedText, { color: C.textMuted, flex: 1 }]}>Fechado</Text>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
          <TextInput
            style={[styles.timeInput, { backgroundColor: C.backgroundSecondary, borderColor: C.border, color: C.text }]}
            value={value.open}
            onChangeText={(t) => onChange("open", t)}
            placeholder="08:00"
            placeholderTextColor={C.textMuted}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
          />
          <Text style={[{ color: C.textMuted, fontSize: 12, fontFamily: "Inter_400Regular" }]}>às</Text>
          <TextInput
            style={[styles.timeInput, { backgroundColor: C.backgroundSecondary, borderColor: C.border, color: C.text }]}
            value={value.close}
            onChangeText={(t) => onChange("close", t)}
            placeholder="22:00"
            placeholderTextColor={C.textMuted}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
          />
        </View>
      )}
      <Switch
        value={value.closed}
        onValueChange={(v) => onChange("closed", v)}
        thumbColor={value.closed ? "#fff" : "#fff"}
        trackColor={{ false: "#CC000040", true: "#CC000080" }}
        style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
      />
    </View>
  );
}

// ── Step C ──────────────────────────────────────────────────────────────────

function StepC({ C, isDark, parking, setParking, cardBrands, toggleCard, delivery, setDelivery, logoUri, handlePickLogo }: any) {
  return (
    <>
      <SectionHeader C={C} icon="star" title="Bloco C" subtitle="Perfil e Comodidades (filtros)" />

      {/* Parking */}
      <FieldGroup C={C} label="Estacionamento">
        <View style={{ flexDirection: "row", gap: 8 }}>
          {[
            { val: "none", label: "Não há" },
            { val: "free", label: "Gratuito" },
            { val: "paid", label: "Pago" },
          ].map((opt) => (
            <Pressable
              key={opt.val}
              style={[styles.chip, { flex: 1, backgroundColor: parking === opt.val ? C.primary + "18" : C.surfaceElevated, borderColor: parking === opt.val ? C.primary : C.border }]}
              onPress={() => { setParking(opt.val); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            >
              <Text style={[styles.chipText, { color: parking === opt.val ? C.primary : C.textSecondary }]}>{opt.label}</Text>
            </Pressable>
          ))}
        </View>
      </FieldGroup>

      {/* Delivery */}
      <FieldGroup C={C} label="Delivery">
        <View style={{ flexDirection: "row", gap: 8 }}>
          {[
            { val: "none", label: "Não possui" },
            { val: "own", label: "Próprio" },
            { val: "app", label: "Via App" },
          ].map((opt) => (
            <Pressable
              key={opt.val}
              style={[styles.chip, { flex: 1, backgroundColor: delivery === opt.val ? C.primary + "18" : C.surfaceElevated, borderColor: delivery === opt.val ? C.primary : C.border }]}
              onPress={() => { setDelivery(opt.val); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            >
              <Text style={[styles.chipText, { color: delivery === opt.val ? C.primary : C.textSecondary }]}>{opt.label}</Text>
            </Pressable>
          ))}
        </View>
      </FieldGroup>

      {/* Card brands */}
      <FieldGroup C={C} label="Formas de pagamento aceitas">
        <View style={styles.cardGrid}>
          {CARD_BRANDS.map((brand) => {
            const active = cardBrands.includes(brand);
            return (
              <Pressable
                key={brand}
                style={[styles.cardChip, { backgroundColor: active ? C.primary + "18" : C.surfaceElevated, borderColor: active ? C.primary : C.border }]}
                onPress={() => { toggleCard(brand); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              >
                <Feather name={active ? "check-square" : "square"} size={13} color={active ? C.primary : C.textMuted} />
                <Text style={[styles.chipText, { color: active ? C.primary : C.textSecondary }]}>{brand}</Text>
              </Pressable>
            );
          })}
        </View>
      </FieldGroup>

      {/* Logo upload */}
      <FieldGroup C={C} label="Logo da loja (circular, 1:1)" hint="Opcional">
        <Pressable
          style={[styles.logoUpload, { backgroundColor: C.surfaceElevated, borderColor: logoUri ? C.primary : C.border }]}
          onPress={handlePickLogo}
        >
          {logoUri ? (
            <View style={{ alignItems: "center", gap: 6 }}>
              <Feather name="check-circle" size={28} color={C.success} />
              <Text style={[styles.logoUploadText, { color: C.success }]}>Logo selecionado</Text>
              <Text style={[styles.logoUploadHint, { color: C.textMuted }]}>Toque para trocar</Text>
            </View>
          ) : (
            <View style={{ alignItems: "center", gap: 6 }}>
              <Feather name="upload-cloud" size={28} color={C.textMuted} />
              <Text style={[styles.logoUploadText, { color: C.textSecondary }]}>Escolher da galeria</Text>
              <Text style={[styles.logoUploadHint, { color: C.textMuted }]}>PNG ou JPG, quadrado</Text>
            </View>
          )}
        </Pressable>
      </FieldGroup>
    </>
  );
}

// ── Step Verification ──────────────────────────────────────────────────────────

function StepVerification({ C, verifyMethod, setVerifyMethod, verifyContact, setVerifyContact, razaoSocial }: any) {
  return (
    <>
      <SectionHeader C={C} icon="shield" title="Prova de Posse" subtitle="Confirme que você é o responsável pela loja" />

      <View style={[styles.infoCard, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
        <Feather name="info" size={15} color={C.primary} />
        <Text style={[styles.infoText, { color: C.textSecondary }]}>
          Enviamos um código de 4 dígitos para confirmar que você é o responsável por{" "}
          <Text style={{ fontFamily: "Inter_700Bold", color: C.text }}>{razaoSocial || "sua empresa"}</Text>.
        </Text>
      </View>

      {/* Method selector */}
      <FieldGroup C={C} label="Método de verificação">
        <View style={{ gap: 10 }}>
          <MethodOption
            C={C}
            active={verifyMethod === "email"}
            icon="mail"
            title="E-mail corporativo"
            sub="Enviaremos o código para o e-mail da empresa"
            onPress={() => setVerifyMethod("email")}
          />
          <MethodOption
            C={C}
            active={verifyMethod === "phone"}
            icon="phone"
            title="Telefone fixo da empresa"
            sub="Faremos uma ligação automática com o código"
            onPress={() => setVerifyMethod("phone")}
          />
        </View>
      </FieldGroup>

      <FieldGroup C={C} label={verifyMethod === "email" ? "E-mail corporativo *" : "Telefone fixo registrado no CNPJ *"}>
        <TextInput
          style={[styles.input, { backgroundColor: C.surfaceElevated, borderColor: C.border, color: C.text }]}
          value={verifyContact}
          onChangeText={setVerifyContact}
          placeholder={verifyMethod === "email" ? "contato@suaempresa.com.br" : "(00) 0000-0000"}
          placeholderTextColor={C.textMuted}
          keyboardType={verifyMethod === "email" ? "email-address" : "phone-pad"}
          autoCapitalize="none"
        />
        {verifyMethod === "email" && (
          <Text style={[styles.fieldHint, { color: C.textMuted }]}>
            Recomendamos o e-mail com domínio da empresa (ex: @suaempresa.com.br)
          </Text>
        )}
      </FieldGroup>
    </>
  );
}

function MethodOption({ C, active, icon, title, sub, onPress }: any) {
  return (
    <Pressable
      style={[styles.methodOption, { backgroundColor: active ? C.primary + "10" : C.backgroundSecondary, borderColor: active ? C.primary : C.border }]}
      onPress={() => { onPress(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
    >
      <View style={[styles.methodIcon, { backgroundColor: active ? C.primary + "20" : C.backgroundTertiary }]}>
        <Feather name={icon} size={18} color={active ? C.primary : C.textMuted} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.methodTitle, { color: C.text }]}>{title}</Text>
        <Text style={[styles.methodSub, { color: C.textMuted }]}>{sub}</Text>
      </View>
      <View style={[styles.radio, { borderColor: active ? C.primary : C.border }]}>
        {active && <View style={[styles.radioDot, { backgroundColor: C.primary }]} />}
      </View>
    </Pressable>
  );
}

// ── Reusable components ───────────────────────────────────────────────────────

function SectionHeader({ C, icon, title, subtitle }: any) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 }}>
      <View style={[styles.sectionIconWrap, { backgroundColor: C.primary + "15" }]}>
        <Feather name={icon} size={16} color={C.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.sectionTitle, { color: C.primary }]}>{title}</Text>
        <Text style={[styles.sectionSub, { color: C.textMuted }]}>{subtitle}</Text>
      </View>
    </View>
  );
}

function FieldGroup({ C, label, hint, children, style }: any) {
  return (
    <View style={[{ gap: 6 }, style]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Text style={[styles.label, { color: C.textSecondary }]}>{label}</Text>
        {hint && (
          <View style={[styles.optionalBadge, { backgroundColor: C.backgroundTertiary }]}>
            <Text style={[styles.optionalText, { color: C.textMuted }]}>{hint}</Text>
          </View>
        )}
      </View>
      {children}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },

  stepBar: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 0,
  },
  stepItem: { flexDirection: "row", alignItems: "center", flex: 1 },
  stepDot: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5,
  },
  stepNum: { fontSize: 10, fontFamily: "Inter_700Bold" },
  stepLabel: { fontSize: 9, fontFamily: "Inter_500Medium", marginLeft: 4, flex: 1, numberOfLines: 1 },
  stepLine: { flex: 1, height: 1.5, marginHorizontal: 4 },

  sectionIconWrap: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
  },
  sectionTitle: { fontSize: 13, fontFamily: "Inter_700Bold" },
  sectionSub: { fontSize: 11, fontFamily: "Inter_400Regular" },

  label: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  optionalBadge: {
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 4,
  },
  optionalText: { fontSize: 10, fontFamily: "Inter_400Regular" },
  fieldHint: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },

  input: {
    borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, fontFamily: "Inter_400Regular",
  },
  textArea: { minHeight: 60, textAlignVertical: "top" },

  lookupBtn: {
    paddingHorizontal: 14, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
    minWidth: 90,
  },
  lookupBtnTxt: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 13 },

  cnpjSuccess: {
    flexDirection: "row", alignItems: "center", gap: 6,
    padding: 8, borderRadius: 8, marginTop: 2,
  },
  cnpjSuccessText: { fontSize: 12, fontFamily: "Inter_500Medium" },

  mapWrap: {
    borderRadius: 12, overflow: "hidden",
    borderWidth: 1, height: 200,
  },
  map: { flex: 1 },
  mapHint: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center" },

  dayRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 10, borderRadius: 10, borderWidth: 1,
  },
  dayLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  closedText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  timeInput: {
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 6,
    fontSize: 13, fontFamily: "Inter_400Regular", width: 62, textAlign: "center",
  },

  chip: {
    borderWidth: 1, borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 8,
    alignItems: "center",
  },
  chipText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  cardGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 8,
  },
  cardChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8,
  },

  logoUpload: {
    borderWidth: 2, borderStyle: "dashed",
    borderRadius: 12, padding: 24,
    alignItems: "center", justifyContent: "center",
  },
  logoUploadText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  logoUploadHint: { fontSize: 11, fontFamily: "Inter_400Regular" },

  infoCard: {
    flexDirection: "row", gap: 10, alignItems: "flex-start",
    padding: 12, borderRadius: 10, borderWidth: 1,
  },
  infoText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },

  methodOption: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderWidth: 1.5, borderRadius: 12, padding: 14,
  },
  methodIcon: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  methodTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  methodSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  radio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2,
    alignItems: "center", justifyContent: "center",
  },
  radioDot: { width: 10, height: 10, borderRadius: 5 },

  bottomCTA: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1,
  },
  btnPrimary: {
    flexDirection: "row", gap: 8,
    alignItems: "center", justifyContent: "center",
    borderRadius: 12, paddingVertical: 14,
  },
  btnPrimaryText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 },

  verifyCard: {
    borderRadius: 14, borderWidth: 1,
    padding: 24, alignItems: "center", gap: 12,
  },
  verifyIcon: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: "center", justifyContent: "center",
  },
  verifyTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  verifySub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },

  devCodeBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
    marginTop: 4,
  },
  devCodeText: { fontSize: 13, fontFamily: "Inter_500Medium" },

  codeInput: {
    borderWidth: 1.5, borderRadius: 12,
    paddingVertical: 18,
    fontSize: 32, fontFamily: "Inter_700Bold",
    letterSpacing: 16,
  },

  resendBtn: { alignItems: "center", padding: 8 },
  resendText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },

  successWrap: {
    flex: 1, alignItems: "center", justifyContent: "center",
    padding: 40, gap: 16,
  },
  successIcon: {
    width: 96, height: 96, borderRadius: 48,
    alignItems: "center", justifyContent: "center",
  },
  successTitle: { fontSize: 24, fontFamily: "Inter_700Bold", textAlign: "center" },
  successSub: { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
});
