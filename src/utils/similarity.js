// Fuzzy duplicate detection for user-typed names (typos, abbreviations, spacing/case).
const normalize = (s) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

const bigrams = (s) => {
  const out = new Map()
  for (let i = 0; i < s.length - 1; i++) {
    const b = s.slice(i, i + 2)
    out.set(b, (out.get(b) ?? 0) + 1)
  }
  return out
}

// Sørensen–Dice coefficient over character bigrams, 0..1.
// ponytail: bigram Dice, swap for Levenshtein if abbreviations like "eng" stop matching
export const similarity = (a, b) => {
  const x = normalize(a), y = normalize(b)
  if (!x || !y) return 0
  if (x === y) return 1
  if (x.length >= 3 && y.length >= 3 && (x.includes(y) || y.includes(x))) return 0.9
  const bx = bigrams(x), by = bigrams(y)
  let common = 0
  for (const [g, n] of bx) common += Math.min(n, by.get(g) ?? 0)
  return (2 * common) / ((x.length - 1) + (y.length - 1))
}

export const isSimilar = (a, b, threshold = 0.5) => similarity(a, b) >= threshold

// For secondary fields (department, city): blank on either side can't rule out a duplicate.
export const isSimilarOrBlank = (a, b) => !normalize(a) || !normalize(b) || isSimilar(a, b)
