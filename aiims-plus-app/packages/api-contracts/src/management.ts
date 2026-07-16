/**
 * Management/analytics contracts (Zod). Leadership dashboard rollups: OPD load,
 * revenue, lab throughput, pharmacy, and patient satisfaction. DTO-only (BDR-0006).
 */
import { z } from "zod";

export const managementOverviewSchema = z.object({
  opd: z.object({
    total: z.number().int(),
    booked: z.number().int(),
    waiting: z.number().int(),
    inProgress: z.number().int(),
    completed: z.number().int(),
    cancelled: z.number().int(),
  }),
  revenue: z.object({
    paidTotal: z.string(),
    outstandingTotal: z.string(),
    paidCount: z.number().int(),
  }),
  lab: z.object({ pending: z.number().int(), resulted: z.number().int() }),
  pharmacy: z.object({
    activeRx: z.number().int(),
    dispensedRx: z.number().int(),
    lowStock: z.number().int(),
  }),
  satisfaction: z.object({ avgRating: z.number(), count: z.number().int() }),
});
export type ManagementOverview = z.infer<typeof managementOverviewSchema>;
