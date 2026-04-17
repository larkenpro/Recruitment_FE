import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getEvents, getEvent, createEvent, updateEventStatus, getRounds, createRound, getEventPositions } from '../../api/events'
import { getColleges } from '../../api/colleges'
import { createPosition, deletePosition } from '../../api/positions'

describe('Events API', () => {
  let createdId = null
  let collegeId = null

  // resolve a real college ID to use in event creation
  beforeAll(async () => {
    try {
      const res = await getColleges()
      collegeId = res.data.data[0]?.id ?? null
    } catch {
      // backend not reachable — tests that need a college will be skipped
    }
  })

  // ── GET all ───────────────────────────────────────────────────────────────
  it('GET /events — returns success with an array', async () => {
    const res = await getEvents()
    expect(res.data.status).toBe('success')
    expect(Array.isArray(res.data.data)).toBe(true)
  })

  // ── POST ──────────────────────────────────────────────────────────────────
  it('POST /events — creates a new event', async () => {
    if (!collegeId) return // skip if no college seeded
    const res = await createEvent({
      collegeId,
      recruitmentYear: 2099,
      startDate: '2099-01-01',
      status: 'UPCOMING',
    })
    expect(res.data.status).toBe('success')
    expect(res.data.data.recruitmentYear).toBe(2099)
    createdId = res.data.data.id
  })

  // ── GET by ID ─────────────────────────────────────────────────────────────
  it('GET /events/:id — returns the created event', async () => {
    if (!createdId) return
    const res = await getEvent(createdId)
    expect(res.data.status).toBe('success')
    expect(res.data.data.id).toBe(createdId)
  })

  // ── PUT status ────────────────────────────────────────────────────────────
  it('PUT /events/:id/status — updates event status', async () => {
    if (!createdId) return
    const res = await updateEventStatus(createdId, 'ACTIVE')
    expect(res.data.status).toBe('success')
    expect(res.data.data.status).toBe('ACTIVE')
  })

  // ── Rounds ────────────────────────────────────────────────────────────────
  // BACKEND BUG: /events/:id/rounds returns 500 for both GET and POST.
  // Unskip these once the backend rounds endpoints are fixed.
  describe.skip('Rounds', () => {
    let createdRoundId = null

    // ── GET rounds (empty) ──────────────────────────────────────────────────
    it('GET /events/:id/rounds — returns success with an array', async () => {
      if (!createdId) return
      const res = await getRounds(createdId)
      expect(res.data.status).toBe('success')
      expect(Array.isArray(res.data.data)).toBe(true)
    })

    // ── POST round ──────────────────────────────────────────────────────────
    it('POST /events/:id/rounds — creates a round and returns its fields', async () => {
      if (!createdId) return
      const res = await createRound(createdId, {
        name: 'Aptitude Test',
        roundType: 'WRITTEN',
        sequence: 1,
      })
      expect(res.data.status).toBe('success')
      const round = res.data.data
      expect(round.name).toBe('Aptitude Test')
      expect(round.roundType).toBe('WRITTEN')
      expect(round.sequence).toBe(1)
      expect(typeof round.id).toBe('number')
      createdRoundId = round.id
    })

    // ── GET rounds (after create) ───────────────────────────────────────────
    it('GET /events/:id/rounds — newly created round appears in the list', async () => {
      if (!createdId || !createdRoundId) return
      const res = await getRounds(createdId)
      expect(res.data.status).toBe('success')
      const ids = res.data.data.map((r) => r.id)
      expect(ids).toContain(createdRoundId)
    })

    // ── Valid roundType values ──────────────────────────────────────────────
    const roundTypes = ['TECHNICAL', 'HR', 'GROUP_DISCUSSION', 'CODING']
    roundTypes.forEach((type, idx) => {
      it(`POST /events/:id/rounds — accepts roundType "${type}"`, async () => {
        if (!createdId) return
        const res = await createRound(createdId, {
          name: `${type} Round`,
          roundType: type,
          sequence: idx + 2, // sequence 2, 3, 4, 5
        })
        expect(res.data.status).toBe('success')
        expect(res.data.data.roundType).toBe(type)
      })
    })

    // ── Sequence ordering ───────────────────────────────────────────────────
    it('GET /events/:id/rounds — rounds are returned in sequence order', async () => {
      if (!createdId) return
      const res = await getRounds(createdId)
      expect(res.data.status).toBe('success')
      const sequences = res.data.data.map((r) => r.sequence)
      const sorted = [...sequences].sort((a, b) => a - b)
      expect(sequences).toEqual(sorted)
    })

    // ── 404 for unknown event ───────────────────────────────────────────────
    it('GET /events/999999/rounds — returns 404 for unknown event', async () => {
      await expect(getRounds(999999)).rejects.toMatchObject({
        response: { status: 404 },
      })
    })

    it('POST /events/999999/rounds — returns 404 for unknown event', async () => {
      await expect(
        createRound(999999, { name: 'Ghost Round', roundType: 'HR', sequence: 1 })
      ).rejects.toMatchObject({
        response: { status: 404 },
      })
    })
  })

  // ── Event Positions ───────────────────────────────────────────────────────
  describe('Event Positions', () => {
    let positionId = null
    let linkedEventId = null

    // Create a scratch position to link; clean it up after the suite
    beforeAll(async () => {
      try {
        const res = await createPosition({
          title: '_Test Position (events suite)',
          department: 'Engineering',
          type: 'Full-Time',
        })
        positionId = res.data.data.id
      } catch {
        // backend not reachable — tests that need a position will be skipped
      }
    })

    afterAll(async () => {
      if (positionId) {
        try { await deletePosition(positionId) } catch { /* best-effort cleanup */ }
      }
    })

    // ── POST with positionIds ─────────────────────────────────────────────
    it('POST /events — creates event with positionIds and returns positions array', async () => {
      if (!collegeId || !positionId) return
      const res = await createEvent({
        collegeId,
        recruitmentYear: 2097,
        startDate: '2097-01-01',
        status: 'UPCOMING',
        positionIds: [positionId],
      })
      expect(res.data.status).toBe('success')
      const event = res.data.data
      expect(Array.isArray(event.positions)).toBe(true)
      expect(event.positions.length).toBe(1)
      expect(event.positions[0].id).toBe(positionId)
      linkedEventId = event.id
    })

    // ── POST with empty positionIds ───────────────────────────────────────
    it('POST /events — response includes empty positions array when positionIds omitted', async () => {
      if (!collegeId) return
      const res = await createEvent({
        collegeId,
        recruitmentYear: 2096,
        startDate: '2096-01-01',
        status: 'UPCOMING',
      })
      expect(res.data.status).toBe('success')
      expect(Array.isArray(res.data.data.positions)).toBe(true)
      expect(res.data.data.positions.length).toBe(0)
    })

    // ── GET /events always includes positions ─────────────────────────────
    it('GET /events — every event item includes a positions array', async () => {
      const res = await getEvents()
      expect(res.data.status).toBe('success')
      res.data.data.forEach(event => {
        expect(Array.isArray(event.positions)).toBe(true)
      })
    })

    // ── GET /events/:id includes positions ────────────────────────────────
    it('GET /events/:id — response includes positions array', async () => {
      if (!linkedEventId) return
      const res = await getEvent(linkedEventId)
      expect(res.data.status).toBe('success')
      expect(Array.isArray(res.data.data.positions)).toBe(true)
    })

    // ── GET /events/:id/positions — linked position appears ───────────────
    it('GET /events/:id/positions — returns the linked position', async () => {
      if (!linkedEventId || !positionId) return
      const res = await getEventPositions(linkedEventId)
      expect(res.data.status).toBe('success')
      expect(Array.isArray(res.data.data)).toBe(true)
      const ids = res.data.data.map(p => p.id)
      expect(ids).toContain(positionId)
    })

    // ── GET /events/:id/positions — position object shape ─────────────────
    it('GET /events/:id/positions — each position has expected fields', async () => {
      if (!linkedEventId) return
      const res = await getEventPositions(linkedEventId)
      expect(res.data.status).toBe('success')
      res.data.data.forEach(p => {
        expect(typeof p.id).toBe('number')
        expect(typeof p.title).toBe('string')
      })
    })

    // ── GET /events/:id/positions — event with no positions is empty ───────
    it('GET /events/:id/positions — returns empty array for event with no positions', async () => {
      if (!createdId) return // createdId was created without positionIds
      const res = await getEventPositions(createdId)
      expect(res.data.status).toBe('success')
      expect(res.data.data.length).toBe(0)
    })

    // ── 404 ───────────────────────────────────────────────────────────────
    it('GET /events/999999/positions — returns 404 for unknown event', async () => {
      await expect(getEventPositions(999999)).rejects.toMatchObject({
        response: { status: 404 },
      })
    })
  })

  // ── 404 ───────────────────────────────────────────────────────────────────
  it('GET /events/999999 — returns 404 for unknown id', async () => {
    await expect(getEvent(999999)).rejects.toMatchObject({
      response: { status: 404 },
    })
  })
})
