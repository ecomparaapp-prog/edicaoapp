import {
  pgTable,
  serial,
  text,
  boolean,
  numeric,
  timestamp,
  json,
} from "drizzle-orm/pg-core";

export type DayHours = {
  open: string;
  close: string;
  closed: boolean;
};

export type OperatingHours = {
  monday: DayHours;
  tuesday: DayHours;
  wednesday: DayHours;
  thursday: DayHours;
  friday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
  holidays: DayHours;
};

export type ParkingType = "none" | "free" | "paid";
export type DeliveryType = "none" | "own" | "app";
export type VerificationMethod = "email" | "phone";
export type RegistrationStatus =
  | "pending_completion"
  | "pending_verification"
  | "pending_approval"
  | "approved"
  | "rejected";

export const merchantRegistrationsTable = pgTable("merchant_registrations", {
  id: serial("id").primaryKey(),

  googlePlaceId: text("google_place_id"),

  cnpj: text("cnpj"),
  razaoSocial: text("razao_social"),
  nomeFantasia: text("nome_fantasia"),
  inscricaoEstadual: text("inscricao_estadual"),
  ownerName: text("owner_name"),

  cep: text("cep"),
  address: text("address"),
  lat: numeric("lat", { precision: 10, scale: 7 }),
  lng: numeric("lng", { precision: 10, scale: 7 }),

  operatingHours: json("operating_hours").$type<OperatingHours>(),
  phone: text("phone"),
  whatsapp: text("whatsapp"),

  parking: text("parking").$type<ParkingType>().default("none"),
  cardBrands: json("card_brands").$type<string[]>().default([]),
  delivery: text("delivery").$type<DeliveryType>().default("none"),
  logoUrl: text("logo_url"),

  verificationMethod: text("verification_method").$type<VerificationMethod>(),
  verificationContact: text("verification_contact"),
  verificationCode: text("verification_code"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),

  status: text("status")
    .$type<RegistrationStatus>()
    .default("pending_verification")
    .notNull(),
  adminNote: text("admin_note"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type MerchantRegistration =
  typeof merchantRegistrationsTable.$inferSelect;
export type InsertMerchantRegistration =
  typeof merchantRegistrationsTable.$inferInsert;
