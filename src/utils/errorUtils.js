export function getErrorMessage(err) {
  const data = err?.response?.data
  if (!data) return 'Network error — please check your connection'
  return data.message || 'An unexpected error occurred'
}
