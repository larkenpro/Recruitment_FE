import api from './axios'

export const getEvents = () => api.get('/events')
export const getEvent = (id) => api.get(`/events/${id}`)
export const createEvent = (data) => api.post('/events', data)
export const updateEventStatus = (id, status) => api.put(`/events/${id}/status?status=${status}`)
export const updateEventMode = (id, mode) => api.put(`/events/${id}/mode`, null, { params: { mode } })
// expiresOn: 'YYYY-MM-DD', the last day the link accepts applications; omit for 30 days.
export const generateLink = (eventId, expiresOn) => api.post(`/links/generate`, { eventId, expiresOn })
// The event's round graph: { pairs: [{ key, positionId, typeId, positionTitle, typeName }], rounds: [{ id, key, name, roundType, x, y, order }], edges: [{ from, to }] }, where `from` may be a pair key.
export const getRoundGraph = (eventId) => api.get(`/events/${eventId}/round-graph`)
// Replaces the whole graph; new rounds carry a temporary `key` that edges refer to.
export const saveRoundGraph = (eventId, graph) => api.put(`/events/${eventId}/round-graph`, graph)
// Per candidate: { candidateId, outcome, rounds: { [roundId]: 'NOT_APPLICABLE' | 'LOCKED' | 'OPEN' | 'PASS' | 'FAIL' | 'ON_HOLD' } }.
export const getRoundProgress = (eventId) => api.get(`/events/${eventId}/round-progress`)
export const getCandidatesByEvent = (eventId) => api.get(`/events/${eventId}/candidates`)
export const addEventApplication = (eventId, data) => api.post(`/events/${eventId}/applications`, data)
export const updateEventApplication = (eventId, candidateId, data) => api.put(`/events/${eventId}/applications/${candidateId}`, data)
export const getEventPositions = (eventId) => api.get(`/events/${eventId}/positions`)
// positions: [{ positionId, typeIds }] — every position needs at least one type
export const addEventPositions = (eventId, positions) => api.post(`/events/${eventId}/positions`, positions)
export const removeEventPosition = (eventId, positionId) => api.delete(`/events/${eventId}/positions/${positionId}`)
export const setEventPositionTypes = (eventId, positionId, typeIds) => api.put(`/events/${eventId}/positions/${positionId}/types`, typeIds)
export const getEventStageSummary = (eventId, stageName = 'Resume') =>
  api.get(`/events/${eventId}/candidates/stage-summary?stageName=${encodeURIComponent(stageName)}`)
export const getEventRoundResults = (eventId) => api.get(`/events/${eventId}/round-results`)
// Groups belong to one Group Discussion round of the event.
const G = (eventId, roundId, path = '') => `/events/${eventId}/rounds/${roundId}/groups${path}`
export const getGroups = (eventId, roundId) => api.get(G(eventId, roundId))
export const generateGroups = (eventId, roundId, count) => api.post(G(eventId, roundId), { count })
export const updateGroup = (eventId, roundId, groupId, data) => api.put(G(eventId, roundId, `/${groupId}`), data)
export const moveGroupMember = (eventId, roundId, groupId, candidateId) => api.put(G(eventId, roundId, `/${groupId}/members/${candidateId}`))
export const deleteAllGroups = (eventId, roundId) => api.delete(G(eventId, roundId))
