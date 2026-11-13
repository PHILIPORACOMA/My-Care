import { v1Bundle } from "@mycare/ruleset";
import { describe, expect, it } from "vitest";
import { CHIP_GROUPS, groupChips } from "./chip-groups";
import { withDemoLexicon } from "./demo";
import { chipsFor } from "./triage";

// Figure 22's chip groups are layout only; these tests guard the one way
// layout could hurt a patient: a chip that goes missing or appears twice.
describe("symptom chip groups", () => {
  it("places every v1 chip in a named body-area group, none in Other", () => {
    const groups = groupChips(chipsFor(v1Bundle, "en"));
    expect(groups.map((g) => g.id)).not.toContain("other");
    expect(groups.flatMap((g) => g.chips.map((c) => c.code)).sort()).toEqual(
      chipsFor(v1Bundle, "en")
        .map((c) => c.code)
        .sort()
    );
  });

  it("places the demo's invented presentation with the stomach chips", () => {
    const groups = groupChips(chipsFor(withDemoLexicon(v1Bundle)!, "en"));
    expect(groups.find((g) => g.id === "stomach")?.chips.map((c) => c.code)).toContain("demo_abdominal_pain");
    expect(groups.map((g) => g.id)).not.toContain("other");
  });

  it("never lists a code in two groups", () => {
    const codes = CHIP_GROUPS.flatMap((g) => g.codes);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("puts a code it does not know under Other instead of dropping it", () => {
    const groups = groupChips([
      { code: "fever_mild", label: "Fever" },
      { code: "brand_new_code", label: "Something new" },
    ]);
    expect(groups.map((g) => g.id)).toEqual(["fever", "other"]);
    expect(groups[1]?.chips).toEqual([{ code: "brand_new_code", label: "Something new" }]);
  });

  it("shows no empty group", () => {
    const groups = groupChips([{ code: "back_pain", label: "Back pain" }]);
    expect(groups.map((g) => g.id)).toEqual(["muscles"]);
    expect(groupChips([])).toEqual([]);
  });

  it("keeps the label the chip came with, in any language", () => {
    const tl = chipsFor(withDemoLexicon(v1Bundle)!, "tl");
    const grouped = groupChips(tl).flatMap((g) => g.chips);
    for (const chip of tl) expect(grouped).toContainEqual(chip);
  });
});
