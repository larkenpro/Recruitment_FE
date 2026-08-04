import api from './axios'

export const BATCH_SIZE = 10

export const getImportFields = () => api.get('/imports/fields')

export const parseWorkbook = (file) => {
  const form = new FormData()
  form.append('file', file)
  return api.post('/imports/parse', form)
}

export const preflightImport = (data) => api.post('/imports/preflight', data)
export const importBatch = (eventId, data) => api.post(`/imports/${eventId}/batch`, data)
export const downloadFailures = (data) =>
  api.post('/imports/failures/xlsx', data, { responseType: 'blob' })

/** Rows are posted a batch at a time so one bad batch can't take the whole import down. */
export const chunk = (rows, size = BATCH_SIZE) => {
  const batches = []
  for (let i = 0; i < rows.length; i += size) batches.push(rows.slice(i, i + size))
  return batches
}

/**
 * Every position title in the workbook, sorted. This is the ranking universe: titles a
 * candidate didn't list get appended to their preferences as least-preferred.
 */
export const distinctPositions = (rows, columnIndex) => {
  if (columnIndex == null || columnIndex < 0) return []
  const titles = new Set()
  rows.forEach((row) => {
    String(row.values[columnIndex] ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .forEach((t) => titles.add(t))
  })
  return [...titles].sort()
}
