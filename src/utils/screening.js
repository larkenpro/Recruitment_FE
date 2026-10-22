// An event's eligibility criteria and fit-score weights (event.screening) applied to one application.
// A null criterion is off. Diploma % stands in for 12th when 12th is blank.

const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v))
const norm = (s) => String(s ?? '').trim().toLowerCase()

export const twelfthOrDiploma = (a) => num(a.twelfthMark) ?? num(a.diplomaMark)

function minimum(reasons, label, value, min, unit = '') {
  if (min === null) return
  if (value === null) reasons.push(`missing ${label}`)
  else if (value < min) reasons.push(`${label} ${value}${unit} < ${min}${unit}`)
}

export const DEFAULT_ROUND_WEIGHT = 1

/**
 * Weighted average, out of 100 (1 dp), of 10th/100, 12th/100 and CGPA/10 — a missing mark scores 0 —
 * plus each round's score / its maximum marks, weighted by s.roundWeights[roundId] (default 1).
 * `rounds` are [{ roundId, score, maxScore }]; one without a score is left out, so the score builds
 * up round by round. Same as Screening.fitScore in the backend — change both.
 */
export function fitScore(a, s, rounds = []) {
  const parts = [
    [num(s.weightTenth) ?? 0, (num(a.tenthMark) ?? 0) / 100],
    [num(s.weightTwelfth) ?? 0, (twelfthOrDiploma(a) ?? 0) / 100],
    [num(s.weightCgpa) ?? 0, (num(a.ugCgpa) ?? 0) / 10],
    ...rounds
      .filter((r) => num(r.score) !== null && r.maxScore > 0)
      .map((r) => [num(s.roundWeights?.[r.roundId]) ?? DEFAULT_ROUND_WEIGHT, num(r.score) / r.maxScore]),
  ]
  const total = parts.reduce((sum, [w]) => sum + w, 0)
  if (total <= 0) return null
  return Math.round((parts.reduce((sum, [w, x]) => sum + w * x, 0) / total) * 1000) / 10
}

/** { eligible, reasons, score } — reasons in criterion order, empty when eligible. */
export function screen(a, s) {
  if (!s) return { eligible: true, reasons: [], score: null }
  const reasons = []
  minimum(reasons, '10th', num(a.tenthMark), num(s.minTenth), '%')
  minimum(reasons, '12th/Diploma', twelfthOrDiploma(a), num(s.minTwelfth), '%')
  minimum(reasons, 'CGPA', num(a.ugCgpa), num(s.minCgpa))

  const active = num(a.arrears) ?? 0
  const maxActive = num(s.maxActiveBacklogs)
  if (maxActive !== null && active > maxActive) reasons.push(`${active} active backlogs (max ${maxActive})`)
  const total = num(a.backlogs) ?? 0
  const maxTotal = num(s.maxTotalBacklogs)
  if (maxTotal !== null && total > maxTotal) reasons.push(`${total} total backlogs (max ${maxTotal})`)

  const batch = num(s.batch)
  if (batch !== null) {
    const year = num(a.graduationYear)
    if (year === null) reasons.push('missing batch')
    else if (year !== batch) reasons.push(`batch ${year}, not ${batch}`)
  }

  const allowed = (s.allowedBranches ?? []).map(norm)
  if (allowed.length > 0) {
    if (!norm(a.branch)) reasons.push('missing branch')
    else if (!allowed.includes(norm(a.branch))) reasons.push(`branch ${a.branch} not taken`)
  }

  return { eligible: reasons.length === 0, reasons, score: fitScore(a, s) }
}
