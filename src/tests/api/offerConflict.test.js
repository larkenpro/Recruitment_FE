import { describe, it, expect } from 'vitest'
import { describeConflict } from '../../api/offerConflict'

describe('describeConflict', () => {
  it('names the candidate with their Offer Status and Response as the pages show them', () => {
    expect(describeConflict({ candidateId: 7, name: 'Asha', offerStatus: 'HOLD', offerResponse: 'ACCEPTED' }))
      .toBe('Asha — Offer Status: WaitList, Offer Response: Accepted')
    expect(describeConflict({ candidateId: 8, name: 'Ben', offerStatus: null, offerResponse: null }))
      .toBe('Ben — Offer Status: Undecided, Offer Response: No Information')
  })
})
