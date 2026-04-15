import api from './axios'

export const getPositions = (params) => api.get('/positions', { params })
export const getPosition = (id) => api.get(`/positions/${id}`)
export const createPosition = (data) => api.post('/positions', data)
export const updatePosition = (id, data) => api.put(`/positions/${id}`, data)
export const deletePosition = (id) => api.delete(`/positions/${id}`)

export const getPublicPositions = () => api.get('/positions')