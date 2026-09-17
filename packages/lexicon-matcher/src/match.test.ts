import assert from "node:assert/strict";
import { test } from "node:test";
import type { LexiconTerm } from "@mycare/ruleset";
import { editDistance } from "./distance.js";
import { matchSymptoms } from "./match.js";
import { normalize } from "./normalize.js";

/*
 * Fixture lexicon. The words "sipon", "hilanat" and "walay hilanat" are the
 * manuscript's own examples (Table 31, UT-003 and UT-004). The symptom codes
 * they map to here are FIXTURES, not the clinical mapping — that belongs to the
 * authored, reviewed lexicon.
 */
const term = (
  symptomCode: string,
  text: string,
  isNegation = false,
  language: LexiconTerm["language"] = "ceb"
): LexiconTerm => ({ symptomCode, language, term: text, isNegation });

const lexicon: LexiconTerm[] = [
  term("fixture_cold", "sipon"),
  term("fixture_fever", "hilanat"),
  term("fixture_fever", "walay hilanat", true),
];

/* UT-003: "Input 'sip-on' is compared against lexicon term 'sipon' — Correct
   symptom code is assigned despite spelling variation." */
test("UT-003: assigns the symptom code despite spelling variation (sip-on vs sipon)", () => {
  const [match] = matchSymptoms("sip-on", lexicon);
  assert.equal(match?.symptomCode, "fixture_cold");
  assert.equal(match?.negated, false);
  assert.deepEqual(match?.matchedTerm, { term: "sipon", language: "ceb" });
});

test("also absorbs a split word, a typo and capitals", () => {
  assert.equal(matchSymptoms("Sip on", lexicon)[0]?.symptomCode, "fixture_cold");
  assert.equal(matchSymptoms("hilanta", lexicon)[0]?.symptomCode, "fixture_fever");
  assert.equal(matchSymptoms("HILANAT!!", lexicon)[0]?.symptomCode, "fixture_fever");
});

/* UT-004: "Patient enters 'walay hilanat' (no fever) — Symptom is correctly
   excluded, not flagged as present." */
test("UT-004: a negation term excludes the symptom rather than flagging it", () => {
  const matches = matchSymptoms("walay hilanat", lexicon);
  assert.equal(matches.length, 1);
  assert.equal(matches[0]?.symptomCode, "fixture_fever");
  assert.equal(matches[0]?.negated, true);
});

test("negation inside a longer sentence still excludes, and other symptoms still match", () => {
  const matches = matchSymptoms("naa koy sipon pero walay hilanat", lexicon);
  assert.deepEqual(
    matches.map((m) => [m.symptomCode, m.negated]),
    [
      ["fixture_cold", false],
      ["fixture_fever", true],
    ]
  );
});

test("a symptom mentioned both negated and plainly is reported present (fail toward escalation)", () => {
  const [match] = matchSymptoms("walay hilanat gahapon, karon hilanat", lexicon);
  assert.equal(match?.negated, false);
});

test("short words never fuzzy-match, so one symptom cannot become another", () => {
  const shortLexicon = [term("fixture_cough", "ubo"), term("fixture_head", "ulo")];
  assert.deepEqual(matchSymptoms("ulo", shortLexicon).map((m) => m.symptomCode), ["fixture_head"]);
  assert.deepEqual(matchSymptoms("uba", shortLexicon), []);
});

test("matches no word it was not given: an empty lexicon proposes nothing", () => {
  assert.deepEqual(matchSymptoms("hilanat sipon", []), []);
  assert.deepEqual(matchSymptoms("", lexicon), []);
});

test("matches terms from every language, for code-switched text", () => {
  const mixed = [...lexicon, term("fixture_head", "fixtureulo", false, "tl")];
  const matches = matchSymptoms("sipon ug fixtureulo", mixed);
  assert.deepEqual(
    matches.map((m) => [m.symptomCode, m.matchedTerm.language]),
    [
      ["fixture_cold", "ceb"],
      ["fixture_head", "tl"],
    ]
  );
});

test("normalises accents, tildes, apostrophes and punctuation", () => {
  assert.equal(normalize("  Ñaña'y  SAKIT—ulo, é? "), "nanay sakit ulo e");
});

test("edit distance counts an adjacent swap as one edit and stops early past the bound", () => {
  assert.equal(editDistance("hilanat", "hilnaat", 1), 1);
  assert.equal(editDistance("abcdef", "uvwxyz", 1), 2);
});

test("is deterministic", () => {
  const text = "naa koy sipon pero walay hilanat";
  assert.deepEqual(matchSymptoms(text, lexicon), matchSymptoms(text, lexicon));
});
