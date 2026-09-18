import type { LanguageCode } from "@mycare/ruleset";
import en from "../i18n/en.json";
import tl from "../i18n/tl.json";
import ceb from "../i18n/ceb.json";

const TRANSLATIONS: Record<LanguageCode, Record<string, string>> = { en, tl, ceb };

/**
 * UI-chrome strings only (buttons, prompts, result copy). These are a
 * developer's best-effort Filipino/Cebuano and have not been reviewed by a
 * native speaker on the team — do that before shipping. Clinical wording
 * (lexicon terms, rule names) is a separate, clinician-appraised concern —
 * see docs/REPO.md.
 *
 * `vars` fills `{name}` placeholders in the string, e.g. translate(lang,
 * "stepOf", { current: 1, total: 3 }) for a key whose value is "Step
 * {current} of {total}".
 */
export function translate(
  language: LanguageCode,
  key: string,
  vars?: Record<string, string | number>
): string {
  const raw = TRANSLATIONS[language][key] ?? TRANSLATIONS.en[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (match, name: string) => String(vars[name] ?? match));
}
