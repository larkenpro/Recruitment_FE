import api from './axios'

export const getEvents = () => api.get('/events')
export const getEvent = (id) => api.get(`/events/${id}`)
export const createEvent = (data) => api.post('/events', data)
export const updateEventStatus = (id, status) => api.put(`/events/${id}/status?status=${status}`)
export const generateLink = (eventId) => api.post(`/links/generate`, {eventId : eventId})
export const uploadSheetToEvent = (eventId, file) => {
  const form = new FormData()
  form.append('file', file)
  return api.post(`/events/${eventId}/student-sheet`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
}

// Backend creates the event from these details + the sheet's student rows.
export const uploadStudentDataSheet = (file, { collegeId, recruitmentYear, startDate }) => {
  const form = new FormData()
  form.append('file', file)
  form.append('collegeId', collegeId)
  form.append('recruitmentYear', recruitmentYear)
  if (startDate) form.append('startDate', startDate)
  return api.post('/events/student-sheet', form, { headers: { 'Content-Type': 'multipart/form-data' } })
}
export const getRounds = (eventId) => api.get(`/events/${eventId}/rounds`)
export const createRound = (eventId, data) => api.post(`/events/${eventId}/rounds`, data)
export const updateRound = (eventId, roundId, data) => api.put(`/events/${eventId}/rounds/${roundId}`, data)
export const deleteRound = (eventId, roundId) => api.delete(`/events/${eventId}/rounds/${roundId}`)
export const getCandidatesByEvent = (eventId) => api.get(`/events/${eventId}/candidates`)
export const getEventPositions = (eventId) => api.get(`/events/${eventId}/positions`)
export const addEventPositions = (eventId, positionIds) => api.post(`/events/${eventId}/positions`, positionIds)
export const removeEventPosition = (eventId, positionId) => api.delete(`/events/${eventId}/positions/${positionId}`)
export const getEventStageSummary = (eventId, stageName = 'Resume') =>
  api.get(`/events/${eventId}/candidates/stage-summary?stageName=${encodeURIComponent(stageName)}`)
export const getEventRoundResults = (eventId) => api.get(`/events/${eventId}/round-results`)
export const getGroups = (eventId) => api.get(`/events/${eventId}/groups`)
export const generateGroups = (eventId, count) => api.post(`/events/${eventId}/groups`, { count })
export const updateGroup = (eventId, groupId, data) => api.put(`/events/${eventId}/groups/${groupId}`, data)
export const deleteAllGroups = (eventId) => api.delete(`/events/${eventId}/groups`)
