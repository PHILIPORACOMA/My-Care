/**
 * Optimal string alignment distance (Damerau–Levenshtein restricted to one
 * transposition per pair): insertions, deletions, substitutions and adjacent
 * swaps each cost 1. Covers the typing mistakes a phone keyboard produces — a
 * missed letter, a doubled letter, two letters swapped.
 *
 * Returns early once the distance must exceed `max`, since callers only care
 * whether it is within a small bound.
 */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) {
    return max + 1;
  }

  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );

  for (let i = 1; i < rows; i++) {
    let rowMin = Number.POSITIVE_INFINITY;
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, d[i - 2]![j - 2]! + 1);
      }
      d[i]![j] = value;
      rowMin = Math.min(rowMin, value);
    }
    if (rowMin > max) {
      return max + 1;
    }
  }

  return d[a.length]![b.length]!;
}

/**
 * How many edits a word of this length may absorb and still count as a match.
 *
 * Short words get none: "ubo" (cough) and "ulo" (head) are one letter apart,
 * so fuzzy-matching three-letter words would turn one symptom into another.
 * The allowance grows with length, where an accidental collision is far less
 * likely.
 */
export function allowedEdits(length: number): number {
  if (length < 5) return 0;
  if (length < 9) return 1;
  return 2;
}
