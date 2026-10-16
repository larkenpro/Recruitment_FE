import { describe, it, expect } from 'vitest'
import { hasInternship, hasItPosition, offerPairs, tickedPairs } from '../../utils/preferences'

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

describe('offerPairs', () => {
  const fte = { id: 2, name: 'FTE' }
  const intern = { id: 1, name: 'Internship' }
  const ba = { id: 1, title: 'BA', types: [fte] }
  const swe = { id: 2, title: 'SWE', types: [intern, fte] }
  const da = { id: 3, title: 'DA', types: [fte] }

  it('lists every pair the event hires for, ranked ones first with their rank, the rest unranked', () => {
    const preferences = [{ position: swe, type: fte }, { position: ba, type: fte }]
    expect(offerPairs([ba, swe, da], preferences)).toEqual([
      { key: '2:2', label: 'SWE — FTE', rank: 1 },
      { key: '1:2', label: 'BA — FTE', rank: 2 },
      { key: '2:1', label: 'SWE — Internship', rank: null },
      { key: '3:2', label: 'DA — FTE', rank: null },
    ])
  })

  it('with no preferences, nothing is ranked', () => {
    expect(offerPairs([da], undefined)).toEqual([{ key: '3:2', label: 'DA — FTE', rank: null }])
  })
})
