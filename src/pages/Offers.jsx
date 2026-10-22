import { useState } from 'react'
import { Card, Empty, Table, Select, Typography, message } from 'antd'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { exportOffersStatus, getOffers } from '../api/candidates'
import { getEventPositions } from '../api/events'
import { useAuth } from '../context/AuthContext'
import { PIPELINE_STAGES, useStageDecision } from '../hooks/useStageDecision'
import { useColumnFilter } from '../hooks/useColumnFilter'
import FilterBar from '../components/FilterBar'
import { OfferResponseCell, OfferedPositionCell } from '../components/OfferPairSelect'
import { useColumnChoice } from '../components/ColumnPicker'
import { useCandidateColumns } from '../components/CandidateColumns'
import DownloadOfferStatus from '../components/DownloadOfferStatus'
import { labelFor } from '../utils/columns'
import { offerResponse, offeredLabel } from '../utils/offers'
import { getErrorMessage } from '../utils/errorUtils'

const { Title, Text } = Typography

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

  // One table per recruitment year, newest first; filters and columns apply to all of them.
  const years = [...new Set(filteredData.map((r) => r.recruitmentYear))].sort((a, b) => b - a)

  return (
    <Card title="Offers" bordered={false} style={{ borderRadius: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
        {columnPicker}
      </div>
      <FilterBar
        filterKeys={FILTER_KEYS}
        optionMap={optionMap}
        filters={filters}
        setFilter={setFilter}
        removeFilter={removeFilter}
      />
      {isLoading ? (
        <Table dataSource={[]} columns={columns} rowKey={rowKey} loading scroll={{ x: 'max-content' }} />
      ) : years.length === 0 ? (
        <Empty description="Nobody at the Offer stage matches these filters" />
      ) : years.map((year) => {
        const rows = filteredData.filter((r) => r.recruitmentYear === year)
        return (
          <section key={year} style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
              <Title level={5} style={{ margin: 0 }}>
                {year} <Text type="secondary" style={{ fontWeight: 400 }}>· {rows.length} candidate{rows.length === 1 ? '' : 's'}</Text>
              </Title>
              <DownloadOfferStatus
                fileName={`Offers ${year} - Offer Status.xlsx`}
                request={() => exportOffersStatus(
                  rows.map((r) => ({ eventId: r.eventId, candidateId: r.candidateId })),
                  `Offers ${year} - Offer Status`,
                )}
              />
            </div>
            <Table dataSource={rows} columns={columns} rowKey={rowKey} scroll={{ x: 'max-content' }} />
          </section>
        )
      })}
      {candidateModals}
    </Card>
  )
}
