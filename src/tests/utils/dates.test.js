import { describe, it, expect } from 'vitest'
import dayjs from 'dayjs'
import { defaultLinkExpiry, formatDate, formatDateTime } from '../../utils/dates'

describe('formatDate / formatDateTime', () => {
  it('day first, then month, then year', () => {
    expect(formatDate('2026-10-16')).toBe('16/10/2026')
    expect(formatDate('2026-03-05T09:07:00')).toBe('05/03/2026')
    expect(formatDateTime('2026-03-05T09:07:00')).toBe('05/03/2026 09:07')
  })

  it('nothing to show is a dash', () => {
    expect(formatDate(null)).toBe('—')
    expect(formatDateTime(undefined)).toBe('—')
  })
})

describe('defaultLinkExpiry', () => {
  const today = dayjs('2026-10-16')
  const fmt = (d) => d.format('YYYY-MM-DD')

  it('two months after the start date', () => {
    expect(fmt(defaultLinkExpiry('2026-11-01', today))).toBe('2027-01-01')
    expect(fmt(defaultLinkExpiry('2026-09-01', today))).toBe('2026-11-01')
  })

  it('no start date counts from today', () => {
    expect(fmt(defaultLinkExpiry(null, today))).toBe('2026-12-16')
  })

  it('a start so old that two months have passed counts from today', () => {
    expect(fmt(defaultLinkExpiry('2025-11-01', today))).toBe('2026-12-16')
  })
})
