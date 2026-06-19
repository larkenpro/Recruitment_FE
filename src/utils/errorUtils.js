export function getErrorMessage(err) {
  const data = err?.response?.data

  if (!data) return 'Network error — please check your connection'

  if (data.errorCode === 'VALIDATION_ERROR' && data.details?.length) {
    return data.details.map((d) => `${d.field}: ${d.message}`).join('\n')
  }

  return data.message || 'An unexpected error occurred'
}