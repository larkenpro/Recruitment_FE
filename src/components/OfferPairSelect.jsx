import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Select, Typography, message } from 'antd'
import { upsertOffer } from '../api/candidates'
import { getErrorMessage } from '../utils/errorUtils'
import { offerPairs } from '../utils/preferences'

// Every pair the event hires for, with the candidate's preference rank beside it ('-' if unranked).
export default function OfferPairSelect({ eventPositions, preferences, ...selectProps }) {
  return (
    <Select
      allowClear
      placeholder="Select position"
      popupMatchSelectWidth={false}
      {...selectProps}
      options={offerPairs(eventPositions, preferences).map((p) => ({
        value: p.key,
        label: (
          <span style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <span>{p.label}</span>
            <Typography.Text type="secondary">{p.rank ?? '-'}</Typography.Text>
          </span>
        ),
      }))}
    />
  )
}

const offeredKey = (offer) =>
  offer?.offeredPosition && offer?.offeredType ? `${offer.offeredPosition.id}:${offer.offeredType.id}` : null

// A table cell that saves the offered pair as soon as it is picked.
export function OfferedPositionCell({ candidateId, eventId, offer, eventPositions, preferences }) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    // The PUT replaces the whole offer, so the rest of it goes along unchanged.
    mutationFn: (pair) => {
      const [offeredPositionId, offeredTypeId] = pair ? pair.split(':').map(Number) : [null, null]
      return upsertOffer(candidateId, eventId, {
        offerDate: offer?.offerDate ?? null,
        location: offer?.location ?? null,
        status: offer?.status ?? null,
        offeredPositionId,
        offeredTypeId,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offers'] })
      queryClient.invalidateQueries({ queryKey: ['offer'] })
      message.success('Offered position saved!')
    },
    onError: (err) => message.error(getErrorMessage(err)),
  })
  return (
    <OfferPairSelect
      size="small"
      style={{ width: 240 }}
      eventPositions={eventPositions}
      preferences={preferences}
      value={offeredKey(offer)}
      loading={!eventPositions || mutation.isPending}
      disabled={mutation.isPending}
      onChange={(pair) => mutation.mutate(pair ?? null)}
    />
  )
}
