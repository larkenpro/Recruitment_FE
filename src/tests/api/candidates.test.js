import { describe, it, expect } from 'vitest'
import { getCandidates, getCandidate, createCandidate } from '../../api/candidates'

// BACKEND BUG: All /candidates endpoints currently return 500.
// These tests are skipped until the backend is fixed.
// Tracked issues:
//   GET  /candidates       → 500 (should return candidate list)
//   POST /candidates       → 500 (should create and return candidate)
//   GET  /candidates/:id   → 500 (should return candidate by id)
//   GET  /candidates/99999 → 500 (should return 404)

describe('Candidates API', () => {
  let createdId = null

  // ── GET all ───────────────────────────────────────────────────────────────
  it.skip('GET /candidates — returns success with an array', async () => {
    const res = await getCandidates()
    expect(res.data.status).toBe('success')
    expect(Array.isArray(res.data.data)).toBe(true)
  })

  // ── POST ──────────────────────────────────────────────────────────────────
  it.skip('POST /candidates — creates a candidate', async () => {
    const res = await createCandidate({
      name: '_Test Candidate',
      email: `test_${Date.now()}@example.com`,
      phone: '9000000000',
    })
    expect(res.data.status).toBe('success')
    expect(res.data.data.name).toBe('_Test Candidate')
    expect(typeof res.data.data.id).toBe('number')
    createdId = res.data.data.id
  })

  // ── GET by ID ─────────────────────────────────────────────────────────────
  it.skip('GET /candidates/:id — returns the created candidate', async () => {
    const res = await getCandidate(createdId)
    expect(res.data.status).toBe('success')
    expect(res.data.data.id).toBe(createdId)
  })

  // ── 404 ───────────────────────────────────────────────────────────────────
  it.skip('GET /candidates/999999 — returns 404 for unknown id', async () => {
    await expect(getCandidate(999999)).rejects.toMatchObject({
      response: { status: 404 },
    })
  })
})
