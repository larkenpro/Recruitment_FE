import { describe, it, expect } from 'vitest'
import { offerResponse } from '../../utils/offers'

describe('offerResponse', () => {
  it('names the two answers', () => {
    expect(offerResponse('ACCEPTED').label).toBe('Accepted')
    expect(offerResponse('REJECTED').label).toBe('Rejected')
  })

  it('no answer yet is No Information', () => {
    expect(offerResponse(null)).toMatchObject({ value: null, label: 'No Information' })
    expect(offerResponse(undefined).label).toBe('No Information')
  })

  it('shows an older free-text status as it is', () => {
    expect(offerResponse('PENDING').label).toBe('PENDING')
  })
})
