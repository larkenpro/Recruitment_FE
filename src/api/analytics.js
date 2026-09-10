import api from './axios'

/**
 * Every candidate's latest status at every stage, across all events — the source for the
 * recruitment funnel and the campus effectiveness table. Rows are `{ candidateId,
 * stageName, status }`, the same shape the per-event stage-summary returns.
 */
export const getStageSummaries = () => api.get('/analytics/stage-summary')
