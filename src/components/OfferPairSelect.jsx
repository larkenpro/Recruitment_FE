import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Select, Tag, Typography, message } from 'antd'
import { upsertOffer } from '../api/candidates'
import { getErrorMessage } from '../utils/errorUtils'
import { offerPairs } from '../utils/preferences'
import { OFFER_RESPONSES } from '../utils/offers'

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

// Saves some fields of an offer. The PUT replaces the whole record, so the rest goes along unchanged.
function useOfferUpdate(candidateId, eventId, offer, savedMessage) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (changes) => {
      const [offeredPositionId, offeredTypeId] = offeredKey(offer)?.split(':').map(Number) ?? [null, null]
      return upsertOffer(candidateId, eventId, {
        offerDate: offer?.offerDate ?? null,
        location: offer?.location ?? null,
        status: offer?.status ?? null,
        offeredPositionId,
        offeredTypeId,
        ...changes,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offers'] })
      queryClient.invalidateQueries({ queryKey: ['offer'] })
      message.success(savedMessage)
    },
    onError: (err) => message.error(getErrorMessage(err)),
  })
}

// A table cell that saves the offered pair as soon as it is picked.
export function OfferedPositionCell({ candidateId, eventId, offer, eventPositions, preferences }) {
  const mutation = useOfferUpdate(candidateId, eventId, offer, 'Offered position saved!')
  return (
    <OfferPairSelect
      size="small"
      style={{ width: 240 }}
      eventPositions={eventPositions}
      preferences={preferences}
      value={offeredKey(offer)}
      loading={!eventPositions || mutation.isPending}
      disabled={mutation.isPending}
      onChange={(pair) => {
        const [offeredPositionId, offeredTypeId] = pair ? pair.split(':').map(Number) : [null, null]
        mutation.mutate({ offeredPositionId, offeredTypeId })
      }}
    />
  )
}

// A table cell for whether the candidate accepted the offer; saves on pick.
export function OfferResponseCell({ candidateId, eventId, offer }) {
  const mutation = useOfferUpdate(candidateId, eventId, offer, 'Offer response saved!')
  return (
    <Select
      size="small"
      style={{ width: 150 }}
      // '' stands in for "no answer yet", which is stored as null.
      value={offer?.status ?? ''}
      loading={mutation.isPending}
      disabled={mutation.isPending}
      onChange={(status) => mutation.mutate({ status: status || null })}
      options={[
        ...OFFER_RESPONSES.map((r) => ({ value: r.value, label: <Tag color={r.color}>{r.label}</Tag> })),
        { value: '', label: <Tag>No Information</Tag> },
      ]}
    />
  )
}
