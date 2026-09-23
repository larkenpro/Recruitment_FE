import api from './axios'

export const getAuditLog = (params) => api.get('/admin/audit', { params })
