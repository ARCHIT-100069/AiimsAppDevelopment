/**
 * A CodeableConcept coding element (system/code/display) — shared by clinical
 * documentation contracts (observations LOINC, conditions ICD-10/SNOMED,
 * orders). Codes come from the reference system (DDR-0012).
 */
import { z } from "zod";

export const codingSchema = z.object({
  system: z.string().min(1).max(64),
  code: z.string().min(1).max(64),
  display: z.string().min(1).max(300),
});
export type Coding = z.infer<typeof codingSchema>;
