import { ApiError, type FacilityEntry } from "@mycare/api-client";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

/* Placeholder numbers: test scaffolding, not real contact details. */
const rhu: FacilityEntry = {
  id: 1, barangayId: 7, barangayName: "Valladolid", name: "Valladolid RHU", type: "rhu",
  address: null, contactNumber: "0900 000 0001", operatingHours: "8AM-5PM", isActive: true,
};

const api = {
  console: {
    facilities: vi.fn(async () => ({ facilities: [rhu], suggestedTypes: ["emergency_hotline", "rhu", "health_station", "hospital"] })),
    updateFacility: vi.fn(async () => rhu),
    createFacility: vi.fn(async () => rhu),
  },
  staff: { barangays: vi.fn(async () => [{ id: 7, name: "Valladolid" }]) },
};

vi.mock("../api", () => ({ api }));

const { FacilitiesPage } = await import("./FacilitiesPage");

describe("Emergency numbers (console)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the old and new number side by side before saving a change", async () => {
    const user = userEvent.setup();
    render(<FacilitiesPage />);

    await user.click(await screen.findByRole("button", { name: "Edit" }));
    const number = screen.getByLabelText(/Contact number/);
    await user.clear(number);
    await user.type(number, "(032) 000-0099");
    await user.click(screen.getByRole("button", { name: "Review" }));

    // Nothing is sent until the change has been looked at.
    expect(api.console.updateFacility).not.toHaveBeenCalled();
    const confirm = screen.getByRole("dialog");
    expect(within(confirm).getByText("0900 000 0001")).toBeInTheDocument();
    expect(within(confirm).getByText("(032) 000-0099")).toBeInTheDocument();
    expect(within(confirm).getByText(/digit by digit/)).toBeInTheDocument();

    await user.click(within(confirm).getByRole("button", { name: "Save change" }));
    expect(api.console.updateFacility).toHaveBeenCalledWith(1, expect.objectContaining({ contactNumber: "(032) 000-0099" }));
  });

  it("returns to the form with the server's message when a number is refused", async () => {
    api.console.updateFacility.mockRejectedValueOnce(
      new ApiError(422, "Invalid", { contactNumber: ["A phone number needs at least 3 digits."] })
    );
    const user = userEvent.setup();
    render(<FacilitiesPage />);

    await user.click(await screen.findByRole("button", { name: "Edit" }));
    const number = screen.getByLabelText(/Contact number/);
    await user.clear(number);
    await user.type(number, "12");
    await user.click(screen.getByRole("button", { name: "Review" }));
    await user.click(screen.getByRole("button", { name: "Save change" }));

    expect(await screen.findByText("A phone number needs at least 3 digits.")).toBeInTheDocument();
    expect(screen.getByLabelText(/Contact number/)).toHaveValue("12");
  });

  it("warns that phones fall back to 911 before the last number is deactivated", async () => {
    const user = userEvent.setup();
    render(<FacilitiesPage />);

    await user.click(await screen.findByRole("button", { name: "Deactivate" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/falls back to the national emergency number 911/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Deactivate" }));
    expect(api.console.updateFacility).toHaveBeenCalledWith(1, { isActive: false });
  });
});
