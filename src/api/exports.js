import api from './axios'

// { title, columns: [title], rows: [[cell]] } → the .xlsx bytes.
export const exportXlsx = (table) => api.post('/exports/xlsx', table, { responseType: 'blob' })
