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
