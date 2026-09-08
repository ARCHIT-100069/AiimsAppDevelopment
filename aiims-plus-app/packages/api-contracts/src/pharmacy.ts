/**
 * Pharmacy contracts (Zod). Drug master, batched stock, prescriptions written by
 * a prescriber, and dispensing. DTO-only boundary (BDR-0006).
 */
import { z } from "zod";

export const DRUG_FORMS = [
  "tablet",
  "capsule",
  "syrup",
  "injection",
  "ointment",
  "drops",
  "other",
] as const;

export const createDrugRequestSchema = z.object({
  name: z.string().trim().min(1).max(200),
  form: z.enum(DRUG_FORMS),
  strength: z.string().trim().min(1).max(60),
  unit: z.string().trim().min(1).max(30).default("unit"),
  category: z.string().trim().min(1).max(80).optional(),
  reorderLevel: z.number().int().min(0).max(1_000_000).default(0),
});

export const drugResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  form: z.string(),
  strength: z.string(),
  unit: z.string(),
  category: z.string().nullable(),
  reorderLevel: z.number().int(),
  totalQty: z.number().int(),
});
export const listDrugsResponseSchema = z.object({ data: z.array(drugResponseSchema) });

export const addStockRequestSchema = z.object({
  batchNo: z.string().trim().min(1).max(60),
  expiryDate: z.iso.date(),
  quantity: z.number().int().min(1).max(10_000_000),
  mrp: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "money with up to 2 decimals")
    .default("0"),
});

export const prescriptionItemInputSchema = z.object({
  drugId: z.uuid(),
  dose: z.string().trim().min(1).max(60),
  frequency: z.string().trim().min(1).max(60),
  duration: z.string().trim().min(1).max(60),
  quantity: z.number().int().min(1).max(100000),
  instructions: z.string().trim().min(1).max(300).optional(),
});

export const createPrescriptionRequestSchema = z.object({
  patientId: z.uuid(),
  encounterId: z.uuid().optional(),
  note: z.string().trim().min(1).max(500).optional(),
  items: z.array(prescriptionItemInputSchema).min(1).max(30),
});

export const prescriptionItemResponseSchema = z.object({
  id: z.uuid(),
  drugId: z.uuid(),
  drugName: z.string(),
  strength: z.string(),
  form: z.string(),
  dose: z.string(),
  frequency: z.string(),
  duration: z.string(),
  quantity: z.number().int(),
  instructions: z.string().nullable(),
});

export const prescriptionResponseSchema = z.object({
  id: z.uuid(),
  patientId: z.uuid(),
  patientName: z.string(),
  encounterId: z.uuid().nullable(),
  prescriberId: z.uuid(),
  status: z.enum(["active", "dispensed", "cancelled"]),
  note: z.string().nullable(),
  version: z.number().int(),
  createdAt: z.string(),
  items: z.array(prescriptionItemResponseSchema),
});
export const listPrescriptionsResponseSchema = z.object({
  data: z.array(prescriptionResponseSchema),
});

export const dispenseResponseSchema = z.object({
  dispenseId: z.uuid(),
  prescriptionId: z.uuid(),
  status: z.literal("dispensed"),
});

export type CreateDrugRequest = z.infer<typeof createDrugRequestSchema>;
export type DrugResponse = z.infer<typeof drugResponseSchema>;
export type AddStockRequest = z.infer<typeof addStockRequestSchema>;
export type CreatePrescriptionRequest = z.infer<typeof createPrescriptionRequestSchema>;
export type PrescriptionResponse = z.infer<typeof prescriptionResponseSchema>;
export type ListPrescriptionsResponse = z.infer<typeof listPrescriptionsResponseSchema>;
export type DispenseResponse = z.infer<typeof dispenseResponseSchema>;
