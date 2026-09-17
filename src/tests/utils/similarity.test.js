import { describe, it, expect } from 'vitest'
import { isSimilar, isSimilarOrBlank } from '../../utils/similarity'

describe('similarity', () => {
  it('flags typos, abbreviations and spacing/case differences', () => {
    expect(isSimilar('Software Engineer', 'softawre eng')).toBe(true)
    expect(isSimilar('PSG College', 'pgscollege')).toBe(true)
    expect(isSimilar('Data Analyst', 'data-analyst')).toBe(true)
    expect(isSimilar('Chennai', 'chenai')).toBe(true)
  })
  it('does not flag clearly different names', () => {
    expect(isSimilar('Software Engineer', 'Product Manager')).toBe(false)
    expect(isSimilar('IIT Madras', 'NIT Calicut')).toBe(false)
    expect(isSimilar('', 'Anything')).toBe(false)
  })
  it('treats blank secondary fields as a possible match', () => {
    expect(isSimilarOrBlank('', 'Engineering')).toBe(true)
    expect(isSimilarOrBlank('Engineering', 'Product')).toBe(false)
  })
})
