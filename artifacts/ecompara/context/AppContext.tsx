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
} from "@/services/storesService";

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
  rank: number;
  priceUpdates: number;
  verifiedUpdates: number;
}

const MOCK_STORES: Store[] = [
  { id: "1", name: "Supermercado Vivendas", distance: 0.8, address: "Av. Principal, 100", lat: -23.5505, lng: -46.6333, plan: "plus" },
  { id: "2", name: "Tatico Supermercados", distance: 1.2, address: "Rua das Flores, 250", lat: -23.5520, lng: -46.6350, plan: "normal" },
  { id: "3", name: "Ultrabox", distance: 1.9, address: "Rua Comercial, 450", lat: -23.5480, lng: -46.6280, plan: "plus" },
  { id: "4", name: "Superbom", distance: 2.4, address: "Av. do Comércio, 800", lat: -23.5550, lng: -46.6400, plan: "normal" },
  { id: "5", name: "Extra Econômico", distance: 3.1, address: "Av. Principal, 1200", lat: -23.5460, lng: -46.6260, plan: "plus" },
  { id: "6", name: "Ponto Alto", distance: 4.2, address: "Rua do Mercado, 300", lat: -23.5490, lng: -46.6310, plan: "normal" },
];

const MOCK_BANNERS: Banner[] = [
  { id: "b1", storeId: "4", storeName: "Superbom", title: "Segunda e Terça", subtitle: "Filé Mignon com até 40% off!", color: "#CC0000" },
  { id: "b2", storeId: "1", storeName: "Vivendas", title: "Final de Semana", subtitle: "Frutas e Verduras Frescas", color: "#1B5E20" },
  { id: "b3", storeId: "3", storeName: "Ultrabox", title: "Promoção Especial", subtitle: "Produtos de limpeza -30%", color: "#0D47A1" },
];

const MOCK_GAME_LEADERBOARD: GameEntry[] = [
  { userId: "u1", userName: "Carlos Silva", userPhoto: "", points: 4850, rank: 1, priceUpdates: 245, verifiedUpdates: 230 },
  { userId: "u2", userName: "Ana Souza", userPhoto: "", points: 3920, rank: 2, priceUpdates: 198, verifiedUpdates: 185 },
  { userId: "u3", userName: "Pedro Lima", userPhoto: "", points: 3240, rank: 3, priceUpdates: 163, verifiedUpdates: 150 },
  { userId: "u4", userName: "Maria Costa", userPhoto: "", points: 2780, rank: 4, priceUpdates: 140, verifiedUpdates: 128 },
  { userId: "u5", userName: "João Pereira", userPhoto: "", points: 2150, rank: 5, priceUpdates: 108, verifiedUpdates: 95 },
  { userId: "u6", userName: "Lucia Ferreira", userPhoto: "", points: 1870, rank: 6, priceUpdates: 94, verifiedUpdates: 82 },
  { userId: "u7", userName: "Marcos Nunes", userPhoto: "", points: 1560, rank: 7, priceUpdates: 78, verifiedUpdates: 71 },
  { userId: "u8", userName: "Clara Rocha", userPhoto: "", points: 1230, rank: 8, priceUpdates: 62, verifiedUpdates: 55 },
];

export const MOCK_PRODUCTS: Product[] = [
  { ean: "7891000053508", name: "Leite Integral Parmalat 1L", brand: "Parmalat", category: "Laticínios", prices: [
    { storeId: "1", storeName: "Vivendas", price: 5.49, distance: 0.8, updatedAt: "2025-03-13", lat: -23.5505, lng: -46.6333 },
    { storeId: "2", storeName: "Tatico", price: 5.29, distance: 1.2, updatedAt: "2025-03-13", lat: -23.5520, lng: -46.6350 },
    { storeId: "3", storeName: "Ultrabox", price: 4.99, distance: 1.9, updatedAt: "2025-03-12", lat: -23.5480, lng: -46.6280 },
    { storeId: "4", storeName: "Superbom", price: 5.19, distance: 2.4, updatedAt: "2025-03-13", lat: -23.5550, lng: -46.6400 },
  ]},
  { ean: "7891910000197", name: "Arroz Tio João 5kg", brand: "Tio João", category: "Grãos", prices: [
    { storeId: "1", storeName: "Vivendas", price: 24.90, distance: 0.8, updatedAt: "2025-03-13", lat: -23.5505, lng: -46.6333 },
    { storeId: "2", storeName: "Tatico", price: 22.99, distance: 1.2, updatedAt: "2025-03-11", lat: -23.5520, lng: -46.6350 },
    { storeId: "4", storeName: "Superbom", price: 23.50, distance: 2.4, updatedAt: "2025-03-13", lat: -23.5550, lng: -46.6400 },
  ]},
  { ean: "7896045104482", name: "Feijão Carioca Camil 1kg", brand: "Camil", category: "Grãos", prices: [
    { storeId: "1", storeName: "Vivendas", price: 8.99, distance: 0.8, updatedAt: "2025-03-13", lat: -23.5505, lng: -46.6333 },
    { storeId: "3", storeName: "Ultrabox", price: 7.89, distance: 1.9, updatedAt: "2025-03-12", lat: -23.5480, lng: -46.6280 },
    { storeId: "4", storeName: "Superbom", price: 8.49, distance: 2.4, updatedAt: "2025-03-13", lat: -23.5550, lng: -46.6400 },
  ]},
  { ean: "7891000310755", name: "Açúcar Cristal União 1kg", brand: "União", category: "Condimentos", prices: [
    { storeId: "2", storeName: "Tatico", price: 4.89, distance: 1.2, updatedAt: "2025-03-13", lat: -23.5520, lng: -46.6350 },
    { storeId: "3", storeName: "Ultrabox", price: 4.49, distance: 1.9, updatedAt: "2025-03-13", lat: -23.5480, lng: -46.6280 },
    { storeId: "4", storeName: "Superbom", price: 4.79, distance: 2.4, updatedAt: "2025-03-13", lat: -23.5550, lng: -46.6400 },
  ]},
  { ean: "7894900700015", name: "Coca-Cola 2L", brand: "Coca-Cola", category: "Bebidas", prices: [
    { storeId: "1", storeName: "Vivendas", price: 9.99, distance: 0.8, updatedAt: "2025-03-13", lat: -23.5505, lng: -46.6333 },
    { storeId: "2", storeName: "Tatico", price: 8.79, distance: 1.2, updatedAt: "2025-03-12", lat: -23.5520, lng: -46.6350 },
    { storeId: "5", storeName: "Extra Econômico", price: 8.49, distance: 3.1, updatedAt: "2025-03-13", lat: -23.5460, lng: -46.6260 },
  ]},
  { ean: "7896004804009", name: "Óleo Soja Liza 900ml", brand: "Liza", category: "Óleos", prices: [
    { storeId: "1", storeName: "Vivendas", price: 7.49, distance: 0.8, updatedAt: "2025-03-13", lat: -23.5505, lng: -46.6333 },
    { storeId: "3", storeName: "Ultrabox", price: 6.99, distance: 1.9, updatedAt: "2025-03-13", lat: -23.5480, lng: -46.6280 },
    { storeId: "4", storeName: "Superbom", price: 7.19, distance: 2.4, updatedAt: "2025-03-13", lat: -23.5550, lng: -46.6400 },
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
  products: Product[];
  searchProducts: (query: string) => Product[];
  searchProductsAsync: (query: string) => Promise<Product[]>;
  getProductByEAN: (ean: string) => Product | undefined;
  lookupEAN: (ean: string) => Promise<EanLookupResult>;
  addManualProduct: (ean: string, name: string) => void;
  retailerStore: RetailerStore | null;
  updateRetailerProduct: (ean: string, price: number) => void;
  submitPriceUpdate: (ean: string, price: number, storeId: string) => void;
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

  const mockRetailerStore: RetailerStore = {
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

  const [retailerStore, setRetailerStore] = useState<RetailerStore | null>(mockRetailerStore);

  useEffect(() => {
    loadUser();
    loadShoppingList();
  }, []);

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
      const nearbyStores = await fetchNearbyStores(lat, lng, radiusKm);
      if (nearbyStores.length > 0) {
        const mapped: Store[] = nearbyStores.map((s: NearbyStore) => ({
          id: s.googlePlaceId,
          name: s.name,
          distance: s.distanceKm,
          address: s.address ?? "",
          lat: s.lat,
          lng: s.lng,
          plan: s.status === "verified" ? "plus" : "normal",
          googlePlaceId: s.googlePlaceId,
          phone: s.phone ?? undefined,
          website: s.website ?? undefined,
          rating: s.rating ?? undefined,
          status: s.status,
          isPartner: s.status === "verified",
          isShadow: s.status === "shadow",
          photoUrl: s.photoUrl ?? undefined,
        }));
        setStores(mapped);
      }
    } catch {
      // fallback stays as MOCK_STORES
    } finally {
      setStoresLoading(false);
    }
  };

  const submitStoreClaim = async (claim: ClaimRequest): Promise<{ ok: boolean; error?: string }> => {
    return submitPartnershipClaim(claim);
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

  const submitPriceUpdate = (_ean: string, _price: number, _storeId: string, bonusPoints?: number) => {
    if (user) {
      const pts = bonusPoints ?? 10;
      setUserState({
        ...user,
        points: user.points + pts,
        totalPriceUpdates: user.totalPriceUpdates + 1,
      });
    }
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
