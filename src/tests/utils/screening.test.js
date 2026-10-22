import { describe, it, expect } from 'vitest'
import { fitScore, screen } from '../../utils/screening'

const DEFAULTS = {
  minTenth: 60, minTwelfth: 60, minCgpa: 6, maxActiveBacklogs: 0, maxTotalBacklogs: null,
  batch: 2026, allowedBranches: [], weightTenth: 0.5, weightTwelfth: 0.5, weightCgpa: 2,
}
const good = { tenthMark: 85, twelfthMark: 80, ugCgpa: 8, arrears: 0, backlogs: 0, graduationYear: 2026, branch: 'CSE' }

describe('fitScore', () => {
  it('is the weighted average of 10th/100, 12th/100 and CGPA/10, out of 100', () => {
    // (0.5*0.85 + 0.5*0.80 + 2*0.80) / 3 * 100
    expect(fitScore(good, DEFAULTS)).toBe(80.8)
  })

  it('is 100 for full marks and 0 for none', () => {
    expect(fitScore({ tenthMark: 100, twelfthMark: 100, ugCgpa: 10 }, DEFAULTS)).toBe(100)
    expect(fitScore({}, DEFAULTS)).toBe(0)
  })

  it('uses diploma when 12th is blank, and scores a missing mark as 0', () => {
    expect(fitScore({ ...good, twelfthMark: null, diplomaMark: 80 }, DEFAULTS)).toBe(80.8)
    expect(fitScore({ ...good, tenthMark: null }, DEFAULTS)).toBe(66.7)
  })

  it('follows the weights, and has no score when every weight is 0', () => {
    expect(fitScore(good, { ...DEFAULTS, weightTenth: 1, weightTwelfth: 0, weightCgpa: 0 })).toBe(85)
    expect(fitScore(good, { ...DEFAULTS, weightTenth: 0, weightTwelfth: 0, weightCgpa: 0 })).toBeNull()
  })

  it('reads numbers sent as strings', () => {
    expect(fitScore({ tenthMark: '85', twelfthMark: '80', ugCgpa: '8' }, { weightTenth: '0.5', weightTwelfth: '0.5', weightCgpa: '2' })).toBe(80.8)
  })
})

describe('screen', () => {
  it('passes a candidate meeting every criterion, exactly at the cut-offs included', () => {
    expect(screen(good, DEFAULTS)).toEqual({ eligible: true, reasons: [], score: 80.8 })
    expect(screen({ ...good, tenthMark: 60, twelfthMark: 60, ugCgpa: 6 }, DEFAULTS).eligible).toBe(true)
  })

  it('names each failed minimum, and a missing mark', () => {
    expect(screen({ ...good, tenthMark: 55 }, DEFAULTS).reasons).toEqual(['10th 55% < 60%'])
    expect(screen({ ...good, twelfthMark: 59.5 }, DEFAULTS).reasons).toEqual(['12th/Diploma 59.5% < 60%'])
    expect(screen({ ...good, ugCgpa: 5.9 }, DEFAULTS).reasons).toEqual(['CGPA 5.9 < 6'])
    expect(screen({ ...good, tenthMark: null, ugCgpa: '' }, DEFAULTS).reasons).toEqual(['missing 10th', 'missing CGPA'])
  })

  it('lets diploma meet the 12th minimum', () => {
    expect(screen({ ...good, twelfthMark: null, diplomaMark: 70 }, DEFAULTS).eligible).toBe(true)
    expect(screen({ ...good, twelfthMark: null, diplomaMark: null }, DEFAULTS).reasons).toEqual(['missing 12th/Diploma'])
  })

  it('checks active and total backlogs separately', () => {
    expect(screen({ ...good, arrears: 1, backlogs: 1 }, DEFAULTS).reasons).toEqual(['1 active backlogs (max 0)'])
    expect(screen({ ...good, backlogs: 5 }, DEFAULTS).eligible).toBe(true)
    expect(screen({ ...good, backlogs: 5 }, { ...DEFAULTS, maxTotalBacklogs: 2 }).reasons).toEqual(['5 total backlogs (max 2)'])
    expect(screen({ ...good, arrears: null }, DEFAULTS).eligible).toBe(true)
  })

  it('checks the batch', () => {
    expect(screen({ ...good, graduationYear: 2025 }, DEFAULTS).reasons).toEqual(['batch 2025, not 2026'])
    expect(screen({ ...good, graduationYear: null }, DEFAULTS).reasons).toEqual(['missing batch'])
  })

  it('checks the branch against the allowed list, ignoring case and spaces; empty allows all', () => {
    const taking = { ...DEFAULTS, allowedBranches: ['CSE', ' Information Technology'] }
    expect(screen({ ...good, branch: ' cse ' }, taking).eligible).toBe(true)
    expect(screen({ ...good, branch: 'Civil' }, taking).reasons).toEqual(['branch Civil not taken'])
    expect(screen({ ...good, branch: '' }, taking).reasons).toEqual(['missing branch'])
    expect(screen({ ...good, branch: 'Civil' }, DEFAULTS).eligible).toBe(true)
  })

  it('skips every criterion that is off', () => {
    const off = { ...DEFAULTS, minTenth: null, minTwelfth: null, minCgpa: null, maxActiveBacklogs: null, batch: null }
    expect(screen({ arrears: 9, backlogs: 9 }, off)).toEqual({ eligible: true, reasons: [], score: 0 })
  })

  it('lists every reason in criterion order', () => {
    const bad = { tenthMark: 40, twelfthMark: 40, ugCgpa: 4, arrears: 2, backlogs: 3, graduationYear: 2024, branch: 'ME' }
    expect(screen(bad, { ...DEFAULTS, maxTotalBacklogs: 1, allowedBranches: ['CSE'] }).reasons).toEqual([
      '10th 40% < 60%', '12th/Diploma 40% < 60%', 'CGPA 4 < 6', '2 active backlogs (max 0)',
      '3 total backlogs (max 1)', 'batch 2024, not 2026', 'branch ME not taken',
    ])
  })

  it('treats an event without screening as everyone eligible', () => {
    expect(screen(good, undefined)).toEqual({ eligible: true, reasons: [], score: null })
  })
})
