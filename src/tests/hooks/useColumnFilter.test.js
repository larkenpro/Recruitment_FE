import { describe, it, expect } from 'vitest'
import { rowMatches } from '../../hooks/useColumnFilter'

describe('rowMatches', () => {
  const keys = [
    { key: 'status', type: 'multi', getVal: (r) => r.status },
    { key: 'branch', getVal: (r) => r.branch },
    { key: 'cgpa', type: 'min', getVal: (r) => r.cgpa },
    { key: 'name', type: 'text', getVal: (r) => r.name },
  ]
  const row = { status: 'HOLD', branch: 'CSE', cgpa: 8, name: 'Asha Rao' }

  it('a multi filter matches any of its values, and an empty one matches everything', () => {
    expect(rowMatches(row, keys, { status: ['SHORTLISTED', 'HOLD'] })).toBe(true)
    expect(rowMatches(row, keys, { status: ['SHORTLISTED'] })).toBe(false)
    expect(rowMatches(row, keys, { status: [] })).toBe(true)
    expect(rowMatches(row, keys, {})).toBe(true)
  })

  it('an undecided row fails a multi filter that has values', () => {
    expect(rowMatches({ ...row, status: null }, keys, { status: ['SHORTLISTED', 'HOLD'] })).toBe(false)
  })

  it('every filter must hold', () => {
    expect(rowMatches(row, keys, { status: ['HOLD'], branch: 'CSE', cgpa: 7.5, name: 'asha' })).toBe(true)
    expect(rowMatches(row, keys, { status: ['HOLD'], branch: 'ECE' })).toBe(false)
    expect(rowMatches(row, keys, { cgpa: 9 })).toBe(false)
  })
})
