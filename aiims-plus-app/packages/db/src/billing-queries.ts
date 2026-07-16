/**
 * Stage 6 data-access helpers (billing). Drizzle stays confined here; every
 * helper requires a tenant-scoped transaction (DDR-0002). Money is `numeric`
 * exchanged as decimal STRINGS (never float, DB §4). Payment marking is
 * versioned and status-guarded so a paid invoice cannot be re-paid.
 */
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import * as s from "./schema";
import type { TenantDb } from "./tenant-context";

/** Tenant-wide invoice list with patient names, for the cashier/billing desk. */
export interface InvoiceListRow {
  id: string;
  invoiceNumber: string;
  patientId: string;
  patientName: string;
  status: "issued" | "paid" | "cancelled";
  currency: string;
  total: string;
  paymentMethod: string | null;
  issuedAt: Date;
  paidAt: Date | null;
}
export async function listInvoices(
  db: TenantDb,
  opts: { status?: "issued" | "paid" | "cancelled" } = {},
): Promise<InvoiceListRow[]> {
  return db
    .select({
      id: s.invoice.id,
      invoiceNumber: s.invoice.invoiceNumber,
      patientId: s.invoice.patientId,
      patientName: sql<string>`${s.patient.nameGiven} || ' ' || ${s.patient.nameFamily}`,
      status: s.invoice.status,
      currency: s.invoice.currency,
      total: s.invoice.total,
      paymentMethod: s.invoice.paymentMethod,
      issuedAt: s.invoice.issuedAt,
      paidAt: s.invoice.paidAt,
    })
    .from(s.invoice)
    .innerJoin(
      s.patient,
      and(eq(s.patient.tenantId, s.invoice.tenantId), eq(s.patient.id, s.invoice.patientId)),
    )
    .where(
      and(isNull(s.invoice.deletedAt), opts.status ? eq(s.invoice.status, opts.status) : undefined),
    )
    .orderBy(desc(s.invoice.issuedAt));
}

/** Gap-free per-tenant invoice numbering (mirrors issueMrn). Format INV-%06d. */
export async function issueInvoiceNumber(db: TenantDb, tenantId: string): Promise<string> {
  const [row] = await db
    .insert(s.invoiceCounter)
    .values({ tenantId, lastValue: 1 })
    .onConflictDoUpdate({
      target: s.invoiceCounter.tenantId,
      set: { lastValue: sql`${s.invoiceCounter.lastValue} + 1` },
    })
    .returning({ lastValue: s.invoiceCounter.lastValue });
  if (!row) throw new Error("invoice counter upsert returned no row");
  return `INV-${String(row.lastValue).padStart(6, "0")}`;
}

export interface InvoiceRow {
  id: string;
  tenantId: string;
  invoiceNumber: string;
  encounterId: string;
  patientId: string;
  status: "issued" | "paid" | "cancelled";
  currency: string;
  subtotal: string;
  total: string;
  paymentRef: string | null;
  paymentMethod: string | null;
  issuedAt: Date;
  paidAt: Date | null;
  version: number;
  createdAt: Date;
}

const invoiceColumns = {
  id: s.invoice.id,
  tenantId: s.invoice.tenantId,
  invoiceNumber: s.invoice.invoiceNumber,
  encounterId: s.invoice.encounterId,
  patientId: s.invoice.patientId,
  status: s.invoice.status,
  currency: s.invoice.currency,
  subtotal: s.invoice.subtotal,
  total: s.invoice.total,
  paymentRef: s.invoice.paymentRef,
  paymentMethod: s.invoice.paymentMethod,
  issuedAt: s.invoice.issuedAt,
  paidAt: s.invoice.paidAt,
  version: s.invoice.version,
  createdAt: s.invoice.createdAt,
} as const;

const notDeleted = isNull(s.invoice.deletedAt);

export async function insertInvoice(
  db: TenantDb,
  input: {
    id: string;
    tenantId: string;
    invoiceNumber: string;
    encounterId: string;
    patientId: string;
    currency: string;
    subtotal: string;
    total: string;
  },
): Promise<InvoiceRow> {
  const [row] = await db.insert(s.invoice).values(input).returning(invoiceColumns);
  if (!row) throw new Error("insert returned no row");
  return row;
}

export interface InvoiceLineRow {
  id: string;
  invoiceId: string;
  description: string;
  codeSystem: string | null;
  code: string | null;
  display: string | null;
  quantity: number;
  unitAmount: string;
  lineAmount: string;
}

const lineColumns = {
  id: s.invoiceLine.id,
  invoiceId: s.invoiceLine.invoiceId,
  description: s.invoiceLine.description,
  codeSystem: s.invoiceLine.codeSystem,
  code: s.invoiceLine.code,
  display: s.invoiceLine.display,
  quantity: s.invoiceLine.quantity,
  unitAmount: s.invoiceLine.unitAmount,
  lineAmount: s.invoiceLine.lineAmount,
} as const;

export async function insertInvoiceLine(
  db: TenantDb,
  input: {
    id: string;
    tenantId: string;
    invoiceId: string;
    description: string;
    codeSystem?: string | null;
    code?: string | null;
    display?: string | null;
    quantity: number;
    unitAmount: string;
    lineAmount: string;
  },
): Promise<InvoiceLineRow> {
  const [row] = await db
    .insert(s.invoiceLine)
    .values({
      id: input.id,
      tenantId: input.tenantId,
      invoiceId: input.invoiceId,
      description: input.description,
      codeSystem: input.codeSystem ?? null,
      code: input.code ?? null,
      display: input.display ?? null,
      quantity: input.quantity,
      unitAmount: input.unitAmount,
      lineAmount: input.lineAmount,
    })
    .returning(lineColumns);
  if (!row) throw new Error("insert returned no row");
  return row;
}

export async function getInvoiceById(db: TenantDb, id: string): Promise<InvoiceRow | undefined> {
  const [row] = await db
    .select(invoiceColumns)
    .from(s.invoice)
    .where(and(eq(s.invoice.id, id), notDeleted))
    .limit(1);
  return row;
}

export async function getInvoiceByEncounter(
  db: TenantDb,
  encounterId: string,
): Promise<InvoiceRow | undefined> {
  const [row] = await db
    .select(invoiceColumns)
    .from(s.invoice)
    .where(and(eq(s.invoice.encounterId, encounterId), notDeleted))
    .limit(1);
  return row;
}

export async function listInvoiceLines(db: TenantDb, invoiceId: string): Promise<InvoiceLineRow[]> {
  return db
    .select(lineColumns)
    .from(s.invoiceLine)
    .where(eq(s.invoiceLine.invoiceId, invoiceId))
    .orderBy(s.invoiceLine.createdAt);
}

/** Mark paid under optimistic concurrency; status guard blocks double-pay. */
export async function markInvoicePaidVersioned(
  db: TenantDb,
  id: string,
  expectedVersion: number,
  input: { paymentRef: string; paymentMethod: string },
): Promise<InvoiceRow | undefined> {
  const [row] = await db
    .update(s.invoice)
    .set({
      status: "paid",
      paymentRef: input.paymentRef,
      paymentMethod: input.paymentMethod,
      paidAt: sql`now()`,
      version: sql`${s.invoice.version} + 1`,
      updatedAt: sql`now()`,
    })
    .where(
      and(
        eq(s.invoice.id, id),
        eq(s.invoice.version, expectedVersion),
        eq(s.invoice.status, "issued"),
        notDeleted,
      ),
    )
    .returning(invoiceColumns);
  return row;
}
