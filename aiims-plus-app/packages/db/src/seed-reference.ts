/**
 * Reference-data seed (DDR-0012) — MINIMAL, REPRESENTATIVE development set
 * (founder clarification #2): enough real, commonly-used codes to develop and
 * test against. Release marker "dev-minimal" makes it trivially replaceable:
 * a production import upserts on the same (system, code) natural keys with a
 * real release identifier, and this seed steps aside.
 */
import { Client } from "pg";

const CODE_SYSTEMS = [
  { code: "icd-10", name: "ICD-10", uri: "http://hl7.org/fhir/sid/icd-10", release: "dev-minimal" },
  { code: "loinc", name: "LOINC", uri: "http://loinc.org", release: "dev-minimal" },
  { code: "snomed", name: "SNOMED CT", uri: "http://snomed.info/sct", release: "dev-minimal" },
] as const;

const CODES: ReadonlyArray<readonly [system: string, code: string, display: string]> = [
  // ICD-10 — common OPD diagnoses
  ["icd-10", "J06.9", "Acute upper respiratory infection, unspecified"],
  ["icd-10", "I10", "Essential (primary) hypertension"],
  ["icd-10", "E11.9", "Type 2 diabetes mellitus without complications"],
  ["icd-10", "A09", "Infectious gastroenteritis and colitis, unspecified"],
  ["icd-10", "M54.5", "Low back pain"],
  ["icd-10", "R50.9", "Fever, unspecified"],
  ["icd-10", "J45.9", "Asthma, unspecified"],
  ["icd-10", "K21.9", "Gastro-oesophageal reflux disease without oesophagitis"],
  ["icd-10", "N39.0", "Urinary tract infection, site not specified"],
  ["icd-10", "H10.9", "Unspecified conjunctivitis"],
  // LOINC — vital signs + common labs
  ["loinc", "8867-4", "Heart rate"],
  ["loinc", "8480-6", "Systolic blood pressure"],
  ["loinc", "8462-4", "Diastolic blood pressure"],
  ["loinc", "8310-5", "Body temperature"],
  ["loinc", "9279-1", "Respiratory rate"],
  ["loinc", "2708-6", "Oxygen saturation in Arterial blood"],
  ["loinc", "29463-7", "Body weight"],
  ["loinc", "8302-2", "Body height"],
  ["loinc", "718-7", "Hemoglobin [Mass/volume] in Blood"],
  ["loinc", "2345-7", "Glucose [Mass/volume] in Serum or Plasma"],
  // SNOMED CT — common findings/procedures
  ["snomed", "386661006", "Fever"],
  ["snomed", "22253000", "Pain"],
  ["snomed", "49727002", "Cough"],
  ["snomed", "25064002", "Headache"],
  ["snomed", "271737000", "Anemia"],
  ["snomed", "38341003", "Hypertensive disorder"],
  ["snomed", "73211009", "Diabetes mellitus"],
  ["snomed", "185349003", "Encounter for check up"],
];

/** Idempotent upsert; runs as the migrator (reference.* is read-only to the app). */
export async function seedReference(client: Client): Promise<void> {
  for (const cs of CODE_SYSTEMS) {
    await client.query(
      `INSERT INTO reference.code_system (code, name, uri, release) VALUES ($1, $2, $3, $4)
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, uri = EXCLUDED.uri, release = EXCLUDED.release, updated_at = now()`,
      [cs.code, cs.name, cs.uri, cs.release],
    );
  }
  for (const [system, code, display] of CODES) {
    await client.query(
      `INSERT INTO reference.code (system, code, display) VALUES ($1, $2, $3)
       ON CONFLICT (system, code) DO UPDATE SET display = EXCLUDED.display, active = true, updated_at = now()`,
      [system, code, display],
    );
  }
}
