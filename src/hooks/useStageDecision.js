import { useMutation } from '@tanstack/react-query'
import { addStageEntry, updateStageStatus } from '../api/candidates'

export const PIPELINE_STAGES = [
  'Resume', 'Rounds', 'Offer', 'Joining', '6 Month Review', '12 Month Retained', 'Exit',
]

/**
 * Shared mutation for updating a candidate's stage status.
 * When SHORTLISTED, automatically advances to the next pipeline stage.
 *
 * Per-call params: { candidateId, eventId, stageName, status, ensureStarted? }
 *   ensureStarted — if true, attempts to start the stage before updating
 *                   (use when the stage may not yet exist, e.g. from EventDetail)
 */
export function useStageDecision({ onSuccess, onError } = {}) {
  return useMutation({
    mutationFn: async ({ candidateId, eventId, stageName, status, ensureStarted = false }) => {
      if (ensureStarted) {
        try { await addStageEntry(candidateId, eventId, { stageName }) } catch (_) {}
      }
      await updateStageStatus(candidateId, eventId, { status })
      if (status === 'SHORTLISTED') {
        const next = PIPELINE_STAGES[PIPELINE_STAGES.indexOf(stageName) + 1]
        if (next) await addStageEntry(candidateId, eventId, { stageName: next })
      }
    },
    onSuccess,
    onError,
  })
}
