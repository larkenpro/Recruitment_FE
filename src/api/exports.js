import api from './axios'

// { title, columns: [title], rows: [[cell]], mergeColumns?: [index] } → the .xlsx bytes, in the app's sheet style.
export const exportXlsx = (table) => api.post('/exports/xlsx', table, { responseType: 'blob' })
