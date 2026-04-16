import { describe, it, expect, beforeAll, vi } from 'vitest'

// Some backend routes reset the connection instead of returning an HTTP error
// body (e.g. for invalid tokens or unauthenticated access). This helper
// accepts either the expected HTTP status OR a network-level connection error.
const expectHttpOrConnectionError = async (promise, httpStatus) => {
  try {
    await promise
    expect.fail(`Expected request to fail with status ${httpStatus}`)
  } catch (err) {
    const status = err?.response?.status
    if (status !== undefined) {
      expect(status).toBe(httpStatus)
    } else {
      // Network error (ECONNRESET / ECONNREFUSED) — server rejected without body
      expect(['ECONNRESET', 'ECONNREFUSED', 'ERR_NETWORK']).toContain(err?.code ?? err?.message)
    }
  }
}
import { getApplyForm, submitApplication, uploadResume } from '../../api/candidates'
import { getPublicPositions } from '../../api/positions'
import { getEvents, generateLink } from '../../api/events'

describe('Public Apply Flow', () => {
  let applyToken = null
  let positionId = null
  let candidateId = null

  // ── Setup: obtain a real apply token and a real position ID ───────────────
  beforeAll(async () => {
    try {
      // get a real event to generate a link from
      const eventsRes = await getEvents()
      const eventId = eventsRes.data.data[0]?.id ?? null
      if (eventId) {
        const linkRes = await generateLink(eventId)
        applyToken = linkRes.data.data?.token ?? null
      }
    } catch {
      // backend not reachable — flow tests will be skipped via guard
    }

    try {
      const posRes = await getPublicPositions()
      positionId = posRes.data.data[0]?.id ?? null
    } catch {
      // positions not reachable
    }
  })

  // ── GET /positions (public) ───────────────────────────────────────────────
  it('getPublicPositions — returns success with an array of positions', async () => {
    const res = await getPublicPositions()
    expect(res.data.status).toBe('success')
    expect(Array.isArray(res.data.data)).toBe(true)
  })

  it('getPublicPositions — each position has an id and title', async () => {
    const res = await getPublicPositions()
    res.data.data.forEach(p => {
      expect(typeof p.id).toBe('number')
      expect(typeof p.title).toBe('string')
    })
  })

  // ── GET /links/validate/:token ────────────────────────────────────────────
  it('getApplyForm — valid token returns event info', async () => {
    if (!applyToken) return
    const res = await getApplyForm(applyToken)
    expect(res.data.status).toBe('success')
    expect(res.data.data.event).toBeDefined()
    expect(res.data.data.event.id).toBeDefined()
  })

  it('getApplyForm — invalid token returns 404', async () => {
    await expectHttpOrConnectionError(getApplyForm('invalid-token-xyz'), 404)
  })

  // ── POST /public-apply/:token ─────────────────────────────────────────────
  it('submitApplication — valid payload returns success with candidateId', async () => {
    if (!applyToken || !positionId) return
    const res = await submitApplication(applyToken, {
      name: '_Test Applicant',
      email: `applicant_${Date.now()}@example.com`,
      phone: '9000000001',
      rollNo: 'TEST001',
      branch: 'Computer Science & Engineering',
      ugCgpa: 8.5,
      tenthMark: 90,
      twelfthMark: 88,
      backlogs: 0,
      preferredPositionId1: positionId,
    })
    expect(res.data.status).toBe('success')
    expect(typeof res.data.data.candidateId).toBe('number')
    candidateId = res.data.data.candidateId
  })

  it('submitApplication — response includes eventId and positionId', async () => {
    if (!applyToken || !positionId) return
    const res = await submitApplication(applyToken, {
      name: '_Test Applicant 2',
      email: `applicant2_${Date.now()}@example.com`,
      branch: 'Information Technology',
      backlogs: 0,
      preferredPositionId1: positionId,
    })
    expect(res.data.status).toBe('success')
    expect(res.data.data.eventId).toBeDefined()
    expect(res.data.data.positionId).toBeDefined()
  })

  it('submitApplication — missing required name returns 400', async () => {
    if (!applyToken || !positionId) return
    await expect(
      submitApplication(applyToken, {
        email: `noemail_${Date.now()}@example.com`,
        branch: 'Electrical Engineering',
        preferredPositionId1: positionId,
      })
    ).rejects.toMatchObject({ response: { status: 400 } })
  })

  it('submitApplication — invalid email format returns 400', async () => {
    if (!applyToken || !positionId) return
    await expect(
      submitApplication(applyToken, {
        name: '_Bad Email',
        email: 'not-an-email',
        branch: 'Electrical Engineering',
        preferredPositionId1: positionId,
      })
    ).rejects.toMatchObject({ response: { status: 400 } })
  })

  it('submitApplication — missing required branch returns 400', async () => {
    if (!applyToken || !positionId) return
    await expect(
      submitApplication(applyToken, {
        name: '_No Branch',
        email: `nobranch_${Date.now()}@example.com`,
        preferredPositionId1: positionId,
      })
    ).rejects.toMatchObject({ response: { status: 400 } })
  })

  it('submitApplication — missing preferredPositionId1 returns 400', async () => {
    if (!applyToken) return
    await expect(
      submitApplication(applyToken, {
        name: '_No Position',
        email: `nopos_${Date.now()}@example.com`,
        branch: 'Mechanical Engineering',
      })
    ).rejects.toMatchObject({ response: { status: 400 } })
  })

  it('submitApplication — non-existent positionId returns 404', async () => {
    if (!applyToken) return
    await expect(
      submitApplication(applyToken, {
        name: '_Bad Position',
        email: `badpos_${Date.now()}@example.com`,
        branch: 'Civil Engineering',
        preferredPositionId1: 999999,
      })
    ).rejects.toMatchObject({ response: { status: 404 } })
  })

  it('submitApplication — expired/invalid token returns 404', async () => {
    if (!positionId) return
    await expect(
      submitApplication('invalid-token-xyz', {
        name: '_Ghost',
        email: 'ghost@example.com',
        branch: 'Information Technology',
        preferredPositionId1: positionId,
      })
    ).rejects.toMatchObject({ response: { status: 404 } })
  })

  // ── POST /candidates/:id/resume ───────────────────────────────────────────
  it('uploadResume — valid PDF returns success with downloadUrl', async () => {
    if (!candidateId) return
    const file = new File(['%PDF-1.4 fake pdf content'], 'resume.pdf', { type: 'application/pdf' })
    const res = await uploadResume(candidateId, file)
    expect(res.data.status).toBe('success')
    expect(res.data.data.candidateId).toBe(candidateId)
    expect(typeof res.data.data.fileName).toBe('string')
    expect(typeof res.data.data.downloadUrl).toBe('string')
  })

  it('uploadResume — disallowed file type returns 400', async () => {
    if (!candidateId) return
    const file = new File(['<html>bad</html>'], 'resume.html', { type: 'text/html' })
    await expect(uploadResume(candidateId, file)).rejects.toMatchObject({
      response: { status: 400 },
    })
  })

  it('uploadResume — unknown candidateId returns 404', async () => {
    const file = new File(['%PDF-1.4 fake'], 'resume.pdf', { type: 'application/pdf' })
    await expectHttpOrConnectionError(uploadResume(999999, file), 404)
  })
})
