import { describe, it, expect } from 'vitest'
import { getColleges, getCollege, createCollege, getCollegeEvents } from '../../api/colleges'

describe('Colleges API', () => {
  let createdId = null

  // ── GET all ───────────────────────────────────────────────────────────────
  it('GET /colleges — returns success with an array', async () => {
    const res = await getColleges()
    expect(res.data.status).toBe('success')
    expect(Array.isArray(res.data.data)).toBe(true)
  })

  // ── POST ──────────────────────────────────────────────────────────────────
  it('POST /colleges — creates a new college with ordered contacts and designations', async () => {
    const res = await createCollege({
      name: '_Test College',
      city: 'Test City',
      state: 'Test State',
      tier: 'Tier 3',
      contacts: [
        { name: 'Jane Doe', designation: 'Head, Training & Placement', email: 'jane@test.edu', phone: '9876543210' },
        { name: 'John Roe', designation: 'Assistant Professor, CSE' },
      ],
    })
    expect(res.data.status).toBe('success')
    expect(res.data.data).toMatchObject({
      name: '_Test College',
      city: 'Test City',
      contacts: [
        { name: 'Jane Doe', designation: 'Head, Training & Placement', email: 'jane@test.edu', phone: '9876543210' },
        { name: 'John Roe', designation: 'Assistant Professor, CSE', email: null, phone: null },
      ],
    })
    expect(typeof res.data.data.id).toBe('number')
    createdId = res.data.data.id
  })

  // ── GET by ID ─────────────────────────────────────────────────────────────
  it('GET /colleges/:id — returns the created college', async () => {
    const res = await getCollege(createdId)
    expect(res.data.status).toBe('success')
    expect(res.data.data.id).toBe(createdId)
    expect(res.data.data.name).toBe('_Test College')
  })

  // ── events at a college ───────────────────────────────────────────────────
  it('GET /colleges/:id/events — a new college has no events yet', async () => {
    const res = await getCollegeEvents(createdId)
    expect(res.data.status).toBe('success')
    expect(res.data.data).toEqual([])
  })

  it('GET /colleges/999999/events — returns 404 for unknown college', async () => {
    await expect(getCollegeEvents(999999)).rejects.toMatchObject({
      response: { status: 404 },
    })
  })

  // ── not found ─────────────────────────────────────────────────────────────
  it('GET /colleges/999999 — returns 404 for unknown id', async () => {
    await expect(getCollege(999999)).rejects.toMatchObject({
      response: { status: 404 },
    })
  })
})
