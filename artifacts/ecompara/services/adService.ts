export type AdType = "store" | "brand";

export interface AdProduct {
  ean: string;
  name: string;
  shortName: string;
  price: number;
  emoji: string;
}

export interface BrandVariant {
  ean: string;
  name: string;
  shortName: string;
  emoji: string;
}

export interface StoreNearby {
  storeId: string;
  storeName: string;
  bairro: string;
  distanceKm: number;
  price: number;
  isPartner: boolean;
}

export interface StoreAd {
  id: string;
  type: "store";
  slotLabel: string;
  storeId: string;
  storeName: string;
  bairro: string;
  accentColor: string;
  cpcScore: number;
  products: AdProduct[];
}

export interface BrandAd {
  id: string;
  type: "brand";
  slotLabel: string;
  brandName: string;
  tagline: string;
  accentColor: string;
  searchRadiusKm: number;
  variants: BrandVariant[];
}

export type Ad = StoreAd | BrandAd;

const STORE_ADS: StoreAd[] = [
  {
    id: "ad-vivendas",
    type: "store",
    slotLabel: "Super Ofertas do Bairro",
    storeId: "1",
    storeName: "Sup. Vivendas",
    bairro: "Asa Sul · Brasília",
    accentColor: "#CC0000",
    cpcScore: 92,
    products: [
      { ean: "7891000053508", name: "Leite Parmalat 1L", shortName: "Leite\nParmalat", price: 5.49, emoji: "🥛" },
      { ean: "7891910000197", name: "Arroz Tio João 5kg", shortName: "Arroz\nTio João", price: 24.90, emoji: "🌾" },
      { ean: "7896045104482", name: "Feijão Camil 1kg", shortName: "Feijão\nCamil", price: 8.99, emoji: "🫘" },
      { ean: "7891000310755", name: "Açúcar União 1kg", shortName: "Açúcar\nUnião", price: 4.89, emoji: "🍬" },
      { ean: "7894900700015", name: "Coca-Cola 2L", shortName: "Coca-\nCola", price: 9.99, emoji: "🥤" },
      { ean: "7896004804009", name: "Óleo Liza 900ml", shortName: "Óleo\nLiza", price: 7.49, emoji: "🫙" },
      { ean: "7891152500046", name: "Macarrão Renata", shortName: "Macar.\nRenata", price: 3.29, emoji: "🍝" },
      { ean: "7896045100156", name: "Café Pilão 250g", shortName: "Café\nPilão", price: 9.99, emoji: "☕" },
      { ean: "7896071013456", name: "Farinha 1kg", shortName: "Farinha\n1kg", price: 4.49, emoji: "🌽" },
      { ean: "7891080300030", name: "Margarina Qualy", shortName: "Marg.\nQualy", price: 6.79, emoji: "🧈" },
      { ean: "7897517200014", name: "Sal Cisne 1kg", shortName: "Sal\nCisne", price: 1.99, emoji: "🧂" },
      { ean: "7891150061843", name: "OMO 1kg", shortName: "OMO\n1kg", price: 16.90, emoji: "🧺" },
      { ean: "7896098900008", name: "Detergente Ypê", shortName: "Det.\nYpê", price: 2.49, emoji: "🧴" },
      { ean: "7891172420038", name: "Papel Neve 12un", shortName: "Papel\nNeve", price: 14.90, emoji: "🧻" },
      { ean: "7891000249901", name: "Nescau 400g", shortName: "Nescau\n400g", price: 7.99, emoji: "🍫" },
    ],
  },
  {
    id: "ad-ultrabox",
    type: "store",
    slotLabel: "Supermercado Verificado Próximo",
    storeId: "3",
    storeName: "Ultrabox",
    bairro: "Santa Maria · DF",
    accentColor: "#0D47A1",
    cpcScore: 87,
    products: [
      { ean: "7891000053508", name: "Leite Parmalat 1L", shortName: "Leite\nParmalat", price: 4.99, emoji: "🥛" },
      { ean: "7891000310755", name: "Açúcar União 1kg", shortName: "Açúcar\nUnião", price: 4.49, emoji: "🍬" },
      { ean: "7896045104482", name: "Feijão Camil 1kg", shortName: "Feijão\nCamil", price: 7.89, emoji: "🫘" },
      { ean: "7896004804009", name: "Óleo Liza 900ml", shortName: "Óleo\nLiza", price: 6.99, emoji: "🫙" },
      { ean: "7891152500046", name: "Macarrão Renata", shortName: "Macar.\nRenata", price: 2.99, emoji: "🍝" },
      { ean: "7896045100156", name: "Café Pilão 250g", shortName: "Café\nPilão", price: 8.99, emoji: "☕" },
      { ean: "7891080300030", name: "Margarina Qualy", shortName: "Marg.\nQualy", price: 5.99, emoji: "🧈" },
      { ean: "7897517200014", name: "Sal Cisne 1kg", shortName: "Sal\nCisne", price: 1.79, emoji: "🧂" },
      { ean: "7891150061843", name: "OMO 1kg", shortName: "OMO\n1kg", price: 15.49, emoji: "🧺" },
      { ean: "7896098900008", name: "Detergente Ypê", shortName: "Det.\nYpê", price: 1.99, emoji: "🧴" },
      { ean: "7891172420038", name: "Papel Neve 12un", shortName: "Papel\nNeve", price: 13.49, emoji: "🧻" },
      { ean: "7891000249901", name: "Nescau 400g", shortName: "Nescau\n400g", price: 7.29, emoji: "🍫" },
      { ean: "7891910000197", name: "Arroz Tio João 5kg", shortName: "Arroz\nTio João", price: 22.99, emoji: "🌾" },
      { ean: "7894900700015", name: "Coca-Cola 2L", shortName: "Coca-\nCola", price: 8.99, emoji: "🥤" },
      { ean: "7896071013456", name: "Farinha 1kg", shortName: "Farinha\n1kg", price: 3.99, emoji: "🌽" },
    ],
  },
];

const BRAND_ADS: BrandAd[] = [
  {
    id: "ad-parmalat",
    type: "brand",
    slotLabel: "PATROCINADO",
    brandName: "Parmalat",
    tagline: "O sabor da fazenda na sua mesa",
    accentColor: "#1565C0",
    searchRadiusKm: 5,
    variants: [
      { ean: "7891000053508", name: "Leite Integral 1L", shortName: "Integral\n1L", emoji: "🥛" },
      { ean: "7891000053515", name: "Leite Desnatado 1L", shortName: "Desnatado\n1L", emoji: "🥛" },
      { ean: "7891000053522", name: "Zero Lactose 1L", shortName: "Zero\nLactose", emoji: "🥛" },
      { ean: "7891000200032", name: "Leite Semi 1L", shortName: "Semi-\ndesnat.", emoji: "🥛" },
      { ean: "7891000300038", name: "Creme de Leite", shortName: "Creme\n300g", emoji: "🫙" },
      { ean: "7891000400012", name: "Iogurte Natural", shortName: "Iogurte\n170g", emoji: "🍦" },
    ],
  },
];

export const HOME_ADS: Ad[] = [
  STORE_ADS[0],
  STORE_ADS[1],
  BRAND_ADS[0],
];

// Stores that stock each EAN — for brand "Onde encontrar" logic
const EAN_STORE_STOCK: Record<string, StoreNearby[]> = {
  "7891000053508": [
    { storeId: "1", storeName: "Sup. Vivendas", bairro: "Asa Sul · Brasília", distanceKm: 0.8, price: 5.49, isPartner: true },
    { storeId: "2", storeName: "Tatico Supermercados", bairro: "Santa Maria · DF", distanceKm: 1.2, price: 5.29, isPartner: false },
    { storeId: "3", storeName: "Ultrabox", bairro: "Santa Maria · DF", distanceKm: 1.9, price: 4.99, isPartner: true },
    { storeId: "4", storeName: "Superbom", bairro: "Gama · DF", distanceKm: 2.4, price: 5.19, isPartner: false },
  ],
  "7891000053515": [
    { storeId: "3", storeName: "Ultrabox", bairro: "Santa Maria · DF", distanceKm: 1.9, price: 5.49, isPartner: true },
    { storeId: "5", storeName: "Extra Econômico", bairro: "Riacho Fundo · DF", distanceKm: 3.1, price: 5.99, isPartner: false },
  ],
  "7891000053522": [
    { storeId: "1", storeName: "Sup. Vivendas", bairro: "Asa Sul · Brasília", distanceKm: 0.8, price: 6.29, isPartner: true },
  ],
  "7891000200032": [],
  "7891000300038": [
    { storeId: "2", storeName: "Tatico Supermercados", bairro: "Santa Maria · DF", distanceKm: 1.2, price: 3.89, isPartner: false },
    { storeId: "4", storeName: "Superbom", bairro: "Gama · DF", distanceKm: 2.4, price: 3.69, isPartner: false },
  ],
  "7891000400012": [
    { storeId: "1", storeName: "Sup. Vivendas", bairro: "Asa Sul · Brasília", distanceKm: 0.8, price: 4.29, isPartner: true },
    { storeId: "3", storeName: "Ultrabox", bairro: "Santa Maria · DF", distanceKm: 1.9, price: 3.99, isPartner: true },
  ],
};

const NEAREST_FALLBACK: Record<string, StoreNearby> = {
  "7891000200032": {
    storeId: "6",
    storeName: "Ponto Alto",
    bairro: "Recanto das Emas · DF",
    distanceKm: 4.2,
    price: 5.89,
    isPartner: false,
  },
};

export function findStoresForEAN(ean: string, radiusKm: number): {
  inRadius: StoreNearby[];
  nearest: StoreNearby | null;
} {
  const all = EAN_STORE_STOCK[ean] ?? [];
  const inRadius = all
    .filter((s) => s.distanceKm <= radiusKm)
    .sort((a, b) => a.price - b.price);

  if (inRadius.length > 0) return { inRadius, nearest: null };

  const outside = all.sort((a, b) => a.distanceKm - b.distanceKm);
  const nearest = outside[0] ?? NEAREST_FALLBACK[ean] ?? null;
  return { inRadius: [], nearest };
}
