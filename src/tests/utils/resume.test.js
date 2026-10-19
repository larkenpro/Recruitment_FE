import { describe, it, expect } from 'vitest'
import { MAX_RESUME_BYTES, resumeTooLarge } from '../../utils/resume'

describe('resumeTooLarge', () => {
  it('allows up to 5 MB, refuses anything over', () => {
    expect(resumeTooLarge({ size: MAX_RESUME_BYTES })).toBe(false)
    expect(resumeTooLarge({ size: MAX_RESUME_BYTES + 1 })).toBe(true)
  })
})
