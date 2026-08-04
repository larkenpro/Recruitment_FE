import { describe, it, expect } from 'vitest'
import { chunk, distinctPositions, BATCH_SIZE } from '../../api/imports'

const row = (positions) => ({ sheet: 'SA+TBA', rowNum: 2, values: ['Asha', 'a@x.com', positions] })

describe('import batching', () => {
  it('splits rows into batches of 10 with a short final batch', () => {
    const rows = Array.from({ length: 374 }, (_, i) => i)
    const batches = chunk(rows, BATCH_SIZE)

    expect(BATCH_SIZE).toBe(10)
    expect(batches).toHaveLength(38)
    expect(batches[0]).toHaveLength(10)
    expect(batches.at(-1)).toHaveLength(4)
    expect(batches.flat()).toEqual(rows)
  })

  it('returns no batches for an empty sheet', () => {
    expect(chunk([], BATCH_SIZE)).toEqual([])
  })
})

describe('distinctPositions', () => {
  it('collects every title across rows, deduped, trimmed and sorted', () => {
    const rows = [
      row('Technical Business Analyst, Sourcing Analyst'),
      row('Sourcing Analyst'),
      row(' Quality Engineer ,Merchandising Coordinator'),
    ]

    expect(distinctPositions(rows, 2)).toEqual([
      'Merchandising Coordinator',
      'Quality Engineer',
      'Sourcing Analyst',
      'Technical Business Analyst',
    ])
  })

  it('ignores blank cells and an unmapped positions column', () => {
    expect(distinctPositions([row(''), row('Sourcing Analyst')], 2)).toEqual(['Sourcing Analyst'])
    expect(distinctPositions([row('Sourcing Analyst')], -1)).toEqual([])
  })
})
