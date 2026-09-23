export function getErrorMessage(err, fallback) {
  const data = err?.response?.data
  if (!data) return 'Network error — please check your connection'
  const message = data.message || fallback || 'An unexpected error occurred'
  // The id also tags the server log line and the audit_log row, so a screenshot of the
  // toast is enough to find the exact request.
  return data.requestId ? `${message} (ref: ${data.requestId})` : message
}
