// @vitest-environment jsdom
import type { Dashboard, StaffUser, Trends } from "@mycare/api-client";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const staff: StaffUser = {
  id: 2,
  email: "nurse@rhu.example",
  role: "sub_admin",
  roleLabel: "Sub Admin",
  barangayId: 7,
  barangayName: "Valladolid",
};

const cell = (n: number | null) => (n === null ? { display: "<5", suppressed: true, value: null } : { display: String(n), suppressed: false, value: n });

const dashboard: Dashboard = {
  range: { from: "2026-09-01", to: "2026-09-18" },
  total: cell(18),
  tiers: { home: cell(7), rhu: cell(6), emergency: cell(null) },
  topSymptoms: [{ code: "code_a", displayName: "Fixture A", count: cell(12) }],
  computedAt: "2026-09-18T03:00:00+00:00",
};

const trends: Trends = {
  series: [
    { date: "2026-09-17", total: cell(12), tiers: { home: cell(7), rhu: cell(null), emergency: cell(null) } },
    { date: "2026-09-18", total: cell(null), tiers: { home: cell(null), rhu: cell(null), emergency: cell(null) } },
  ],
  clusters: [{ symptomCode: "code_a", displayName: "Fixture A", tier: "rhu", currentWeek: cell(12), changePercent: 38 }],
  currentWeek: { from: "2026-09-12", to: "2026-09-18" },
  watchList: [{ symptomCode: "code_a", displayName: "Fixture A", tier: null, currentWeek: cell(12), changePercent: 38, state: "rising" }],
  computedAt: "2026-09-18T03:00:00+00:00",
};

const api = {
  auth: { me: vi.fn(async () => staff), login: vi.fn(), logout: vi.fn() },
  staff: {
    dashboard: vi.fn(async () => dashboard),
    trends: vi.fn(async () => trends),
    barangays: vi.fn(async () => []),
    syncStatus: vi.fn(),
    map: vi.fn(),
    reports: vi.fn(),
    generateReport: vi.fn(),
    downloadReport: vi.fn(),
  },
};

vi.mock("./api", () => ({ api, onUnauthenticated: () => () => {} }));

const { App } = await import("./App");
const { AuthProvider } = await import("./auth");
const { TrendsPage } = await import("./pages/TrendsPage");

function renderIn(children: React.ReactNode, path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>{children}</AuthProvider>
    </MemoryRouter>
  );
}

const renderApp = () => renderIn(<App />);

describe("portal", () => {
  beforeEach(() => vi.clearAllMocks());

  /* UT-017 and UT-020 as the health worker sees them. */
  it("shows tier counts and never renders a suppressed number", async () => {
    renderApp();

    // The heading renders before the request resolves, so wait for a figure.
    expect(await screen.findByText("7")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Triage overview/ })).toBeInTheDocument();
    // Emergency was under five: masked, with an explanation, and no digit.
    const masked = screen.getAllByTitle(/Fewer than 5/);
    expect(masked.length).toBeGreaterThan(0);
    expect(masked[0]!.textContent).toContain("<5");
  });

  it("names the health worker's own barangay, and offers no barangay chooser", async () => {
    renderApp();

    // Figure 31's heading: "Brgy. {name} — Triage overview".
    await waitFor(() => expect(screen.getByRole("heading", { name: /Brgy\. Valladolid/ })).toBeInTheDocument());
    expect(screen.queryByLabelText("Barangay")).toBeNull();
    expect(api.staff.dashboard).toHaveBeenCalled();
  });

  /*
   * Figure 31 shows "▲ 12% vs last week" under each figure. It is only honest
   * when both periods are displayable: a percentage against a suppressed
   * figure would let a reader solve for the hidden count.
   */
  it("states a change only when both periods are displayable", async () => {
    api.staff.dashboard
      .mockResolvedValueOnce({ ...dashboard, tiers: { home: cell(14), rhu: cell(6), emergency: cell(null) } })
      .mockResolvedValueOnce({ ...dashboard, tiers: { home: cell(7), rhu: cell(6), emergency: cell(null) } });

    renderApp();

    expect(await screen.findByText(/100% vs previous period/)).toBeInTheDocument();
    expect(screen.getByText("No change vs previous period")).toBeInTheDocument();
    // Emergency is suppressed in both periods, so no change line at all.
    expect(screen.getAllByText(/vs previous period/)).toHaveLength(2);
  });

  it("states the cluster banner in words a health worker can act on", async () => {
    renderIn(<TrendsPage />);

    await waitFor(() => expect(screen.getByText(/Possible clusters this week/)).toBeInTheDocument());
    expect(screen.getByText(/38% week-over-week rise in rhu referrals/)).toBeInTheDocument();
    expect(screen.getByText(/Worth a look, not a conclusion/)).toBeInTheDocument();
  });

  /*
   * Figure 32's chart must not size a bar to a hidden count: a suppressed day
   * is a fixed hatched block, and within a shown day the masked tiers collapse
   * into one block whose height is only their sum.
   */
  it("draws suppressed days as hatching rather than a bar", async () => {
    const { container } = renderIn(<TrendsPage />);

    await waitFor(() => expect(container.querySelector("svg")).toBeTruthy());

    const titles = [...container.querySelectorAll("rect > title")].map((t) => t.textContent);
    expect(titles.some((t) => t?.includes("2026-09-18") && t.includes("Fewer than 5"))).toBe(true);
    expect(titles).toContain("2026-09-17 — Home management: 7");
  });
});
