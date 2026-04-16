import api from './axios'
import axios from 'axios'

export const getCandidates = () => api.get('/candidates')
export const getCandidate = (id) => api.get(`/candidates/${id}`)
export const createCandidate = (data) => api.post('/candidates', data)
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

export const submitApplication = (token, data) =>
  axios.post(`${import.meta.env.VITE_PUBLIC_API_URL}/api/v1/public-apply/${token}`, data)
