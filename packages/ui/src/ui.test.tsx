import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TierVolumeChart } from "./charts.js";
import { Button, Count, DataTable, TextField } from "./components.js";
import { formatDate, formatRelative, manilaToday, shiftDays } from "./format.js";

const shown = (n: number) => ({ display: String(n), suppressed: false, value: n });
const masked = { display: "<5", suppressed: true, value: null };

describe("Count", () => {
  it("renders a suppressed cell as <5 with an explanation, never a number", () => {
    const { container } = render(<Count cell={masked} />);
    expect(container.textContent).toContain("<5");
    expect(container.querySelector(".mc-count-masked")).toHaveAttribute("title", expect.stringContaining("Fewer than 5"));
    expect(container.textContent).not.toMatch(/\b[0-4]\b/);
  });

  it("renders a shown cell plainly", () => {
    render(<Count cell={shown(12)} />);
    expect(screen.getByText("12")).toBeInTheDocument();
  });
});

describe("TierVolumeChart", () => {
  it("draws a fixed-height hatched placeholder for a suppressed day, not a sized bar", () => {
    const { container } = render(
      <TierVolumeChart
        days={[
          { date: "2026-09-16", total: masked, tiers: { home: masked, rhu: masked, emergency: masked } },
          { date: "2026-09-17", total: shown(12), tiers: { home: shown(7), rhu: masked, emergency: masked } },
        ]}
      />
    );
    const titles = [...container.querySelectorAll("rect > title")].map((t) => t.textContent);
    expect(titles).toContain("2026-09-16: Fewer than 5 sessions. Hidden to protect patient privacy.");
    expect(titles).toContain("2026-09-17 — Home management: 7");
    expect(titles.some((t) => t?.includes("hidden"))).toBe(true);
  });
});

describe("forms and buttons", () => {
  it("links a field error to its input for screen readers", () => {
    render(<TextField label="Email" error="Required." value="" onChange={() => {}} />);
    const input = screen.getByLabelText(/Email/);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Required.");
  });

  it("disables a busy button", () => {
    render(<Button busy>Save</Button>);
    expect(screen.getByRole("button", { name: /Save/ })).toBeDisabled();
  });

  it("shows an empty state instead of an empty table", () => {
    render(<DataTable columns={[]} rows={[]} rowKey={() => 1} empty="No reports yet." />);
    expect(screen.getByText("No reports yet.")).toBeInTheDocument();
  });
});

describe("format", () => {
  it("keeps a Manila calendar day on the same day", () => {
    expect(formatDate("2026-09-17")).toContain("17");
  });

  it("computes Manila today across the UTC date line", () => {
    // 2026-09-16 20:00 UTC is 2026-09-17 04:00 in Manila.
    expect(manilaToday(new Date("2026-09-16T20:00:00Z"))).toBe("2026-09-17");
  });

  it("shifts dates and describes recency", () => {
    expect(shiftDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(formatRelative("2026-09-17T08:00:00Z", new Date("2026-09-17T11:00:00Z"))).toBe("3 hours ago");
    expect(formatRelative(null)).toBe("never");
  });
});
