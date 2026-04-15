import { describe, it, expect, beforeAll } from 'vitest'
import {
  getPositions,
  getPosition,
  createPosition,
  updatePosition,
  deletePosition,
  getPublicPositions,
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
      type: 'Full-Time',
    })
    expect(res.data.status).toBe('success')
    expect(res.data.data).toMatchObject({
      title: '_Test Engineer',
      department: 'QA',
      type: 'Full-Time',
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

  it('GET /positions?type=Full-Time — filters results by type', async () => {
    const res = await getPositions({ type: 'Full-Time' })
    expect(res.data.status).toBe('success')
    res.data.data.forEach(p => expect(p.type).toBe('Full-Time'))
  })

  // ── PUT ───────────────────────────────────────────────────────────────────
  it('PUT /positions/:id — updates the position', async () => {
    const res = await updatePosition(createdId, {
      title: '_Senior Test Engineer',
      department: 'QA',
      type: 'Full-Time',
    })
    expect(res.data.status).toBe('success')
    expect(res.data.data.title).toBe('_Senior Test Engineer')
    expect(res.data.data.id).toBe(createdId)
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

  // ── getPublicPositions ────────────────────────────────────────────────────
  it('getPublicPositions — returns success with an array', async () => {
    const res = await getPublicPositions()
    expect(res.data.status).toBe('success')
    expect(Array.isArray(res.data.data)).toBe(true)
  })
})
