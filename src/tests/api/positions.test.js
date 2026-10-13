import { describe, it, expect, beforeAll } from 'vitest'
import {
  getPositions,
  getPosition,
  createPosition,
  updatePosition,
  deletePosition,
  getPositionTypes,
  uploadPositionJd,
  getPositionJd,
  deletePositionJd,
} from '../../api/positions'

describe('Positions API', () => {
  let createdId = null

  // ── GET all ──────────────────────────────────────────────────────────────
  it('GET /positions — returns success with an array', async () => {
    const res = await getPositions()
    expect(res.data.status).toBe('success')
    expect(Array.isArray(res.data.data)).toBe(true)
  })

  // ── POST ──────────────────────────────────────────────────────────────────
  it('POST /positions — creates a new position', async () => {
    const res = await createPosition({
      title: '_Test Engineer',
      department: 'QA',
      jobDescription: 'Test the product end to end.',
    })
    expect(res.data.status).toBe('success')
    expect(res.data.data).toMatchObject({
      title: '_Test Engineer',
      department: 'QA',
      jobDescription: 'Test the product end to end.',
    })
    expect(typeof res.data.data.id).toBe('number')
    createdId = res.data.data.id
  })

  // ── GET by ID ─────────────────────────────────────────────────────────────
  it('GET /positions/:id — returns the created position', async () => {
    const res = await getPosition(createdId)
    expect(res.data.status).toBe('success')
    expect(res.data.data.id).toBe(createdId)
    expect(res.data.data.title).toBe('_Test Engineer')
  })

  // ── GET with filters ──────────────────────────────────────────────────────
  it('GET /positions?department=QA — filters results by department', async () => {
    const res = await getPositions({ department: 'QA' })
    expect(res.data.status).toBe('success')
    expect(Array.isArray(res.data.data)).toBe(true)
    res.data.data.forEach(p => expect(p.department).toBe('QA'))
  })

  // ── Position types ────────────────────────────────────────────────────────
  it('GET /position-types — returns Internship, FTE and Intern-to-FTE', async () => {
    const res = await getPositionTypes()
    expect(res.data.status).toBe('success')
    expect(res.data.data.map(t => t.name)).toEqual(['Internship', 'FTE', 'Intern-to-FTE'])
  })

  it('POST /positions — missing job description returns 400', async () => {
    await expect(createPosition({ title: '_No JD' })).rejects.toMatchObject({ response: { status: 400 } })
  })

  // ── PUT ───────────────────────────────────────────────────────────────────
  it('PUT /positions/:id — updates the position', async () => {
    const res = await updatePosition(createdId, {
      title: '_Senior Test Engineer',
      department: 'QA',
      jobDescription: 'Lead QA for the product.',
    })
    expect(res.data.status).toBe('success')
    expect(res.data.data.title).toBe('_Senior Test Engineer')
    expect(res.data.data.id).toBe(createdId)
  })

  // ── JD PDF ────────────────────────────────────────────────────────────────
  const pdf = (body) => new Blob([body], { type: 'application/pdf' })

  it('POST /positions/:id/jd — stores a PDF and the position lists its name', async () => {
    const res = await uploadPositionJd(createdId, new File([pdf('%PDF-1.4 test')], 'test-jd.pdf', { type: 'application/pdf' }))
    expect(res.data.data).toBe('test-jd.pdf')
    expect((await getPosition(createdId)).data.data.jdFileName).toBe('test-jd.pdf')
  })

  it('GET /positions/:id/jd — returns the PDF', async () => {
    const res = await getPositionJd(createdId)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('application/pdf')
  })

  it('POST /positions/:id/jd — a file that is not a PDF returns 400', async () => {
    await expect(uploadPositionJd(createdId, new File([pdf('<html>')], 'fake.pdf', { type: 'application/pdf' })))
      .rejects.toMatchObject({ response: { status: 400 } })
  })

  it('DELETE /positions/:id/jd — removes it', async () => {
    await deletePositionJd(createdId)
    expect((await getPosition(createdId)).data.data.jdFileName).toBeNull()
    await expect(getPositionJd(createdId)).rejects.toMatchObject({ response: { status: 404 } })
    // Re-added so deleting the position below also covers a position that has a JD.
    await uploadPositionJd(createdId, new File([pdf('%PDF-1.4 test')], 'test-jd.pdf', { type: 'application/pdf' }))
  })

  // ── DELETE ────────────────────────────────────────────────────────────────
  it('DELETE /positions/:id — deletes the position', async () => {
    const res = await deletePosition(createdId)
    expect(res.data.status).toBe('success')
    expect(res.data.message).toMatch(/deleted/i)
  })

  // ── 404 after delete ──────────────────────────────────────────────────────
  it('GET /positions/:id — returns 404 for deleted position', async () => {
    await expect(getPosition(createdId)).rejects.toMatchObject({
      response: {
        status: 404,
        data: { status: 'error' },
      },
    })
  })

  // ── 404 for non-existent ID ───────────────────────────────────────────────
  it('GET /positions/999999 — returns 404 for unknown id', async () => {
    await expect(getPosition(999999)).rejects.toMatchObject({
      response: { status: 404 },
    })
  })
})
