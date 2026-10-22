import { useState } from 'react'
import { Card, Table, Select, message } from 'antd'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getOffers } from '../api/candidates'
import { getEventPositions } from '../api/events'
import { useAuth } from '../context/AuthContext'
import { PIPELINE_STAGES, useStageDecision } from '../hooks/useStageDecision'
import { useColumnFilter } from '../hooks/useColumnFilter'
import FilterBar from '../components/FilterBar'
import { OfferResponseCell, OfferedPositionCell } from '../components/OfferPairSelect'
import { useColumnChoice } from '../components/ColumnPicker'
import { useCandidateColumns } from '../components/CandidateColumns'
import DownloadExcel from '../components/DownloadExcel'
import { labelFor } from '../utils/columns'
import { offerResponse, offeredLabel } from '../utils/offers'
import { getErrorMessage } from '../utils/errorUtils'

const AFTER_OFFER = PIPELINE_STAGES.slice(PIPELINE_STAGES.indexOf('Offer') + 1)

const DECISION_OPTIONS = [
  { value: 'SHORTLISTED', label: 'Shortlisted' },
  { value: 'HOLD', label: 'Hold' },
  { value: 'REJECTED', label: 'Rejected' },
]
// Same stored values; at Offer, HOLD reads as a waitlist.
const OFFER_DECISION_OPTIONS = DECISION_OPTIONS.map((o) => (o.value === 'HOLD' ? { ...o, label: 'WaitList' } : o))
const optionsFor = (stageName) => (stageName === 'Offer' ? OFFER_DECISION_OPTIONS : DECISION_OPTIONS)

const currentStage = (r) => PIPELINE_STAGES.filter((s) => s in r.stages).at(-1)

const FILTER_KEYS = [
  { key: 'name', label: 'Name', getVal: (r) => r.name, type: 'text' },
  { key: 'collegeName', label: 'College', getVal: (r) => r.collegeName },
  { key: 'branch', label: 'Branch', getVal: (r) => r.branch },
  { key: 'graduationYear', label: 'Batch', getVal: (r) => r.graduationYear },
  { key: 'stage', label: 'Stage', getVal: currentStage },
  { key: 'offerStatus', label: 'Offer Status', type: 'multi', getVal: (r) => r.stages.Offer },
]

const rowKey = (r) => `${r.eventId}:${r.candidateId}`

export default function Offers() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { hasPage } = useAuth()
  const [pendingKey, setPendingKey] = useState(null)

  const { data: offers, isLoading } = useQuery({
    queryKey: ['offers'],
    queryFn: () => getOffers().then((r) => r.data.data),
  })

  const eventIds = [...new Set((offers ?? []).map((r) => r.eventId))]
  const positionsByEvent = Object.fromEntries(useQueries({
    queries: eventIds.map((id) => ({
      queryKey: ['eventPositions', String(id)],
      queryFn: () => getEventPositions(id).then((r) => r.data.data),
    })),
  }).map((q, i) => [eventIds[i], q.data]))

  const columnsFor = useColumnChoice()
  const { columns: col, modals: candidateModals } = useCandidateColumns((eventId) => positionsByEvent[eventId])

  const { filteredData, filters, setFilter, removeFilter, optionMap: rawOptionMap } = useColumnFilter(offers, FILTER_KEYS, { offerStatus: ['SHORTLISTED', 'HOLD'] })
  const optionMap = { ...rawOptionMap, offerStatus: OFFER_DECISION_OPTIONS }

  const decision = useStageDecision({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offers'] })
      setPendingKey(null)
      message.success('Decision saved!')
    },
    onError: (err) => {
      setPendingKey(null)
      message.error(getErrorMessage(err))
    },
  })

  const stageColumn = (stageName, key, title) => ({
    key,
    title,
    exportValue: (r) => labelFor(optionsFor(stageName), r.stages[stageName]),
    render: (_, r) => {
      if (!(stageName in r.stages)) return '—'
      const key = rowKey(r)
      return (
        <Select
          size="small"
          style={{ width: 130 }}
          value={r.stages[stageName]}
          placeholder="Set decision"
          loading={pendingKey === key && decision.isPending}
          disabled={decision.isPending && pendingKey !== key}
          onChange={(status) => {
            setPendingKey(key)
            decision.mutate({ candidateId: r.candidateId, eventId: r.eventId, stageName, status })
          }}
          options={optionsFor(stageName)}
        />
      )
    },
  })

  // The same columns and defaults as the event page's Offer table, plus where each candidate is from.
  const { shown: columns, picker: columnPicker } = columnsFor('offers', [
    stageColumn('Offer', 'decision', 'Offer Status'),
    col.name, col.rollNo, col.email, col.phone, col.branch, col.batch, col.tenthMark, col.twelfthMark, col.diplomaMark, col.ugCgpa, col.pgCgpa, col.keamRank, col.preferences, col.activeBacklogs, col.backlogs, col.resume,
    {
      key: 'offered',
      title: 'Offered position',
      exportValue: (r) => offeredLabel(r.offer),
      render: (_, r) => (
        <OfferedPositionCell
          candidateId={r.candidateId}
          eventId={r.eventId}
          offer={r.offer}
          eventPositions={positionsByEvent[r.eventId]}
          preferences={r.preferences}
        />
      ),
    },
    {
      key: 'response',
      title: 'Offer Response',
      exportValue: (r) => (r.stages.Offer === 'SHORTLISTED' ? offerResponse(r.offer?.status).label : null),
      // Only an offer actually made (Shortlisted) can be accepted or rejected.
      render: (_, r) => (r.stages.Offer === 'SHORTLISTED'
        ? <OfferResponseCell candidateId={r.candidateId} eventId={r.eventId} offer={r.offer} />
        : '—'),
    },
    col.details,
    { key: 'college', title: 'College', dataIndex: 'collegeName' },
    {
      key: 'event',
      title: 'Event',
      dataIndex: 'recruitmentYear',
      render: (y, r) => (hasPage('EVENTS') ? <a onClick={() => navigate(`/events/${r.eventId}`)}>{y}</a> : y),
    },
    ...AFTER_OFFER.map((stageName) => stageColumn(stageName, stageName, stageName)),
  ], ['decision', 'response', 'name', 'rollNo', 'branch', 'offered'])

  return (
    <Card title="Offers" bordered={false} style={{ borderRadius: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
        {columnPicker}
        <DownloadExcel title="Offers" columns={columns} rows={filteredData} />
      </div>
      <FilterBar
        filterKeys={FILTER_KEYS}
        optionMap={optionMap}
        filters={filters}
        setFilter={setFilter}
        removeFilter={removeFilter}
      />
      <Table
        dataSource={filteredData}
        columns={columns}
        rowKey={rowKey}
        loading={isLoading}
        scroll={{ x: 'max-content' }}
      />
      {candidateModals}
    </Card>
  )
}
