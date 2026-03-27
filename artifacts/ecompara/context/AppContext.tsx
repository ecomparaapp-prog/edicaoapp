import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import {
  lookupEAN as cosmosLookupEAN,
  searchProducts as cosmosSearchProducts,
  type EanLookupResult,
  type CosmosProduct,
} from "@/services/cosmosService";
import {
  fetchNearbyStores,
  submitPartnershipClaim,
  type NearbyStore,
  type ClaimRequest,
  type FetchStoresResult,
} from "@/services/storesService";
import { submitPrice } from "@/services/priceService";

export type UserRole = "customer" | "retailer" | null;

export interface User {
  id: string;
  name: string;
  email: string;
  photo: string;
  role: UserRole;
  points: number;
  rank: number;
  totalPriceUpdates: number;
}

export interface ShoppingItem {
  id: string;
  eanCode: string;
  productName: string;
  quantity: number;
  checked: boolean;
  bestPrice?: number;
  bestStore?: string;
}

export interface Product {
  ean: string;
  name: string;
  brand: string;
  category: string;
  image?: string;
  prices: StorePrice[];
}

export interface StorePrice {
  storeId: string;
  storeName: string;
  price: number;
  distance: number;
  updatedAt: string;
  lat: number;
  lng: number;
}

export interface Store {
  id: string;
  name: string;
  logo?: string;
  distance: number;
  address: string;
  lat: number;
  lng: number;
  plan: "normal" | "plus";
  googlePlaceId?: string;
  phone?: string;
  website?: string;
  rating?: number;
  status?: "shadow" | "verified";
  isPartner?: boolean;
  isShadow?: boolean;
  photoUrl?: string;
}

export interface RetailerStore {
  id: string;
  name: string;
  address: string;
  plan: "normal" | "plus";
  subscribers: number;
  campaignBudget: number;
  totalViews: number;
  totalClicks: number;
  products: RetailerProduct[];
}

export interface RetailerProduct {
  ean: string;
  name: string;
  price: number;
  updatedAt: string;
}

export interface Banner {
  id: string;
  storeId: string;
  storeName: string;
  image?: string;
  title: string;
  subtitle: string;
  color: string;
}

export interface GameEntry {
  userId: string;
  userName: string;
  userPhoto: string;
  points: number;
  weeklyPoints: number;
  rank: number;
  level: number;
  priceUpdates: number;
  verifiedUpdates: number;
  region: "brasilia" | "santa-maria";
  title?: string;
}

export interface PointsHistoryEntry {
  id: string;
  action: string;
  points: number;
  date: string;
  icon: string;
  multiplier?: string;
}

export interface DailyMission {
  id: string;
  label: string;
  points: number;
  completed: boolean;
  icon: string;
}

export interface FinalizedList {
  id: string;
  storeId: string;
  storeName: string;
  isPartner: boolean;
  totalItems: number;
  checkedItems: number;
  durationSeconds: number;
  points: number;
  status: "full" | "partial" | "fraud";
  timestamp: string;
}

export interface NFCeEntry {
  id: string;
  chNFe: string;
  storeId: string;
  storeName: string;
  storeCNPJ: string;
  items: { ean: string; name: string; price: number }[];
  points: number;
  timestamp: string;
  isDuplicate: boolean;
}

const MOCK_STORES: Store[] = [
  { id: "1", name: "Tatico Supermercados", distance: 0.6, address: "QR 205 Conj 1 Lote 1, Santa Maria", lat: -15.8620, lng: -47.9975, plan: "plus", status: "verified", isPartner: true, isShadow: false, phone: "(61) 3902-1234", website: "https://tatico.com.br" },
  { id: "2", name: "Comper Supermercado", distance: 1.1, address: "EQN 205/206, Santa Maria", lat: -15.8645, lng: -47.9955, plan: "normal", status: "shadow", isShadow: true },
  { id: "3", name: "Supermercado São Paulo", distance: 1.7, address: "QR 307 Conj A, Santa Maria", lat: -15.8660, lng: -47.9940, plan: "plus", status: "shadow", isShadow: true },
  { id: "4", name: "Atacadão Santa Maria", distance: 2.3, address: "DF-001 Km 12, Santa Maria", lat: -15.8610, lng: -47.9930, plan: "normal", status: "shadow", isShadow: true },
  { id: "5", name: "Baratão Supermercados", distance: 3.0, address: "QR 102 Conj B, Santa Maria", lat: -15.8680, lng: -47.9985, plan: "normal", status: "shadow", isShadow: true },
  { id: "6", name: "Assaí Atacadista", distance: 3.8, address: "BR-040, Santa Maria Norte", lat: -15.8590, lng: -47.9920, plan: "plus", status: "shadow", isShadow: true },
];

const MOCK_BANNERS: Banner[] = [
  { id: "b1", storeId: "4", storeName: "Atacadão Santa Maria", title: "Segunda e Terça", subtitle: "Filé Mignon com até 40% off!", color: "#CC0000" },
  { id: "b2", storeId: "1", storeName: "Tatico Supermercados", title: "Final de Semana", subtitle: "Frutas e Verduras Frescas", color: "#1B5E20" },
  { id: "b3", storeId: "6", storeName: "Assaí Atacadista", title: "Promoção Especial", subtitle: "Produtos de limpeza -30%", color: "#0D47A1" },
];

const MOCK_GAME_LEADERBOARD: GameEntry[] = [
  { userId: "u1", userName: "Carlos Silva", userPhoto: "", points: 14850, weeklyPoints: 4850, rank: 1, level: 42, priceUpdates: 245, verifiedUpdates: 230, region: "brasilia", title: "Rei do Bairro" },
  { userId: "u2", userName: "Ana Souza", userPhoto: "", points: 11920, weeklyPoints: 3920, rank: 2, level: 38, priceUpdates: 198, verifiedUpdates: 185, region: "brasilia" },
  { userId: "u3", userName: "Pedro Lima", userPhoto: "", points: 9240, weeklyPoints: 3240, rank: 3, level: 35, priceUpdates: 163, verifiedUpdates: 150, region: "brasilia" },
  { userId: "u4", userName: "Maria Costa", userPhoto: "", points: 7780, weeklyPoints: 2780, rank: 4, level: 28, priceUpdates: 140, verifiedUpdates: 128, region: "brasilia" },
  { userId: "u5", userName: "João Pereira", userPhoto: "", points: 6150, weeklyPoints: 2150, rank: 5, level: 22, priceUpdates: 108, verifiedUpdates: 95, region: "brasilia" },
  { userId: "u6", userName: "Lucia Ferreira", userPhoto: "", points: 4870, weeklyPoints: 1870, rank: 6, level: 17, priceUpdates: 94, verifiedUpdates: 82, region: "brasilia" },
  { userId: "u7", userName: "Marcos Nunes", userPhoto: "", points: 3560, weeklyPoints: 1560, rank: 7, level: 14, priceUpdates: 78, verifiedUpdates: 71, region: "brasilia" },
  { userId: "u8", userName: "Clara Rocha", userPhoto: "", points: 2230, weeklyPoints: 1230, rank: 8, level: 9, priceUpdates: 62, verifiedUpdates: 55, region: "brasilia" },
  { userId: "u9", userName: "Tiago Alves", userPhoto: "", points: 1580, weeklyPoints: 980, rank: 9, level: 7, priceUpdates: 48, verifiedUpdates: 40, region: "brasilia" },
  { userId: "u10", userName: "Beatriz Melo", userPhoto: "", points: 890, weeklyPoints: 640, rank: 10, level: 4, priceUpdates: 32, verifiedUpdates: 28, region: "brasilia" },
  { userId: "sm1", userName: "Roberto Dias", userPhoto: "", points: 8200, weeklyPoints: 2100, rank: 1, level: 31, priceUpdates: 180, verifiedUpdates: 170, region: "santa-maria", title: "Rei do Bairro" },
  { userId: "sm2", userName: "Fernanda Gomes", userPhoto: "", points: 6100, weeklyPoints: 1850, rank: 2, level: 25, priceUpdates: 130, verifiedUpdates: 120, region: "santa-maria" },
  { userId: "sm3", userName: "Rafael Sena", userPhoto: "", points: 4300, weeklyPoints: 1200, rank: 3, level: 19, priceUpdates: 95, verifiedUpdates: 88, region: "santa-maria" },
  { userId: "sm4", userName: "Camila Borges", userPhoto: "", points: 3100, weeklyPoints: 870, rank: 4, level: 12, priceUpdates: 72, verifiedUpdates: 65, region: "santa-maria" },
  { userId: "sm5", userName: "Lucas Prado", userPhoto: "", points: 1950, weeklyPoints: 520, rank: 5, level: 8, priceUpdates: 45, verifiedUpdates: 38, region: "santa-maria" },
];

const MOCK_POINTS_HISTORY: PointsHistoryEntry[] = [
  { id: "h1", action: "Cadastrar Cupom (NFC-e)", points: 300, date: "Hoje, 14:32", icon: "file-text", multiplier: "2x XP (>10 itens)" },
  { id: "h2", action: "Confirmar Preço", points: 15, date: "Hoje, 13:10", icon: "check-circle" },
  { id: "h3", action: "Confirmar Preço", points: 15, date: "Hoje, 13:08", icon: "check-circle" },
  { id: "h4", action: "Combo Diário (Streak)", points: 50, date: "Hoje, 08:00", icon: "zap" },
  { id: "h5", action: "Cadastrar Produto (Individual)", points: 50, date: "Ontem, 17:45", icon: "package" },
  { id: "h6", action: "Favoritar Mercado", points: 20, date: "Ontem, 16:20", icon: "heart" },
  { id: "h7", action: "Finalizar Lista no Local", points: 300, date: "Ontem, 12:05", icon: "map-pin", multiplier: "+100 pts (parceiro)" },
  { id: "h8", action: "Cadastrar Cupom (NFC-e)", points: 150, date: "Ontem, 10:30", icon: "file-text" },
  { id: "h9", action: "Confirmar Preço", points: 10, date: "Seg, 19:22", icon: "check-circle" },
  { id: "h10", action: "Finalizar Cadastro", points: 250, date: "Seg, 09:00", icon: "user-check" },
];

const MOCK_DAILY_MISSIONS: DailyMission[] = [
  { id: "m1", label: "Favoritar 1 mercado hoje", points: 20, completed: true, icon: "heart" },
  { id: "m2", label: "Confirmar 3 preços", points: 30, completed: false, icon: "check-circle" },
  { id: "m3", label: "Cadastrar 1 cupom NFC-e", points: 150, completed: false, icon: "file-text" },
  { id: "m4", label: "Buscar 1 produto", points: 10, completed: true, icon: "search" },
  { id: "m5", label: "Login diário (Streak)", points: 50, completed: true, icon: "zap" },
];

export const MOCK_PRODUCTS: Product[] = [
  { ean: "7891000053508", name: "Leite Integral Parmalat 1L", brand: "Parmalat", category: "Laticínios", prices: [
    { storeId: "1", storeName: "Tatico", price: 5.49, distance: 0.6, updatedAt: "2026-03-25", lat: -15.8620, lng: -47.9975 },
    { storeId: "2", storeName: "Comper", price: 5.29, distance: 1.1, updatedAt: "2026-03-25", lat: -15.8645, lng: -47.9955 },
    { storeId: "3", storeName: "Sup. São Paulo", price: 4.99, distance: 1.7, updatedAt: "2026-03-24", lat: -15.8660, lng: -47.9940 },
    { storeId: "4", storeName: "Atacadão", price: 4.79, distance: 2.3, updatedAt: "2026-03-25", lat: -15.8610, lng: -47.9930 },
  ]},
  { ean: "7891910000197", name: "Arroz Tio João 5kg", brand: "Tio João", category: "Grãos", prices: [
    { storeId: "1", storeName: "Tatico", price: 24.90, distance: 0.6, updatedAt: "2026-03-25", lat: -15.8620, lng: -47.9975 },
    { storeId: "2", storeName: "Comper", price: 22.99, distance: 1.1, updatedAt: "2026-03-23", lat: -15.8645, lng: -47.9955 },
    { storeId: "6", storeName: "Assaí", price: 21.50, distance: 3.8, updatedAt: "2026-03-25", lat: -15.8590, lng: -47.9920 },
  ]},
  { ean: "7896045104482", name: "Feijão Carioca Camil 1kg", brand: "Camil", category: "Grãos", prices: [
    { storeId: "1", storeName: "Tatico", price: 8.99, distance: 0.6, updatedAt: "2026-03-25", lat: -15.8620, lng: -47.9975 },
    { storeId: "3", storeName: "Sup. São Paulo", price: 7.89, distance: 1.7, updatedAt: "2026-03-24", lat: -15.8660, lng: -47.9940 },
    { storeId: "4", storeName: "Atacadão", price: 7.49, distance: 2.3, updatedAt: "2026-03-25", lat: -15.8610, lng: -47.9930 },
  ]},
  { ean: "7891000310755", name: "Açúcar Cristal União 1kg", brand: "União", category: "Condimentos", prices: [
    { storeId: "2", storeName: "Comper", price: 4.89, distance: 1.1, updatedAt: "2026-03-25", lat: -15.8645, lng: -47.9955 },
    { storeId: "3", storeName: "Sup. São Paulo", price: 4.49, distance: 1.7, updatedAt: "2026-03-25", lat: -15.8660, lng: -47.9940 },
    { storeId: "6", storeName: "Assaí", price: 3.99, distance: 3.8, updatedAt: "2026-03-25", lat: -15.8590, lng: -47.9920 },
  ]},
  { ean: "7894900700015", name: "Coca-Cola 2L", brand: "Coca-Cola", category: "Bebidas", prices: [
    { storeId: "1", storeName: "Tatico", price: 9.99, distance: 0.6, updatedAt: "2026-03-25", lat: -15.8620, lng: -47.9975 },
    { storeId: "2", storeName: "Comper", price: 8.79, distance: 1.1, updatedAt: "2026-03-24", lat: -15.8645, lng: -47.9955 },
    { storeId: "5", storeName: "Baratão", price: 8.49, distance: 3.0, updatedAt: "2026-03-25", lat: -15.8680, lng: -47.9985 },
  ]},
  { ean: "7896004804009", name: "Óleo Soja Liza 900ml", brand: "Liza", category: "Óleos", prices: [
    { storeId: "1", storeName: "Tatico", price: 7.49, distance: 0.6, updatedAt: "2026-03-25", lat: -15.8620, lng: -47.9975 },
    { storeId: "3", storeName: "Sup. São Paulo", price: 6.99, distance: 1.7, updatedAt: "2026-03-25", lat: -15.8660, lng: -47.9940 },
    { storeId: "6", storeName: "Assaí", price: 6.49, distance: 3.8, updatedAt: "2026-03-25", lat: -15.8590, lng: -47.9920 },
  ]},
];

type AppContextType = {
  user: User | null;
  setUser: (user: User | null) => void;
  isLoggedIn: boolean;
  shoppingList: ShoppingItem[];
  addToShoppingList: (item: Omit<ShoppingItem, "id">) => void;
  removeFromShoppingList: (id: string) => void;
  toggleShoppingItem: (id: string) => void;
  clearShoppingList: () => void;
  stores: Store[];
  storesLoading: boolean;
  loadNearbyStores: (lat: number, lng: number, radiusKm?: number) => Promise<void>;
  submitStoreClaim: (claim: ClaimRequest) => Promise<{ ok: boolean; error?: string }>;
  banners: Banner[];
  leaderboard: GameEntry[];
  pointsHistory: PointsHistoryEntry[];
  dailyMissions: DailyMission[];
  streak: number;
  finalizedLists: FinalizedList[];
  processedNFCe: NFCeEntry[];
  seenChNFe: Set<string>;
  finalizeShoppingList: (storeId: string, storeName: string, isPartner: boolean, durationSeconds: number, totalItems: number, checkedItems: number) => { points: number; status: "full" | "partial" | "fraud" };
  processNFCe: (chNFe: string, storeId: string, storeName: string, storeCNPJ: string, items: { ean: string; name: string; price: number }[]) => { ok: boolean; duplicate: boolean; points: number };
  products: Product[];
  searchProducts: (query: string) => Product[];
  searchProductsAsync: (query: string) => Promise<Product[]>;
  getProductByEAN: (ean: string) => Product | undefined;
  lookupEAN: (ean: string) => Promise<EanLookupResult>;
  addManualProduct: (ean: string, name: string) => void;
  retailerStore: RetailerStore | null;
  updateRetailerProduct: (ean: string, price: number) => void;
  submitPriceUpdate: (ean: string, price: number, placeId: string, bonusPoints?: number) => Promise<{ ok: boolean; reportId?: number; bonusPoints?: number; error?: string }>;
  userRadius: number;
  activeTab: "customer" | "retailer";
  setActiveTab: (tab: "customer" | "retailer") => void;
};

const AppContext = createContext<AppContextType | null>(null);

export function useApp(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);
  const [activeTab, setActiveTab] = useState<"customer" | "retailer">("customer");
  const [cosmosCache, setCosmosCache] = useState<Record<string, Product>>({});
  const [stores, setStores] = useState<Store[]>(MOCK_STORES);
  const [storesLoading, setStoresLoading] = useState(false);

  const MOCK_RETAILER_STORE: RetailerStore = {
    id: "r1",
    name: "Supermercado Demo",
    address: "Rua Principal, 123",
    plan: "plus",
    subscribers: 1240,
    campaignBudget: 500,
    totalViews: 48500,
    totalClicks: 3200,
    products: [
      { ean: "7891000053508", name: "Leite Parmalat 1L", price: 5.49, updatedAt: "2025-03-13" },
      { ean: "7891910000197", name: "Arroz Tio João 5kg", price: 24.90, updatedAt: "2025-03-13" },
      { ean: "7894900700015", name: "Coca-Cola 2L", price: 9.99, updatedAt: "2025-03-12" },
      { ean: "7896045104482", name: "Feijão Camil 1kg", price: 8.99, updatedAt: "2025-03-11" },
      { ean: "7891000310755", name: "Açúcar União 1kg", price: 4.89, updatedAt: "2025-03-10" },
    ],
  };

  // retailerStore is ONLY populated when the logged-in user has role === "retailer".
  // Customers always receive null — no retailer data is ever exposed to them.
  const [retailerStore, setRetailerStore] = useState<RetailerStore | null>(null);
  const [finalizedLists, setFinalizedLists] = useState<FinalizedList[]>([
    { id: "fl1", storeId: "1", storeName: "Supermercado Vivendas", isPartner: true, totalItems: 8, checkedItems: 8, durationSeconds: 720, points: 300, status: "full", timestamp: "Ontem, 11:32" },
    { id: "fl2", storeId: "2", storeName: "Tatico Supermercados", isPartner: false, totalItems: 5, checkedItems: 4, durationSeconds: 380, points: 200, status: "full", timestamp: "Seg, 14:10" },
  ]);
  const [processedNFCe, setProcessedNFCe] = useState<NFCeEntry[]>([
    { id: "nf1", chNFe: "35250300000001234560014050012345678901234567", storeId: "2", storeName: "Tatico Supermercados", storeCNPJ: "00.000.001/0001-01", items: [{ ean: "7891000053508", name: "Leite Parmalat 1L", price: 4.89 }, { ean: "7891910000197", name: "Arroz Tio João 5kg", price: 21.90 }, { ean: "7894900700015", name: "Coca-Cola 2L", price: 8.49 }], points: 150, timestamp: "Ontem, 15:21", isDuplicate: false },
  ]);
  const [seenChNFe, setSeenChNFe] = useState<Set<string>>(new Set(["35250300000001234560014050012345678901234567"]));

  useEffect(() => {
    loadUser();
    loadShoppingList();
  }, []);

  // Security gate: retailerStore is ONLY populated for users with role === "retailer".
  // Any other role (customer, null) always gets null — no leakage of merchant data.
  useEffect(() => {
    if (user?.role === "retailer") {
      setRetailerStore(MOCK_RETAILER_STORE);
    } else {
      setRetailerStore(null);
    }
  }, [user]);

  const loadUser = async () => {
    try {
      const stored = await AsyncStorage.getItem("@ecompara_user");
      if (stored) setUserState(JSON.parse(stored));
    } catch {}
  };

  const loadShoppingList = async () => {
    try {
      const stored = await AsyncStorage.getItem("@ecompara_shopping_list");
      if (stored) setShoppingList(JSON.parse(stored));
    } catch {}
  };

  const setUser = async (newUser: User | null) => {
    setUserState(newUser);
    if (newUser) {
      await AsyncStorage.setItem("@ecompara_user", JSON.stringify(newUser));
    } else {
      await AsyncStorage.removeItem("@ecompara_user");
    }
  };

  const addToShoppingList = async (item: Omit<ShoppingItem, "id">) => {
    const newItem: ShoppingItem = {
      ...item,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    };
    const updated = [...shoppingList, newItem];
    setShoppingList(updated);
    await AsyncStorage.setItem("@ecompara_shopping_list", JSON.stringify(updated));
  };

  const removeFromShoppingList = async (id: string) => {
    const updated = shoppingList.filter((i) => i.id !== id);
    setShoppingList(updated);
    await AsyncStorage.setItem("@ecompara_shopping_list", JSON.stringify(updated));
  };

  const toggleShoppingItem = async (id: string) => {
    const updated = shoppingList.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i));
    setShoppingList(updated);
    await AsyncStorage.setItem("@ecompara_shopping_list", JSON.stringify(updated));
  };

  const clearShoppingList = async () => {
    setShoppingList([]);
    await AsyncStorage.removeItem("@ecompara_shopping_list");
  };

  const searchProducts = (query: string): Product[] => {
    // Merge MOCK_PRODUCTS with Cosmos-discovered products (cosmosCache takes precedence by EAN)
    const cosmosValues = Object.values(cosmosCache);
    const cosmosEans = new Set(cosmosValues.map((p) => p.ean));
    const allProducts = [...cosmosValues, ...MOCK_PRODUCTS.filter((p) => !cosmosEans.has(p.ean))];
    if (!query.trim()) return allProducts;
    const q = query.toLowerCase();
    return allProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.ean.includes(q)
    );
  };

  const searchProductsAsync = async (query: string): Promise<Product[]> => {
    const localResults = searchProducts(query);

    try {
      const cosmosResults = await cosmosSearchProducts(query);
      const localEans = new Set(localResults.map((p) => p.ean));
      const cosmosAsProducts: Product[] = cosmosResults
        .filter((c) => !localEans.has(c.ean))
        .map((c) => ({
          ean: c.ean,
          name: c.description,
          brand: c.brand || "—",
          category: c.category || "Outros",
          image: c.thumbnailUrl || undefined,
          prices: [],
        }));

      return [...localResults, ...cosmosAsProducts];
    } catch {
      return localResults;
    }
  };

  const getProductByEAN = (ean: string): Product | undefined => {
    // Cosmos-discovered products take precedence over mock data
    return cosmosCache[ean] ?? MOCK_PRODUCTS.find((p) => p.ean === ean);
  };

  const updateRetailerProduct = (ean: string, price: number) => {
    if (!retailerStore) return;
    const updated = retailerStore.products.map((p) =>
      p.ean === ean ? { ...p, price, updatedAt: new Date().toISOString().slice(0, 10) } : p
    );
    setRetailerStore({ ...retailerStore, products: updated });
  };

  const lookupEAN = async (ean: string): Promise<EanLookupResult> => {
    const result = await cosmosLookupEAN(ean);
    // Store found products in cosmosCache so getProductByEAN can use them
    if (result.found && result.product) {
      const p = result.product;
      setCosmosCache((prev) => ({
        ...prev,
        [ean]: {
          ean,
          name: p.description,
          brand: p.brand || "—",
          category: p.category || "Outros",
          image: p.thumbnailUrl || undefined,
          // Preserve existing prices if we already have a mock entry
          prices: MOCK_PRODUCTS.find((m) => m.ean === ean)?.prices ?? [],
        },
      }));
    }
    return result;
  };

  const loadNearbyStores = async (lat: number, lng: number, radiusKm = 10): Promise<void> => {
    setStoresLoading(true);
    try {
      const result: FetchStoresResult = await fetchNearbyStores(lat, lng, radiusKm);
      if (result.success && result.stores.length > 0) {
        const mapped: Store[] = result.stores.map((s: NearbyStore) => ({
          id: s.googlePlaceId,
          name: s.name,
          distance: s.distanceKm,
          address: s.address ?? "",
          lat: Number(s.lat),
          lng: Number(s.lng),
          plan: s.status === "verified" ? "plus" : "normal",
          googlePlaceId: s.googlePlaceId,
          phone: s.phone ?? undefined,
          website: s.website ?? undefined,
          rating: s.rating ?? undefined,
          status: s.status,
          isPartner: s.is_partner,
          isShadow: s.is_shadow,
          photoUrl: s.photoUrl ?? undefined,
        }));
        setStores(mapped);
      }
      // If success but 0 results (cache miss + Places API call in progress on server),
      // keep MOCK_STORES so the user always sees something.
    } catch {
      // fallback stays as MOCK_STORES on network failure
    } finally {
      setStoresLoading(false);
    }
  };

  const submitStoreClaim = async (claim: ClaimRequest): Promise<{ ok: boolean; error?: string }> => {
    return submitPartnershipClaim(claim);
  };

  const finalizeShoppingList = (
    storeId: string, storeName: string, isPartner: boolean,
    durationSeconds: number, totalItems: number, checkedItems: number
  ): { points: number; status: "full" | "partial" | "fraud" } => {
    let points = 0;
    let status: "full" | "partial" | "fraud";
    if (durationSeconds < 60 && totalItems >= 5) {
      status = "fraud";
      points = 10;
    } else if (durationSeconds < 300) {
      status = "partial";
      points = 50;
    } else {
      status = "full";
      points = 200 + (isPartner ? 100 : 0);
    }
    const entry: FinalizedList = {
      id: Date.now().toString(),
      storeId, storeName, isPartner,
      totalItems, checkedItems, durationSeconds,
      points, status,
      timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) + " hoje",
    };
    setFinalizedLists((prev) => [entry, ...prev]);
    if (user) {
      setUserState({ ...user, points: user.points + points, totalPriceUpdates: user.totalPriceUpdates + 1 });
    }
    return { points, status };
  };

  const processNFCe = (
    chNFe: string, storeId: string, storeName: string, storeCNPJ: string,
    items: { ean: string; name: string; price: number }[]
  ): { ok: boolean; duplicate: boolean; points: number } => {
    if (seenChNFe.has(chNFe)) {
      return { ok: false, duplicate: true, points: 0 };
    }
    const now = new Date();
    const isWeekend = now.getDay() === 0 || now.getDay() === 6;
    const basePoints = 150;
    const multiplier = items.length > 10 ? 2 : isWeekend ? 1.2 : 1;
    const points = Math.round(basePoints * multiplier);
    const entry: NFCeEntry = {
      id: Date.now().toString(),
      chNFe, storeId, storeName, storeCNPJ, items, points,
      timestamp: now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) + " hoje",
      isDuplicate: false,
    };
    setSeenChNFe((prev) => new Set([...prev, chNFe]));
    setProcessedNFCe((prev) => [entry, ...prev]);
    if (user) {
      setUserState({ ...user, points: user.points + points });
    }
    return { ok: true, duplicate: false, points };
  };

  const addManualProduct = (ean: string, name: string) => {
    const exists = MOCK_PRODUCTS.find((p) => p.ean === ean);
    if (!exists) {
      MOCK_PRODUCTS.push({
        ean,
        name,
        brand: "Manual",
        category: "Outros",
        prices: [],
      });
    }
    submitPriceUpdate(ean, 0, "", 50);
  };

  const submitPriceUpdate = async (ean: string, price: number, placeId: string, bonusPoints?: number) => {
    if (user && ean && price > 0 && placeId) {
      const result = await submitPrice(ean, placeId, user.id, price);
      const pts = result.ok ? (result.bonusPoints ?? bonusPoints ?? 10) : (bonusPoints ?? 10);
      setUserState({
        ...user,
        points: user.points + pts,
        totalPriceUpdates: user.totalPriceUpdates + 1,
      });
      return result;
    }
    // fallback: still award points locally
    if (user) {
      const pts = bonusPoints ?? 10;
      setUserState({ ...user, points: user.points + pts, totalPriceUpdates: user.totalPriceUpdates + 1 });
    }
    return { ok: false };
  };

  return (
    <AppContext.Provider
      value={{
        user,
        setUser,
        isLoggedIn: !!user,
        shoppingList,
        addToShoppingList,
        removeFromShoppingList,
        toggleShoppingItem,
        clearShoppingList,
        stores,
        storesLoading,
        loadNearbyStores,
        submitStoreClaim,
        banners: MOCK_BANNERS,
        leaderboard: MOCK_GAME_LEADERBOARD,
        pointsHistory: MOCK_POINTS_HISTORY,
        dailyMissions: MOCK_DAILY_MISSIONS,
        streak: 5,
        finalizedLists,
        processedNFCe,
        seenChNFe,
        finalizeShoppingList,
        processNFCe,
        products: (() => {
          const cosmosValues = Object.values(cosmosCache);
          const cosmosEans = new Set(cosmosValues.map((p) => p.ean));
          return [...cosmosValues, ...MOCK_PRODUCTS.filter((p) => !cosmosEans.has(p.ean))];
        })(),
        searchProducts,
        searchProductsAsync,
        getProductByEAN,
        lookupEAN,
        addManualProduct,
        retailerStore,
        updateRetailerProduct,
        submitPriceUpdate,
        userRadius: 5,
        activeTab,
        setActiveTab,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
