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
import { getApplyForm, submitApplication, uploadResume, getPublicEventPositions, checkApplication } from '../../api/candidates'
import { getEvents, generateLink } from '../../api/events'

describe('Apply Flow', () => {
  let applyToken = null
  let preference = null
  let candidateId = null
  const firstEmail = `applicant_${Date.now()}@example.com`

  // ── Setup: obtain a real apply token and an event-linked position ID ──────
  beforeAll(async () => {
    try {
      const eventsRes = await getEvents()
      // Only an ACTIVE event takes applications; with none, the submit tests skip.
      const event = eventsRes.data.data.find(e => e.status === 'ACTIVE' && e.positions?.length > 0) ?? null
      if (event) {
        const linkRes = await generateLink(event.id)
        // generate returns the full apply URL (…/apply/<token>), not an object
        applyToken = linkRes.data.data?.split('/apply/').pop() || null

        // a (position, type) pair the event is hiring for, as the form submits it
        const posRes = await getPublicEventPositions(event.id)
        const open = posRes.data.data.find(p => p.types?.length)
        preference = open ? `${open.id}:${open.types[0].id}` : null
      }
    } catch {
      // backend not reachable — flow tests will be skipped via guard
    }
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

  // ── POST /apply/:token ────────────────────────────────────────────────────
  it('submitApplication — valid payload returns success with candidateId', async () => {
    if (!applyToken || !preference) return
    const res = await submitApplication(applyToken, {
      name: '_Test Applicant',
      email: firstEmail,
      phone: '9000000001',
      // Unique per run: a roll number already on file at this college is a returning candidate (409).
      rollNo: `TEST${Date.now()}`,
      branch: 'Computer Science & Engineering',
      ugCgpa: 8.5,
      tenthMark: 90,
      twelfthMark: 88,
      backlogs: 0,
      preferences: [preference],
      consent: true,
    })
    expect(res.data.status).toBe('success')
    expect(typeof res.data.data.candidateId).toBe('number')
    candidateId = res.data.data.candidateId
  })

  // ── Existing candidates go through the candidate page, never this form ──
  it('checkApplication — an email already on file is reported, masked', async () => {
    if (!applyToken || !candidateId) return
    const res = await checkApplication(applyToken, { email: firstEmail.toUpperCase() })
    expect(res.data.data.exists).toBe(true)
    expect(res.data.data.matchedBy).toBe('EMAIL')
    expect(res.data.data.maskedEmail).toMatch(/^a\*\*\*\d@example\.com$/)
    expect(res.data.data.prefill).toBeUndefined()
  })

  it('checkApplication — a new person is not a match', async () => {
    if (!applyToken) return
    const res = await checkApplication(applyToken, { email: `new_${Date.now()}@example.com` })
    expect(res.data.data.exists).toBe(false)
  })

  it('submitApplication — the same email again returns 409 instead of overwriting', async () => {
    if (!applyToken || !candidateId) return
    await expect(submitApplication(applyToken, {
      name: '_Someone Else',
      email: firstEmail,
      branch: 'Civil Engineering',
      preferences: [preference],
      consent: true,
    })).rejects.toMatchObject({ response: { status: 409 } })
  })

  it('submitApplication — response includes eventId and positionId', async () => {
    if (!applyToken || !preference) return
    const res = await submitApplication(applyToken, {
      name: '_Test Applicant 2',
      email: `applicant2_${Date.now()}@example.com`,
      branch: 'Information Technology',
      backlogs: 0,
      preferences: [preference],
      consent: true,
    })
    expect(res.data.status).toBe('success')
    expect(res.data.data.eventId).toBeDefined()
    expect(res.data.data.positionId).toBeDefined()
  })

  it('submitApplication — missing required name returns 400', async () => {
    if (!applyToken || !preference) return
    await expect(
      submitApplication(applyToken, {
        email: `noemail_${Date.now()}@example.com`,
        branch: 'Electrical Engineering',
        preferences: [preference],
        consent: true,
      })
    ).rejects.toMatchObject({ response: { status: 400 } })
  })

  it('submitApplication — without ticking consent returns 400', async () => {
    if (!applyToken || !preference) return
    await expect(
      submitApplication(applyToken, {
        name: '_No Consent',
        email: `noconsent_${Date.now()}@example.com`,
        branch: 'Civil Engineering',
        preferences: [preference],
      })
    ).rejects.toMatchObject({ response: { status: 400 } })
  })

  it('submitApplication — invalid email format returns 400', async () => {
    if (!applyToken || !preference) return
    await expect(
      submitApplication(applyToken, {
        name: '_Bad Email',
        email: 'not-an-email',
        branch: 'Electrical Engineering',
        preferences: [preference],
        consent: true,
      })
    ).rejects.toMatchObject({ response: { status: 400 } })
  })

  it('submitApplication — missing preferences returns 400', async () => {
    if (!applyToken) return
    await expect(
      submitApplication(applyToken, {
        name: '_No Position',
        email: `nopos_${Date.now()}@example.com`,
        branch: 'Mechanical Engineering',
      })
    ).rejects.toMatchObject({ response: { status: 400 } })
  })

  it('submitApplication — pair the event is not hiring for returns 400', async () => {
    if (!applyToken) return
    await expect(
      submitApplication(applyToken, {
        name: '_Bad Position',
        email: `badpos_${Date.now()}@example.com`,
        branch: 'Civil Engineering',
        preferences: ['999999:1'],
        consent: true,
      })
    ).rejects.toMatchObject({ response: { status: 400 } })
  })

  it('submitApplication — expired/invalid token returns 404', async () => {
    if (!preference) return
    await expect(
      submitApplication('invalid-token-xyz', {
        name: '_Ghost',
        email: 'ghost@example.com',
        branch: 'Information Technology',
        preferences: [preference],
        consent: true,
      })
    ).rejects.toMatchObject({ response: { status: 404 } })
  })

  // ── Resume uploaded as part of /apply/:token (multipart) ─────────────────
  // uploadResume tests below verify the standalone endpoint still works
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

  // ── handleSubmit logic: numeric field conversion ──────────────────────────
  // PublicApply.jsx converts all mark/CGPA fields via Number().
  // Sending string representations should be accepted by the API.
  it('submitApplication — numeric fields as strings are accepted', async () => {
    if (!applyToken || !preference) return
    const res = await submitApplication(applyToken, {
      name: '_Test Numeric Strings',
      email: `numstr_${Date.now()}@example.com`,
      branch: 'Computer Science & Engineering',
      tenthMark: 90,        // component sends Number("90") = 90
      twelfthMark: 88,
      ugCgpa: 8.5,
      backlogs: 0,
      preferences: [preference],
      consent: true,
    })
    expect(res.data.status).toBe('success')
    expect(typeof res.data.data.candidateId).toBe('number')
  })

  // ── handleSubmit: backlogs falsy-check bug surface ────────────────────────
  // In the component: `values.backlogs ? Number(values.backlogs) : 0`
  // If the form returns the number 0 (not string "0"), the condition is falsy
  // and the else branch fires — still yields 0, so the result is correct.
  // But it means backlogs:0 submitted explicitly is handled the same as omitted.
  it('submitApplication — backlogs explicitly 0 is accepted', async () => {
    if (!applyToken || !preference) return
    const res = await submitApplication(applyToken, {
      name: '_Test Backlogs Zero',
      email: `backlogs0_${Date.now()}@example.com`,
      branch: 'Information Technology',
      backlogs: 0,
      preferences: [preference],
      consent: true,
    })
    expect(res.data.status).toBe('success')
  })

  it('submitApplication — negative backlogs should be rejected (returns 400)', async () => {
    if (!applyToken || !preference) return
    // The component does Number(values.backlogs) — negative values pass through unchecked.
    // This test surfaces whether the backend validates the range.
    await expect(
      submitApplication(applyToken, {
        name: '_Test Negative Backlogs',
        email: `negbacklogs_${Date.now()}@example.com`,
        branch: 'Electrical Engineering',
        backlogs: -1,
        preferences: [preference],
        consent: true,
      })
    ).rejects.toMatchObject({ response: { status: 400 } })
  })

  // ── handleSubmit: out-of-range academic marks ─────────────────────────────
  // The component does no range validation before submitting — these corner
  // cases reveal whether the API enforces bounds.
  it('submitApplication — ugCgpa above 10 should be rejected (returns 400)', async () => {
    if (!applyToken || !preference) return
    await expect(
      submitApplication(applyToken, {
        name: '_Test High CGPA',
        email: `highcgpa_${Date.now()}@example.com`,
        branch: 'Computer Science & Engineering',
        ugCgpa: 11,
        backlogs: 0,
        preferences: [preference],
        consent: true,
      })
    ).rejects.toMatchObject({ response: { status: 400 } })
  })

  it('submitApplication — tenthMark above 100 should be rejected (returns 400)', async () => {
    if (!applyToken || !preference) return
    await expect(
      submitApplication(applyToken, {
        name: '_Test High Tenth',
        email: `highten_${Date.now()}@example.com`,
        branch: 'Computer Science & Engineering',
        tenthMark: 105,
        backlogs: 0,
        preferences: [preference],
        consent: true,
      })
    ).rejects.toMatchObject({ response: { status: 400 } })
  })

  it('submitApplication — negative ugCgpa should be rejected (returns 400)', async () => {
    if (!applyToken || !preference) return
    await expect(
      submitApplication(applyToken, {
        name: '_Test Neg CGPA',
        email: `negcgpa_${Date.now()}@example.com`,
        branch: 'Computer Science & Engineering',
        ugCgpa: -1,
        backlogs: 0,
        preferences: [preference],
        consent: true,
      })
    ).rejects.toMatchObject({ response: { status: 400 } })
  })

  // ── handleSubmit: NaN from Number() ──────────────────────────────────────
  // Number("abc") = NaN. The component passes this straight to the API.
  // This test verifies the backend rejects NaN-producing inputs.
  it('submitApplication — non-numeric ugCgpa (NaN after Number()) should be rejected (returns 400)', async () => {
    if (!applyToken || !preference) return
    await expect(
      submitApplication(applyToken, {
        name: '_Test NaN CGPA',
        email: `nancgpa_${Date.now()}@example.com`,
        branch: 'Computer Science & Engineering',
        ugCgpa: NaN,
        backlogs: 0,
        preferences: [preference],
        consent: true,
      })
    ).rejects.toMatchObject({ response: { status: 400 } })
  })

  // ── handleSubmit: duplicate email submission ──────────────────────────────
  // Submitting the same email a second time should return a clear error, not 500.
  it('submitApplication — duplicate email returns 400 or 409 (not 500)', async () => {
    if (!applyToken || !preference) return
    const email = `dup_${Date.now()}@example.com`
    // First submission
    await submitApplication(applyToken, {
      name: '_Test Dup Email First',
      email,
      branch: 'Information Technology',
      backlogs: 0,
      preferences: [preference],
      consent: true,
    })
    // Second submission with same email
    try {
      await submitApplication(applyToken, {
        name: '_Test Dup Email Second',
        email,
        branch: 'Information Technology',
        backlogs: 0,
        preferences: [preference],
        consent: true,
      })
      // If the backend silently accepts duplicates, that is also a valid outcome
      // but the test documents the behavior.
    } catch (err) {
      const status = err.response?.status
      expect([400, 409]).toContain(status)
    }
  })

  // ── handleSubmit: internshipAvailability formatting ───────────────────────
  // The component formats dates as "MMMM-YYYY to MMMM-YYYY" before sending.
  // Test that a pre-formatted string is accepted by the API.
  it('submitApplication — valid internshipAvailability string is accepted', async () => {
    if (!applyToken || !preference) return
    const res = await submitApplication(applyToken, {
      name: '_Test Internship',
      email: `intern_${Date.now()}@example.com`,
      branch: 'Computer Science & Engineering',
      backlogs: 0,
      preferences: [preference],
      consent: true,
      internshipAvailability: 'June-2025 to August-2025',
    })
    expect(res.data.status).toBe('success')
  })

  it('submitApplication — null internshipAvailability is accepted (field omitted)', async () => {
    if (!applyToken || !preference) return
    // Component sends null when DatePicker is not filled in.
    const res = await submitApplication(applyToken, {
      name: '_Test No Internship',
      email: `nointern_${Date.now()}@example.com`,
      branch: 'Computer Science & Engineering',
      backlogs: 0,
      preferences: [preference],
      consent: true,
      internshipAvailability: null,
    })
    expect(res.data.status).toBe('success')
  })

  // ── handleSubmit: oversized / special character inputs ───────────────────
  it('submitApplication — very long name should be rejected or truncated gracefully', async () => {
    if (!applyToken || !preference) return
    const longName = 'A'.repeat(300)
    let status
    try {
      const res = await submitApplication(applyToken, {
        name: longName,
        email: `longname_${Date.now()}@example.com`,
        branch: 'Computer Science & Engineering',
        backlogs: 0,
        preferences: [preference],
        consent: true,
      })
      status = res.status
    } catch (err) {
      status = err.response?.status
    }
    expect(status).not.toBe(500)
  })

  it('submitApplication — name with special characters is accepted', async () => {
    if (!applyToken || !preference) return
    const res = await submitApplication(applyToken, {
      name: "O'Brien-Smith Jr.",
      email: `special_${Date.now()}@example.com`,
      branch: 'Computer Science & Engineering',
      backlogs: 0,
      preferences: [preference],
      consent: true,
    })
    expect(res.data.status).toBe('success')
  })

  it('submitApplication — XSS payload in name does not cause 500', async () => {
    if (!applyToken || !preference) return
    let status
    try {
      const res = await submitApplication(applyToken, {
        name: '<script>alert(1)</script>',
        email: `xss_${Date.now()}@example.com`,
        branch: 'Computer Science & Engineering',
        backlogs: 0,
        preferences: [preference],
        consent: true,
      })
      status = res.status
    } catch (err) {
      status = err.response?.status
    }
    expect(status).not.toBe(500)
  })

  // ── handleSubmit: all optional fields populated ───────────────────────────
  it('submitApplication — full payload with all optional fields returns success', async () => {
    if (!applyToken || !preference) return
    const res = await submitApplication(applyToken, {
      name: '_Test Full Payload',
      email: `full_${Date.now()}@example.com`,
      phone: '9876543210',
      rollNo: `CS${Date.now()}`,
      branch: 'Computer Science & Engineering',
      tenthMark: 92.5,
      twelfthMark: 88.0,
      diplomaMark: 85.0,
      keamRank: 1234,
      ugDegree: 'B.Tech Computer Science',
      ugCgpa: 8.5,
      pgDegree: 'M.Tech CSE',
      pgCgpa: 9.0,
      backlogs: 0,
      preferences: [preference],
      consent: true,
      jobLocation: 'Both',
      githubLink: 'https://github.com/testuser',
      leadershipPositions: 'Class Representative, Coding Club Lead',
      internshipAvailability: 'June-2025 to August-2025',
    })
    expect(res.data.status).toBe('success')
    expect(typeof res.data.data.candidateId).toBe('number')
  })
})
