import { describe, it, expect } from 'vitest'
import { tally, avg, computeAnalytics } from '../../utils/analyticsHelpers'

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
