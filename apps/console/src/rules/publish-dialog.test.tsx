import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PublishDialog } from "./RulesetVersionPage";

/* Test scaffolding: a role, as entered when a reviewer has not agreed to be named. */
describe("PublishDialog: who reviewed and approved the version", () => {
  it("publishes only with the attestation and a reviewer, and passes the reviewer on trimmed", () => {
    const onConfirm = vi.fn();
    render(<PublishDialog label="v9" busy={false} onClose={() => {}} onConfirm={onConfirm} />);
    const publish = screen.getByRole("button", { name: "Publish" });
    const reviewer = screen.getByLabelText(/^Reviewed and approved by \(name or role\)/);

    expect(publish).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    // The attestation alone is not enough.
    expect(publish).toBeDisabled();

    fireEvent.change(reviewer, { target: { value: "   " } });
    expect(publish).toBeDisabled();

    fireEvent.change(reviewer, { target: { value: "  Fixture reviewer (test) " } });
    expect(publish).toBeEnabled();
    fireEvent.click(publish);
    expect(onConfirm).toHaveBeenCalledWith("Fixture reviewer (test)");
  });

  it("asks for a name only with consent, otherwise a role", () => {
    render(<PublishDialog label="v9" busy={false} onClose={() => {}} onConfirm={() => {}} />);
    expect(screen.getByText(/only if they agreed to be named/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Reviewed and approved by/)).toHaveAttribute("maxLength", "100");
  });
});
