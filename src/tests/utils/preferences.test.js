import { describe, it, expect } from 'vitest'
import { hasInternship, hasItPosition, tickedPairs } from '../../utils/preferences'

const pair = (department) => ({ position: { id: 1, title: 'X', department }, type: { id: 1, name: 'FTE' } })
const typed = (id, name) => ({ position: { id: 1, title: 'X' }, type: { id, name } })

describe('hasItPosition', () => {
  it('matches the IT department regardless of case and spacing', () => {
    expect(hasItPosition([pair('Merchandising'), pair('IT')])).toBe(true)
    expect(hasItPosition([pair(' it ')])).toBe(true)
  })
  it('is false for other, blank or missing departments and for no positions', () => {
    expect(hasItPosition([pair('Merchandising'), pair(''), pair(null), pair(undefined)])).toBe(false)
    expect(hasItPosition([])).toBe(false)
  })
})

describe('hasInternship', () => {
  it('is true for the Internship and Intern-to-FTE types', () => {
    expect(hasInternship([typed(2, 'FTE'), typed(1, 'Internship')])).toBe(true)
    expect(hasInternship([typed(3, 'Intern-to-FTE')])).toBe(true)
  })
  it('is false for FTE only, and for no positions', () => {
    expect(hasInternship([typed(2, 'FTE')])).toBe(false)
    expect(hasInternship([])).toBe(false)
  })
})

describe('tickedPairs', () => {
  it('keeps only the ticked pairs, in ranked order', () => {
    const ranked = [typed(2, 'FTE'), typed(1, 'Internship'), typed(3, 'Intern-to-FTE')]
    expect(tickedPairs(ranked, new Set(['1:3', '1:2'])).map((p) => p.type.name)).toEqual(['FTE', 'Intern-to-FTE'])
  })
})
