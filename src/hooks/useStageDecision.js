import { useMutation } from '@tanstack/react-query'
import { addStageEntry, updateStageStatusByName } from '../api/candidates'

// The app tracks a candidate up to Joining; the backend still knows the later retention stages.
export const PIPELINE_STAGES = ['Resume', 'Rounds', 'Offer', 'Joining']

/**
 * Shared mutation for updating a candidate's stage status by name.
 * When SHORTLISTED, automatically advances to the next pipeline stage.
 * When REJECTED, the backend cascades rejection to all subsequent stages.
 *
 * Per-call params: { candidateId, eventId, stageName, status, ensureStarted? }
 *   ensureStarted — if true, attempts to start the stage before updating
 *                   (use when the stage may not yet exist, e.g. from EventDetail)
 */
export async function decideStage({ candidateId, eventId, stageName, status, ensureStarted = false }) {
  if (ensureStarted) {
    try { await addStageEntry(candidateId, eventId, { stageName }) } catch (_) {}
  }
  await updateStageStatusByName(candidateId, eventId, stageName, { status })
  if (status === 'SHORTLISTED') {
    const next = PIPELINE_STAGES[PIPELINE_STAGES.indexOf(stageName) + 1]
    if (next) await addStageEntry(candidateId, eventId, { stageName: next })
  }
}

export function useStageDecision({ onSuccess, onError } = {}) {
  return useMutation({ mutationFn: decideStage, onSuccess, onError })
}
