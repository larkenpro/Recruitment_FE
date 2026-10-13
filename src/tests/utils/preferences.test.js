import { describe, it, expect } from 'vitest'
import { hasItPosition } from '../../utils/preferences'

const pair = (department) => ({ position: { id: 1, title: 'X', department }, type: { id: 1, name: 'FTE' } })

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
