/**
 * `clinical` schema (Stage 2) — mirrors the reviewed SQL in ../migrations.
 * Encrypted identifiers are bytea ciphertext + blind-index digests
 * (DDR-0006); Drizzle describes the tables, it never owns security DDL.
 */
import { date, integer, jsonb, pgSchema, text, timestamp, uuid, bigint } from "drizzle-orm/pg-core";
import { bytea } from "./bytea";

export const clinical = pgSchema("clinical");

export const patient = clinical.table("patient", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  mrn: text("mrn").notNull(),
  nameGiven: text("name_given").notNull(),
  nameFamily: text("name_family").notNull(),
  gender: text("gender").$type<"male" | "female" | "other" | "unknown">().notNull(),
  birthDate: date("birth_date").notNull(),
  abhaAddress: text("abha_address"),
  abhaNumberEnc: bytea("abha_number_enc"),
  abhaNumberBidx: bytea("abha_number_bidx"),
  phoneEnc: bytea("phone_enc"),
  phoneBidx: bytea("phone_bidx"),
  emailEnc: bytea("email_enc"),
  emailBidx: bytea("email_bidx"),
  encKeyRef: text("enc_key_ref"),
  address: jsonb("address"),
  identifiers: jsonb("identifiers").notNull().default({}),
  fhirExtensions: jsonb("fhir_extensions").notNull().default({}),
  fhirId: text("fhir_id"),
  version: integer("version").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  retentionClass: text("retention_class"),
  retentionUntil: timestamp("retention_until", { withTimezone: true }),
});

export const mrnCounter = clinical.table("mrn_counter", {
  tenantId: uuid("tenant_id").primaryKey(),
  lastValue: bigint("last_value", { mode: "number" }).notNull().default(0),
});
