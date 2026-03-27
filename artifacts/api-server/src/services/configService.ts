import { db } from "@workspace/db";
import { appConfigTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

export const CONFIGURABLE_KEYS = [
  "GOOGLE_PLACES_KEY",
  "COSMOS_TOKEN",
  "PLACES_MONTHLY_CALL_LIMIT",
] as const;

export type ConfigKey = (typeof CONFIGURABLE_KEYS)[number];

const CONFIG_LABELS: Record<ConfigKey, string> = {
  GOOGLE_PLACES_KEY: "Google Places API Key",
  COSMOS_TOKEN: "Token Bluesoft Cosmos (EAN)",
  PLACES_MONTHLY_CALL_LIMIT: "Limite mensal de chamadas (Google Places)",
};

const CONFIG_DESCRIPTIONS: Record<ConfigKey, string> = {
  GOOGLE_PLACES_KEY: "Chave de API do Google Places usada para buscar lojas próximas.",
  COSMOS_TOKEN: "Token de autenticação para a API Bluesoft Cosmos de busca por código de barras (EAN).",
  PLACES_MONTHLY_CALL_LIMIT: "Número máximo de chamadas mensais à API do Google Places. Padrão: 200.",
};

export async function getConfig(key: ConfigKey): Promise<string | undefined> {
  try {
    const rows = await db
      .select()
      .from(appConfigTable)
      .where(eq(appConfigTable.key, key))
      .limit(1);
    if (rows.length > 0) return rows[0].value;
  } catch {
  }
  return process.env[key];
}

export async function setConfig(key: ConfigKey, value: string): Promise<void> {
  await db
    .insert(appConfigTable)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: appConfigTable.key,
      set: { value, updatedAt: new Date() },
    });
}

export async function deleteConfig(key: ConfigKey): Promise<void> {
  await db.delete(appConfigTable).where(eq(appConfigTable.key, key));
}

export async function getAllConfigStatus(): Promise<
  Array<{
    key: ConfigKey;
    label: string;
    description: string;
    source: "database" | "env" | "not_set";
    isSet: boolean;
    value?: string;
  }>
> {
  const dbRows = await db.select().from(appConfigTable);
  const dbMap = new Map(dbRows.map((r) => [r.key, r.value]));

  return CONFIGURABLE_KEYS.map((key) => {
    const dbVal = dbMap.get(key);
    const envVal = process.env[key];

    if (dbVal !== undefined) {
      return {
        key,
        label: CONFIG_LABELS[key],
        description: CONFIG_DESCRIPTIONS[key],
        source: "database" as const,
        isSet: true,
        value: maskSecret(key, dbVal),
      };
    } else if (envVal) {
      return {
        key,
        label: CONFIG_LABELS[key],
        description: CONFIG_DESCRIPTIONS[key],
        source: "env" as const,
        isSet: true,
        value: maskSecret(key, envVal),
      };
    } else {
      return {
        key,
        label: CONFIG_LABELS[key],
        description: CONFIG_DESCRIPTIONS[key],
        source: "not_set" as const,
        isSet: false,
      };
    }
  });
}

function maskSecret(key: ConfigKey, value: string): string {
  if (key === "PLACES_MONTHLY_CALL_LIMIT") return value;
  if (value.length <= 8) return "••••••••";
  return value.slice(0, 4) + "••••••••" + value.slice(-4);
}
