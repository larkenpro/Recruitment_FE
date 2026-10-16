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
import { OfferedPositionCell } from '../components/OfferPairSelect'
import { getErrorMessage } from '../utils/errorUtils'

const FROM_OFFER = PIPELINE_STAGES.slice(PIPELINE_STAGES.indexOf('Offer'))

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
  { key: 'offerStatus', label: 'Offer decision', getVal: (r) => r.stages.Offer },
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

  const { filteredData, filters, setFilter, removeFilter, optionMap: rawOptionMap } = useColumnFilter(offers, FILTER_KEYS)
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

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      fixed: 'left',
      render: (t, r) => <a onClick={() => navigate(`/candidates/${r.candidateId}`)}><strong>{t}</strong></a>,
    },
    { title: 'College', dataIndex: 'collegeName' },
    {
      title: 'Event',
      dataIndex: 'recruitmentYear',
      render: (y, r) => (hasPage('EVENTS') ? <a onClick={() => navigate(`/events/${r.eventId}`)}>{y}</a> : y),
    },
    { title: 'Branch', dataIndex: 'branch', render: (v) => v || '—' },
    { title: 'Batch', dataIndex: 'graduationYear', render: (v) => v ?? '—' },
    {
      title: 'Offered position',
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
    ...FROM_OFFER.map((stageName) => ({
      title: stageName,
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
    })),
  ]

  return (
    <Card title="Offers" bordered={false} style={{ borderRadius: 12 }}>
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
    </Card>
  )
}
