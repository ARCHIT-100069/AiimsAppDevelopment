import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it } from "vitest";
import { RegisterForm } from "./new/register-form";

/** Accessibility is a component-level requirement (FEDR-0004 / TDR-0010). */
describe("RegisterForm (a11y)", () => {
  it("every field is labelled and the form has no axe violations", async () => {
    const { container } = render(<RegisterForm />);
    expect(screen.getByLabelText("Given name")).toBeInTheDocument();
    expect(screen.getByLabelText("Family name")).toBeInTheDocument();
    expect(screen.getByLabelText("Birth date")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /register patient/i })).toBeInTheDocument();
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
