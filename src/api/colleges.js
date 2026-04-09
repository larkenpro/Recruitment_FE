import api from './axios'

export const getColleges = () => api.get('/colleges')
export const getCollege = (id) => api.get(`/colleges/${id}`)
export const createCollege = (data) => api.post('/colleges', data)
