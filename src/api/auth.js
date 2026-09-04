import api from './axios'

export const getMe = () => api.get('/auth/me')
