import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { useApp, type ShoppingItem } from "@/context/AppContext";

export default function ShoppingListScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const C = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const {
    shoppingList,
    toggleShoppingItem,
    removeFromShoppingList,
    clearShoppingList,
    addToShoppingList,
  } = useApp();

  const [newProduct, setNewProduct] = useState("");
  const inputRef = useRef<TextInput>(null);

  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 84 : (insets.bottom ? insets.bottom + 60 : 80);

  const checked = shoppingList.filter((i) => i.checked);
  const unchecked = shoppingList.filter((i) => !i.checked);
  const totalSaving = shoppingList.reduce(
    (sum, i) => sum + (i.bestPrice || 0) * i.quantity,
    0
  );

  const handleAdd = () => {
    if (!newProduct.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addToShoppingList({
      eanCode: "",
      productName: newProduct.trim(),
      quantity: 1,
      checked: false,
    });
    setNewProduct("");
    inputRef.current?.focus();
  };

  const handleClear = () => {
    Alert.alert("Limpar lista?", "Todos os itens serão removidos.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Limpar",
        style: "destructive",
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          clearShoppingList();
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: ShoppingItem }) => (
    <Pressable
      style={[
        styles.item,
        {
          backgroundColor: C.surfaceElevated,
          borderColor: item.checked ? C.success : C.border,
          opacity: item.checked ? 0.65 : 1,
        },
      ]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        toggleShoppingItem(item.id);
      }}
    >
      <View
        style={[
          styles.checkbox,
          {
            borderColor: item.checked ? C.success : C.border,
            backgroundColor: item.checked ? C.success : "transparent",
          },
        ]}
      >
        {item.checked && <Feather name="check" size={12} color="#fff" />}
      </View>
      <View style={styles.itemInfo}>
        <Text
          style={[
            styles.itemName,
            {
              color: C.text,
              textDecorationLine: item.checked ? "line-through" : "none",
            },
          ]}
        >
          {item.productName}
        </Text>
        {item.eanCode ? (
          <Text style={[styles.itemEan, { color: C.textMuted }]}>
            {item.eanCode}
          </Text>
        ) : null}
        {item.bestPrice ? (
          <View style={styles.priceRow}>
            <Text style={[styles.itemPrice, { color: C.primary }]}>
              R$ {item.bestPrice.toFixed(2).replace(".", ",")}
            </Text>
            {item.bestStore ? (
              <Text style={[styles.itemStore, { color: C.textMuted }]}>
                · {item.bestStore}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          removeFromShoppingList(item.id);
        }}
        style={styles.removeBtn}
        hitSlop={8}
      >
        <Feather name="trash-2" size={16} color={C.textMuted} />
      </Pressable>
    </Pressable>
  );

  const listData = [...unchecked, ...checked];

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 12, backgroundColor: C.background },
        ]}
      >
        <View>
          <Text style={[styles.title, { color: C.text }]}>Minha Lista</Text>
          <Text style={[styles.subtitle, { color: C.textMuted }]}>
            {unchecked.length} restante{unchecked.length !== 1 ? "s" : ""} ·{" "}
            {checked.length} marcado{checked.length !== 1 ? "s" : ""}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            style={[
              styles.headerBtn,
              { backgroundColor: C.backgroundSecondary },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/scanner");
            }}
          >
            <MaterialCommunityIcons
              name="barcode-scan"
              size={18}
              color={C.text}
            />
          </Pressable>
          {shoppingList.length > 0 && (
            <Pressable
              style={[
                styles.headerBtn,
                { backgroundColor: C.backgroundSecondary },
              ]}
              onPress={handleClear}
            >
              <Feather name="trash-2" size={18} color={C.textMuted} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Always-visible Add Bar */}
      <View
        style={[
          styles.addRow,
          {
            backgroundColor: C.backgroundSecondary,
            marginHorizontal: 16,
            marginBottom: 10,
            borderColor: newProduct ? C.primary : C.border,
            borderWidth: 1.5,
          },
        ]}
      >
        <Feather name="plus-circle" size={18} color={C.primary} />
        <TextInput
          ref={inputRef}
          style={[styles.addInput, { color: C.text }]}
          placeholder="Adicionar produto à lista..."
          placeholderTextColor={C.textMuted}
          value={newProduct}
          onChangeText={setNewProduct}
          onSubmitEditing={handleAdd}
          returnKeyType="done"
        />
        {newProduct.trim().length > 0 && (
          <Pressable
            style={[styles.addConfirmBtn, { backgroundColor: C.primary }]}
            onPress={handleAdd}
          >
            <Feather name="check" size={16} color="#fff" />
          </Pressable>
        )}
      </View>

      {/* Total */}
      {totalSaving > 0 && (
        <View
          style={[
            styles.totalRow,
            {
              backgroundColor: C.primary,
              marginHorizontal: 16,
              marginBottom: 12,
            },
          ]}
        >
          <Text style={styles.totalLabel}>Melhor total estimado</Text>
          <Text style={styles.totalValue}>
            R$ {totalSaving.toFixed(2).replace(".", ",")}
          </Text>
        </View>
      )}

      {/* List */}
      {listData.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="shopping-cart" size={52} color={C.textMuted} />
          <Text style={[styles.emptyTitle, { color: C.text }]}>
            Lista vazia
          </Text>
          <Text style={[styles.emptySubtitle, { color: C.textMuted }]}>
            Digite o nome de um produto no campo acima ou escaneie um código de
            barras
          </Text>
          <Pressable
            style={[styles.emptyBtn, { backgroundColor: C.primary }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push("/(tabs)/search");
            }}
          >
            <Feather name="search" size={16} color="#fff" />
            <Text style={styles.emptyBtnText}>Buscar produtos</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: bottomPad, gap: 8 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  headerActions: { flexDirection: "row", gap: 8 },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 10,
    gap: 10,
  },
  addInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  addConfirmBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  totalLabel: { color: "#fff", fontSize: 13, fontFamily: "Inter_500Medium" },
  totalValue: { color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold" },
  item: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  itemEan: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 1 },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
  },
  itemPrice: { fontSize: 13, fontFamily: "Inter_700Bold" },
  itemStore: { fontSize: 11, fontFamily: "Inter_400Regular" },
  removeBtn: { padding: 4 },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 12,
    marginTop: 40,
  },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  emptyBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
