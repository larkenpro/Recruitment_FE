import api from './axios'

export const getPositions = (params) => api.get('/positions', { params })
export const getPosition = (id) => api.get(`/positions/${id}`)
export const createPosition = (data) => api.post('/positions', data)
export const updatePosition = (id, data) => api.put(`/positions/${id}`, data)
export const deletePosition = (id) => api.delete(`/positions/${id}`)

// The JD as a PDF, one per position; uploading again replaces it.
export const uploadPositionJd = (id, file) => {
  const form = new FormData()
  form.append('file', file)
  return api.post(`/positions/${id}/jd`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
}
// Fetched as a blob: the endpoint needs the JWT, which a plain link can't send.
export const getPositionJd = (id) => api.get(`/positions/${id}/jd`, { responseType: 'blob' })
export const deletePositionJd = (id) => api.delete(`/positions/${id}/jd`)

export const getPositionTypes = () => api.get('/position-types')
