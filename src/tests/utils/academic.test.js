import { describe, it, expect } from 'vitest'
import dayjs from 'dayjs'
import { academicPayload, academicFormValues, formatAvailability } from '../../utils/academic'

describe('academicPayload', () => {
  it('turns number inputs (strings) into numbers, including the graduation year', () => {
    const payload = academicPayload({ graduationYear: '2026', ugCgpa: '8.5', tenthMark: '92', branch: 'CSE' })
    expect(payload).toMatchObject({ graduationYear: 2026, ugCgpa: 8.5, tenthMark: 92, branch: 'CSE' })
  })

  it('sends blank backlog counts as 0 and other blank numbers as null', () => {
    const payload = academicPayload({ graduationYear: '', arrears: '', backlogs: undefined, keamRank: null })
    expect(payload).toMatchObject({ graduationYear: null, arrears: 0, backlogs: 0, keamRank: null })
  })

  it('formats the internship range, or null when incomplete', () => {
    expect(formatAvailability([dayjs('2026-06-01'), dayjs('2026-08-01')])).toBe('June-2026 to August-2026')
    expect(academicPayload({ internshipAvailability: [dayjs('2026-06-01')] }).internshipAvailability).toBeNull()
  })
})

describe('academicFormValues', () => {
  it('keeps the API fields and turns the availability text back into a range', () => {
    const values = academicFormValues({ graduationYear: 2025, internshipAvailability: 'June-2026 to August-2026' })
    expect(values.graduationYear).toBe(2025)
    expect(values.internshipAvailability).toHaveLength(2)
  })
})
