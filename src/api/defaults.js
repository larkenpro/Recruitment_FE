import api from './axios'

// What new events and rounds start with: { minTenth, minTwelfth, minCgpa, maxActiveBacklogs,
// maxTotalBacklogs, weightTenth, weightTwelfth, weightCgpa, roundMaxScore, roundWeight,
// gradeExcellent, gradeVeryGood, gradeGood, gradeNotBad (% of a round's max) }; null criterion = off.
export const getDefaults = () => api.get('/defaults')
export const updateDefaults = (defaults) => api.put('/defaults', defaults)
