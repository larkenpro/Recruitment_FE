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
export const getCandidateScores = (id) => api.get(C(`/${id}/scores`))
export const getCandidateStageHistory = (id) => api.get(C(`/${id}/stage-history`))

export const uploadResume = (candidateId, file) => {
  const form = new FormData()
  form.append('file', file)
  return axios.post(`${import.meta.env.VITE_PUBLIC_API_URL}/api/v1/candidates/${candidateId}/resume`, form, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

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
