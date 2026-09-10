/**
 * Count occurrences of each key across an array.
 * Returns [{name, value}] sorted by value descending.
 * Items where getKey returns null/undefined are skipped.
 */
export function tally(arr, getKey) {
  const map = {}
  arr.forEach(item => {
    const key = getKey(item)
    if (key == null || key === '') return
    map[key] = (map[key] ?? 0) + 1
  })
  return Object.entries(map)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
}

/**
 * Average of numeric values across an array.
 * Skips null/undefined/NaN entries.
 * Returns a string fixed to 2 decimal places, or '—' when no valid values exist.
 */
export function avg(arr, getVal) {
  const vals = arr.map(getVal).filter(v => v != null && !isNaN(Number(v)))
  if (!vals.length) return '—'
  return (vals.reduce((s, v) => s + Number(v), 0) / vals.length).toFixed(2)
}

/**
 * Group an array by a key, then reduce each group to one number.
 * Returns [{name, value}] sorted by value descending, groups with a null/empty key skipped.
 */
export function groupAndAggregate(arr, getKey, aggregate) {
  const groups = {}
  arr.forEach(item => {
    const key = getKey(item)
    if (key == null || key === '') return
    ;(groups[key] ??= []).push(item)
  })
  return Object.entries(groups)
    .map(([name, items]) => ({ name, value: aggregate(items) }))
    .sort((a, b) => b.value - a.value)
}

/**
 * Merge any number of candidates' round results into one row per round for a
 * side-by-side comparison table.
 *
 * Rows are keyed on event + round, so a round several candidates sat collapses onto a
 * single row; `values` holds only the candidates who actually sat it, so a missing id
 * means "did not attend". Row order follows first appearance, which keeps a candidate's
 * rounds grouped instead of interleaving by id.
 *
 * @param candidateRounds `[{ id, events }]`, where events is the /round-results payload:
 *   `[{ eventId, collegeName, recruitmentYear, rounds: [{ roundId, roundName, score, result }] }]`
 * @returns `[{ key, label, type: 'round', values: { [candidateId]: round } }]`
 */
export function buildRoundComparisonRows(candidateRounds = []) {
  const rows = new Map()
  candidateRounds.forEach(({ id, events = [] }) => {
    events.forEach(ev => (ev.rounds ?? []).forEach(round => {
      const key = `${ev.eventId}-${round.roundId}`
      if (!rows.has(key)) {
        rows.set(key, {
          key,
          label: `${ev.collegeName} (${ev.recruitmentYear}) · ${round.roundName}`,
          type: 'round',
          values: {},
        })
      }
      rows.get(key).values[id] = round
    }))
  })
  return [...rows.values()]
}

/**
 * Average round-result score grouped by interview round type (e.g. GD, Technical, HR).
 */
// Fixed display order for the "Average Score by Round Type" chart — round types
// not listed here (e.g. WRITTEN, CODING) sort alphabetically after these.
const ROUND_TYPE_ORDER = ['GROUP_DISCUSSION', 'TECHNICAL', 'HR']

export function computeScoreByRoundType(roundResults) {
  const byType = groupAndAggregate(roundResults, r => r.roundType, items => Number(avg(items, r => r.score)))
  return byType.sort((a, b) => {
    const ai = ROUND_TYPE_ORDER.indexOf(a.name)
    const bi = ROUND_TYPE_ORDER.indexOf(b.name)
    if (ai === -1 && bi === -1) return a.name.localeCompare(b.name)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })
}

/**
 * Derive all analytics stats from a flat candidate array.
 * Returns null when the array is empty.
 */
export function computeAnalytics(candidates) {
  if (!candidates.length) return null

  const total = candidates.length
  const withActiveBacklogs = candidates.filter(c => (c.arrears ?? 0) > 0).length
  const withTotalBacklogs = candidates.filter(c => (c.backlogs ?? 0) > 0).length
  const avgCgpa = avg(candidates, c => c.ugCgpa)
  const avg10th = avg(candidates, c => c.tenthMark)
  const avg12th = avg(candidates, c => c.twelfthMark)

  const byBranch = tally(candidates, c => c.branch)
  const byCollege = tally(candidates, c => c.college?.name)
  const byLocation = tally(candidates, c => c.jobLocation)

  const positionCounts = {}
  candidates.forEach(c => {
    const p1 = c.preferredPosition1?.title
    const p2 = c.preferredPosition2?.title
    if (p1) positionCounts[p1] = (positionCounts[p1] ?? 0) + 1
    if (p2) positionCounts[p2] = (positionCounts[p2] ?? 0) + 1
  })
  const byPosition = Object.entries(positionCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  return { total, withActiveBacklogs, withTotalBacklogs, avgCgpa, avg10th, avg12th, byBranch, byCollege, byLocation, byPosition }
}

/**
 * The recruitment funnel proper — the tail of PIPELINE_STAGES (6 Month Review onwards)
 * is post-hire retention, not hiring, so it is left out.
 */
export const FUNNEL_STAGES = ['Resume', 'Rounds', 'Offer', 'Joining']

/**
 * Roll per-event stage summaries into one funnel across every event.
 *
 * Counts are distinct candidates, not (event, candidate) rows: someone who sits two
 * college drives is one person in the funnel, which is what the conversion rates mean.
 * `advanced` is defined as "reached the next step" rather than read off a status, so
 * the three segments always add back up to the step's own total.
 *
 * Stage rows are filtered through `candidateIds`, which is what makes `reached` a subset
 * of `applied` by construction — without it a stale history row for a deleted candidate
 * pushes a step above the one before it and the conversion reads over 100%.
 *
 * @param candidateIds `Set` of live candidate ids; its size is the entry step
 * @param summariesByStage `{ [stageName]: [{ candidateId, status }] }`, merged across events
 * @returns `[{ name, reached, rejected, advanced, inProgress, from, conversion }]`,
 *   where `conversion` is the percentage of the previous step that reached this one
 *   (null on the first step).
 */
export function buildFunnel(candidateIds, summariesByStage) {
  const steps = [
    { name: 'Applied', reached: candidateIds.size, rejected: 0 },
    ...FUNNEL_STAGES.map(stage => {
      const rows = (summariesByStage[stage] ?? []).filter(r => candidateIds.has(r.candidateId))
      return {
        name: stage,
        reached: new Set(rows.map(r => r.candidateId)).size,
        rejected: new Set(rows.filter(r => r.status === 'REJECTED').map(r => r.candidateId)).size,
      }
    }),
  ]

  return steps.map((step, i) => {
    const advanced = steps[i + 1]?.reached ?? 0
    const prev = steps[i - 1]
    return {
      ...step,
      advanced,
      inProgress: Math.max(0, step.reached - advanced - step.rejected),
      from: prev?.name ?? null,
      conversion: prev && prev.reached ? (step.reached / prev.reached) * 100 : null,
    }
  })
}

/**
 * Per-college counts for the campus effectiveness table.
 *
 * Metrics are declarative so the table can grow without touching this function: each one
 * is either a plain candidate count (no `stage`) or the distinct candidates from that
 * college who reached `stage`, optionally narrowed to a `status`. Early attrition drops in
 * as one more entry once there is a stage to count it from.
 *
 * Counts are distinct candidates, so someone who sat two drives for the same college is
 * one person. A stage row whose candidate is unknown is ignored, which keeps a stale
 * history row from inflating a college the same way it once inflated the funnel.
 *
 * @param candidates flat candidate array, each with `college.name`
 * @param summariesByStage `{ [stageName]: [{ candidateId, status }] }`, merged across events
 * @param metrics `[{ key, label, stage?, status? }]`
 * @returns `[{ college, [metric.key]: count }]`, sorted by the first metric descending
 */
export function buildCampusRows(candidates, summariesByStage, metrics) {
  const collegeOf = new Map(candidates.map(c => [c.id, c.college?.name]))
  const zeroed = Object.fromEntries(metrics.map(m => [m.key, 0]))

  const rows = new Map()
  candidates.forEach(c => {
    const college = c.college?.name
    if (college && !rows.has(college)) rows.set(college, { college, ...zeroed })
  })

  metrics.forEach(metric => {
    if (!metric.stage) {
      candidates.forEach(c => {
        const row = rows.get(c.college?.name)
        if (row) row[metric.key] += 1
      })
      return
    }
    const counted = new Set()
    ;(summariesByStage[metric.stage] ?? []).forEach(({ candidateId, status }) => {
      if (metric.status && status !== metric.status) return
      if (counted.has(candidateId)) return
      const row = rows.get(collegeOf.get(candidateId))
      if (!row) return
      counted.add(candidateId)
      row[metric.key] += 1
    })
  })

  const [first] = metrics
  return [...rows.values()].sort((a, b) => b[first.key] - a[first.key])
}
