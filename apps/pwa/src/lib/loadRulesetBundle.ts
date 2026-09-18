import type { RulesetBundle } from "@mycare/ruleset";
import { v1Bundle } from "@mycare/ruleset";

/**
 * Bundled directly at build time: the patient device is fully offline, so
 * there is no first-run fetch to fall back on. Once the Laravel API can
 * author and publish versioned bundles (Phase 3), replace this with a
 * fetch-then-cache-in-IndexedDB loader that falls back to the last cached
 * version when offline — the async signature already supports that swap
 * without touching callers.
 */
export async function loadRulesetBundle(): Promise<RulesetBundle> {
  return v1Bundle;
}
