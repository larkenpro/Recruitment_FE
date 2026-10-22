import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getEvents, getEvent, createEvent, updateEventStatus, updateEventMode, addEventApplication, updateEventApplication, getRoundGraph, saveRoundGraph, getRoundProgress, getEventPositions, setEventPositionTypes, getCandidatesByEvent, getGroups, generateGroups, updateGroup, deleteAllGroups } from '../../api/events'
import { getColleges } from '../../api/colleges'
import { createPosition, deletePosition, getPositionTypes } from '../../api/positions'

// Events can't be deleted and identical ones are rejected, so each run needs its own years.
const YEAR = 3000 + Math.floor(Math.random() * 6000)

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
      recruitmentYear: YEAR,
      startDate: `${YEAR}-01-01`,
      status: 'UPCOMING',
    })
    expect(res.data.status).toBe('success')
    expect(res.data.data.recruitmentYear).toBe(YEAR)
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

  // ── Round graph ───────────────────────────────────────────────────────────
  describe('Round graph', () => {
    let saved = null

    it('GET /events/:id/round-graph — an event starts with no rounds', async () => {
      if (!createdId) return
      const res = await getRoundGraph(createdId)
      expect(res.data.status).toBe('success')
      expect(Array.isArray(res.data.data.rounds)).toBe(true)
      expect(Array.isArray(res.data.data.edges)).toBe(true)
    })

    it('PUT /events/:id/round-graph — saves rounds and arrows, returned in graph order', async () => {
      if (!createdId) return
      const res = await saveRoundGraph(createdId, {
        rounds: [
          { key: 'hr', name: 'HR Round', roundType: 'HR', x: 300, y: 0 },
          { key: 'apt', name: 'Aptitude Test', roundType: 'WRITTEN', x: 0, y: 0 },
          { key: 'gd', name: 'Group Discussion', roundType: 'GROUP_DISCUSSION', x: 0, y: 120 },
        ],
        edges: [{ from: 'apt', to: 'hr' }, { from: 'gd', to: 'hr' }],
      })
      expect(res.data.status).toBe('success')
      saved = res.data.data
      expect(saved.rounds.map((r) => r.name)).toEqual(['Aptitude Test', 'Group Discussion', 'HR Round'])
      expect(saved.rounds.map((r) => r.order)).toEqual([1, 2, 3])
      expect(saved.edges).toHaveLength(2)
      saved.rounds.forEach((r) => expect(typeof r.id).toBe('number'))
    })

    it('PUT /events/:id/round-graph — rejects a loop with 400', async () => {
      if (!saved) return
      const [a, , hr] = saved.rounds
      await expect(saveRoundGraph(createdId, {
        rounds: saved.rounds.map(({ id, name }) => ({ id, name })),
        edges: [{ from: String(a.id), to: String(hr.id) }, { from: String(hr.id), to: String(a.id) }],
      })).rejects.toMatchObject({ response: { status: 400 } })
    })

    it('GET /events/:id/round-progress — returns success with an array', async () => {
      if (!createdId) return
      const res = await getRoundProgress(createdId)
      expect(res.data.status).toBe('success')
      expect(Array.isArray(res.data.data)).toBe(true)
    })

    it('GET /events/999999/round-graph — returns 404 for unknown event', async () => {
      await expect(getRoundGraph(999999)).rejects.toMatchObject({ response: { status: 404 } })
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
          jobDescription: 'Scratch position for the events suite.',
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
    it('POST /events — creates event with typed positions and returns positions array', async () => {
      if (!collegeId || !positionId) return
      const res = await createEvent({
        collegeId,
        recruitmentYear: YEAR + 1,
        startDate: `${YEAR + 1}-01-01`,
        status: 'UPCOMING',
        positions: [{ positionId, typeIds: [(await getPositionTypes()).data.data[0].id] }],
      })
      expect(res.data.status).toBe('success')
      const event = res.data.data
      expect(Array.isArray(event.positions)).toBe(true)
      expect(event.positions.length).toBe(1)
      expect(event.positions[0].id).toBe(positionId)
      linkedEventId = event.id
    })

    // ── POST with empty positionIds ───────────────────────────────────────
    it('POST /events — response includes empty positions array when positions omitted', async () => {
      if (!collegeId) return
      const res = await createEvent({
        collegeId,
        recruitmentYear: YEAR + 2,
        startDate: `${YEAR + 2}-01-01`,
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
      if (!createdId) return // createdId was created without positions
      const res = await getEventPositions(createdId)
      expect(res.data.status).toBe('success')
      expect(res.data.data.length).toBe(0)
    })

    // ── admin candidate entry ─────────────────────────────────────────────
    it('POST /events/:id/applications — adds a candidate, refuses a repeat, and edits them', async () => {
      if (!linkedEventId || !positionId) return
      const typeId = (await getEventPositions(linkedEventId)).data.data.find(p => p.id === positionId).types[0].id
      const walkIn = {
        name: '_Walk-in', email: `walkin_${Date.now()}@example.com`, rollNo: `W${Date.now()}`,
        ugCgpa: 8.1, consent: true, preferences: [{ positionId, typeId }],
      }

      await expect(addEventApplication(linkedEventId, { ...walkIn, consent: false }))
        .rejects.toMatchObject({ response: { status: 400 } })

      const added = await addEventApplication(linkedEventId, walkIn)
      expect(added.status).toBe(201)
      expect(added.data.data.consentedAt).toBeTruthy()

      await expect(addEventApplication(linkedEventId, walkIn)).rejects.toMatchObject({ response: { status: 409 } })

      const edited = await updateEventApplication(linkedEventId, added.data.data.candidateId,
        { ...walkIn, name: '_Walk-in Edited', ugCgpa: 8.6 })
      expect(edited.data.data).toMatchObject({ name: '_Walk-in Edited', ugCgpa: 8.6, email: walkIn.email })
    })

    // ── mode ──────────────────────────────────────────────────────────────
    it('POST /events — mode defaults to ON_CAMPUS and can be changed', async () => {
      if (!linkedEventId) return
      expect((await getEvent(linkedEventId)).data.data.mode).toBe('ON_CAMPUS')
      const res = await updateEventMode(linkedEventId, 'HYBRID')
      expect(res.data.data.mode).toBe('HYBRID')
    })

    it('PUT /events/:id/mode — an unknown mode is rejected with 400', async () => {
      if (!linkedEventId) return
      await expect(updateEventMode(linkedEventId, 'UNDERWATER')).rejects.toMatchObject({ response: { status: 400 } })
    })

    // ── PUT /events/:id/positions/:positionId/types ───────────────────────
    it('PUT /events/:id/positions/:positionId/types — sets the types the position is open for', async () => {
      if (!linkedEventId || !positionId) return
      const types = (await getPositionTypes()).data.data
      const res = await setEventPositionTypes(linkedEventId, positionId, [types[0].id, types[1].id])
      expect(res.data.status).toBe('success')
      const linked = res.data.data.find(p => p.id === positionId)
      expect(linked.types.map(t => t.id)).toEqual([types[0].id, types[1].id])

      const reread = await getEventPositions(linkedEventId)
      expect(reread.data.data.find(p => p.id === positionId).types).toHaveLength(2)
    })

    it('PUT /events/:id/positions/:positionId/types — 404 for a position not on the event', async () => {
      if (!linkedEventId) return
      await expect(setEventPositionTypes(linkedEventId, 999999, [])).rejects.toMatchObject({
        response: { status: 404 },
      })
    })

    it('POST /events — a position with no type is rejected with 400', async () => {
      if (!collegeId || !positionId) return
      await expect(createEvent({
        collegeId,
        recruitmentYear: YEAR + 3,
        positions: [{ positionId, typeIds: [] }],
      })).rejects.toMatchObject({ response: { status: 400 } })
    })

    // ── 404 ───────────────────────────────────────────────────────────────
    it('GET /events/999999/positions — returns 404 for unknown event', async () => {
      await expect(getEventPositions(999999)).rejects.toMatchObject({
        response: { status: 404 },
      })
    })
  })

  // ── Event Candidates ──────────────────────────────────────────────────────
  describe('Event Candidates', () => {

    // ── GET /events/:id/candidates — returns array ────────────────────────
    it('GET /events/:id/candidates — returns success with an array', async () => {
      if (!createdId) return
      const res = await getCandidatesByEvent(createdId)
      expect(res.data.status).toBe('success')
      expect(Array.isArray(res.data.data)).toBe(true)
    })

    // ── No applications on a fresh event ─────────────────────────────────
    it('GET /events/:id/candidates — empty array for event with no applications', async () => {
      if (!createdId) return
      const res = await getCandidatesByEvent(createdId)
      expect(res.data.status).toBe('success')
      expect(res.data.data.length).toBe(0)
    })

    // ── Candidate object shape (when candidates exist) ────────────────────
    it('GET /events/:id/candidates — each candidate has expected fields', async () => {
      if (!createdId) return
      const res = await getCandidatesByEvent(createdId)
      expect(res.data.status).toBe('success')
      res.data.data.forEach(c => {
        expect(typeof c.id).toBe('number')
        expect(typeof c.name).toBe('string')
        expect(typeof c.email).toBe('string')
      })
    })

    // ── unknown event — backend returns 200 with empty array ─────────────
    // NOTE: backend does not 404 on unknown eventId for this endpoint;
    // it returns success with an empty candidates array instead.
    it('GET /events/999999/candidates — returns success with empty array for unknown event', async () => {
      const res = await getCandidatesByEvent(999999)
      expect(res.data.status).toBe('success')
      expect(Array.isArray(res.data.data)).toBe(true)
      expect(res.data.data.length).toBe(0)
    })
  })

  // ── Groups (per Group Discussion round) ───────────────────────────────────
  describe('Groups', () => {
    let gdRoundId = null

    // The Round graph tests above saved a Group Discussion round on this event.
    beforeAll(async () => {
      if (!createdId) return
      const res = await getRoundGraph(createdId)
      gdRoundId = res.data.data.rounds.find((r) => r.roundType === 'GROUP_DISCUSSION')?.id ?? null
    })

    it('GET /events/:id/rounds/:roundId/groups — returns success with an array', async () => {
      if (!gdRoundId) return
      const res = await getGroups(createdId, gdRoundId)
      expect(res.data.status).toBe('success')
      expect(Array.isArray(res.data.data)).toBe(true)
    })

    it('POST /events/:id/rounds/:roundId/groups — returns 400 when nobody has reached the round', async () => {
      if (!gdRoundId) return
      await expect(generateGroups(createdId, gdRoundId, 2)).rejects.toMatchObject({
        response: { status: 400 },
      })
    })

    it('PUT /events/:id/rounds/:roundId/groups/:groupId — returns 404 for unknown group', async () => {
      if (!gdRoundId) return
      await expect(updateGroup(createdId, gdRoundId, 999999, { name: 'Group X', topic: 'Test' })).rejects.toMatchObject({
        response: { status: 404 },
      })
    })

    it('DELETE /events/:id/rounds/:roundId/groups — returns success', async () => {
      if (!gdRoundId) return
      const res = await deleteAllGroups(createdId, gdRoundId)
      expect(res.data.status).toBe('success')
    })

    it('GET groups for a round that is not a Group Discussion round — returns 400', async () => {
      if (!createdId) return
      const graph = (await getRoundGraph(createdId)).data.data
      const other = graph.rounds.find((r) => r.roundType !== 'GROUP_DISCUSSION')
      if (!other) return
      await expect(getGroups(createdId, other.id)).rejects.toMatchObject({ response: { status: 400 } })
    })

    it('GET /events/999999/rounds/1/groups — returns 404 for unknown event', async () => {
      await expect(getGroups(999999, 1)).rejects.toMatchObject({
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
