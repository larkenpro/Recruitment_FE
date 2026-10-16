import { Modal } from 'antd'
import { offerResponse } from '../utils/offers'

const OFFER_STATUS_LABEL = { SHORTLISTED: 'Shortlisted', HOLD: 'WaitList', REJECTED: 'Rejected' }

// One line per candidate a change would take back out of the cleared rounds (an OFFER_CONFLICT conflict).
export const describeConflict = (c) =>
  `${c.name} — Offer Status: ${OFFER_STATUS_LABEL[c.offerStatus] ?? 'Undecided'}, Offer Response: ${offerResponse(c.offerResponse).label}`

// Asks whether to go ahead anyway; resolves true to revoke their offers.
export const confirmRevokeOffers = (conflicts) => new Promise((resolve) => {
  Modal.confirm({
    centered: true,
    width: 520,
    title: `This would undo ${conflicts.length === 1 ? 'an offer' : `${conflicts.length} offers`}`,
    content: (
      <>
        <p>
          The change takes {conflicts.length === 1 ? 'this candidate' : 'these candidates'} back out of the cleared
          rounds, so their offer no longer stands:
        </p>
        <ul style={{ paddingLeft: 18 }}>
          {conflicts.map((c) => <li key={c.candidateId}>{describeConflict(c)}</li>)}
        </ul>
        <p>Going ahead revokes their offer letters and clears their Offer and Joining progress.</p>
      </>
    ),
    okText: 'Revoke offers and save',
    okButtonProps: { danger: true },
    cancelText: 'Keep offers',
    onOk: () => resolve(true),
    onCancel: () => resolve(false),
  })
})
