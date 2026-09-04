import api from './axios'
import axios from 'axios'

const C = (path = '') => `${import.meta.env.VITE_PUBLIC_API_URL}/api/candidate${path}`

export const getCandidates = () => api.get(C())
export const getCandidate = (id) => api.get(C(`/${id}`))
export const createCandidate = (data) => api.post(C(), data)
export const updateCandidate = (id, data) => api.put(C(`/${id}`), data)
export const patchCandidate = (id, data) => api.patch(C(`/${id}`), data)
export const deleteCandidate = (id) => api.delete(C(`/${id}`))

export const getCandidateEvent = (id) => api.get(C(`/${id}/event`))
export const getCandidateResume = (id) => api.get(`${import.meta.env.VITE_PUBLIC_API_URL}/api/v1/candidates/${id}/resume`)

const V1 = (path = '') => `${import.meta.env.VITE_PUBLIC_API_URL}/api/v1/candidates${path}`

// Fetches the actual resume bytes through the authed axios instance (the /view and
// /download endpoints require a JWT, which a plain <iframe>/<a href> can't send).
export const getResumeFile = (id) => api.get(V1(`/${id}/resume/view`), { responseType: 'blob' })

export const getCandidateRoundResults = (id) => api.get(V1(`/${id}/round-results`))
export const updateRoundResult = (candidateId, eventId, roundId, data) => api.put(V1(`/${candidateId}/events/${eventId}/rounds/${roundId}`), data)
export const getCandidateStageHistory = (id) => api.get(V1(`/${id}/stage-history`))
export const addStageEntry = (candidateId, eventId, data) => api.post(V1(`/${candidateId}/events/${eventId}/stages`), data)
export const updateStageStatus = (candidateId, eventId, data) => api.patch(V1(`/${candidateId}/events/${eventId}/stages/current`), data)
export const updateStageStatusByName = (candidateId, eventId, stageName, data) =>
  api.patch(V1(`/${candidateId}/events/${eventId}/stages/${encodeURIComponent(stageName)}/status`), data)

export const uploadResume = (candidateId, file) => {
  const form = new FormData()
  form.append('file', file)
  return axios.post(`${import.meta.env.VITE_PUBLIC_API_URL}/api/v1/candidates/${candidateId}/resume`, form, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

export const getExitRecord = (candidateId) => api.get(C(`/${candidateId}/exit`))
export const createExitRecord = (candidateId, data) => api.post(C(`/${candidateId}/exit`), data)
export const updateExitRecord = (candidateId, data) => api.put(C(`/${candidateId}/exit`), data)
export const deleteExitRecord = (candidateId) => api.delete(C(`/${candidateId}/exit`))

// Offer
export const getOffer = (candidateId, eventId) =>
  api.get(`/candidates/${candidateId}/events/${eventId}/offer`)
export const upsertOffer = (candidateId, eventId, data) =>
  api.put(`/candidates/${candidateId}/events/${eventId}/offer`, data)

// Documents
export const getCandidateDocuments = (candidateId) =>
  api.get(`/candidates/${candidateId}/documents`)
export const uploadCandidateDocument = (candidateId, file, documentType, description) => {
  const form = new FormData()
  form.append('file', file)
  if (documentType) form.append('documentType', documentType)
  if (description) form.append('description', description)
  return api.post(`/candidates/${candidateId}/documents`, form)
}
export const deleteCandidateDocument = (candidateId, documentId) =>
  api.delete(`/candidates/${candidateId}/documents/${documentId}`)

// Public apply — no auth
// validates token in backend
export const getApplyForm = (token) =>
  axios.get(`${import.meta.env.VITE_PUBLIC_API_URL}/api/v1/links/validate/${token}`)

export const submitApplication = (token, data, file) => {
  const form = new FormData()
  Object.entries(data).forEach(([k, v]) => {
    if (v == null) return
    if (Array.isArray(v)) {
      v.forEach(item => form.append(k, item))
    } else {
      form.append(k, v)
    }
  })
  if (file) form.append('resume', file)
  return axios.post(`${import.meta.env.VITE_PUBLIC_API_URL}/api/v1/apply/${token}`, form)
}

/**
 * Pre-flight duplicate check for the public apply form — public, no auth.
 * Rejects an expired token before any lookup, so it doubles as a liveness check.
 */
export const checkApplication = (token, data) =>
  axios.post(`${import.meta.env.VITE_PUBLIC_API_URL}/api/v1/apply/${token}/check`, data)
