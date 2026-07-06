import { render, screen, waitFor } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RegisterForm } from "./new/register-form";

/** Accessibility is a component-level requirement (FEDR-0004 / TDR-0010). */
describe("Practitioner RegisterForm (a11y)", () => {
  beforeEach(() => {
    // The form loads users/departments/specialties on mount — stub fetch.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ data: [] }),
      })) as unknown as typeof fetch,
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("every control is labelled and the form has no axe violations", async () => {
    const { container } = render(<RegisterForm />);
    await waitFor(() => expect(screen.getByLabelText("Linked user")).toBeInTheDocument());
    expect(screen.getByLabelText("Registration number")).toBeInTheDocument();
    expect(screen.getByLabelText("Department")).toBeInTheDocument();
    expect(screen.getByLabelText("Specialty")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add practitioner/i })).toBeInTheDocument();
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
