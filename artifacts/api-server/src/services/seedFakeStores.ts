import { pool } from "@workspace/db";
import bcrypt from "bcryptjs";

// ── Produtos reais do mercado brasileiro ─────────────────────────────────────
const PRODUCTS = [
  { ean: "7891000100103", name: "Arroz Branco Tipo 1 5kg",        brand: "Tio João",    category: "Cereais",      basePrice: 22.90 },
  { ean: "7896336010058", name: "Feijão Carioca 1kg",             brand: "Camil",       category: "Grãos",        basePrice: 6.90  },
  { ean: "7891910000197", name: "Açúcar Cristal 5kg",             brand: "União",       category: "Açúcar",       basePrice: 18.90 },
  { ean: "7891107101621", name: "Óleo de Soja 900ml",             brand: "Soya",        category: "Óleos",        basePrice: 7.90  },
  { ean: "7896656800018", name: "Leite Integral UHT 1L",          brand: "Italac",      category: "Laticínios",   basePrice: 4.90  },
  { ean: "7622210951038", name: "Biscoito Recheado 130g",         brand: "Oreo",        category: "Biscoitos",    basePrice: 3.49  },
  { ean: "7891187003023", name: "Café Torrado Moído 500g",        brand: "Pilão",       category: "Cafés",        basePrice: 19.90 },
  { ean: "7896005300010", name: "Macarrão Espaguete 500g",        brand: "Barilla",     category: "Massas",       basePrice: 4.29  },
  { ean: "7896084200015", name: "Sal Refinado Iodado 1kg",        brand: "Cisne",       category: "Temperos",     basePrice: 2.49  },
  { ean: "7896036090528", name: "Molho de Tomate 300g",           brand: "Pomarola",    category: "Molhos",       basePrice: 3.79  },
  { ean: "7894900011524", name: "Refrigerante Cola 2L",           brand: "Coca-Cola",   category: "Bebidas",      basePrice: 8.90  },
  { ean: "7891991011771", name: "Cerveja Pilsen Lata 350ml",      brand: "Skol",        category: "Bebidas",      basePrice: 3.29  },
  { ean: "7896024010022", name: "Frango Inteiro Congelado 1kg",   brand: "Sadia",       category: "Carnes",       basePrice: 9.90  },
  { ean: "7898907401013", name: "Carne Moída Bovina 500g",        brand: "Friboi",      category: "Carnes",       basePrice: 14.90 },
  { ean: "7896085008018", name: "Presunto Cozido Fatiado 200g",   brand: "Perdigão",    category: "Frios",        basePrice: 8.90  },
  { ean: "7898215152330", name: "Queijo Mussarela Fatiado 200g",  brand: "Tirolez",     category: "Frios",        basePrice: 11.90 },
  { ean: "7891515901148", name: "Manteiga com Sal 200g",          brand: "Aviação",     category: "Laticínios",   basePrice: 9.90  },
  { ean: "7891025000250", name: "Iogurte Natural Integral 170g",  brand: "Danone",      category: "Laticínios",   basePrice: 2.99  },
  { ean: "7891152516545", name: "Margarina Cremosa 500g",         brand: "Qualy",       category: "Laticínios",   basePrice: 7.49  },
  { ean: "7896183001469", name: "Farinha de Trigo Especial 1kg",  brand: "Dona Benta",  category: "Farinhas",     basePrice: 4.79  },
];

// Volume de vendas por produto (pesos para Curva ABC)
// Produtos A (alto giro): arroz, feijão, leite, refrigerante, frango, café
// Produtos B (médio giro): açúcar, óleo, macarrão, cerveja, carne moída, margarina
// Produtos C (baixo giro): biscoito, sal, molho, presunto, queijo, manteiga, iogurte, farinha
const PRODUCT_WEIGHTS: Record<string, number> = {
  "7891000100103": 18, // Arroz        — A
  "7896336010058": 15, // Feijão       — A
  "7896656800018": 14, // Leite        — A
  "7894900011524": 12, // Refrigerante — A
  "7896024010022": 11, // Frango       — A
  "7891187003023": 10, // Café         — A
  "7891910000197":  7, // Açúcar       — B
  "7891107101621":  6, // Óleo         — B
  "7896005300010":  5, // Macarrão     — B
  "7891991011771":  5, // Cerveja      — B
  "7898907401013":  4, // Carne moída  — B
  "7891152516545":  4, // Margarina    — B
  "7622210951038":  2, // Biscoito     — C
  "7896084200015":  2, // Sal          — C
  "7896036090528":  2, // Molho        — C
  "7896085008018":  1, // Presunto     — C
  "7898215152330":  1, // Queijo       — C
  "7891515901148":  1, // Manteiga     — C
  "7891025000250":  1, // Iogurte      — C
  "7896183001469":  1, // Farinha      — C
};

// ── 8 Supermercados fictícios no DF ──────────────────────────────────────────
const FAKE_STORES = [
  {
    placeId:      "fake_brasbom_taguatinga",
    cnpj:         "11111111000101",
    nomeFantasia: "BrasBom Taguatinga",
    razaoSocial:  "BrasBom Comércio Ltda",
    ownerName:    "Roberto Alves",
    address:      "QS 7, Rua 600, Taguatinga, Brasília - DF",
    lat:          -15.8290, lng: -48.0530,
    priceMultiplier: 1.02,
    plan: "plus",
  },
  {
    placeId:      "fake_hiper_ceilandia",
    cnpj:         "22222222000102",
    nomeFantasia: "Hiper Ceilândia",
    razaoSocial:  "Distribuidora Hiper DF Ltda",
    ownerName:    "Fernanda Souza",
    address:      "QNM 13, Módulo H, Ceilândia Norte, Brasília - DF",
    lat:          -15.8144, lng: -48.1048,
    priceMultiplier: 0.97,
    plan: "normal",
  },
  {
    placeId:      "fake_aguas_vivas",
    cnpj:         "33333333000103",
    nomeFantasia: "Mercado Águas Vivas",
    razaoSocial:  "Águas Vivas Supermercados Eireli",
    ownerName:    "Marcos Lima",
    address:      "Av. Castanheiras 1200, Águas Claras, Brasília - DF",
    lat:          -15.8386, lng: -48.0268,
    priceMultiplier: 1.05,
    plan: "plus",
  },
  {
    placeId:      "fake_super_piloto",
    cnpj:         "44444444000104",
    nomeFantasia: "Super Piloto 208",
    razaoSocial:  "Comercial Piloto 208 Ltda",
    ownerName:    "Célia Rocha",
    address:      "CLN 208, Bloco B, Asa Norte, Brasília - DF",
    lat:          -15.7942, lng: -47.8825,
    priceMultiplier: 1.08,
    plan: "normal",
  },
  {
    placeId:      "fake_samambaia_hiper",
    cnpj:         "55555555000105",
    nomeFantasia: "Samambaia Hiper",
    razaoSocial:  "Samambaia Atacarejo Ltda",
    ownerName:    "Paulo Mendes",
    address:      "QS Samambaia Norte 312, Samambaia, Brasília - DF",
    lat:          -15.8746, lng: -48.0822,
    priceMultiplier: 0.95,
    plan: "normal",
  },
  {
    placeId:      "fake_gama_super",
    cnpj:         "66666666000106",
    nomeFantasia: "Gama Super",
    razaoSocial:  "Gama Supermercados ME",
    ownerName:    "Joana Ferreira",
    address:      "Setor Central, Gama, Brasília - DF",
    lat:          -16.0143, lng: -48.0657,
    priceMultiplier: 0.99,
    plan: "normal",
  },
  {
    placeId:      "fake_mercadao_sobradinho",
    cnpj:         "77777777000107",
    nomeFantasia: "Mercadão Sobradinho",
    razaoSocial:  "Sobradinho Varejo Ltda",
    ownerName:    "André Costa",
    address:      "QR 10, Conjunto 5, Sobradinho, Brasília - DF",
    lat:          -15.6530, lng: -47.7916,
    priceMultiplier: 1.03,
    plan: "plus",
  },
  {
    placeId:      "fake_guara_express",
    cnpj:         "88888888000108",
    nomeFantasia: "Guará Express",
    razaoSocial:  "Express Alimentos do Guará Ltda",
    ownerName:    "Silvia Nunes",
    address:      "QE 40, Área Especial, Guará II, Brasília - DF",
    lat:          -15.8183, lng: -47.9864,
    priceMultiplier: 1.01,
    plan: "normal",
  },
];

// ── 15 Clientes fictícios ─────────────────────────────────────────────────────
const FAKE_USERS = [
  { userId: "fake_user_001", nickname: "ana_df",       fullName: "Ana Lima" },
  { userId: "fake_user_002", nickname: "carlos_bsb",   fullName: "Carlos Oliveira" },
  { userId: "fake_user_003", nickname: "fernanda_tag", fullName: "Fernanda Santos" },
  { userId: "fake_user_004", nickname: "joao_ceilandia",fullName: "João Carvalho" },
  { userId: "fake_user_005", nickname: "marina_guara", fullName: "Marina Costa" },
  { userId: "fake_user_006", nickname: "roberto_gama", fullName: "Roberto Almeida" },
  { userId: "fake_user_007", nickname: "patricia_asa", fullName: "Patrícia Rocha" },
  { userId: "fake_user_008", nickname: "marcos_norte", fullName: "Marcos Ferreira" },
  { userId: "fake_user_009", nickname: "juliana_sul",  fullName: "Juliana Mendes" },
  { userId: "fake_user_010", nickname: "lucas_aguas",  fullName: "Lucas Pereira" },
  { userId: "fake_user_011", nickname: "beatriz_df",   fullName: "Beatriz Sousa" },
  { userId: "fake_user_012", nickname: "thiago_sob",   fullName: "Thiago Nunes" },
  { userId: "fake_user_013", nickname: "camila_sam",   fullName: "Camila Vieira" },
  { userId: "fake_user_014", nickname: "eduardo_gua",  fullName: "Eduardo Lima" },
  { userId: "fake_user_015", nickname: "leticia_pil",  fullName: "Letícia Dias" },
];

function randBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function roundPrice(p: number): number {
  return Math.round(p * 100) / 100;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function randomChaveAcesso(cnpj: string, seq: number): string {
  const pad = (s: string | number, len: number) => String(s).padStart(len, "0");
  const uf = "53"; // DF
  const aamm = "2603"; // Março 2026
  return `${uf}${aamm}${pad(cnpj.replace(/\D/g, ""), 14)}55001${pad(seq, 9)}1${pad(seq, 9)}`;
}

function weightedRandom(weights: number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

// ── Função principal ──────────────────────────────────────────────────────────
export async function seedFakeStores(): Promise<void> {
  if (process.env.NODE_ENV === "production") return;

  const client = await pool.connect();
  try {
    // Verifica se já foi seeded
    const check = await client.query(
      "SELECT 1 FROM places_cache WHERE google_place_id = 'fake_brasbom_taguatinga' LIMIT 1",
    );
    if (check.rows.length > 0) return;

    console.log("[seed-stores] Iniciando seed de supermercados fictícios...");

    // ── 1. EAN Cache (Catálogo de Produtos) ──────────────────────────────────
    for (const p of PRODUCTS) {
      await client.query(
        `INSERT INTO ean_cache (ean, description, brand, category, cached_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (ean) DO NOTHING`,
        [p.ean, p.name, p.brand, p.category],
      );
    }

    // ── 2. Perfis de Usuários Fictícios ──────────────────────────────────────
    for (const u of FAKE_USERS) {
      await client.query(
        `INSERT INTO user_profiles (user_id, nickname, full_name, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         ON CONFLICT (user_id) DO NOTHING`,
        [u.userId, u.nickname, u.fullName],
      );
    }

    // ── 3. Places Cache + Merchant Registrations ─────────────────────────────
    for (const store of FAKE_STORES) {
      // places_cache
      await client.query(
        `INSERT INTO places_cache
           (google_place_id, name, address, lat, lng, rating, status, is_shadow, is_partner,
            geom, synced_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'verified', FALSE, TRUE,
                 ST_SetSRID(ST_MakePoint($7, $8), 4326)::geography, NOW())
         ON CONFLICT (google_place_id) DO NOTHING`,
        [store.placeId, store.nomeFantasia, store.address,
         store.lat, store.lng,
         roundPrice(randBetween(3.8, 4.9)),
         store.lng, store.lat],
      );

      // merchant_registrations
      const existingReg = await client.query(
        "SELECT id FROM merchant_registrations WHERE cnpj = $1 LIMIT 1",
        [store.cnpj],
      );
      if (existingReg.rows.length > 0) continue;

      const regResult = await client.query(
        `INSERT INTO merchant_registrations
           (google_place_id, cnpj, razao_social, nome_fantasia, owner_name,
            address, lat, lng, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'approved', NOW(), NOW())
         RETURNING id`,
        [store.placeId, store.cnpj, store.razaoSocial, store.nomeFantasia,
         store.ownerName, store.address, store.lat, store.lng],
      );

      if (regResult.rows.length === 0) continue;
      const regId = regResult.rows[0].id;

      // merchant_users — senha padrão "teste123" para todos os lojistas fictícios
      const hash = await bcrypt.hash("teste123", 10);
      await client.query(
        `INSERT INTO merchant_users
           (merchant_registration_id, email, password_hash, must_change_password, plan, created_at, updated_at)
         VALUES ($1, $2, $3, FALSE, $4, NOW(), NOW())
         ON CONFLICT (email) DO NOTHING`,
        [regId, `portal@${store.cnpj}.ecompara.dev`, hash, store.plan],
      );
    }

    // Atualiza o supermercado de teste principal com CNPJ e placeId
    await client.query(
      `UPDATE merchant_registrations
         SET cnpj = '11111111000101', google_place_id = 'fake_brasbom_taguatinga',
             lat = -15.8290, lng = -48.0530,
             address = 'QS 7, Rua 600, Taguatinga, Brasília - DF',
             updated_at = NOW()
       WHERE nome_fantasia = 'Supermercado Teste' AND (cnpj IS NULL OR cnpj = '')`,
    );

    // ── 4. Relatórios de Preço (90 dias, todos os supermercados) ─────────────
    const productWeightValues = PRODUCTS.map((p) => PRODUCT_WEIGHTS[p.ean] ?? 1);

    for (const store of FAKE_STORES) {
      for (const p of PRODUCTS) {
        const numReports = Math.max(1, Math.floor(PRODUCT_WEIGHTS[p.ean] * randBetween(1.5, 3)));
        for (let i = 0; i < numReports; i++) {
          const daysBack = Math.floor(randBetween(1, 90));
          const priceVariance = randBetween(0.93, 1.07);
          const price = roundPrice(p.basePrice * store.priceMultiplier * priceVariance);
          const user = FAKE_USERS[Math.floor(Math.random() * FAKE_USERS.length)];

          await client.query(
            `INSERT INTO price_reports
               (product_ean, product_name, place_id, user_id, price, reported_at,
                is_verified, upvotes, downvotes, report_type, points_awarded, source, confidence_score)
             VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7, $8, 'auto_validated', 15, 'manual', 0.9)`,
            [p.ean, p.name, store.placeId, user.userId, price,
             daysAgo(daysBack),
             Math.floor(randBetween(2, 20)),
             Math.floor(randBetween(0, 3))],
          );
        }
      }
    }

    // ── 5. NFC-e Records (90 dias, loja principal de teste) ──────────────────
    const mainStore = FAKE_STORES[0]; // BrasBom Taguatinga = loja vinculada ao teste
    let nfceSeq = 1;

    for (let dayBack = 90; dayBack >= 1; dayBack--) {
      // 1 a 3 NFC-e por dia
      const nfceCount = Math.floor(randBetween(1, 4));
      for (let t = 0; t < nfceCount; t++) {
        const user = FAKE_USERS[Math.floor(Math.random() * FAKE_USERS.length)];
        const chave = randomChaveAcesso(mainStore.cnpj, nfceSeq++);

        // Seleciona 4-8 produtos ponderados pelo peso de vendas
        const itemCount = Math.floor(randBetween(4, 9));
        const selectedProducts: typeof PRODUCTS = [];
        const usedIndexes = new Set<number>();
        for (let k = 0; k < itemCount; k++) {
          let idx = weightedRandom(productWeightValues);
          let tries = 0;
          while (usedIndexes.has(idx) && tries < 20) {
            idx = weightedRandom(productWeightValues);
            tries++;
          }
          usedIndexes.add(idx);
          selectedProducts.push(PRODUCTS[idx]);
        }

        const items = selectedProducts.map((p) => ({
          ean:   p.ean,
          name:  p.name,
          qty:   Math.floor(randBetween(1, 4)),
          unit:  "UN",
          price: roundPrice(p.basePrice * mainStore.priceMultiplier * randBetween(0.95, 1.05)),
        }));

        const totalValue = roundPrice(
          items.reduce((sum, it) => sum + it.price * it.qty, 0),
        );
        const pointsAwarded = Math.floor(totalValue * 3); // 3 pontos por real

        const purchaseDate = daysAgo(dayBack);
        // Hora aleatória entre 8h e 21h
        purchaseDate.setHours(Math.floor(randBetween(8, 21)), Math.floor(randBetween(0, 59)));

        await client.query(
          `INSERT INTO nfce_records
             (chave_acesso, cnpj, store_name, place_id, user_id,
              total_value, item_count, items, points_awarded, processed_at, source, state_code, doc_number)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'manual', 'DF', $11)
           ON CONFLICT (chave_acesso) DO NOTHING`,
          [chave, mainStore.cnpj, mainStore.nomeFantasia, mainStore.placeId,
           user.userId, totalValue, items.length, JSON.stringify(items),
           pointsAwarded, purchaseDate, String(nfceSeq)],
        );
      }
    }

    // ── 6. Histórico de Pontos dos Usuários Fictícios ─────────────────────────
    for (const u of FAKE_USERS) {
      const numActions = Math.floor(randBetween(5, 20));
      for (let i = 0; i < numActions; i++) {
        await client.query(
          `INSERT INTO points_history (user_id, action_type, points_amount, created_at)
           VALUES ($1, $2, $3, $4)`,
          [u.userId, "price_confirmation", Math.floor(randBetween(10, 50)), daysAgo(Math.floor(randBetween(1, 90)))],
        );
      }
    }

    console.log(`[seed-stores] ${FAKE_STORES.length} supermercados fictícios criados com sucesso.`);
    console.log(`[seed-stores] ${FAKE_USERS.length} clientes fictícios criados com sucesso.`);
    console.log(`[seed-stores] ${PRODUCTS.length} produtos indexados no catálogo.`);
  } catch (err) {
    console.error("[seed-stores] Erro:", err);
  } finally {
    client.release();
  }
}
