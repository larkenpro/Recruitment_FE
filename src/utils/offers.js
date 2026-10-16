// The candidate's answer to an offer, kept in the offer record's `status`; none yet reads as No Information.
export const OFFER_RESPONSES = [
  { value: 'ACCEPTED', label: 'Accepted', color: 'green' },
  { value: 'REJECTED', label: 'Rejected', color: 'red' },
]

export const offerResponse = (status) =>
  OFFER_RESPONSES.find((r) => r.value === status) ?? { value: null, label: status ?? 'No Information', color: 'default' }
