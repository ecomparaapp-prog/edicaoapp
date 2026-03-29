import { db } from "@workspace/db";
import { appConfigTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

export const CONFIGURABLE_KEYS = [
  "GOOGLE_PLACES_KEY",
  "COSMOS_TOKEN",
  "PLACES_MONTHLY_CALL_LIMIT",
  "MAIL_FROM_NAME",
  "MAIL_FROM_ADDRESS",
  "MAILTRAP_HOST",
  "MAILTRAP_PORT",
  "MAILTRAP_USER",
  "MAILTRAP_PASS",
] as const;

export type ConfigKey = (typeof CONFIGURABLE_KEYS)[number];

export const CONFIG_GROUPS: Record<string, ConfigKey[]> = {
  "Integrações Externas": ["GOOGLE_PLACES_KEY", "COSMOS_TOKEN", "PLACES_MONTHLY_CALL_LIMIT"],
  "E-mail — Remetente": ["MAIL_FROM_NAME", "MAIL_FROM_ADDRESS"],
  "E-mail — Servidor SMTP": ["MAILTRAP_HOST", "MAILTRAP_PORT", "MAILTRAP_USER", "MAILTRAP_PASS"],
};

const CONFIG_LABELS: Record<ConfigKey, string> = {
  GOOGLE_PLACES_KEY: "Google Places API Key",
  COSMOS_TOKEN: "Token Bluesoft Cosmos (EAN)",
  PLACES_MONTHLY_CALL_LIMIT: "Limite mensal de chamadas (Google Places)",
  MAIL_FROM_NAME: "Nome do remetente",
  MAIL_FROM_ADDRESS: "E-mail remetente (from)",
  MAILTRAP_HOST: "Servidor SMTP (host)",
  MAILTRAP_PORT: "Porta SMTP",
  MAILTRAP_USER: "Usuário SMTP",
  MAILTRAP_PASS: "Senha SMTP",
};

const CONFIG_DESCRIPTIONS: Record<ConfigKey, string> = {
  GOOGLE_PLACES_KEY: "Chave de API do Google Places usada para buscar lojas próximas.",
  COSMOS_TOKEN: "Token de autenticação para a API Bluesoft Cosmos de busca por código de barras (EAN).",
  PLACES_MONTHLY_CALL_LIMIT: "Número máximo de chamadas mensais à API do Google Places. Padrão: 200.",
  MAIL_FROM_NAME: "Nome exibido como remetente nos e-mails. Ex: eCompara",
  MAIL_FROM_ADDRESS: "Endereço de e-mail do remetente. Use seu endereço SMTP ou deixe em branco para usar o Ethereal Email automaticamente em testes.",
  MAILTRAP_HOST: "Host do servidor SMTP. Deixe em branco para usar Ethereal Email (testes automáticos). Ex. de produção: smtp.sendgrid.net",
  MAILTRAP_PORT: "Porta SMTP. Recomendado: 587 (STARTTLS). Outras opções: 25, 465, 2525.",
  MAILTRAP_USER: "Usuário de autenticação SMTP. Deixe em branco para usar Ethereal Email automaticamente nos testes.",
  MAILTRAP_PASS: "Senha de autenticação SMTP. Deixe em branco para usar Ethereal Email automaticamente nos testes.",
};

// Campos não-sensíveis: exibir valor completo no painel
const PLAIN_TEXT_KEYS: ConfigKey[] = [
  "PLACES_MONTHLY_CALL_LIMIT",
  "MAIL_FROM_NAME",
  "MAIL_FROM_ADDRESS",
  "MAILTRAP_HOST",
  "MAILTRAP_PORT",
];

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
  if (PLAIN_TEXT_KEYS.includes(key)) return value;
  if (value.length <= 8) return "••••••••";
  return value.slice(0, 4) + "••••••••" + value.slice(-4);
}
