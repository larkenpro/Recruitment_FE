import api from './axios'

// What new events and rounds start with: { minTenth, minTwelfth, minCgpa, maxActiveBacklogs,
// maxTotalBacklogs, weightTenth, weightTwelfth, weightCgpa, roundMaxScore, roundWeight }; null criterion = off.
export const getDefaults = () => api.get('/defaults')
export const updateDefaults = (defaults) => api.put('/defaults', defaults)
