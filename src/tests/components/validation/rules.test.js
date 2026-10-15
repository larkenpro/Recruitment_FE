import { describe, it, expect } from 'vitest'
import { CGPA_RULE, COUNT_RULE, GRADUATION_YEAR_RULE, SCORE_RULE, SEQUENCE_RULE, requiredRule } from '../../../components/validation/rules'

const check = (rule, value) => rule.validator(null, value).then(() => null, (message) => message)

describe('number rules', () => {
  it('leave an empty value to the required rule', async () => {
    for (const value of [undefined, null, '', '   ']) expect(await check(SCORE_RULE, value)).toBeNull()
  })

  it('reject text, signs and exponents', async () => {
    for (const value of ['abc', '8.5abc', '-2', '+3', '1e3', '8.', '.5']) {
      expect(await check(CGPA_RULE, value)).toBe('Enter a number')
    }
  })

  it('accept numbers from text inputs (strings, padded) and InputNumber (numbers)', async () => {
    expect(await check(CGPA_RULE, ' 8.25 ')).toBeNull()
    expect(await check(CGPA_RULE, 8.5)).toBeNull()
    expect(await check(SCORE_RULE, '100')).toBeNull()
  })

  it('cap decimal places', async () => {
    expect(await check(SCORE_RULE, '92.555')).toBe('Use at most 2 decimal places')
  })

  it('want whole numbers for counts, years and sequences', async () => {
    expect(await check(COUNT_RULE, '2.5')).toBe('Enter a whole number')
    expect(await check(COUNT_RULE, 'two')).toBe('Enter a whole number')
    expect(await check(GRADUATION_YEAR_RULE, 2026.5)).toBe('Enter a whole number')
    expect(await check(COUNT_RULE, '0')).toBeNull()
  })

  it('enforce the range', async () => {
    expect(await check(CGPA_RULE, '10.5')).toBe('CGPA must be between 0 and 10')
    expect(await check(GRADUATION_YEAR_RULE, '1979')).toBe('Enter a year between 1980 and 2100')
    expect(await check(SEQUENCE_RULE, 0)).toBe('Must be 1 or more')
    expect(await check(SEQUENCE_RULE, 1)).toBeNull()
  })
})

describe('requiredRule', () => {
  it('treats whitespace-only as missing', () => {
    expect(requiredRule('Name is required')).toMatchObject({ required: true, whitespace: true })
  })
})
