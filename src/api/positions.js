import api from './axios'

export const getPositions = (params) => api.get('/positions', { params })
export const getPosition = (id) => api.get(`/positions/${id}`)
export const createPosition = (data) => api.post('/positions', data)
export const updatePosition = (id, data) => api.put(`/positions/${id}`, data)
export const deletePosition = (id) => api.delete(`/positions/${id}`)

// JD letters as PDFs, one per position and location; uploading for the same location replaces it.
export const uploadPositionJd = (id, location, file) => {
  const form = new FormData()
  form.append('file', file)
  form.append('location', location)
  return api.post(`/positions/${id}/jd`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
}
// Fetched as a blob: the endpoint needs the JWT, which a plain link can't send.
export const getPositionJd = (id, letterId) => api.get(`/positions/${id}/jd/${letterId}`, { responseType: 'blob' })
export const deletePositionJd = (id, letterId) => api.delete(`/positions/${id}/jd/${letterId}`)

export const getPositionTypes = () => api.get('/position-types')
