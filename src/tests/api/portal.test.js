import { describe, it, expect, afterEach } from 'vitest'
import {
  requestSignInLink, createCandidateSession, getMyPage, updateMyApplication,
  setCandidateSession, clearCandidateSession,
} from '../../api/portal'

// The candidate page API is public at the security layer; each call proves the candidate
// with the session token from an emailed link, which a test can't receive — so these cover
// the parts that don't need a real inbox.
describe('Candidate page API', () => {
  afterEach(() => clearCandidateSession())

  it('POST /portal/link — answers the same whether or not the email is on file', async () => {
    const res = await requestSignInLink({ email: `nobody_${Date.now()}@example.com` })
    expect(res.status).toBe(200)
    expect(res.data.message).toMatch(/sign-in link/)
  })

  it('POST /portal/session — a forged link token is refused', async () => {
    await expect(createCandidateSession('not-a-real-token')).rejects.toMatchObject({ response: { status: 401 } })
  })

  it('GET /portal/me — without a session is refused', async () => {
    await expect(getMyPage()).rejects.toMatchObject({ response: { status: 401 } })
  })

  it('PUT /portal/applications/:eventId — an admin token is not a candidate session', async () => {
    setCandidateSession(localStorage.getItem('token'))
    await expect(updateMyApplication(1, { ugCgpa: 8, preferences: [{ positionId: 1, typeId: 1 }] }))
      .rejects.toMatchObject({ response: { status: 401 } })
  })
})
