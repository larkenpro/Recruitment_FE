import { describe, it, expect, beforeAll } from 'vitest'
import {
  exportOffersStatus,
  getCandidates,
  getCandidate,
  createCandidate,
  updateCandidate,
  deleteCandidate,
  getCandidateResume,
  getCandidateStageHistory,
  getOffers,
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
      name: '_Test Candidate',
      username: `test_${ts}`,
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
      name: '_Test Candidate Updated',
      username: `test_${ts}`,
      email: `test_${ts}@example.com`,
      collegeId,
    })
    expect(res.data.status).toBe('success')
    expect(res.data.data.name).toBe('_Test Candidate Updated')
    expect(res.data.data.id).toBe(createdId)
  })

  // ── Sub-resources ─────────────────────────────────────────────────────────
  // stage-history returns a bare list, not the usual { status, data } envelope
  it('GET /candidates/:id/stage-history — returns an array', async () => {
    if (!createdId) return
    const res = await getCandidateStageHistory(createdId)
    expect(Array.isArray(res.data)).toBe(true)
  })

  it('GET /candidates/:id/resume — returns 404 when no resume uploaded', async () => {
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

  // ── Offers ────────────────────────────────────────────────────────────────
  it('POST /candidates/offers/status/xlsx — 400 when none of the rows is at Offer', async () => {
    await expect(exportOffersStatus([{ eventId: 999999, candidateId: 999999 }], 'Offers'))
      .rejects.toMatchObject({ response: { status: 400 } })
  })

  it('GET /candidates/offers — everyone who reached Offer, each with their stages', async () => {
    const res = await getOffers()
    expect(res.data.status).toBe('success')
    expect(Array.isArray(res.data.data)).toBe(true)
    res.data.data.forEach((row) => expect(row.stages).toHaveProperty('Offer'))
  })

  // ── 404 ───────────────────────────────────────────────────────────────────
  it('GET /candidates/999999 — returns 404 for unknown id', async () => {
    await expect(getCandidate(999999)).rejects.toMatchObject({
      response: { status: 404 },
    })
  })
})
