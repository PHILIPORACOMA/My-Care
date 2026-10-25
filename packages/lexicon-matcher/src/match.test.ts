import assert from "node:assert/strict";
import { test } from "node:test";
import type { LexiconTerm } from "@mycare/ruleset";
import { editDistance } from "./distance.js";
import { matchSymptoms } from "./match.js";
import { normalize, tokenize, tokenizeClauses } from "./normalize.js";

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

/*
 * "naay hilanat" (I have a fever) is two edits from "walay hilanat" once the
 * words are joined, which a 12-letter join allows. Reading a symptom as absent
 * can under-triage, so a negation must match word for word (BUILD-LOG 9k).
 */
test("a positive mention one or two letters from a negation is never read as the negation", () => {
  const [match] = matchSymptoms("naay hilanat", lexicon);
  assert.equal(match?.symptomCode, "fixture_fever");
  assert.equal(match?.negated, false);
  assert.equal(matchSymptoms("naa koy hilanat", lexicon)[0]?.negated, false);
});

test("a negation still absorbs a typo inside one of its own words, or exact run-together words", () => {
  for (const text of ["wala hilanat", "walay hilnat", "walayhilanat", "Walay-hilanat"]) {
    const [match] = matchSymptoms(text, lexicon);
    assert.equal(match?.negated, true, text);
  }
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

/*
 * One extra word inside a phrase (ADR-0008). The words below are fixtures
 * for the matcher's mechanics, not clinical vocabulary.
 */
const phrases: LexiconTerm[] = [
  term("fixture_belly", "grabe nga sakit sa tiyan"),
  term("fixture_belly_plain", "sakit sa tiyan"),
  term("fixture_head", "sakit akong ulo"),
  term("fixture_head_word", "ulo"),
  ...lexicon,
  term("fixture_cough", "ubo"),
  term("fixture_cough", "walay ubo", true),
];

test("a phrase still matches with one extra word inside it", () => {
  assert.deepEqual(matchSymptoms("grabe kaayo nga sakit sa tiyan", phrases).map((m) => m.symptomCode), ["fixture_belly"]);
  assert.deepEqual(matchSymptoms("sakit kaayo akong ulo karon", phrases).map((m) => m.symptomCode), ["fixture_head"]);
});

test("never with two extra words, and never in place of an exact match", () => {
  assert.deepEqual(matchSymptoms("sakit kaayo gyud akong ulo", phrases).map((m) => m.symptomCode), ["fixture_head_word"]);
  // The exact phrase wins over a looser reading of a longer one.
  assert.deepEqual(matchSymptoms("grabe nga sakit sa tiyan", phrases).map((m) => m.symptomCode), ["fixture_belly"]);
});

test("the extra word is never one that already named a symptom", () => {
  // "ulo" is claimed first, so "sakit sa ulo tiyan" is not stretched into "sakit sa tiyan".
  assert.deepEqual(matchSymptoms("sakit sa ulo tiyan", phrases).map((m) => m.symptomCode), ["fixture_head_word"]);
});

test("the extra word never bridges two clauses", () => {
  const onlyBelly = [term("fixture_belly_plain", "sakit sa tiyan")];
  assert.deepEqual(matchSymptoms("sakit sa ilong, tiyan", onlyBelly), []);
  assert.deepEqual(matchSymptoms("sakit sa ilong. Tiyan", onlyBelly), []);
  assert.deepEqual(matchSymptoms("sakit sa ilong tiyan", onlyBelly).map((m) => m.symptomCode), ["fixture_belly_plain"]);
});

test("a negation never takes an extra word, so a later symptom is not erased", () => {
  const matches = matchSymptoms("walay ubo pero hilanat ko", phrases);
  assert.deepEqual(
    matches.map((m) => [m.symptomCode, m.negated]),
    [
      ["fixture_cough", true],
      ["fixture_fever", false],
    ]
  );
  assert.equal(matchSymptoms("walay kaayo hilanat", phrases)[0]?.negated, false);
});

test("clauses hold the same tokens as tokenize, grouped at punctuation", () => {
  const text = "Sakit akong ulo, ug hilanat! Walay-ubo… karon\nmao ra";
  assert.deepEqual(tokenizeClauses(text).flat(), tokenize(text));
  assert.deepEqual(tokenizeClauses(text), [["sakit", "akong", "ulo"], ["ug", "hilanat"], ["walayubo"], ["karon"], ["mao", "ra"]]);
});
