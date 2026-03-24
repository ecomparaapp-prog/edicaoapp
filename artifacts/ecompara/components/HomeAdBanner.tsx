import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
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
  type StoreAd,
  type BrandAd,
  type BrandVariant,
  type StoreNearby,
} from "@/services/adService";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - 32;

// Product card size inside store carousel
const PRODUCT_CARD_W = 108;
const PRODUCT_CARD_H = 148;

// Brand variant card size
const VARIANT_CARD_W = 112;

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

  // ─── Store Ad Card ────────────────────────────────────────────────────────
  const renderStoreAd = (ad: StoreAd) => (
    <View style={[styles.card, { width: CARD_WIDTH, backgroundColor: isDark ? "#1A1A1A" : "#fff", borderColor: C.border }]}>

      {/* Header */}
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

      {/* Inner product carousel */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.productCarouselContent}
        decelerationRate="fast"
        snapToInterval={PRODUCT_CARD_W + 10}
      >
        {ad.products.map((product) => (
          <Pressable
            key={product.ean}
            style={[
              styles.productCard,
              {
                width: PRODUCT_CARD_W,
                height: PRODUCT_CARD_H,
                backgroundColor: isDark ? "#242424" : "#FAFAFA",
                borderColor: isDark ? "#333" : "#ECECEC",
              },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push(`/product/${product.ean}`);
            }}
          >
            {/* Emoji image area */}
            <View style={[styles.productImgBox, { backgroundColor: isDark ? "#2E2E2E" : "#F0F0F0" }]}>
              <Text style={styles.productEmoji}>{product.emoji}</Text>
            </View>

            {/* Name */}
            <Text
              style={[styles.productName, { color: C.text }]}
              numberOfLines={2}
            >
              {product.name}
            </Text>

            {/* Price */}
            <Text style={[styles.productPrice, { color: ad.accentColor }]}>
              R${product.price.toFixed(2).replace(".", ",")}
            </Text>

            {/* CTA chip */}
            <View style={[styles.productCta, { backgroundColor: ad.accentColor + "18" }]}>
              <Text style={[styles.productCtaText, { color: ad.accentColor }]}>Ver preços</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      {/* Scroll hint arrows */}
      <View style={[styles.scrollHint, { borderTopColor: isDark ? "#2A2A2A" : "#F0F0F0" }]}>
        <Feather name="chevrons-right" size={13} color={C.textMuted} />
        <Text style={[styles.scrollHintText, { color: C.textMuted }]}>Deslize para ver mais ofertas</Text>
      </View>

      {/* Footer */}
      <View style={[styles.cardFooter, { borderTopColor: C.border }]}>
        <View style={[styles.cpcBadge, { backgroundColor: isDark ? "#2A2A2A" : "#F5F5F5" }]}>
          <MaterialCommunityIcons name="shield-check" size={10} color={ad.accentColor} />
          <Text style={[styles.cpcText, { color: C.textMuted }]}>Score {ad.cpcScore}</Text>
        </View>
        <Pressable
          style={styles.cardFooterAction}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push(`/store/${ad.storeId}`);
          }}
        >
          <Text style={[styles.cardFooterActionText, { color: ad.accentColor }]}>Ver loja completa</Text>
          <Feather name="arrow-right" size={12} color={ad.accentColor} />
        </Pressable>
      </View>
    </View>
  );

  // ─── Brand Ad Card ────────────────────────────────────────────────────────
  const renderBrandAd = (ad: BrandAd) => (
    <View style={[styles.card, { width: CARD_WIDTH, backgroundColor: isDark ? "#1A1A1A" : "#fff", borderColor: C.border }]}>

      {/* Header */}
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

      {/* Hint bar */}
      <View style={[styles.brandHintBar, { backgroundColor: isDark ? "#1F2A3A" : "#EBF1FA" }]}>
        <Ionicons name="location-outline" size={13} color={ad.accentColor} />
        <Text style={[styles.brandHintText, { color: ad.accentColor }]}>
          Toque em uma variante para ver onde encontrar perto de você
        </Text>
      </View>

      {/* Variant carousel — larger cards */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.variantCarouselContent}
        decelerationRate="fast"
        snapToInterval={VARIANT_CARD_W + 10}
      >
        {ad.variants.map((v) => (
          <Pressable
            key={v.ean}
            style={[
              styles.variantCard,
              {
                width: VARIANT_CARD_W,
                backgroundColor: isDark ? "#1E2A3D" : "#F0F5FF",
                borderColor: ad.accentColor + "50",
              },
            ]}
            onPress={() => handleBrandProductPress(ad, v)}
          >
            <Text style={styles.variantEmoji}>{v.emoji}</Text>
            <Text style={[styles.variantName, { color: C.text }]} numberOfLines={2}>
              {v.name}
            </Text>
            <View style={[styles.variantFindBtn, { backgroundColor: ad.accentColor }]}>
              <Feather name="map-pin" size={10} color="#fff" />
              <Text style={styles.variantFindText}>Onde tem?</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      {/* Scroll hint */}
      <View style={[styles.scrollHint, { borderTopColor: isDark ? "#2A2A2A" : "#F0F0F0" }]}>
        <Feather name="chevrons-right" size={13} color={C.textMuted} />
        <Text style={[styles.scrollHintText, { color: C.textMuted }]}>Deslize para ver mais variantes</Text>
      </View>

      {/* Footer */}
      <View style={[styles.cardFooter, { borderTopColor: C.border }]}>
        <View style={[styles.cpcBadge, { backgroundColor: isDark ? "#2A2A2A" : "#F5F5F5" }]}>
          <MaterialCommunityIcons name="tag-outline" size={10} color={ad.accentColor} />
          <Text style={[styles.cpcText, { color: C.textMuted }]}>CPC Premium · Indústria</Text>
        </View>
        <View style={styles.cardFooterAction}>
          <Text style={[styles.cardFooterActionText, { color: ad.accentColor }]}>Ver linha completa</Text>
          <Feather name="arrow-right" size={12} color={ad.accentColor} />
        </View>
      </View>
    </View>
  );

  // ─── Root render ──────────────────────────────────────────────────────────
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
          renderItem={({ item }) =>
            item.type === "store" ? renderStoreAd(item) : renderBrandAd(item)
          }
        />

        {/* Pagination dots */}
        <View style={styles.dots}>
          {HOME_ADS.map((ad, i) => {
            const color =
              ad.type === "brand"
                ? (ad as BrandAd).accentColor
                : (ad as StoreAd).accentColor;
            return (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    backgroundColor: i === activeBanner ? color : (isDark ? "#333" : "#DDD"),
                    width: i === activeBanner ? 18 : 6,
                  },
                ]}
              />
            );
          })}
        </View>
      </View>

      {/* ── "Onde Encontrar" bottom sheet ── */}
      <Modal
        visible={!!findSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setFindSheet(null)}
      >
        <Pressable style={styles.sheetOverlay} onPress={() => setFindSheet(null)}>
          <Pressable
            style={[
              styles.sheetBox,
              { backgroundColor: isDark ? "#1A1A1A" : "#fff", paddingBottom: insets.bottom + 16 },
            ]}
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
                    <View
                      style={[
                        styles.storeRankBadge,
                        { backgroundColor: idx === 0 ? "#4CAF50" : isDark ? "#2A2A2A" : "#F5F5F5" },
                      ]}
                    >
                      <Text style={[styles.storeRankText, { color: idx === 0 ? "#fff" : isDark ? "#AAA" : "#666" }]}>
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
                    Produto não encontrado num raio de {findSheet.searchRadiusKm}km
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
                  Nenhum mercado com este produto encontrado na sua região. Seja o primeiro a cadastrar!
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
  // ── Outer card ──────────────────────────────────────────────────────────
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 8,
  },
  cardHeaderLeft: { gap: 3 },
  cardHeaderRight: { flex: 1, alignItems: "flex-end", gap: 2 },
  adBadge: {
    backgroundColor: "rgba(255,255,255,0.22)",
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    alignSelf: "flex-start",
  },
  adBadgeText: { color: "#fff", fontSize: 9, fontWeight: "700", letterSpacing: 0.6 },
  cardSlotLabel: { color: "#fff", fontSize: 14, fontWeight: "700" },
  cardStoreName: { color: "#fff", fontSize: 11, fontWeight: "600", textAlign: "right" },
  cardBairro: { color: "rgba(255,255,255,0.75)", fontSize: 10, textAlign: "right" },

  // ── Product carousel (store ad) ──────────────────────────────────────────
  productCarouselContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  productCard: {
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 10,
    gap: 6,
  },
  productImgBox: {
    width: 64,
    height: 64,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  productEmoji: { fontSize: 34 },
  productName: {
    fontSize: 11,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 14,
  },
  productPrice: {
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },
  productCta: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 2,
  },
  productCtaText: {
    fontSize: 10,
    fontWeight: "700",
  },

  // ── Brand hint bar ────────────────────────────────────────────────────────
  brandHintBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  brandHintText: {
    fontSize: 10,
    fontWeight: "500",
    flex: 1,
  },

  // ── Variant carousel (brand ad) ───────────────────────────────────────────
  variantCarouselContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  variantCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 10,
    gap: 8,
  },
  variantEmoji: { fontSize: 38 },
  variantName: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 16,
  },
  variantFindBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    marginTop: 2,
  },
  variantFindText: { color: "#fff", fontSize: 10, fontWeight: "700" },

  // ── Scroll hint ───────────────────────────────────────────────────────────
  scrollHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  scrollHintText: { fontSize: 10 },

  // ── Footer ────────────────────────────────────────────────────────────────
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cpcBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  cpcText: { fontSize: 9, fontWeight: "500" },
  cardFooterAction: { flexDirection: "row", alignItems: "center", gap: 4 },
  cardFooterActionText: { fontSize: 11, fontWeight: "700" },

  // ── Radius row (brand header) ──────────────────────────────────────────────
  radiusRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  radiusText: { color: "rgba(255,255,255,0.8)", fontSize: 10 },

  // ── Pagination dots ───────────────────────────────────────────────────────
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
    gap: 5,
  },
  dot: { height: 6, borderRadius: 3 },

  // ── "Onde Encontrar" sheet ────────────────────────────────────────────────
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheetBox: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 12,
    paddingHorizontal: 16,
    maxHeight: "80%",
  },
  sheetHandle: {
    width: 38,
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
  sheetTitle: { fontSize: 16, fontWeight: "700" },
  sheetSubtitle: { fontSize: 12, marginTop: 2 },
  sheetSectionLabel: { fontSize: 11, marginBottom: 8 },
  storeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  storeRankBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  storeRankText: { fontSize: 13, fontWeight: "700" },
  storeRowName: { fontSize: 14, fontWeight: "600" },
  storeRowMeta: { fontSize: 11 },
  storeRowPrice: { fontSize: 16, fontWeight: "800", color: "#4CAF50" },
  partnerBadge: {
    backgroundColor: "#E8F5E9",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  partnerBadgeText: { color: "#2E7D32", fontSize: 9, fontWeight: "700" },
  rupturaBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 10,
    marginTop: 4,
  },
  rupturaText: { flex: 1, fontSize: 13, lineHeight: 18 },
  sheetCloseBtn: {
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginTop: 16,
  },
  sheetCloseBtnText: { fontSize: 15, fontWeight: "600" },
});
