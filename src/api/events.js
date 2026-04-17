import api from './axios'

export const getEvents = () => api.get('/events')
export const getEvent = (id) => api.get(`/events/${id}`)
export const createEvent = (data) => api.post('/events', data)
export const updateEventStatus = (id, status) => api.put(`/events/${id}/status?status=${status}`)
export const generateLink = (eventId) => api.post(`/links/generate`, {eventId : eventId})
export const getRounds = (eventId) => api.get(`/events/${eventId}/rounds`)
export const createRound = (eventId, data) => api.post(`/events/${eventId}/rounds`, data)
export const getCandidatesByEvent = (eventId) => api.get(`/events/${eventId}/candidates`)
export const getEventPositions = (eventId) => api.get(`/events/${eventId}/positions`)
