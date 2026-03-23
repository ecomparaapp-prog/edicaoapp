import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
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
import { useApp } from "@/context/AppContext";
import {
  checkNickname,
  fetchProfile,
  saveProfile,
  type UserProfile,
} from "@/services/profileService";

function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9)
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

const IDENTITY_FIELDS = ["nickname", "fullName", "cpf"] as const;
const ALL_FIELDS = ["nickname", "fullName", "cpf", "phone", "address", "pixKey"] as const;

type FieldKey = (typeof ALL_FIELDS)[number];

interface FormState {
  nickname: string;
  fullName: string;
  cpf: string;
  phone: string;
  address: string;
  pixKey: string;
}

function completionCount(form: FormState): number {
  return ALL_FIELDS.filter((f) => (form[f] ?? "").trim().length > 0).length;
}

export default function ProfileEditScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const C = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top;

  const { user, setUser } = useApp();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [form, setForm] = useState<FormState>({
    nickname: "",
    fullName: "",
    cpf: "",
    phone: "",
    address: "",
    pixKey: "",
  });

  const [nicknameStatus, setNicknameStatus] = useState<"idle" | "checking" | "ok" | "taken">("idle");
  const [nicknameSuggestion, setNicknameSuggestion] = useState<string | null>(null);
  const nicknameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [phoneEdit, setPhoneEdit] = useState(false);
  const [phoneDraft, setPhoneDraft] = useState("");
  const [phoneSaving, setPhoneSaving] = useState(false);

  const [addressEdit, setAddressEdit] = useState(false);
  const [addressDraft, setAddressDraft] = useState("");
  const [addressSaving, setAddressSaving] = useState(false);

  const [pixEdit, setPixEdit] = useState(false);
  const [pixDraft, setPixDraft] = useState("");
  const [pixSaving, setPixSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchProfile(user.id).then((p) => {
      if (p) {
        setProfile(p);
        setForm({
          nickname: p.nickname ?? "",
          fullName: p.fullName ?? "",
          cpf: p.cpf ?? "",
          phone: p.phone ?? "",
          address: p.address ?? "",
          pixKey: p.pixKey ?? "",
        });
      }
      setLoading(false);
    });
  }, [user?.id]);

  const handleNicknameChange = (text: string) => {
    const clean = text.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20);
    setForm((f) => ({ ...f, nickname: clean }));
    setNicknameStatus("idle");
    setNicknameSuggestion(null);
    if (nicknameTimer.current) clearTimeout(nicknameTimer.current);
    if (clean.length >= 3) {
      setNicknameStatus("checking");
      nicknameTimer.current = setTimeout(async () => {
        const result = await checkNickname(clean, user!.id);
        setNicknameStatus(result.available ? "ok" : "taken");
        setNicknameSuggestion(result.suggestion);
      }, 600);
    }
  };

  const isFullNameLocked = profile?.fullNameLocked ?? false;
  const isCpfLocked = profile?.cpfLocked ?? false;

  const completed = completionCount(form);
  const isComplete = completed === ALL_FIELDS.length;
  const progressPct = (completed / ALL_FIELDS.length) * 100;

  const handleSaveIdentity = async () => {
    if (!user) return;
    if (!form.nickname.trim()) {
      Alert.alert("Atenção", "O nickname é obrigatório.");
      return;
    }
    if (nicknameStatus === "taken") {
      Alert.alert(
        "Nickname indisponível",
        nicknameSuggestion ? `Sugestão: ${nicknameSuggestion}` : "Escolha outro nickname."
      );
      return;
    }

    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const result = await saveProfile(user.id, {
      nickname: form.nickname,
      fullName: form.fullName || null,
      cpf: form.cpf || null,
      phone: form.phone || null,
      address: form.address || null,
      pixKey: form.pixKey || null,
    });

    setSaving(false);

    if (!result.ok) {
      if (result.suggestion) {
        Alert.alert("Nickname indisponível", `Sugestão: ${result.suggestion}`);
      } else {
        Alert.alert("Erro", result.error);
      }
      return;
    }

    setProfile(result.profile);
    setForm((f) => ({
      ...f,
      nickname: result.profile.nickname ?? f.nickname,
      fullName: result.profile.fullName ?? f.fullName,
      cpf: result.profile.cpf ?? f.cpf,
    }));

    if (user) {
      const updatedUser = { ...user, name: result.profile.nickname };
      if (result.profile.bonusAwarded) updatedUser.points = (user.points || 0) + result.profile.bonusPoints;
      setUser(updatedUser);
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (result.profile.bonusAwarded) {
      Alert.alert("🎉 +250 pontos!", "Perfil completo! Você ganhou 250 pontos no ranking.", [
        { text: "Ótimo!", onPress: () => router.back() },
      ]);
    } else {
      Alert.alert("Salvo", "Dados de identidade atualizados.", [{ text: "OK" }]);
    }
  };

  const patchField = async (field: "phone" | "address" | "pixKey", value: string | null) => {
    if (!user) return { ok: false };
    const payload = {
      nickname: form.nickname || profile?.nickname || "user",
      fullName: form.fullName || null,
      cpf: form.cpf || null,
      phone: field === "phone" ? value : form.phone || null,
      address: field === "address" ? value : form.address || null,
      pixKey: field === "pixKey" ? value : form.pixKey || null,
    };
    return saveProfile(user.id, payload);
  };

  const handlePhoneSave = async () => {
    setPhoneSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const result = await patchField("phone", phoneDraft.trim() || null);
    setPhoneSaving(false);
    if (!result.ok) { Alert.alert("Erro", result.error); return; }
    setForm((f) => ({ ...f, phone: phoneDraft.trim() }));
    setProfile(result.profile);
    setPhoneEdit(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (result.profile.bonusAwarded && user) {
      setUser({ ...user, points: (user.points || 0) + result.profile.bonusPoints });
      Alert.alert("🎉 +250 pontos!", "Perfil completo! Você ganhou 250 pontos no ranking.");
    }
  };

  const handlePhoneDelete = () => {
    Alert.alert("Remover celular", "Deseja apagar o número de celular?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Apagar", style: "destructive", onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          const result = await patchField("phone", null);
          if (!result.ok) { Alert.alert("Erro", result.error); return; }
          setForm((f) => ({ ...f, phone: "" }));
          setProfile(result.profile);
          setPhoneEdit(false);
        },
      },
    ]);
  };

  const handleAddressSave = async () => {
    setAddressSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const result = await patchField("address", addressDraft.trim() || null);
    setAddressSaving(false);
    if (!result.ok) { Alert.alert("Erro", result.error); return; }
    setForm((f) => ({ ...f, address: addressDraft.trim() }));
    setProfile(result.profile);
    setAddressEdit(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (result.profile.bonusAwarded && user) {
      setUser({ ...user, points: (user.points || 0) + result.profile.bonusPoints });
      Alert.alert("🎉 +250 pontos!", "Perfil completo! Você ganhou 250 pontos no ranking.");
    }
  };

  const handleAddressDelete = () => {
    Alert.alert("Remover endereço", "Deseja apagar o endereço cadastrado?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Apagar", style: "destructive", onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          const result = await patchField("address", null);
          if (!result.ok) { Alert.alert("Erro", result.error); return; }
          setForm((f) => ({ ...f, address: "" }));
          setProfile(result.profile);
          setAddressEdit(false);
        },
      },
    ]);
  };

  const handlePixSave = async () => {
    setPixSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const result = await patchField("pixKey", pixDraft.trim() || null);
    setPixSaving(false);
    if (!result.ok) { Alert.alert("Erro", result.error); return; }
    setForm((f) => ({ ...f, pixKey: pixDraft.trim() }));
    setProfile(result.profile);
    setPixEdit(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (result.profile.bonusAwarded && user) {
      setUser({ ...user, points: (user.points || 0) + result.profile.bonusPoints });
      Alert.alert("🎉 +250 pontos!", "Perfil completo! Você ganhou 250 pontos no ranking.");
    }
  };

  const handlePixDelete = () => {
    Alert.alert("Remover chave PIX", "Deseja apagar a chave PIX cadastrada?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Apagar", style: "destructive", onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          const result = await patchField("pixKey", null);
          if (!result.ok) { Alert.alert("Erro", result.error); return; }
          setForm((f) => ({ ...f, pixKey: "" }));
          setProfile(result.profile);
          setPixEdit(false);
        },
      },
    ]);
  };

  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: C.background, justifyContent: "center", alignItems: "center" }]}>
        <Text style={[styles.emptyText, { color: C.textMuted }]}>Faça login para editar seu perfil.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: C.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: C.border }]}>
        <Pressable
          style={[styles.backBtn, { backgroundColor: C.backgroundSecondary }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
        >
          <Feather name="chevron-left" size={20} color={C.text} />
        </Pressable>
        <Text style={[styles.title, { color: C.text }]}>Meu Perfil</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={C.primary} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {/* Progress */}
          <View style={[styles.progressCard, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
            <View style={styles.progressHeader}>
              <Text style={[styles.progressLabel, { color: C.text }]}>Completude do perfil</Text>
              <Text style={[styles.progressPct, { color: C.primary }]}>{Math.round(progressPct)}%</Text>
            </View>
            <View style={[styles.progressBg, { backgroundColor: C.backgroundTertiary }]}>
              <View style={[styles.progressFill, { backgroundColor: isComplete ? C.success : C.primary, width: `${progressPct}%` as any }]} />
            </View>
            {!profile?.profileBonusAwarded && (
              <View style={[styles.bonusBadge, { backgroundColor: C.primary + "15", borderColor: C.primary + "40" }]}>
                <Feather name="award" size={14} color={C.primary} />
                <Text style={[styles.bonusText, { color: C.primary }]}>
                  Perfil 100% completo = <Text style={{ fontFamily: "Inter_700Bold" }}>+250 pontos</Text> no ranking
                </Text>
              </View>
            )}
            {profile?.profileBonusAwarded && (
              <View style={[styles.bonusBadge, { backgroundColor: C.success + "15", borderColor: C.success + "40" }]}>
                <Feather name="check-circle" size={14} color={C.success} />
                <Text style={[styles.bonusText, { color: C.success }]}>Bônus de 250 pontos já resgatado!</Text>
              </View>
            )}
          </View>

          {/* Confidentiality notice */}
          <View style={[styles.privacyCard, { backgroundColor: C.backgroundSecondary, borderColor: C.border }]}>
            <Feather name="lock" size={14} color={C.textMuted} />
            <Text style={[styles.privacyText, { color: C.textMuted }]}>
              Seus dados são armazenados com segurança e nunca compartilhados com terceiros. Nome completo e CPF são exibidos apenas internamente para verificação de identidade.
            </Text>
          </View>

          {/* ── IDENTITY SECTION ── */}
          <SectionHeader label="Identidade" C={C} />

          {/* Nickname */}
          <FieldCard label="Nickname" required hint="Exibido publicamente no ranking. Apenas letras, números e _" C={C}>
            <View style={styles.nicknameRow}>
              <TextInput
                style={[styles.input, { color: C.text, backgroundColor: C.backgroundSecondary, flex: 1 }]}
                value={form.nickname}
                onChangeText={handleNicknameChange}
                placeholder="meu_nickname"
                placeholderTextColor={C.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={20}
              />
              <View style={styles.nicknameIcon}>
                {nicknameStatus === "checking" && <ActivityIndicator size="small" color={C.textMuted} />}
                {nicknameStatus === "ok" && <Feather name="check-circle" size={18} color={C.success} />}
                {nicknameStatus === "taken" && <Feather name="x-circle" size={18} color={C.error} />}
              </View>
            </View>
            {nicknameStatus === "taken" && nicknameSuggestion && (
              <Pressable onPress={() => { setForm((f) => ({ ...f, nickname: nicknameSuggestion })); setNicknameStatus("idle"); setNicknameSuggestion(null); }}>
                <Text style={[styles.suggestionText, { color: C.primary }]}>
                  Sugestão: <Text style={{ fontFamily: "Inter_700Bold" }}>{nicknameSuggestion}</Text> (toque para usar)
                </Text>
              </Pressable>
            )}
          </FieldCard>

          {/* Full Name */}
          <FieldCard label="Nome completo" required hint={isFullNameLocked ? "Campo bloqueado após primeiro preenchimento" : "Será bloqueado após salvo"} locked={isFullNameLocked} C={C}>
            <TextInput
              style={[styles.input, { color: isFullNameLocked ? C.textMuted : C.text, backgroundColor: isFullNameLocked ? C.backgroundTertiary : C.backgroundSecondary }]}
              value={form.fullName}
              onChangeText={(t) => !isFullNameLocked && setForm((f) => ({ ...f, fullName: t }))}
              placeholder="Seu nome completo"
              placeholderTextColor={C.textMuted}
              editable={!isFullNameLocked}
              autoCapitalize="words"
            />
          </FieldCard>

          {/* CPF */}
          <FieldCard label="CPF" required hint={isCpfLocked ? "Campo bloqueado após primeiro preenchimento" : "Será bloqueado após salvo"} locked={isCpfLocked} C={C}>
            <TextInput
              style={[styles.input, { color: isCpfLocked ? C.textMuted : C.text, backgroundColor: isCpfLocked ? C.backgroundTertiary : C.backgroundSecondary }]}
              value={form.cpf}
              onChangeText={(t) => !isCpfLocked && setForm((f) => ({ ...f, cpf: formatCPF(t) }))}
              placeholder="000.000.000-00"
              placeholderTextColor={C.textMuted}
              keyboardType="numeric"
              editable={!isCpfLocked}
              maxLength={14}
            />
          </FieldCard>

          {/* Identity save button */}
          <Pressable
            style={[styles.saveBtn, { backgroundColor: saving ? C.primary + "80" : C.primary }]}
            onPress={handleSaveIdentity}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Feather name="save" size={16} color="#fff" />
                <Text style={styles.saveBtnText}>Salvar identidade</Text>
              </>
            )}
          </Pressable>

          {/* ── CONTACT SECTION ── */}
          <SectionHeader label="Contato e pagamento" C={C} />

          {/* Phone CRUD */}
          <CrudFieldCard
            label="Celular"
            icon="smartphone"
            value={form.phone}
            hint="Com DDD, ex: (61) 99999-0000"
            isEditing={phoneEdit}
            isSaving={phoneSaving}
            draft={phoneDraft}
            onEdit={() => { setPhoneDraft(form.phone); setPhoneEdit(true); }}
            onCancel={() => setPhoneEdit(false)}
            onSave={handlePhoneSave}
            onDelete={form.phone ? handlePhoneDelete : undefined}
            onChangeDraft={(t) => setPhoneDraft(formatPhone(t))}
            keyboardType="phone-pad"
            maxLength={15}
            C={C}
          />

          {/* Address CRUD */}
          <CrudFieldCard
            label="Endereço"
            icon="map-pin"
            value={form.address}
            hint="Rua, número, bairro, cidade – UF"
            isEditing={addressEdit}
            isSaving={addressSaving}
            draft={addressDraft}
            onEdit={() => { setAddressDraft(form.address); setAddressEdit(true); }}
            onCancel={() => setAddressEdit(false)}
            onSave={handleAddressSave}
            onDelete={form.address ? handleAddressDelete : undefined}
            onChangeDraft={(t) => setAddressDraft(t)}
            multiline
            C={C}
          />

          {/* PIX Key CRUD */}
          <CrudFieldCard
            label="Chave PIX"
            icon="credit-card"
            value={form.pixKey}
            hint="CPF, e-mail, telefone ou chave aleatória"
            isEditing={pixEdit}
            isSaving={pixSaving}
            draft={pixDraft}
            onEdit={() => { setPixDraft(form.pixKey); setPixEdit(true); }}
            onCancel={() => setPixEdit(false)}
            onSave={handlePixSave}
            onDelete={form.pixKey ? handlePixDelete : undefined}
            onChangeDraft={(t) => setPixDraft(t)}
            autoCapitalize="none"
            C={C}
          />

          {/* PIX notice */}
          <View style={[styles.pixNotice, { backgroundColor: "#FFF9C4", borderColor: "#F9A825" }]}>
            <Feather name="info" size={14} color="#F57F17" />
            <Text style={[styles.pixNoticeText, { color: "#5D4037" }]}>
              O resgate de pontos exige perfil 100% completo. Seus pontos serão transferidos via PIX para a chave cadastrada.
            </Text>
          </View>

          <View style={{ height: 20 }} />
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

function SectionHeader({ label, C }: { label: string; C: typeof Colors.light }) {
  return (
    <Text style={[sectionHeaderStyle, { color: C.textMuted }]}>{label.toUpperCase()}</Text>
  );
}
const sectionHeaderStyle: import("react-native").TextStyle = {
  fontSize: 11,
  fontFamily: "Inter_600SemiBold",
  letterSpacing: 0.8,
  marginBottom: -6,
  marginLeft: 4,
};

function CrudFieldCard({
  label,
  icon,
  value,
  hint,
  isEditing,
  isSaving,
  draft,
  onEdit,
  onCancel,
  onSave,
  onDelete,
  onChangeDraft,
  keyboardType,
  maxLength,
  multiline,
  autoCapitalize,
  C,
}: {
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  value: string;
  hint?: string;
  isEditing: boolean;
  isSaving: boolean;
  draft: string;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onDelete?: () => void;
  onChangeDraft: (t: string) => void;
  keyboardType?: import("react-native").TextInputProps["keyboardType"];
  maxLength?: number;
  multiline?: boolean;
  autoCapitalize?: import("react-native").TextInputProps["autoCapitalize"];
  C: typeof Colors.light;
}) {
  const hasValue = value.trim().length > 0;

  return (
    <View style={[styles.crudCard, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
      <View style={styles.crudHeader}>
        <View style={styles.crudLabelRow}>
          <Feather name={icon} size={14} color={C.primary} />
          <Text style={[styles.fieldLabel, { color: C.text }]}>{label}</Text>
        </View>
        {!isEditing && (
          <View style={styles.crudActions}>
            <Pressable style={[styles.crudBtn, { backgroundColor: C.backgroundSecondary }]} onPress={onEdit}>
              <Feather name={hasValue ? "edit-2" : "plus"} size={13} color={C.primary} />
              <Text style={[styles.crudBtnText, { color: C.primary }]}>{hasValue ? "Editar" : "Adicionar"}</Text>
            </Pressable>
            {hasValue && onDelete && (
              <Pressable style={[styles.crudBtn, { backgroundColor: C.backgroundSecondary }]} onPress={onDelete}>
                <Feather name="trash-2" size={13} color={C.error} />
              </Pressable>
            )}
          </View>
        )}
      </View>

      {!isEditing && (
        <Text
          style={[styles.crudValue, { color: hasValue ? C.text : C.textMuted }]}
          numberOfLines={multiline ? 3 : 1}
        >
          {hasValue ? value : "Não informado"}
        </Text>
      )}

      {isEditing && (
        <View style={{ gap: 10 }}>
          <TextInput
            style={[
              styles.input,
              multiline && styles.inputMulti,
              { color: C.text, backgroundColor: C.backgroundSecondary },
            ]}
            value={draft}
            onChangeText={onChangeDraft}
            placeholder={hint}
            placeholderTextColor={C.textMuted}
            keyboardType={keyboardType}
            maxLength={maxLength}
            multiline={multiline}
            numberOfLines={multiline ? 3 : 1}
            autoCapitalize={autoCapitalize ?? "sentences"}
            autoCorrect={false}
            autoFocus
          />
          <View style={styles.crudEditActions}>
            <Pressable style={[styles.cancelBtn, { borderColor: C.border }]} onPress={onCancel}>
              <Text style={[styles.cancelBtnText, { color: C.textMuted }]}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[styles.confirmBtn, { backgroundColor: isSaving ? C.primary + "80" : C.primary, flex: 1 }]}
              onPress={onSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Feather name="check" size={14} color="#fff" />
                  <Text style={styles.confirmBtnText}>Salvar</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      )}

      {!isEditing && hint && (
        <Text style={[styles.fieldHint, { color: C.textMuted }]}>{hint}</Text>
      )}
    </View>
  );
}

function FieldCard({
  label,
  required,
  hint,
  locked,
  C,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  locked?: boolean;
  C: typeof Colors.light;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.fieldCard, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
      <View style={styles.fieldLabelRow}>
        <Text style={[styles.fieldLabel, { color: C.text }]}>
          {label}
          {required && <Text style={{ color: C.primary }}> *</Text>}
        </Text>
        {locked && (
          <View style={[styles.lockedBadge, { backgroundColor: C.backgroundTertiary }]}>
            <Feather name="lock" size={10} color={C.textMuted} />
            <Text style={[styles.lockedText, { color: C.textMuted }]}>bloqueado</Text>
          </View>
        )}
      </View>
      {children}
      {hint && <Text style={[styles.fieldHint, { color: C.textMuted }]}>{hint}</Text>}
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
  loadingBox: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, gap: 14 },
  progressCard: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 10 },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  progressLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  progressPct: { fontSize: 14, fontFamily: "Inter_700Bold" },
  progressBg: { height: 8, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 4 },
  bonusBadge: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  bonusText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  privacyCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  privacyText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  fieldCard: { borderRadius: 14, padding: 14, borderWidth: 1, gap: 8 },
  fieldLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  lockedBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  lockedText: { fontSize: 10, fontFamily: "Inter_500Medium" },
  input: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  inputMulti: { minHeight: 72, textAlignVertical: "top" },
  fieldHint: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },
  nicknameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  nicknameIcon: { width: 24, alignItems: "center" },
  suggestionText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  pixNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  pixNoticeText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
  },
  saveBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  crudCard: { borderRadius: 14, padding: 14, borderWidth: 1, gap: 10 },
  crudHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  crudLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  crudActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  crudBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  crudBtnText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  crudValue: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  crudEditActions: { flexDirection: "row", gap: 8 },
  cancelBtn: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 10,
    paddingVertical: 10,
  },
  confirmBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },
});
