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
