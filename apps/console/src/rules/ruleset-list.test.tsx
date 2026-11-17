import type { RulesetStatus, RulesetVersionSummary } from "@mycare/api-client";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

/* Fixture versions — test scaffolding, not clinical content. */
const version = (id: number, label: string, status: RulesetStatus, rules = 23, terms = 0): RulesetVersionSummary => ({
  id,
  label,
  status,
  publishedAt: status === "published" ? "2026-11-01T00:00:00+00:00" : null,
  publishedBy: status === "published" ? "admin@example.org" : null,
  reviewedBy: status === "published" ? "Fixture reviewer (test)" : null,
  counts: { rules, lexiconTerms: terms, severityThresholds: 0, clarificationQuestions: 2, healthTips: 0 },
});

const draft = version(7, "v7", "draft", 23, 335);
const all = [draft, version(6, "v6", "in_review"), version(5, "v5", "published"), version(4, "v4", "superseded"), version(3, "v3", "retired")];

const api = {
  console: {
    versions: vi.fn(async () => all),
    deleteDraft: vi.fn(async () => ({ id: 7, label: "v7" })),
    createDraft: vi.fn(),
    importBundle: vi.fn(),
  },
};

vi.mock("../api", () => ({ api }));

const { RulesetListPage } = await import("./RulesetListPage");

const renderPage = () =>
  render(
    <MemoryRouter>
      <RulesetListPage />
    </MemoryRouter>
  );

describe("Triage rules & lexicon: the version list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.console.versions.mockImplementation(async () => all);
  });

  it("keeps saved-over and retired versions behind a toggle, so the list stays readable", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole("link", { name: "v7" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "v6" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "v5" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "v4" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "v3" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show older versions (2)" }));
    expect(screen.getByRole("link", { name: "v4" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "v3" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Hide older versions" }));
    expect(screen.queryByRole("link", { name: "v4" })).not.toBeInTheDocument();
  });

  it("shows who reviewed and approved each published version", async () => {
    renderPage();
    expect(await screen.findByText("Reviewed and approved by: Fixture reviewer (test)")).toBeInTheDocument();
  });

  it("offers Delete on a draft only, never on a version in review or published", async () => {
    renderPage();
    await screen.findByRole("link", { name: "v7" });

    const buttons = screen.getAllByRole("button", { name: "Delete" });
    expect(buttons).toHaveLength(1);
    expect(within(buttons[0]!.closest("tr")!).getByRole("link", { name: "v7" })).toBeInTheDocument();
  });

  it("says what the draft holds before deleting, and only deletes once confirmed", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Delete" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/23 rules, 335 lexicon terms/)).toBeInTheDocument();
    expect(within(dialog).getByText(/cannot be recovered/)).toBeInTheDocument();
    expect(api.console.deleteDraft).not.toHaveBeenCalled();

    api.console.versions.mockImplementation(async () => all.filter((v) => v.id !== 7));
    await user.click(within(dialog).getByRole("button", { name: "Delete v7" }));

    expect(api.console.deleteDraft).toHaveBeenCalledWith(7);
    await vi.waitFor(() => expect(screen.queryByRole("link", { name: "v7" })).not.toBeInTheDocument());
  });

  it("shows the server's refusal and deletes nothing", async () => {
    api.console.deleteDraft.mockRejectedValueOnce(new Error("v7 is in_review. Only a draft can be deleted."));
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Delete" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete v7" }));

    expect(await screen.findByText(/Only a draft can be deleted/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "v7" })).toBeInTheDocument();
  });
});
