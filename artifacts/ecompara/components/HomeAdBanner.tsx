import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useState, useRef } from "react";
import {
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import {
  HOME_ADS,
  findStoresForEAN,
  type Ad,
  type StoreAd,
  type BrandAd,
  type BrandVariant,
  type StoreNearby,
} from "@/services/adService";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - 32;
const PRODUCT_CELL = Math.floor((CARD_WIDTH - 8) / 5);

interface Props {
  isDark: boolean;
  activeBanner: number;
  setActiveBanner: (i: number) => void;
}

interface FindSheetData {
  variantName: string;
  inRadius: StoreNearby[];
  nearest: StoreNearby | null;
  brandName: string;
  searchRadiusKm: number;
}

export default function HomeAdBanner({ isDark, activeBanner, setActiveBanner }: Props) {
  const C = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const [findSheet, setFindSheet] = useState<FindSheetData | null>(null);

  const handleBrandProductPress = (brand: BrandAd, variant: BrandVariant) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { inRadius, nearest } = findStoresForEAN(variant.ean, brand.searchRadiusKm);
    setFindSheet({
      variantName: variant.name,
      inRadius,
      nearest,
      brandName: brand.brandName,
      searchRadiusKm: brand.searchRadiusKm,
    });
  };

  const renderStoreAd = (ad: StoreAd) => {
    const rows = [
      ad.products.slice(0, 5),
      ad.products.slice(5, 10),
      ad.products.slice(10, 15),
    ];
    return (
      <Pressable
        style={[styles.card, { width: CARD_WIDTH, backgroundColor: isDark ? "#1A1A1A" : "#fff", borderColor: C.border }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push(`/store/${ad.storeId}`);
        }}
      >
        {/* Card Header */}
        <View style={[styles.cardHeader, { backgroundColor: ad.accentColor }]}>
          <View style={styles.cardHeaderLeft}>
            <View style={styles.adBadge}>
              <Text style={styles.adBadgeText}>ANÚNCIO</Text>
            </View>
            <Text style={styles.cardSlotLabel}>{ad.slotLabel}</Text>
          </View>
          <View style={styles.cardHeaderRight}>
            <Text style={styles.cardStoreName} numberOfLines={1}>{ad.storeName}</Text>
            <Text style={styles.cardBairro} numberOfLines={1}>{ad.bairro}</Text>
          </View>
        </View>

        {/* Product Grid 5×3 */}
        <View style={styles.productGrid}>
          {rows.map((row, rowIdx) => (
            <View key={rowIdx} style={styles.productRow}>
              {row.map((product) => (
                <Pressable
                  key={product.ean}
                  style={[styles.productCell, { width: PRODUCT_CELL }]}
                  onPress={(e) => {
                    e.stopPropagation();
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push(`/product/${product.ean}`);
                  }}
                >
                  <View style={[styles.productEmoji, { backgroundColor: isDark ? "#2A2A2A" : "#F8F8F8" }]}>
                    <Text style={styles.productEmojiText}>{product.emoji}</Text>
                  </View>
                  <Text style={[styles.productShortName, { color: C.textSecondary }]} numberOfLines={2}>
                    {product.shortName}
                  </Text>
                  <Text style={[styles.productPrice, { color: ad.accentColor }]}>
                    R${product.price.toFixed(2).replace(".", ",")}
                  </Text>
                </Pressable>
              ))}
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={[styles.cardFooter, { borderTopColor: C.border }]}>
          <View style={[styles.cpcBadge, { backgroundColor: isDark ? "#2A2A2A" : "#F5F5F5" }]}>
            <MaterialCommunityIcons name="shield-check" size={10} color={ad.accentColor} />
            <Text style={[styles.cpcText, { color: C.textMuted }]}>Score {ad.cpcScore}</Text>
          </View>
          <View style={styles.cardFooterAction}>
            <Text style={[styles.cardFooterActionText, { color: ad.accentColor }]}>Ver todas as ofertas</Text>
            <Feather name="arrow-right" size={12} color={ad.accentColor} />
          </View>
        </View>
      </Pressable>
    );
  };

  const renderBrandAd = (ad: BrandAd) => (
    <View style={[styles.card, { width: CARD_WIDTH, backgroundColor: isDark ? "#1A1A1A" : "#fff", borderColor: C.border }]}>
      {/* Card Header */}
      <View style={[styles.cardHeader, { backgroundColor: ad.accentColor }]}>
        <View style={styles.cardHeaderLeft}>
          <View style={[styles.adBadge, { backgroundColor: "rgba(255,255,255,0.25)" }]}>
            <Text style={styles.adBadgeText}>{ad.slotLabel}</Text>
          </View>
          <Text style={styles.cardSlotLabel}>{ad.brandName}</Text>
        </View>
        <View style={styles.cardHeaderRight}>
          <Text style={styles.cardStoreName}>{ad.tagline}</Text>
          <View style={styles.radiusRow}>
            <Feather name="map-pin" size={9} color="rgba(255,255,255,0.8)" />
            <Text style={styles.radiusText}>Raio {ad.searchRadiusKm}km</Text>
          </View>
        </View>
      </View>

      {/* Brand label */}
      <View style={[styles.brandFindRow, { backgroundColor: isDark ? "#1F2A3A" : "#EBF1FA" }]}>
        <Ionicons name="location-outline" size={13} color={ad.accentColor} />
        <Text style={[styles.brandFindText, { color: ad.accentColor }]}>
          Toque em um produto para ver onde encontrar perto de você
        </Text>
      </View>

      {/* Variant carousel */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.variantList}
      >
        {ad.variants.map((v) => (
          <Pressable
            key={v.ean}
            style={[styles.variantCell, { backgroundColor: isDark ? "#252D3D" : "#F0F5FF", borderColor: ad.accentColor + "40" }]}
            onPress={() => handleBrandProductPress(ad, v)}
          >
            <Text style={styles.variantEmoji}>{v.emoji}</Text>
            <Text style={[styles.variantName, { color: C.text }]} numberOfLines={2}>
              {v.shortName}
            </Text>
            <View style={[styles.variantFindBtn, { backgroundColor: ad.accentColor }]}>
              <Feather name="map-pin" size={9} color="#fff" />
              <Text style={styles.variantFindText}>Onde tem</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      {/* Footer */}
      <View style={[styles.cardFooter, { borderTopColor: C.border }]}>
        <View style={[styles.cpcBadge, { backgroundColor: isDark ? "#2A2A2A" : "#F5F5F5" }]}>
          <MaterialCommunityIcons name="tag-outline" size={10} color={ad.accentColor} />
          <Text style={[styles.cpcText, { color: C.textMuted }]}>CPC Premium · Indústria</Text>
        </View>
        <View style={styles.cardFooterAction}>
          <Text style={[styles.cardFooterActionText, { color: ad.accentColor }]}>Ver todos os produtos</Text>
          <Feather name="arrow-right" size={12} color={ad.accentColor} />
        </View>
      </View>
    </View>
  );

  return (
    <>
      <View style={{ marginTop: 20 }}>
        <FlatList
          data={HOME_ADS}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(
              e.nativeEvent.contentOffset.x / (CARD_WIDTH + 12)
            );
            setActiveBanner(idx);
          }}
          renderItem={({ item }) => {
            if (item.type === "store") return renderStoreAd(item);
            return renderBrandAd(item);
          }}
        />

        {/* Pagination dots */}
        <View style={styles.dots}>
          {HOME_ADS.map((ad, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i === activeBanner
                    ? (ad.type === "brand" ? (ad as BrandAd).accentColor : (ad as StoreAd).accentColor)
                    : (isDark ? "#333" : "#DDD"),
                  width: i === activeBanner ? 16 : 6,
                },
              ]}
            />
          ))}
        </View>
      </View>

      {/* "Onde Encontrar" bottom sheet for brand products */}
      <Modal
        visible={!!findSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setFindSheet(null)}
      >
        <Pressable style={styles.sheetOverlay} onPress={() => setFindSheet(null)}>
          <Pressable
            style={[styles.sheetBox, { backgroundColor: isDark ? "#1A1A1A" : "#fff", paddingBottom: insets.bottom + 16 }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeaderRow}>
              <Ionicons name="location" size={20} color="#1565C0" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.sheetTitle, { color: isDark ? "#FFF" : "#111" }]}>
                  {findSheet?.variantName}
                </Text>
                <Text style={[styles.sheetSubtitle, { color: isDark ? "#AAA" : "#666" }]}>
                  {findSheet?.brandName} · Raio {findSheet?.searchRadiusKm}km
                </Text>
              </View>
            </View>

            {findSheet && findSheet.inRadius.length > 0 ? (
              <>
                <Text style={[styles.sheetSectionLabel, { color: isDark ? "#AAA" : "#777" }]}>
                  Disponível perto de você — ordenado pelo menor preço
                </Text>
                {findSheet.inRadius.map((store, idx) => (
                  <Pressable
                    key={store.storeId}
                    style={[styles.storeRow, { borderBottomColor: isDark ? "#2A2A2A" : "#F0F0F0" }]}
                    onPress={() => {
                      setFindSheet(null);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      router.push(`/store/${store.storeId}`);
                    }}
                  >
                    <View style={[styles.storeRankBadge, { backgroundColor: idx === 0 ? "#4CAF50" : isDark ? "#2A2A2A" : "#F5F5F5" }]}>
                      <Text style={[styles.storeRankText, { color: idx === 0 ? "#fff" : (isDark ? "#AAA" : "#666") }]}>
                        {idx === 0 ? "🏆" : `${idx + 1}º`}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={[styles.storeRowName, { color: isDark ? "#FFF" : "#111" }]}>
                          {store.storeName}
                        </Text>
                        {store.isPartner && (
                          <View style={styles.partnerBadge}>
                            <Text style={styles.partnerBadgeText}>Parceiro</Text>
                          </View>
                        )}
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                        <Feather name="map-pin" size={10} color={isDark ? "#888" : "#999"} />
                        <Text style={[styles.storeRowMeta, { color: isDark ? "#888" : "#999" }]}>
                          {store.distanceKm.toFixed(1)}km · {store.bairro}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.storeRowPrice}>
                      R${store.price.toFixed(2).replace(".", ",")}
                    </Text>
                  </Pressable>
                ))}
              </>
            ) : findSheet?.nearest ? (
              <>
                <View style={[styles.rupturaBox, { backgroundColor: isDark ? "#2A1A1A" : "#FFF3F3" }]}>
                  <Ionicons name="warning-outline" size={18} color="#CC0000" />
                  <Text style={[styles.rupturaText, { color: isDark ? "#FF8888" : "#CC0000" }]}>
                    Produto não encontrado nos mercados num raio de {findSheet.searchRadiusKm}km
                  </Text>
                </View>
                <Text style={[styles.sheetSectionLabel, { color: isDark ? "#AAA" : "#777", marginTop: 12 }]}>
                  Mercado mais próximo com este produto:
                </Text>
                <Pressable
                  style={[styles.storeRow, { borderBottomColor: isDark ? "#2A2A2A" : "#F0F0F0" }]}
                  onPress={() => {
                    setFindSheet(null);
                    router.push(`/store/${findSheet.nearest!.storeId}`);
                  }}
                >
                  <View style={[styles.storeRankBadge, { backgroundColor: isDark ? "#2A2A2A" : "#F5F5F5" }]}>
                    <Feather name="map-pin" size={14} color="#CC0000" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.storeRowName, { color: isDark ? "#FFF" : "#111" }]}>
                      {findSheet.nearest.storeName}
                    </Text>
                    <Text style={[styles.storeRowMeta, { color: isDark ? "#888" : "#999" }]}>
                      {findSheet.nearest.distanceKm.toFixed(1)}km · {findSheet.nearest.bairro}
                    </Text>
                  </View>
                  <Text style={[styles.storeRowPrice, { color: "#CC0000" }]}>
                    R${findSheet.nearest.price.toFixed(2).replace(".", ",")}
                  </Text>
                </Pressable>
              </>
            ) : (
              <View style={[styles.rupturaBox, { backgroundColor: isDark ? "#2A1A1A" : "#FFF3F3" }]}>
                <Ionicons name="warning-outline" size={18} color="#CC0000" />
                <Text style={[styles.rupturaText, { color: isDark ? "#FF8888" : "#CC0000" }]}>
                  Nenhum mercado com este produto foi encontrado na sua região ainda. Seja o primeiro a cadastrar!
                </Text>
              </View>
            )}

            <Pressable
              style={[styles.sheetCloseBtn, { backgroundColor: isDark ? "#2A2A2A" : "#F0F0F0" }]}
              onPress={() => setFindSheet(null)}
            >
              <Text style={[styles.sheetCloseBtnText, { color: isDark ? "#FFF" : "#333" }]}>Fechar</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  cardHeaderLeft: {
    gap: 3,
  },
  cardHeaderRight: {
    flex: 1,
    alignItems: "flex-end",
    gap: 2,
  },
  adBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: "flex-start",
  },
  adBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  cardSlotLabel: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  cardStoreName: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "right",
  },
  cardBairro: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 10,
    textAlign: "right",
  },
  productGrid: {
    paddingHorizontal: 4,
    paddingVertical: 6,
    gap: 4,
  },
  productRow: {
    flexDirection: "row",
    gap: 4,
  },
  productCell: {
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 2,
    gap: 2,
  },
  productEmoji: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  productEmojiText: {
    fontSize: 18,
  },
  productShortName: {
    fontSize: 8,
    textAlign: "center",
    lineHeight: 10,
  },
  productPrice: {
    fontSize: 9,
    fontWeight: "700",
    textAlign: "center",
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  cpcBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 20,
  },
  cpcText: {
    fontSize: 9,
    fontWeight: "500",
  },
  cardFooterAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  cardFooterActionText: {
    fontSize: 11,
    fontWeight: "600",
  },
  brandFindRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  brandFindText: {
    fontSize: 10,
    fontWeight: "500",
    flex: 1,
  },
  variantList: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 8,
  },
  variantCell: {
    width: 80,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 6,
    gap: 5,
  },
  variantEmoji: {
    fontSize: 26,
  },
  variantName: {
    fontSize: 9,
    textAlign: "center",
    lineHeight: 12,
    fontWeight: "500",
  },
  variantFindBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 20,
    marginTop: 2,
  },
  variantFindText: {
    color: "#fff",
    fontSize: 8,
    fontWeight: "700",
  },
  radiusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  radiusText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 10,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
    gap: 5,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  // Sheet
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheetBox: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingHorizontal: 16,
    maxHeight: "80%",
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: "#CCC",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  sheetSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  sheetSectionLabel: {
    fontSize: 11,
    marginBottom: 8,
  },
  storeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  storeRankBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  storeRankText: {
    fontSize: 12,
    fontWeight: "700",
  },
  storeRowName: {
    fontSize: 14,
    fontWeight: "600",
  },
  storeRowMeta: {
    fontSize: 11,
  },
  storeRowPrice: {
    fontSize: 16,
    fontWeight: "700",
    color: "#4CAF50",
  },
  partnerBadge: {
    backgroundColor: "#E8F5E9",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  partnerBadgeText: {
    color: "#2E7D32",
    fontSize: 9,
    fontWeight: "600",
  },
  rupturaBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 10,
    marginTop: 4,
  },
  rupturaText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  sheetCloseBtn: {
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginTop: 16,
  },
  sheetCloseBtnText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
