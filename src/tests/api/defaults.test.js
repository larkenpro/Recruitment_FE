import { describe, it, expect } from 'vitest'
import { getDefaults } from '../../api/defaults'

describe('Defaults API', () => {
  it('GET /defaults — what new events and rounds start with', async () => {
    const { data } = (await getDefaults()).data
    expect(data).toEqual(expect.objectContaining({
      weightTenth: expect.any(Number), weightTwelfth: expect.any(Number), weightCgpa: expect.any(Number),
      roundMaxScore: expect.any(Number), roundWeight: expect.any(Number),
    }))
    expect(data.roundMaxScore).toBeGreaterThanOrEqual(1)
    expect(data).not.toHaveProperty('id')
  })
})
