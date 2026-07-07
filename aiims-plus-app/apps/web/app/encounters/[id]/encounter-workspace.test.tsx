import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EncounterResponse } from "@aiims/api-contracts";
import { EncounterWorkspace } from "./encounter-workspace";

const encounter = {
  id: "0197a000-0000-7000-8000-000000000001",
  appointmentId: null,
  patientId: "0197a000-0000-7000-8000-000000000002",
  practitionerId: "0197a000-0000-7000-8000-000000000003",
  facilityId: "0197a000-0000-7000-8000-000000000004",
  departmentId: null,
  class: "AMB",
  status: "in_progress",
  chiefComplaint: null,
  signedAt: null,
  signedBy: null,
  periodStart: "2026-08-01T09:00:00.000Z",
  periodEnd: null,
  version: 0,
  createdAt: "2026-08-01T09:00:00.000Z",
} as unknown as EncounterResponse;

describe("EncounterWorkspace (a11y)", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ data: [] }),
      })) as unknown as typeof fetch,
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("documentation controls are labelled and the workspace has no axe violations", async () => {
    const { container } = render(
      <EncounterWorkspace
        encounter={encounter}
        initialNotes={[]}
        initialObservations={[]}
        initialConditions={[]}
        initialOrders={[]}
        initialResults={[]}
        initialInvoice={null}
        canDocument
        canSign
        canBill
        canShare
      />,
    );
    expect(screen.getByLabelText("Chief complaint")).toBeInTheDocument();
    expect(screen.getByLabelText("Vital")).toBeInTheDocument();
    expect(screen.getByLabelText("Diagnosis (ICD-10)")).toBeInTheDocument();
    expect(screen.getByLabelText("New note")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign encounter/i })).toBeInTheDocument();
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
