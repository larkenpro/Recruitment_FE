import { describe, it, expect, beforeAll } from 'vitest'
import {
  getCandidates,
  getCandidate,
  createCandidate,
  updateCandidate,
  deleteCandidate,
  getCandidateResume,
  getCandidateScores,
  getCandidateStageHistory,
} from '../../api/candidates'
import { getColleges } from '../../api/colleges'

describe('Candidates API', () => {
  let createdId = null
  let collegeId = null

  beforeAll(async () => {
    try {
      const res = await getColleges()
      collegeId = res.data.data[0]?.id ?? null
    } catch {
      // backend not reachable
    }
  })

  // ── GET all ───────────────────────────────────────────────────────────────
  it('GET /candidate — returns success with an array', async () => {
    const res = await getCandidates()
    expect(res.data.status).toBe('success')
    expect(Array.isArray(res.data.data)).toBe(true)
  })

  // ── POST ──────────────────────────────────────────────────────────────────
  it('POST /candidate — creates a candidate', async () => {
    if (!collegeId) return
    const ts = Date.now()
    const res = await createCandidate({
      username: `test_user_${ts}`,
      name: '_Test Candidate',
      email: `test_${ts}@example.com`,
      collegeId,
    })
    expect(res.data.status).toBe('success')
    expect(res.data.data.name).toBe('_Test Candidate')
    expect(typeof res.data.data.id).toBe('number')
    createdId = res.data.data.id
  })

  // ── GET by ID ─────────────────────────────────────────────────────────────
  it('GET /candidate/:id — returns the created candidate', async () => {
    if (!createdId) return
    const res = await getCandidate(createdId)
    expect(res.data.status).toBe('success')
    expect(res.data.data.id).toBe(createdId)
    expect(res.data.data.name).toBe('_Test Candidate')
  })

  // ── PUT ───────────────────────────────────────────────────────────────────
  it('PUT /candidate/:id — updates candidate fields', async () => {
    if (!createdId || !collegeId) return
    const ts = Date.now()
    const res = await updateCandidate(createdId, {
      username: `test_user_${ts}`,
      name: '_Test Candidate Updated',
      email: `test_${ts}@example.com`,
      collegeId,
    })
    expect(res.data.status).toBe('success')
    expect(res.data.data.name).toBe('_Test Candidate Updated')
    expect(res.data.data.id).toBe(createdId)
  })

  // ── Sub-resources ─────────────────────────────────────────────────────────
  it.skip('GET /candidates/:id/scores — returns success with an array', async () => {
    if (!createdId) return
    const res = await getCandidateScores(createdId)
    expect(res.data.status).toBe('success')
    expect(Array.isArray(res.data.data)).toBe(true)
  })

  it.skip('GET /candidates/:id/stage-history — returns success with an array', async () => {
    if (!createdId) return
    const res = await getCandidateStageHistory(createdId)
    expect(res.data.status).toBe('success')
    expect(Array.isArray(res.data.data)).toBe(true)
  })

  it.skip('GET /candidates/:id/resume — returns 404 when no resume uploaded', async () => {
    if (!createdId) return
    await expect(getCandidateResume(createdId)).rejects.toMatchObject({
      response: { status: 404 },
    })
  })

  // ── DELETE ────────────────────────────────────────────────────────────────
  it('DELETE /candidates/:id — deletes the candidate', async () => {
    if (!createdId) return
    const res = await deleteCandidate(createdId)
    expect(res.data.status).toBe('success')
  })

  // ── 404 ───────────────────────────────────────────────────────────────────
  it('GET /candidates/999999 — returns 404 for unknown id', async () => {
    await expect(getCandidate(999999)).rejects.toMatchObject({
      response: { status: 404 },
    })
  })
})
