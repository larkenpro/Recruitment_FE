import api from './axios'

export const getStages = () => api.get(`${import.meta.env.VITE_PUBLIC_API_URL}/api/v1/stages`)
