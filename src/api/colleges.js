import api from './axios'

export const getColleges = () => api.get('/colleges')
export const getCollege = (id) => api.get(`/colleges/${id}`)
export const getCollegeEvents = (id) => api.get(`/colleges/${id}/events`)
export const createCollege = (data) => api.post('/colleges', data)
export const updateCollege = (id, data) => api.put(`/colleges/${id}`, data)
