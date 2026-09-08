/**
 * Management/analytics aggregates. Read-only rollups over the operational
 * tables for the leadership dashboard — OPD load, revenue, lab throughput,
 * pharmacy, and patient satisfaction (NABH). Every query runs inside the
 * tenant RLS context (DDR-0002); Drizzle stays confined here (ADR-0011).
 */
import { and, count, eq, gte, lte, sql } from "drizzle-orm";
import * as s from "./schema";
import type { TenantDb } from "./tenant-context";

export interface ManagementOverview {
  opd: {
    total: number;
    booked: number;
    waiting: number; // checked_in
    inProgress: number;
    completed: number; // fulfilled
    cancelled: number; // cancelled + no_show
  };
  revenue: { paidTotal: string; outstandingTotal: string; paidCount: number };
  lab: { pending: number; resulted: number };
  pharmacy: { activeRx: number; dispensedRx: number; lowStock: number };
  satisfaction: { avgRating: number; count: number };
}

export async function getManagementOverview(
  db: TenantDb,
  dayStart: Date,
  dayEnd: Date,
): Promise<ManagementOverview> {
  // Sequential, not Promise.all: every query below shares the one pg client
  // this transaction holds, and node-postgres only allows one in-flight
  // query per client — concurrent awaits on it are deprecated (pg#9 removes
  // support entirely) even though today's driver silently queues them.
  const opdRows = await db
    .select({ status: s.appointment.status, n: count() })
    .from(s.appointment)
    .where(and(gte(s.appointment.startAt, dayStart), lte(s.appointment.startAt, dayEnd)))
    .groupBy(s.appointment.status);
  const revenueRow = await db
    .select({
      paidTotal: sql<string>`coalesce(sum(${s.invoice.total}) filter (where ${s.invoice.status} = 'paid'), 0)`,
      outstandingTotal: sql<string>`coalesce(sum(${s.invoice.total}) filter (where ${s.invoice.status} = 'issued'), 0)`,
      paidCount: sql<number>`count(*) filter (where ${s.invoice.status} = 'paid')`,
    })
    .from(s.invoice);
  const srRows = await db
    .select({ status: s.serviceRequest.status, n: count() })
    .from(s.serviceRequest)
    .groupBy(s.serviceRequest.status);
  const rxRows = await db
    .select({ status: s.prescription.status, n: count() })
    .from(s.prescription)
    .groupBy(s.prescription.status);
  // Per-drug stock vs reorder level — count low/out in JS (small formulary).
  const drugStock = await db
    .select({
      reorderLevel: s.drug.reorderLevel,
      qty: sql<number>`coalesce(sum(${s.stockBatch.quantity}), 0)`,
    })
    .from(s.drug)
    .leftJoin(
      s.stockBatch,
      and(eq(s.stockBatch.tenantId, s.drug.tenantId), eq(s.stockBatch.drugId, s.drug.id)),
    )
    .where(sql`${s.drug.deletedAt} is null`)
    .groupBy(s.drug.id, s.drug.reorderLevel);
  const fbRow = await db
    .select({
      avg: sql<number>`coalesce(avg(${s.patientFeedback.rating}), 0)`,
      n: count(),
    })
    .from(s.patientFeedback);

  const opdBy = (st: string) => Number(opdRows.find((r) => r.status === st)?.n ?? 0);
  const srBy = (st: string) => Number(srRows.find((r) => r.status === st)?.n ?? 0);
  const rxBy = (st: string) => Number(rxRows.find((r) => r.status === st)?.n ?? 0);

  return {
    opd: {
      total: opdRows.reduce((a, r) => a + Number(r.n), 0),
      booked: opdBy("booked"),
      waiting: opdBy("checked_in"),
      inProgress: opdBy("in_progress"),
      completed: opdBy("fulfilled"),
      cancelled: opdBy("cancelled") + opdBy("no_show"),
    },
    revenue: {
      paidTotal: String(revenueRow[0]?.paidTotal ?? "0"),
      outstandingTotal: String(revenueRow[0]?.outstandingTotal ?? "0"),
      paidCount: Number(revenueRow[0]?.paidCount ?? 0),
    },
    lab: { pending: srBy("active"), resulted: srBy("completed") },
    pharmacy: {
      activeRx: rxBy("active"),
      dispensedRx: rxBy("dispensed"),
      lowStock: drugStock.filter((d) => Number(d.qty) <= d.reorderLevel).length,
    },
    satisfaction: {
      avgRating: Math.round(Number(fbRow[0]?.avg ?? 0) * 10) / 10,
      count: Number(fbRow[0]?.n ?? 0),
    },
  };
}
