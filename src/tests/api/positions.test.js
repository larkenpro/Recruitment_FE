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
    })
    expect(res.data.status).toBe('success')
    expect(res.data.data).toMatchObject({
      title: '_Test Engineer',
      department: 'QA',
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

  // ── PUT ───────────────────────────────────────────────────────────────────
  it('PUT /positions/:id — updates the position', async () => {
    const res = await updatePosition(createdId, {
      title: '_Senior Test Engineer',
      department: 'QA',
    })
    expect(res.data.status).toBe('success')
    expect(res.data.data.title).toBe('_Senior Test Engineer')
    expect(res.data.data.id).toBe(createdId)
  })

  // ── JD letters ────────────────────────────────────────────────────────────
  const pdf = (body) => new Blob([body], { type: 'application/pdf' })
  const file = (name = 'test-jd.pdf', body = '%PDF-1.4 test') => new File([pdf(body)], name, { type: 'application/pdf' })
  const letters = async () => (await getPosition(createdId)).data.data.jdLetters

  it('POST /positions/:id/jd — one letter per location, listed on the position', async () => {
    expect((await uploadPositionJd(createdId, '_Chennai', file('chennai.pdf'))).data.data).toBe('chennai.pdf')
    await uploadPositionJd(createdId, '_Pune', file('pune.pdf'))
    expect((await letters()).map(l => [l.location, l.fileName])).toEqual([['_Chennai', 'chennai.pdf'], ['_Pune', 'pune.pdf']])
  })

  it('POST /positions/:id/jd — the same location replaces its letter', async () => {
    await uploadPositionJd(createdId, '_chennai', file('chennai-v2.pdf'))
    const ls = await letters()
    expect(ls).toHaveLength(2)
    expect(ls.find(l => l.location === '_Chennai').fileName).toBe('chennai-v2.pdf')
  })

  it('GET /positions/:id/jd/:letterId — returns the PDF', async () => {
    const res = await getPositionJd(createdId, (await letters())[0].id)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('application/pdf')
  })

  it('POST /positions/:id/jd — a file that is not a PDF returns 400', async () => {
    await expect(uploadPositionJd(createdId, '_Chennai', file('fake.pdf', '<html>')))
      .rejects.toMatchObject({ response: { status: 400 } })
  })

  it('DELETE /positions/:id/jd/:letterId — removes it', async () => {
    const [first] = await letters()
    await deletePositionJd(createdId, first.id)
    expect(await letters()).toHaveLength(1)
    await expect(getPositionJd(createdId, first.id)).rejects.toMatchObject({ response: { status: 404 } })
    // One left so deleting the position below also covers a position that has a JD letter.
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
