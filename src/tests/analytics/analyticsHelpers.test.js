import { describe, it, expect } from 'vitest'
import { tally, avg, computeAnalytics, buildRoundComparisonRows, buildFunnel, buildCampusRows } from '../../utils/analyticsHelpers'

// ── tally ─────────────────────────────────────────────────────────────────────

describe('tally', () => {
  it('counts occurrences of each key', () => {
    const data = [{ b: 'CSE' }, { b: 'ECE' }, { b: 'CSE' }, { b: 'CSE' }]
    const result = tally(data, d => d.b)
    expect(result).toEqual([
      { name: 'CSE', value: 3 },
      { name: 'ECE', value: 1 },
    ])
  })

  it('returns results sorted by value descending', () => {
    const data = [
      { v: 'A' }, { v: 'B' }, { v: 'B' }, { v: 'C' },
      { v: 'C' }, { v: 'C' },
    ]
    const result = tally(data, d => d.v)
    const values = result.map(r => r.value)
    expect(values).toEqual([...values].sort((a, b) => b - a))
  })

  it('skips items where getKey returns null', () => {
    const data = [{ b: 'CSE' }, { b: null }, { b: 'ECE' }]
    const result = tally(data, d => d.b)
    expect(result.map(r => r.name)).not.toContain(null)
    expect(result.length).toBe(2)
  })

  it('skips items where getKey returns undefined', () => {
    const data = [{ b: 'CSE' }, {}, { b: 'CSE' }]
    const result = tally(data, d => d.b)
    expect(result).toEqual([{ name: 'CSE', value: 2 }])
  })

  it('skips items where getKey returns empty string', () => {
    const data = [{ b: '' }, { b: 'ECE' }]
    const result = tally(data, d => d.b)
    expect(result).toEqual([{ name: 'ECE', value: 1 }])
  })

  it('returns an empty array for an empty input', () => {
    expect(tally([], d => d.b)).toEqual([])
  })

  it('returns an empty array when all keys are null', () => {
    const data = [{ b: null }, { b: null }]
    expect(tally(data, d => d.b)).toEqual([])
  })

  it('works with nested key access', () => {
    const data = [
      { college: { name: 'MIT' } },
      { college: { name: 'MIT' } },
      { college: { name: 'IIT' } },
      { college: null },
    ]
    const result = tally(data, d => d.college?.name)
    expect(result).toEqual([
      { name: 'MIT', value: 2 },
      { name: 'IIT', value: 1 },
    ])
  })
})

// ── avg ───────────────────────────────────────────────────────────────────────

describe('avg', () => {
  it('returns the average of numeric values as a 2dp string', () => {
    const data = [{ v: 8 }, { v: 9 }, { v: 7 }]
    expect(avg(data, d => d.v)).toBe('8.00')
  })

  it('rounds to 2 decimal places', () => {
    const data = [{ v: 7 }, { v: 8 }, { v: 9 }, { v: 10 }]
    expect(avg(data, d => d.v)).toBe('8.50')
  })

  it('skips null values', () => {
    const data = [{ v: 10 }, { v: null }, { v: 8 }]
    expect(avg(data, d => d.v)).toBe('9.00')
  })

  it('skips undefined values', () => {
    const data = [{ v: 10 }, {}, { v: 6 }]
    expect(avg(data, d => d.v)).toBe('8.00')
  })

  it('skips NaN values', () => {
    const data = [{ v: 10 }, { v: NaN }, { v: 6 }]
    expect(avg(data, d => d.v)).toBe('8.00')
  })

  it('returns "—" for an empty array', () => {
    expect(avg([], d => d.v)).toBe('—')
  })

  it('returns "—" when all values are null', () => {
    const data = [{ v: null }, { v: null }]
    expect(avg(data, d => d.v)).toBe('—')
  })

  it('handles string numbers', () => {
    const data = [{ v: '8.5' }, { v: '9.5' }]
    expect(avg(data, d => d.v)).toBe('9.00')
  })
})

// ── computeAnalytics ──────────────────────────────────────────────────────────

describe('computeAnalytics', () => {
  const base = {
    branch: 'CSE',
    college: { name: 'MIT' },
    jobLocation: 'Gurugram NCR',
    ugCgpa: 8.5,
    tenthMark: 90,
    twelfthMark: 85,
    backlogs: 0,
    preferredPosition1: { title: 'Software Engineer' },
    preferredPosition2: null,
  }

  it('returns null for an empty array', () => {
    expect(computeAnalytics([])).toBeNull()
  })

  it('returns correct total', () => {
    const result = computeAnalytics([base, base])
    expect(result.total).toBe(2)
  })

  it('counts candidates with total backlogs correctly', () => {
    const withBacklog = { ...base, backlogs: 2 }
    const result = computeAnalytics([base, base, withBacklog])
    expect(result.withTotalBacklogs).toBe(1)
  })

  it('counts candidates with active backlogs correctly', () => {
    const withArrears = { ...base, arrears: 1 }
    const result = computeAnalytics([base, base, withArrears])
    expect(result.withActiveBacklogs).toBe(1)
  })

  it('treats missing backlogs/arrears fields as zero', () => {
    const noFields = { ...base, backlogs: undefined, arrears: undefined }
    const result = computeAnalytics([noFields])
    expect(result.withTotalBacklogs).toBe(0)
    expect(result.withActiveBacklogs).toBe(0)
  })

  it('computes avgCgpa correctly', () => {
    const a = { ...base, ugCgpa: 8 }
    const b = { ...base, ugCgpa: 9 }
    const result = computeAnalytics([a, b])
    expect(result.avgCgpa).toBe('8.50')
  })

  it('computes avg10th and avg12th', () => {
    const result = computeAnalytics([base])
    expect(result.avg10th).toBe('90.00')
    expect(result.avg12th).toBe('85.00')
  })

  it('groups byBranch sorted by count descending', () => {
    const cse = { ...base, branch: 'CSE' }
    const ece = { ...base, branch: 'ECE' }
    const result = computeAnalytics([cse, cse, ece])
    expect(result.byBranch[0]).toEqual({ name: 'CSE', value: 2 })
    expect(result.byBranch[1]).toEqual({ name: 'ECE', value: 1 })
  })

  it('groups byCollege correctly', () => {
    const result = computeAnalytics([base, base])
    expect(result.byCollege).toEqual([{ name: 'MIT', value: 2 }])
  })

  it('groups byLocation correctly', () => {
    const result = computeAnalytics([base])
    expect(result.byLocation).toEqual([{ name: 'Gurugram NCR', value: 1 }])
  })

  it('counts byPosition from both pref1 and pref2', () => {
    const c1 = {
      ...base,
      preferredPosition1: { title: 'SDE' },
      preferredPosition2: { title: 'BA' },
    }
    const c2 = {
      ...base,
      preferredPosition1: { title: 'SDE' },
      preferredPosition2: null,
    }
    const result = computeAnalytics([c1, c2])
    const sde = result.byPosition.find(p => p.name === 'SDE')
    const ba = result.byPosition.find(p => p.name === 'BA')
    expect(sde?.value).toBe(2)
    expect(ba?.value).toBe(1)
  })

  it('excludes null preferences from byPosition', () => {
    const noPrefs = { ...base, preferredPosition1: null, preferredPosition2: null }
    const result = computeAnalytics([noPrefs])
    expect(result.byPosition).toEqual([])
  })

  it('returns all expected keys', () => {
    const result = computeAnalytics([base])
    expect(result).toMatchObject({
      total: expect.any(Number),
      withActiveBacklogs: expect.any(Number),
      withTotalBacklogs: expect.any(Number),
      avgCgpa: expect.any(String),
      avg10th: expect.any(String),
      avg12th: expect.any(String),
      byBranch: expect.any(Array),
      byCollege: expect.any(Array),
      byLocation: expect.any(Array),
      byPosition: expect.any(Array),
    })
  })
})

// ── buildRoundComparisonRows ──────────────────────────────────────────────────

describe('buildRoundComparisonRows', () => {
  const event = (eventId, rounds) => ({
    eventId,
    collegeName: 'NIT',
    recruitmentYear: 2025,
    rounds,
  })
  const round = (roundId, roundName, score, result) => ({ roundId, roundName, score, result })

  it('collapses a round several candidates sat onto one row', () => {
    const rows = buildRoundComparisonRows([
      { id: 1, events: [event(1, [round(10, 'Technical', 8, 'PASS')])] },
      { id: 2, events: [event(1, [round(10, 'Technical', 6, 'FAIL')])] },
      { id: 3, events: [event(1, [round(10, 'Technical', 9, 'PASS')])] },
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].values[1].score).toBe(8)
    expect(rows[0].values[2].score).toBe(6)
    expect(rows[0].values[3].score).toBe(9)
    expect(rows[0].label).toBe('NIT (2025) \u00b7 Technical')
  })

  it('omits candidates who did not sit a round', () => {
    const rows = buildRoundComparisonRows([
      { id: 1, events: [event(1, [round(10, 'Technical', 8, 'PASS')])] },
      { id: 2, events: [event(1, [round(11, 'HR', 7, 'PASS')])] },
    ])
    expect(rows).toHaveLength(2)
    expect(rows.find(r => r.key === '1-10').values).toEqual({ 1: expect.any(Object) })
    expect(rows.find(r => r.key === '1-11').values).toEqual({ 2: expect.any(Object) })
  })

  it('does not merge same round ids across different events', () => {
    const rows = buildRoundComparisonRows([
      { id: 1, events: [event(1, [round(10, 'Technical', 8, 'PASS')])] },
      { id: 2, events: [event(2, [round(10, 'Technical', 5, 'FAIL')])] },
    ])
    expect(rows).toHaveLength(2)
  })

  it('scales past two candidates', () => {
    const rows = buildRoundComparisonRows(
      [1, 2, 3, 4, 5].map(id => ({ id, events: [event(1, [round(10, 'Technical', id, 'PASS')])] }))
    )
    expect(rows).toHaveLength(1)
    expect(Object.keys(rows[0].values)).toHaveLength(5)
  })

  it('returns an empty list for no candidates or no rounds', () => {
    expect(buildRoundComparisonRows([])).toEqual([])
    expect(buildRoundComparisonRows()).toEqual([])
    expect(buildRoundComparisonRows([{ id: 1, events: [] }])).toEqual([])
  })
})

describe('buildFunnel', () => {
  const summaries = {
    Resume: [
      { candidateId: 1, status: 'SHORTLISTED' },
      { candidateId: 2, status: 'SHORTLISTED' },
      { candidateId: 3, status: 'REJECTED' },
      { candidateId: 1, status: 'SHORTLISTED' }, // same person, second event
    ],
    Rounds: [{ candidateId: 1, status: 'SHORTLISTED' }, { candidateId: 2, status: 'REJECTED' }],
    Offer: [{ candidateId: 1, status: 'SHORTLISTED' }],
    Joining: [{ candidateId: 1, status: null }],
  }

  it('counts distinct candidates per stage and converts off the previous stage', () => {
    const [applied, resume, rounds, offer, joining] = buildFunnel(new Set([1, 2, 3, 4, 5, 6]), summaries)

    expect(applied).toMatchObject({ name: 'Applied', reached: 6, advanced: 3, inProgress: 3, conversion: null })
    expect(resume).toMatchObject({ name: 'Resume', reached: 3, rejected: 1, advanced: 2, inProgress: 0, from: 'Applied' })
    expect(resume.conversion).toBeCloseTo(50)
    expect(rounds).toMatchObject({ reached: 2, rejected: 1, advanced: 1, inProgress: 0 })
    expect(offer).toMatchObject({ reached: 1, advanced: 1 })
    expect(joining).toMatchObject({ reached: 1, advanced: 0, inProgress: 1 })
  })

  it('reports no conversion rather than dividing by zero on an empty funnel', () => {
    const steps = buildFunnel(new Set(), {})
    expect(steps.every(s => s.conversion === null)).toBe(true)
    expect(steps.every(s => s.reached === 0 && s.inProgress === 0)).toBe(true)
  })

  // candidate_stage_history had no delete cascade before V29, so a deleted candidate's rows
  // survived and pushed a stage above the one feeding it — the funnel read 166.7% on real data.
  it('ignores stage rows for candidates that no longer exist', () => {
    const [applied, resume] = buildFunnel(new Set([1, 2, 3]), summaries)

    expect(applied.reached).toBe(3)
    expect(resume.reached).toBe(3)
    expect(resume.conversion).toBeCloseTo(100)
  })

  it('never reports a conversion above 100%', () => {
    const ghosts = { Resume: [7, 8, 9, 10].map(candidateId => ({ candidateId, status: 'SHORTLISTED' })) }
    const steps = buildFunnel(new Set([1]), ghosts)

    expect(steps.every(s => s.conversion == null || s.conversion <= 100)).toBe(true)
  })
})

describe('buildCampusRows', () => {
  const METRICS = [
    { key: 'applications', label: 'Applications' },
    { key: 'shortlists', label: 'Shortlists', stage: 'Resume', status: 'SHORTLISTED' },
    { key: 'offered', label: 'Offered', stage: 'Offer' },
  ]

  const candidates = [
    { id: 1, college: { name: 'NIT' } },
    { id: 2, college: { name: 'NIT' } },
    { id: 3, college: { name: 'CET' } },
    { id: 4, college: null },
  ]

  const summaries = {
    Resume: [
      { candidateId: 1, status: 'SHORTLISTED' },
      { candidateId: 1, status: 'SHORTLISTED' }, // same person, second drive
      { candidateId: 2, status: 'REJECTED' },
      { candidateId: 3, status: 'SHORTLISTED' },
      { candidateId: 99, status: 'SHORTLISTED' }, // stale row, candidate is gone
    ],
    Offer: [{ candidateId: 1, status: null }],
  }

  it('counts distinct candidates per college and honours the status filter', () => {
    const [nit, cet] = buildCampusRows(candidates, summaries, METRICS)

    expect(nit).toEqual({ college: 'NIT', applications: 2, shortlists: 1, offered: 1 })
    expect(cet).toEqual({ college: 'CET', applications: 1, shortlists: 1, offered: 0 })
  })

  it('skips candidates with no college and stage rows with no candidate', () => {
    const rows = buildCampusRows(candidates, summaries, METRICS)

    expect(rows.map(r => r.college)).toEqual(['NIT', 'CET'])
    expect(rows.reduce((n, r) => n + r.shortlists, 0)).toBe(2) // id 99 not counted anywhere
  })

  it('zero-fills a metric whose stage has no rows, so a later column needs no other change', () => {
    const withAttrition = [...METRICS, { key: 'attrition', label: 'Early Attrition', stage: 'Exit' }]

    expect(buildCampusRows(candidates, summaries, withAttrition)[0].attrition).toBe(0)
  })
})
