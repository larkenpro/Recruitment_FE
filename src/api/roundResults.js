import api from './axios'

export const getAllRoundResults = () => api.get('/round-results')
