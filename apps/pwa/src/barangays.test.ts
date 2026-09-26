import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BUNDLED_BARANGAY_NAMES, bundledBarangays, resolveBarangay } from "./barangays";

/*
 * UT-001. The shipped barangay list must be exactly the server's, and a choice
 * made from it must resolve to the server's id - or to nothing - by name.
 */

describe("the barangay list shipped in the app", () => {
  it("matches the server's BarangaySeeder names exactly, in order", () => {
    // Tests run from apps/pwa.
    const seeder = readFileSync(resolve(process.cwd(), "../api/database/seeders/BarangaySeeder.php"), "utf8");
    const block = seeder.match(/const NAMES = \[([\s\S]*?)\];/);
    expect(block, "BarangaySeeder::NAMES not found").not.toBeNull();
    const serverNames = [...block![1]!.matchAll(/'([^']+)'/g)].map((m) => m[1]);

    expect([...BUNDLED_BARANGAY_NAMES]).toEqual(serverNames);
  });

  it("carries no ids, so it can never stamp a session with a guessed one", () => {
    expect(bundledBarangays().every((b) => b.id === null)).toBe(true);
    expect(bundledBarangays()).toHaveLength(15);
  });
});

describe("resolving a choice to the server's barangay", () => {
  const server = [
    { id: 7, name: "Poblacion I", city: "Carcar City" },
    { id: 12, name: "Valladolid", city: "Carcar City" },
  ];

  it("finds the server's id by name, ignoring case and spacing", () => {
    expect(resolveBarangay({ id: null, name: "Valladolid", city: "Carcar City" }, server)?.id).toBe(12);
    expect(resolveBarangay({ id: null, name: "  poblacion   i ", city: "Carcar City" }, server)?.id).toBe(7);
  });

  it("does not confuse Poblacion I with Poblacion II", () => {
    expect(resolveBarangay({ id: null, name: "Poblacion II", city: "Carcar City" }, server)).toBeUndefined();
  });

  it("returns nothing for a barangay the server does not have, rather than guessing", () => {
    expect(resolveBarangay({ id: null, name: "Tuyom", city: "Carcar City" }, server)).toBeUndefined();
  });
});
