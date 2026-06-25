import {
  AppstoreOutlined,
  CalendarOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  LinkOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  UnorderedListOutlined,
  UsergroupAddOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Empty,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Popconfirm,
  Radio,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd'
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  addEventPositions,
  createRound,
  updateRound,
  deleteRound,
  generateLink,
  getCandidatesByEvent,
  getEvent,
  getEventPositions,
  getEventRoundResults,
  getEventStageSummary,
  getGroups,
  generateGroups,
  updateGroup,
  getRounds,
  removeEventPosition,
  updateEventStatus,
} from '../api/events'
import { getPositions } from '../api/positions'
import { getCandidateResume, updateRoundResult, addStageEntry, updateStageStatusByName } from '../api/candidates'
import { getErrorMessage } from '../utils/errorUtils'
import { useStageDecision } from '../hooks/useStageDecision'
import { useColumnFilter } from '../hooks/useColumnFilter'
import FilterBar from '../components/FilterBar'

const { Title, Text } = Typography

const CANDIDATE_FILTER_KEYS = [
  { key: 'branch', label: 'Branch', getVal: (r) => r.branch },
  { key: 'ugCgpa', label: 'CGPA', type: 'min', getVal: (r) => r.ugCgpa },
  { key: 'backlogs', label: 'Backlogs', type: 'max', getVal: (r) => r.backlogs ?? 0 },
  { key: 'resumeStatus', label: 'Resume Result', getVal: (r) => r.resumeStatus },
]

const ROUND_FILTER_KEYS = [
  { key: 'branch', label: 'Branch', getVal: (r) => r.branch },
  { key: 'backlogs', label: 'Backlogs', type: 'max', getVal: (r) => r.backlogs ?? 0 },
  { key: 'roundsDecision', label: 'Decision', getVal: (r) => r.roundsDecision },
]

const LATE_STAGE_FILTER_KEYS = [
  { key: 'branch', label: 'Branch', getVal: (r) => r.branch },
  { key: 'stageStatus', label: 'Decision', getVal: (r) => r.stageStatus },
]

const RESUME_STATUS_OPTIONS = [
  { value: 'SHORTLISTED', label: 'Shortlisted' },
  { value: 'HOLD', label: 'Hold' },
  { value: 'REJECTED', label: 'Rejected' },
]

const ROUND_DECISION_OPTIONS = RESUME_STATUS_OPTIONS

const ROUND_RESULT_OPTIONS = [
  { value: 'PASS', label: 'Pass' },
  { value: 'FAIL', label: 'Fail' },
  { value: 'ON_HOLD', label: 'On Hold' },
]

const STATUS_COLOR = { UPCOMING: 'blue', ACTIVE: 'green', COMPLETED: 'default', CANCELLED: 'red' }
const ROUND_TYPE_COLOR = { WRITTEN: 'purple', TECHNICAL: 'blue', HR: 'green', GROUP_DISCUSSION: 'orange', CODING: 'cyan' }

export default function EventDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [link, setLink] = useState(null)
  const [templateLoading, setTemplateLoading] = useState(false)
  const [editingRound, setEditingRound] = useState(null)
  const [roundForm] = Form.useForm()
  const [editRoundForm] = Form.useForm()
  const [positionForm] = Form.useForm()
  const [resumeModal, setResumeModal] = useState({ open: false, candidateId: null, fileName: null })
  const [pendingCandidateId, setPendingCandidateId] = useState(null)
  const [groupCount, setGroupCount] = useState(null)
  const [editingGroup, setEditingGroup] = useState(null)
  const [groupForm] = Form.useForm()
  const [editingRoundId, setEditingRoundId] = useState(null)
  const [roundTableEdits, setRoundTableEdits] = useState({})
  const [pendingRoundCandidateId, setPendingRoundCandidateId] = useState(null)
  const [pendingPipelineCandidateId, setPendingPipelineCandidateId] = useState(null)

  const { data: event, isLoading } = useQuery({
    queryKey: ['event', id],
    queryFn: () => getEvent(id).then((r) => r.data.data),
  })

  const { data: rounds } = useQuery({
    queryKey: ['rounds', id],
    queryFn: () => getRounds(id).then((r) => r.data.data),
  })

  const { data: eventPositions } = useQuery({
    queryKey: ['eventPositions', id],
    queryFn: () => getEventPositions(id).then((r) => r.data.data),
  })

  const { data: allPositions } = useQuery({
    queryKey: ['positions'],
    queryFn: () => getPositions().then((r) => r.data.data),
  })

  const { data: candidates, isLoading: candidatesLoading } = useQuery({
    queryKey: ['eventCandidates', id],
    queryFn: () => getCandidatesByEvent(id).then((r) => r.data.data),
  })

  const { data: stageSummaryList } = useQuery({
    queryKey: ['eventStageSummary', id],
    queryFn: () => getEventStageSummary(id).then((r) => r.data.data),
  })

  const { data: groups } = useQuery({
    queryKey: ['eventGroups', id],
    queryFn: () => getGroups(id).then((r) => r.data.data),
    enabled: (rounds ?? []).some((r) => r.roundType === 'GROUP_DISCUSSION'),
  })

  const { data: eventRoundResults } = useQuery({
    queryKey: ['eventRoundResults', id],
    queryFn: () => getEventRoundResults(id).then((r) => r.data.data),
  })

  const { data: roundsStageSummaryList } = useQuery({
    queryKey: ['eventStageSummary', id, 'Rounds'],
    queryFn: () => getEventStageSummary(id, 'Rounds').then((r) => r.data.data),
  })

  const { data: offerStageSummaryList } = useQuery({
    queryKey: ['eventStageSummary', id, 'Offer'],
    queryFn: () => getEventStageSummary(id, 'Offer').then((r) => r.data.data),
  })
  const { data: joiningStageSummaryList } = useQuery({
    queryKey: ['eventStageSummary', id, 'Joining'],
    queryFn: () => getEventStageSummary(id, 'Joining').then((r) => r.data.data),
  })
  const { data: sixMonthStageSummaryList } = useQuery({
    queryKey: ['eventStageSummary', id, '6 Month Review'],
    queryFn: () => getEventStageSummary(id, '6 Month Review').then((r) => r.data.data),
  })
  const { data: twelveMonthStageSummaryList } = useQuery({
    queryKey: ['eventStageSummary', id, '12 Month Retained'],
    queryFn: () => getEventStageSummary(id, '12 Month Retained').then((r) => r.data.data),
  })
  const { data: exitStageSummaryList } = useQuery({
    queryKey: ['eventStageSummary', id, 'Exit'],
    queryFn: () => getEventStageSummary(id, 'Exit').then((r) => r.data.data),
  })

  const stageSummaryMap = useMemo(
    () => Object.fromEntries((stageSummaryList ?? []).map((s) => [s.candidateId, s])),
    [stageSummaryList]
  )

  const candidatesWithStatus = useMemo(
    () => (candidates ?? []).map((c) => ({ ...c, resumeStatus: stageSummaryMap[c.id]?.status ?? null })),
    [candidates, stageSummaryMap]
  )

  const {
    filteredData: filteredCandidates,
    filters: candidateFilters,
    setFilter: setCandidateFilter,
    removeFilter: removeCandidateFilter,
    optionMap: rawCandidateOptionMap,
  } = useColumnFilter(candidatesWithStatus, CANDIDATE_FILTER_KEYS)

  const candidateOptionMap = { ...rawCandidateOptionMap, resumeStatus: RESUME_STATUS_OPTIONS }

  const roundResultMap = useMemo(() => {
    const map = {}
    ;(eventRoundResults ?? []).forEach((r) => {
      if (!map[r.roundId]) map[r.roundId] = {}
      map[r.roundId][r.candidateId] = r
    })
    return map
  }, [eventRoundResults])

  const roundsStageSummaryMap = useMemo(
    () => Object.fromEntries((roundsStageSummaryList ?? []).map((s) => [s.candidateId, s])),
    [roundsStageSummaryList]
  )

  const shortlistedCandidates = useMemo(
    () => (candidatesWithStatus ?? []).filter((c) => c.resumeStatus === 'SHORTLISTED'),
    [candidatesWithStatus]
  )

  const shortlistedIds = useMemo(
    () => new Set(shortlistedCandidates.map((c) => c.id)),
    [shortlistedCandidates]
  )

  const candidateMap = useMemo(
    () => Object.fromEntries((candidates ?? []).map((c) => [c.id, c])),
    [candidates]
  )

  const lateStageLists = useMemo(() => ({
    'Offer': offerStageSummaryList ?? [],
    'Joining': joiningStageSummaryList ?? [],
    '6 Month Review': sixMonthStageSummaryList ?? [],
    '12 Month Retained': twelveMonthStageSummaryList ?? [],
    'Exit': exitStageSummaryList ?? [],
  }), [offerStageSummaryList, joiningStageSummaryList, sixMonthStageSummaryList, twelveMonthStageSummaryList, exitStageSummaryList])

  const lateStageSummaryMaps = useMemo(() => Object.fromEntries(
    Object.entries(lateStageLists).map(([stage, list]) => [
      stage,
      Object.fromEntries(list.map((s) => [s.candidateId, s])),
    ])
  ), [lateStageLists])

  const shortlistedWithRoundsDecision = useMemo(
    () => shortlistedCandidates.map((c) => ({ ...c, roundsDecision: roundsStageSummaryMap[c.id]?.status ?? null })),
    [shortlistedCandidates, roundsStageSummaryMap]
  )

  const {
    filteredData: filteredShortlisted,
    filters: roundFilters,
    setFilter: setRoundFilter,
    removeFilter: removeRoundFilter,
    optionMap: rawRoundOptionMap,
  } = useColumnFilter(shortlistedWithRoundsDecision, ROUND_FILTER_KEYS)

  const roundOptionMap = { ...rawRoundOptionMap, roundsDecision: ROUND_DECISION_OPTIONS }

  const lateStageEnrichedData = useMemo(() => Object.fromEntries(
    Object.entries(lateStageLists).map(([stage, list]) => [
      stage,
      list.map((s) => ({ ...candidateMap[s.candidateId], key: s.candidateId, stageStatus: s.status })).filter((r) => r.id),
    ])
  ), [lateStageLists, candidateMap])

  const { filteredData: filteredOfferData, filters: offerFilters, setFilter: setOfferFilter, removeFilter: removeOfferFilter, optionMap: offerOptionMap } = useColumnFilter(lateStageEnrichedData['Offer'], LATE_STAGE_FILTER_KEYS)
  const { filteredData: filteredJoiningData, filters: joiningFilters, setFilter: setJoiningFilter, removeFilter: removeJoiningFilter, optionMap: joiningOptionMap } = useColumnFilter(lateStageEnrichedData['Joining'], LATE_STAGE_FILTER_KEYS)
  const { filteredData: filteredSixMonthData, filters: sixMonthFilters, setFilter: setSixMonthFilter, removeFilter: removeSixMonthFilter, optionMap: sixMonthOptionMap } = useColumnFilter(lateStageEnrichedData['6 Month Review'], LATE_STAGE_FILTER_KEYS)
  const { filteredData: filteredTwelveMonthData, filters: twelveMonthFilters, setFilter: setTwelveMonthFilter, removeFilter: removeTwelveMonthFilter, optionMap: twelveMonthOptionMap } = useColumnFilter(lateStageEnrichedData['12 Month Retained'], LATE_STAGE_FILTER_KEYS)
  const { filteredData: filteredExitData, filters: exitFilters, setFilter: setExitFilter, removeFilter: removeExitFilter, optionMap: exitOptionMap } = useColumnFilter(lateStageEnrichedData['Exit'], LATE_STAGE_FILTER_KEYS)

  const lateStageFilterProps = {
    'Offer': { filteredData: filteredOfferData, filters: offerFilters, setFilter: setOfferFilter, removeFilter: removeOfferFilter, optionMap: { ...offerOptionMap, stageStatus: ROUND_DECISION_OPTIONS } },
    'Joining': { filteredData: filteredJoiningData, filters: joiningFilters, setFilter: setJoiningFilter, removeFilter: removeJoiningFilter, optionMap: { ...joiningOptionMap, stageStatus: ROUND_DECISION_OPTIONS } },
    '6 Month Review': { filteredData: filteredSixMonthData, filters: sixMonthFilters, setFilter: setSixMonthFilter, removeFilter: removeSixMonthFilter, optionMap: { ...sixMonthOptionMap, stageStatus: ROUND_DECISION_OPTIONS } },
    '12 Month Retained': { filteredData: filteredTwelveMonthData, filters: twelveMonthFilters, setFilter: setTwelveMonthFilter, removeFilter: removeTwelveMonthFilter, optionMap: { ...twelveMonthOptionMap, stageStatus: ROUND_DECISION_OPTIONS } },
    'Exit': { filteredData: filteredExitData, filters: exitFilters, setFilter: setExitFilter, removeFilter: removeExitFilter, optionMap: { ...exitOptionMap, stageStatus: ROUND_DECISION_OPTIONS } },
  }

  const statusMutation = useMutation({
    mutationFn: (status) => updateEventStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', id] })
      queryClient.invalidateQueries({ queryKey: ['events'] })
      message.success('Status updated!')
    },
    onError: (err) => message.error(getErrorMessage(err)),
  })

  const roundMutation = useMutation({
    mutationFn: (data) => createRound(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rounds', id] })
      roundForm.resetFields()
      message.success('Round added!')
    },
    onError: (err) => message.error(getErrorMessage(err)),
  })

  const updateRoundMutation = useMutation({
    mutationFn: ({ roundId, data }) => updateRound(id, roundId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rounds', id] })
      setEditingRound(null)
      editRoundForm.resetFields()
      message.success('Round updated!')
    },
    onError: (err) => message.error(getErrorMessage(err)),
  })

  const deleteRoundMutation = useMutation({
    mutationFn: (roundId) => deleteRound(id, roundId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rounds', id] })
      message.success('Round deleted!')
    },
    onError: (err) => message.error(getErrorMessage(err)),
  })

  const addPositionsMutation = useMutation({
    mutationFn: (positionIds) => addEventPositions(id, positionIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eventPositions', id] })
      positionForm.resetFields()
      message.success('Position(s) added!')
    },
    onError: (err) => message.error(getErrorMessage(err)),
  })

  const removePositionMutation = useMutation({
    mutationFn: (positionId) => removeEventPosition(id, positionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eventPositions', id] })
      message.success('Position removed!')
    },
    onError: (err) => message.error(getErrorMessage(err)),
  })

  const shortlistMutation = useStageDecision({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eventStageSummary', id] })
      setPendingCandidateId(null)
      message.success('Decision saved!')
    },
    onError: (err) => {
      setPendingCandidateId(null)
      message.error(getErrorMessage(err))
    },
  })

  const generateGroupsMutation = useMutation({
    mutationFn: (count) => generateGroups(id, count),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eventGroups', id] })
      message.success('Groups generated!')
    },
    onError: (err) => message.error(getErrorMessage(err)),
  })

  const updateGroupMutation = useMutation({
    mutationFn: ({ groupId, data }) => updateGroup(id, groupId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eventGroups', id] })
      setEditingGroup(null)
      groupForm.resetFields()
      message.success('Group updated!')
    },
    onError: (err) => message.error(getErrorMessage(err)),
  })

  const roundsDecisionMutation = useStageDecision({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eventStageSummary', id, 'Rounds'] })
      queryClient.invalidateQueries({ queryKey: ['eventStageSummary', id, 'Offer'] })
      setPendingRoundCandidateId(null)
      message.success('Decision saved!')
    },
    onError: (err) => {
      setPendingRoundCandidateId(null)
      message.error(getErrorMessage(err))
    },
  })

  const pipelineDecisionMutation = useStageDecision({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eventStageSummary', id] })
      setPendingPipelineCandidateId(null)
      message.success('Decision saved!')
    },
    onError: (err) => {
      setPendingPipelineCandidateId(null)
      message.error(getErrorMessage(err))
    },
  })

  const eventRoundScoreMutation = useMutation({
    mutationFn: ({ candidateId, roundId, ...data }) =>
      updateRoundResult(candidateId, Number(id), roundId, data),
    onSuccess: (_, { candidateId, roundId, result }) => {
      queryClient.invalidateQueries({ queryKey: ['eventRoundResults', id] })
      message.success('Score saved!')

      if (result === 'FAIL') {
        roundsDecisionMutation.mutate({ candidateId, eventId: Number(id), stageName: 'Rounds', status: 'REJECTED', ensureStarted: true })
      } else if (result === 'PASS') {
        const currentRound = sortedRounds.find((r) => r.id === roundId)
        const isLast = currentRound?.id === sortedRounds[sortedRounds.length - 1]?.id
        if (isLast) {
          const priorRounds = sortedRounds.filter((r) => r.sequence < currentRound.sequence)
          const allPriorPassed = priorRounds.every((pr) => roundResultMap[pr.id]?.[candidateId]?.result === 'PASS')
          if (allPriorPassed) {
            roundsDecisionMutation.mutate({ candidateId, eventId: Number(id), stageName: 'Rounds', status: 'SHORTLISTED', ensureStarted: true })
          }
        }
      }
    },
    onError: (err) => message.error(getErrorMessage(err)),
  })

  const handleViewResume = async (candidateId) => {
    try {
      const res = await getCandidateResume(candidateId)
      setResumeModal({ open: true, candidateId, fileName: res.data.data?.fileName ?? null })
    } catch {
      message.error('No resume found for this candidate')
    }
  }

  const handleGenerateLink = async () => {
    try {
      const res = await generateLink(Number(id))
      setLink(res.data.data)
      message.success('Link generated!')
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const handleDefaultTemplate = async () => {
    setTemplateLoading(true)
    try {
      await Promise.all([
        createRound(id, { name: 'Group Discussion', roundType: 'GROUP_DISCUSSION', sequence: 1 }),
        createRound(id, { name: 'Interview', roundType: 'TECHNICAL', sequence: 2 }),
        createRound(id, { name: 'HR Round', roundType: 'HR', sequence: 3 }),
      ])
      queryClient.invalidateQueries({ queryKey: ['rounds', id] })
      message.success('Default rounds added!')
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setTemplateLoading(false)
    }
  }

  if (isLoading) return <Card loading style={{ borderRadius: 12 }} />
  if (!event) return <Empty />

  const sortedRounds = [...(rounds ?? [])].sort((a, b) => a.sequence - b.sequence)
  const hasGroupDiscussion = sortedRounds.some((r) => r.roundType === 'GROUP_DISCUSSION')
  const availablePositions = (allPositions ?? []).filter(
    (p) => !(eventPositions ?? []).some((ep) => ep.id === p.id)
  )

  const LATE_STAGE_NAMES = ['Offer', 'Joining', '6 Month Review', '12 Month Retained', 'Exit']

  const renderLateStageTab = (stageName) => {
    const { filteredData, filters, setFilter, removeFilter, optionMap } = lateStageFilterProps[stageName]
    const summaryMap = lateStageSummaryMaps[stageName]
    const totalCount = (lateStageEnrichedData[stageName] ?? []).length
    if (totalCount === 0) {
      return <Empty description={`No candidates at the ${stageName} stage yet`} />
    }
    return (
      <>
        <FilterBar
          filterKeys={LATE_STAGE_FILTER_KEYS}
          optionMap={optionMap}
          filters={filters}
          setFilter={setFilter}
          removeFilter={removeFilter}
        />
        <Table
          dataSource={filteredData}
          rowKey="key"
          size="small"
          pagination={{ pageSize: 10 }}
          columns={[
            {
              title: 'Name',
              dataIndex: 'name',
              render: (t, r) => (
                <a onClick={() => navigate(`/candidates/${r.id}`)}>
                  <strong>{t}</strong>
                </a>
              ),
            },
            { title: 'Email', dataIndex: 'email' },
            { title: 'Branch', dataIndex: 'branch', render: (v) => v || '—' },
            { title: 'UG CGPA', dataIndex: 'ugCgpa', render: (v) => v ?? '—' },
            {
              title: 'Decision',
              render: (_, r) => (
                <Select
                  size="small"
                  style={{ width: 140 }}
                  value={summaryMap[r.id]?.status ?? null}
                  placeholder="Set decision"
                  loading={pendingPipelineCandidateId === r.id && pipelineDecisionMutation.isPending}
                  disabled={pipelineDecisionMutation.isPending && pendingPipelineCandidateId !== r.id}
                  onChange={(status) => {
                    setPendingPipelineCandidateId(r.id)
                    pipelineDecisionMutation.mutate({ candidateId: r.id, eventId: Number(id), stageName, status, ensureStarted: true })
                  }}
                  options={ROUND_DECISION_OPTIONS}
                />
              ),
            },
          ]}
        />
      </>
    )
  }

  const eventTabItems = [
    {
      key: 'positions',
      label: (
        <span>
          <AppstoreOutlined style={{ marginRight: 4 }} />
          Positions
          {(eventPositions?.length ?? 0) > 0 && (
            <Tag style={{ marginLeft: 6, fontSize: 10, padding: '0 4px', lineHeight: '16px' }}>
              {eventPositions.length}
            </Tag>
          )}
        </span>
      ),
      children: (
        <div>
          {(eventPositions ?? []).length > 0 ? (
            <List
              dataSource={eventPositions}
              renderItem={(p) => (
                <List.Item
                  actions={[
                    <Popconfirm
                      title="Remove this position from the event?"
                      onConfirm={() => removePositionMutation.mutate(p.id)}
                      okText="Yes"
                      cancelText="No"
                      okButtonProps={{ danger: true }}
                    >
                      <Button
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        loading={removePositionMutation.isPending}
                      />
                    </Popconfirm>,
                  ]}
                >
                  <List.Item.Meta
                    title={<Text strong>{p.title}</Text>}
                    description={[p.department, p.type].filter(Boolean).join(' · ')}
                  />
                </List.Item>
              )}
            />
          ) : (
            <Empty description="No positions linked to this event" style={{ marginBottom: 24 }} />
          )}
          <Divider>Add Positions</Divider>
          <Form
            form={positionForm}
            layout="vertical"
            style={{ maxWidth: 480 }}
            onFinish={(v) => addPositionsMutation.mutate(v.positionIds)}
          >
            <Form.Item name="positionIds" rules={[{ required: true, message: 'Select at least one position' }]}>
              <Select
                mode="multiple"
                placeholder="Select positions to add"
                optionFilterProp="label"
                showSearch
                options={availablePositions.map((p) => ({
                  value: p.id,
                  label: p.type ? `${p.title} — ${p.type}` : p.title,
                }))}
              />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={addPositionsMutation.isPending}>
              Add
            </Button>
          </Form>
        </div>
      ),
    },
    {
      key: 'rounds',
      label: (
        <span>
          <UnorderedListOutlined style={{ marginRight: 4 }} />
          Rounds
          {sortedRounds.length > 0 && (
            <Tag style={{ marginLeft: 6, fontSize: 10, padding: '0 4px', lineHeight: '16px' }}>
              {sortedRounds.length}
            </Tag>
          )}
        </span>
      ),
      children: (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <Button
              icon={<ThunderboltOutlined />}
              onClick={handleDefaultTemplate}
              loading={templateLoading}
              disabled={sortedRounds.length > 0}
            >
              Use Default Template
            </Button>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {sortedRounds.length > 0
                ? 'Remove existing rounds to use the template'
                : 'Adds Group Discussion · Interview · HR rounds'}
            </Text>
          </div>
          {sortedRounds.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 24 }}>
              {sortedRounds.map((r) => (
                <div
                  key={r.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1.5px solid #e5e7eb',
                    background: '#fafafa',
                  }}
                >
                  <Tag style={{ fontWeight: 700, minWidth: 28, textAlign: 'center', margin: 0 }}>#{r.sequence}</Tag>
                  <Text strong style={{ fontSize: 14, flex: 1 }}>{r.name}</Text>
                  {r.roundType && (
                    <Tag color={ROUND_TYPE_COLOR[r.roundType] ?? 'default'} style={{ margin: 0 }}>{r.roundType}</Tag>
                  )}
                  <Space size={4}>
                    <Button
                      size="small"
                      type="text"
                      icon={<EditOutlined />}
                      onClick={() => {
                        setEditingRound(r)
                        editRoundForm.setFieldsValue({ name: r.name, roundType: r.roundType ?? undefined, sequence: r.sequence })
                      }}
                    />
                    <Popconfirm
                      title="Delete this round?"
                      description="All round results for this round will also be deleted."
                      onConfirm={() => deleteRoundMutation.mutate(r.id)}
                      okText="Delete"
                      cancelText="Cancel"
                      okButtonProps={{ danger: true }}
                    >
                      <Button
                        size="small"
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        loading={deleteRoundMutation.isPending && deleteRoundMutation.variables === r.id}
                      />
                    </Popconfirm>
                  </Space>
                </div>
              ))}
            </div>
          ) : (
            <Empty description="No rounds added yet" style={{ marginBottom: 24 }} />
          )}
          <Divider>Add Round</Divider>
          <Form
            form={roundForm}
            layout="vertical"
            style={{ maxWidth: 480 }}
            onFinish={(v) => roundMutation.mutate({ ...v, sequence: Number(v.sequence) })}
          >
            <Form.Item name="name" label="Round Name" rules={[{ required: true }]}>
              <Input placeholder="e.g. Technical Round 1" />
            </Form.Item>
            <Form.Item name="roundType" label="Round Type">
              <Select
                options={['WRITTEN', 'TECHNICAL', 'HR', 'GROUP_DISCUSSION', 'CODING'].map((s) => ({ value: s }))}
              />
            </Form.Item>
            <Form.Item name="sequence" label="Sequence" rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} min={1} />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={roundMutation.isPending}>
              Add Round
            </Button>
          </Form>
        </div>
      ),
    },
    ...(hasGroupDiscussion
      ? [
          {
            key: 'groups',
            label: (
              <span>
                <UsergroupAddOutlined style={{ marginRight: 4 }} />
                Groups
                {(groups?.length ?? 0) > 0 && (
                  <Tag style={{ marginLeft: 6, fontSize: 10, padding: '0 4px', lineHeight: '16px' }}>
                    {groups.length}
                  </Tag>
                )}
              </span>
            ),
            children: (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <InputNumber
                    min={1}
                    placeholder="Number of groups"
                    value={groupCount}
                    onChange={setGroupCount}
                    style={{ width: 160 }}
                  />
                  {(groups?.length ?? 0) > 0 ? (
                    <Popconfirm
                      title="Regenerate groups?"
                      description="This will delete all existing groups and randomly assign new ones."
                      onConfirm={() => generateGroupsMutation.mutate(groupCount)}
                      okText="Regenerate"
                      cancelText="Cancel"
                      okButtonProps={{ danger: true }}
                      disabled={!groupCount}
                    >
                      <Button
                        type="primary"
                        loading={generateGroupsMutation.isPending}
                        disabled={!groupCount}
                      >
                        Regenerate Groups
                      </Button>
                    </Popconfirm>
                  ) : (
                    <Button
                      type="primary"
                      onClick={() => generateGroupsMutation.mutate(groupCount)}
                      loading={generateGroupsMutation.isPending}
                      disabled={!groupCount}
                    >
                      Generate Groups
                    </Button>
                  )}
                </div>
                {(groups?.length ?? 0) === 0 ? (
                  <Empty description="No groups generated yet" />
                ) : (
                  <Row gutter={[16, 16]}>
                    {groups.map((g) => (
                      <Col key={g.id} xs={24} sm={12} lg={8}>
                        <Card
                          size="small"
                          title={<Text strong>Group {g.name}</Text>}
                          extra={
                            <Button
                              size="small"
                              icon={<EditOutlined />}
                              onClick={() => {
                                setEditingGroup(g)
                                groupForm.setFieldsValue({ name: g.name, topic: g.topic ?? '' })
                              }}
                            >
                              Edit
                            </Button>
                          }
                          style={{ height: '100%' }}
                        >
                          <div style={{ marginBottom: 10 }}>
                            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>
                              TOPIC
                            </Text>
                            {g.topic ? (
                              <Text>{g.topic}</Text>
                            ) : (
                              <Text type="secondary" italic style={{ fontSize: 13 }}>
                                No topic set
                              </Text>
                            )}
                          </div>
                          <Divider style={{ margin: '10px 0' }} />
                          {(() => {
                            const visibleMembers = g.members.filter((m) => shortlistedIds.has(m.id))
                            return (
                              <>
                                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 6 }}>
                                  MEMBERS ({visibleMembers.length})
                                </Text>
                                {visibleMembers.length === 0 ? (
                                  <Text type="secondary" italic style={{ fontSize: 12 }}>
                                    No shortlisted members
                                  </Text>
                                ) : (
                                  visibleMembers.map((m) => (
                                    <div
                                      key={m.id}
                                      style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}
                                    >
                                      <Text style={{ fontSize: 13, flex: 1 }}>{m.name}</Text>
                                      {m.branch && (
                                        <Tag style={{ fontSize: 11, margin: 0 }}>{m.branch}</Tag>
                                      )}
                                    </div>
                                  ))
                                )}
                              </>
                            )
                          })()}
                        </Card>
                      </Col>
                    ))}
                  </Row>
                )}
              </div>
            ),
          },
        ]
      : []),
  ]

  const renderRoundTabContent = (round) => {
    if (shortlistedCandidates.length === 0) {
      return <Empty description="No candidates have passed the Resume stage yet" />
    }

    const isLastRound = round.id === sortedRounds[sortedRounds.length - 1]?.id
    const roundFilterKeys = isLastRound
      ? ROUND_FILTER_KEYS
      : ROUND_FILTER_KEYS.filter((k) => k.key !== 'roundsDecision')

    const priorRounds = sortedRounds.filter((r) => r.sequence < round.sequence)
    const displayCandidates = priorRounds.length === 0
      ? filteredShortlisted
      : filteredShortlisted.filter((c) =>
          priorRounds.every((pr) => roundResultMap[pr.id]?.[c.id]?.result === 'PASS')
        )

    const isEditing = editingRoundId === round.id

    const updateRoundEdit = (candidateId, field, value) =>
      setRoundTableEdits((prev) => ({ ...prev, [candidateId]: { ...(prev[candidateId] ?? {}), [field]: value } }))

    const initRoundEdit = () => {
      const initial = {}
      displayCandidates.forEach((c) => {
        const ex = roundResultMap[round.id]?.[c.id]
        initial[c.id] = {
          score: ex?.score != null ? Number(ex.score) : null,
          result: ex?.result ?? null,
          interviewer: ex?.interviewer ?? null,
          comments: ex?.comments ?? null,
        }
      })
      setRoundTableEdits(initial)
      setEditingRoundId(round.id)
    }

    const handleRoundSave = () => {
      Object.entries(roundTableEdits).forEach(([cidStr, data]) => {
        if (data.score != null || data.result != null) {
          eventRoundScoreMutation.mutate({ candidateId: Number(cidStr), roundId: round.id, ...data })
        }
      })
      setEditingRoundId(null)
      setRoundTableEdits({})
    }

    const editControls = (
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
        {isEditing ? (
          <Space>
            <Button size="small" onClick={() => { setEditingRoundId(null); setRoundTableEdits({}) }}>Cancel</Button>
            <Button size="small" type="primary" onClick={handleRoundSave} loading={eventRoundScoreMutation.isPending}>Save</Button>
          </Space>
        ) : (
          <Button size="small" icon={<EditOutlined />} onClick={initRoundEdit}>Edit Scores</Button>
        )}
      </div>
    )

    const roundColumns = [
      {
        title: 'Name',
        dataIndex: 'name',
        render: (t, r) => (
          <a onClick={() => navigate(`/candidates/${r.id}`)}>
            <strong>{t}</strong>
          </a>
        ),
      },
      { title: 'Branch', dataIndex: 'branch', render: (v) => v || '—' },
      { title: 'UG CGPA', dataIndex: 'ugCgpa', render: (v) => v ?? '—' },
      {
        title: 'Score',
        render: (_, r) => {
          if (isEditing) return (
            <InputNumber
              size="small"
              style={{ width: 80 }}
              min={0}
              max={100}
              step={0.5}
              value={roundTableEdits[r.id]?.score ?? null}
              onChange={(val) => updateRoundEdit(r.id, 'score', val)}
            />
          )
          const res = roundResultMap[round.id]?.[r.id]
          return res?.score != null ? String(res.score) : '—'
        },
      },
      {
        title: 'Result',
        render: (_, r) => {
          if (isEditing) return (
            <Select
              size="small"
              style={{ width: 110 }}
              value={roundTableEdits[r.id]?.result ?? null}
              placeholder="—"
              allowClear
              options={ROUND_RESULT_OPTIONS}
              onChange={(val) => updateRoundEdit(r.id, 'result', val ?? null)}
            />
          )
          const res = roundResultMap[round.id]?.[r.id]
          if (!res?.result) return <Tag>Pending</Tag>
          const color = res.result === 'PASS' ? 'green' : res.result === 'FAIL' ? 'red' : 'orange'
          return <Tag color={color}>{res.result}</Tag>
        },
      },
      {
        title: 'Interviewer',
        render: (_, r) => {
          if (isEditing) return (
            <Input
              size="small"
              style={{ width: 130 }}
              value={roundTableEdits[r.id]?.interviewer ?? ''}
              onChange={(e) => updateRoundEdit(r.id, 'interviewer', e.target.value || null)}
            />
          )
          return roundResultMap[round.id]?.[r.id]?.interviewer || '—'
        },
      },
      {
        title: 'Comments',
        render: (_, r) => {
          if (isEditing) return (
            <Input
              size="small"
              style={{ width: 160 }}
              value={roundTableEdits[r.id]?.comments ?? ''}
              onChange={(e) => updateRoundEdit(r.id, 'comments', e.target.value || null)}
            />
          )
          const val = roundResultMap[round.id]?.[r.id]?.comments
          return val ? <span title={val}>{val.length > 24 ? val.slice(0, 24) + '…' : val}</span> : '—'
        },
      },
      ...(isLastRound ? [{
        title: 'Rounds Decision',
        render: (_, r) => (
          <Select
            size="small"
            style={{ width: 140 }}
            value={roundsStageSummaryMap[r.id]?.status ?? null}
            placeholder="Set decision"
            loading={pendingRoundCandidateId === r.id && roundsDecisionMutation.isPending}
            disabled={roundsDecisionMutation.isPending && pendingRoundCandidateId !== r.id}
            onChange={(status) => {
              setPendingRoundCandidateId(r.id)
              roundsDecisionMutation.mutate({ candidateId: r.id, eventId: Number(id), stageName: 'Rounds', status, ensureStarted: true })
            }}
            options={ROUND_DECISION_OPTIONS}
          />
        ),
      }] : []),
    ]

    // GD round with assigned groups — render per-group cards
    if (round.roundType === 'GROUP_DISCUSSION' && (groups ?? []).length > 0) {
      const displayCandidateIds = new Set(displayCandidates.map((c) => c.id))
      const assignedIds = new Set((groups ?? []).flatMap((g) => g.members.map((m) => m.id)))
      const unassigned = displayCandidates.filter((c) => !assignedIds.has(c.id))

      return (
        <>
          {editControls}
          <FilterBar filterKeys={roundFilterKeys} optionMap={roundOptionMap} filters={roundFilters} setFilter={setRoundFilter} removeFilter={removeRoundFilter} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(groups ?? []).map((group) => {
            const groupData = group.members
              .filter((m) => displayCandidateIds.has(m.id))
              .map((m) => ({
                ...(candidateMap[m.id] ?? {}),
                id: m.id,
                name: m.name,
                branch: m.branch,
                key: m.id,
              }))
            return (
              <Card
                key={group.id}
                size="small"
                style={{ borderRadius: 8, border: '1.5px solid #e5e7eb' }}
                title={
                  <Space>
                    <Text strong>Group {group.name}</Text>
                    <Tag style={{ fontWeight: 400 }}>{groupData.length} members</Tag>
                    {group.topic && <Tag color="blue">{group.topic}</Tag>}
                  </Space>
                }
              >
                <Table
                  dataSource={groupData}
                  rowKey="key"
                  size="small"
                  pagination={false}
                  columns={roundColumns}
                />
              </Card>
            )
          })}
          {unassigned.length > 0 && (
            <Card
              size="small"
              style={{ borderRadius: 8, border: '1.5px dashed #e5e7eb' }}
              title={<Text type="secondary">Unassigned ({unassigned.length})</Text>}
            >
              <Table
                dataSource={unassigned}
                rowKey="id"
                size="small"
                pagination={false}
                columns={roundColumns}
              />
            </Card>
          )}
          </div>
        </>
      )
    }

    // All other rounds — flat table
    return (
      <>
        {editControls}
        <FilterBar filterKeys={roundFilterKeys} optionMap={roundOptionMap} filters={roundFilters} setFilter={setRoundFilter} removeFilter={removeRoundFilter} />
        <Table
          dataSource={displayCandidates}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 10 }}
          columns={roundColumns}
        />
      </>
    )
  }

  const pipelineTabItems = [
    {
      key: 'pipeline-resume',
      label: (
        <span>
          <TeamOutlined style={{ marginRight: 4 }} />
          Resume
          {(candidates?.length ?? 0) > 0 && (
            <Tag style={{ marginLeft: 6, fontSize: 10, padding: '0 4px', lineHeight: '16px' }}>
              {candidates.length}
            </Tag>
          )}
        </span>
      ),
      children: (
        <>
          <FilterBar
            filterKeys={CANDIDATE_FILTER_KEYS}
            optionMap={candidateOptionMap}
            filters={candidateFilters}
            setFilter={setCandidateFilter}
            removeFilter={removeCandidateFilter}
          />
          <Table
            dataSource={filteredCandidates}
            loading={candidatesLoading}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 10 }}
            locale={{ emptyText: 'No candidates have applied yet' }}
            columns={[
              {
                title: 'Name',
                dataIndex: 'name',
                render: (t, r) => (
                  <a onClick={() => navigate(`/candidates/${r.id}`)}>
                    <strong>{t}</strong>
                  </a>
                ),
              },
              { title: 'Email', dataIndex: 'email' },
              { title: 'Phone', dataIndex: 'phone', render: (v) => v || '—' },
              { title: 'Branch', dataIndex: 'branch', render: (v) => v || '—' },
              { title: 'UG CGPA', dataIndex: 'ugCgpa', render: (v) => v ?? '—' },
              {
                title: 'Backlogs',
                dataIndex: 'backlogs',
                render: (v) => <Tag color={(v ?? 0) === 0 ? 'green' : 'red'}>{v ?? 0}</Tag>,
              },
              {
                title: 'Resume',
                render: (_, r) => (
                  <Button size="small" icon={<FileTextOutlined />} onClick={() => handleViewResume(r.id)}>
                    View
                  </Button>
                ),
              },
              {
                title: 'Resume Result',
                render: (_, r) => (
                  <Select
                    size="small"
                    style={{ width: 140 }}
                    value={r.resumeStatus ?? null}
                    placeholder="Set decision"
                    loading={pendingCandidateId === r.id && shortlistMutation.isPending}
                    disabled={shortlistMutation.isPending && pendingCandidateId !== r.id}
                    onChange={(status) => {
                      setPendingCandidateId(r.id)
                      shortlistMutation.mutate({ candidateId: r.id, eventId: Number(id), stageName: 'Resume', status, ensureStarted: true })
                    }}
                    options={RESUME_STATUS_OPTIONS}
                  />
                ),
              },
            ]}
          />
        </>
      ),
    },
    ...sortedRounds.map((round) => ({
      key: `pipeline-${round.id}`,
      label: (
        <span>
          <Tag style={{ fontWeight: 700, fontSize: 10, padding: '0 4px', lineHeight: '16px', marginRight: 4 }}>
            #{round.sequence}
          </Tag>
          {round.name}
          {round.roundType && (
            <Tag color={ROUND_TYPE_COLOR[round.roundType] ?? 'default'} style={{ marginLeft: 4, fontSize: 10, padding: '0 4px', lineHeight: '16px' }}>
              {round.roundType}
            </Tag>
          )}
        </span>
      ),
      children: renderRoundTabContent(round),
    })),
    ...LATE_STAGE_NAMES.map((stageName) => ({
      key: `pipeline-${stageName.replace(/ /g, '-').toLowerCase()}`,
      label: (
        <span>
          {stageName}
          {(lateStageLists[stageName]?.length ?? 0) > 0 && (
            <Tag style={{ marginLeft: 6, fontSize: 10, padding: '0 4px', lineHeight: '16px' }}>
              {lateStageLists[stageName].length}
            </Tag>
          )}
        </span>
      ),
      children: renderLateStageTab(stageName),
    })),
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top row */}
      <Row gutter={[16, 16]} align="stretch">
        {/* Event info card */}
        <Col xs={24} md={10}>
          <Card bordered={false} style={{ borderRadius: 12, height: '100%' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                paddingBottom: 20,
                borderBottom: '1px solid #f0f0f0',
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <CalendarOutlined style={{ fontSize: 24, color: '#fff' }} />
              </div>
              <div>
                <Title level={4} style={{ margin: 0, marginBottom: 2 }}>
                  {event.college?.name}
                </Title>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  Recruitment {event.recruitmentYear}
                </Text>
              </div>
            </div>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Start Date">{event.startDate ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="City">{event.college?.city ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Tier">{event.college?.tier ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Select
                  value={event.status}
                  size="small"
                  style={{ width: 150 }}
                  loading={statusMutation.isPending}
                  onChange={(val) => statusMutation.mutate(val)}
                  options={['UPCOMING', 'ACTIVE', 'COMPLETED', 'CANCELLED'].map((v) => ({
                    value: v,
                    label: <Tag color={STATUS_COLOR[v]}>{v}</Tag>,
                  }))}
                />
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        {/* Summary card */}
        <Col xs={24} md={7}>
          <Card bordered={false} style={{ borderRadius: 12, height: '100%' }} title="Summary">
            <Row gutter={[16, 24]}>
              <Col span={12}>
                <Statistic
                  title="Positions"
                  value={eventPositions?.length ?? 0}
                  prefix={<AppstoreOutlined />}
                  valueStyle={{ color: '#4f46e5', fontSize: 22 }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="Rounds"
                  value={sortedRounds.length}
                  prefix={<UnorderedListOutlined />}
                  valueStyle={{ fontSize: 22 }}
                />
              </Col>
              <Col span={24}>
                <Statistic
                  title="Candidates Applied"
                  value={candidates?.length ?? 0}
                  prefix={<TeamOutlined />}
                  valueStyle={{ fontSize: 22 }}
                />
              </Col>
            </Row>
          </Card>
        </Col>

        {/* Application link card */}
        <Col xs={24} md={7}>
          <Card bordered={false} style={{ borderRadius: 12, height: '100%' }} title="Application Link">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Text type="secondary" style={{ fontSize: 13 }}>
                Generate a shareable link for candidates to apply. Only available when the event is{' '}
                <Tag color="green" style={{ margin: 0 }}>ACTIVE</Tag>.
              </Text>
              <Button
                type="primary"
                icon={<LinkOutlined />}
                onClick={handleGenerateLink}
                disabled={event.status !== 'ACTIVE'}
              >
                Generate Link
              </Button>
              {link && (
                <Space.Compact style={{ width: '100%' }}>
                  <Input value={link} readOnly size="small" />
                  <Button
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={() => {
                      navigator.clipboard.writeText(link)
                      message.success('Copied!')
                    }}
                  >
                    Copy
                  </Button>
                </Space.Compact>
              )}
            </div>
          </Card>
        </Col>
      </Row>

      {/* Event config tabs (Positions, Rounds, Groups) */}
      <Card
        bordered={false}
        style={{ borderRadius: 12 }}
        title={<Text strong style={{ fontSize: 15 }}>Event Details</Text>}
      >
        <Tabs items={eventTabItems} />
      </Card>

      {/* Pipeline stages */}
      <Card
        bordered={false}
        style={{ borderRadius: 12 }}
        title={<Text strong style={{ fontSize: 15 }}>Pipeline Stages</Text>}
      >
        <Tabs items={pipelineTabItems} />
      </Card>

      {/* Edit round modal */}
      <Modal
        open={!!editingRound}
        title="Edit Round"
        onCancel={() => { setEditingRound(null); editRoundForm.resetFields() }}
        onOk={() => editRoundForm.submit()}
        confirmLoading={updateRoundMutation.isPending}
        destroyOnClose
      >
        <Form
          form={editRoundForm}
          layout="vertical"
          style={{ marginTop: 16 }}
          onFinish={(v) => updateRoundMutation.mutate({ roundId: editingRound.id, data: { ...v, sequence: Number(v.sequence) } })}
        >
          <Form.Item name="name" label="Round Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="roundType" label="Round Type">
            <Select
              allowClear
              options={['WRITTEN', 'TECHNICAL', 'HR', 'GROUP_DISCUSSION', 'CODING'].map((s) => ({ value: s }))}
            />
          </Form.Item>
          <Form.Item name="sequence" label="Sequence" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={1} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Resume viewer modal */}
      <Modal
        open={resumeModal.open}
        title={
          <Space>
            <FileTextOutlined style={{ color: '#4f46e5' }} />
            <span>{resumeModal.fileName ?? 'Resume'}</span>
          </Space>
        }
        onCancel={() => setResumeModal({ open: false, candidateId: null, fileName: null })}
        footer={[
          <Button
            key="download"
            href={`${import.meta.env.VITE_PUBLIC_API_URL}/api/v1/candidates/${resumeModal.candidateId}/resume/download`}
            target="_blank"
          >
            Download
          </Button>,
          <Button key="close" type="primary" onClick={() => setResumeModal({ open: false, candidateId: null, fileName: null })}>
            Close
          </Button>,
        ]}
        width={900}
        styles={{ body: { padding: 0 } }}
      >
        {resumeModal.candidateId && resumeModal.fileName?.toLowerCase().endsWith('.pdf') ? (
          <iframe
            src={`${import.meta.env.VITE_PUBLIC_API_URL}/api/v1/candidates/${resumeModal.candidateId}/resume/view`}
            style={{ width: '100%', height: 620, border: 'none' }}
            title={resumeModal.fileName}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <FileTextOutlined style={{ fontSize: 40, color: '#9ca3af', marginBottom: 12 }} />
            <div style={{ color: '#6b7280', marginBottom: 16 }}>
              Preview not available for this file type.
            </div>
          </div>
        )}
      </Modal>

      {/* Edit group modal */}
      <Modal
        open={!!editingGroup}
        title={`Edit Group ${editingGroup?.name ?? ''}`}
        onCancel={() => { setEditingGroup(null); groupForm.resetFields() }}
        onOk={() => groupForm.submit()}
        confirmLoading={updateGroupMutation.isPending}
        destroyOnClose
      >
        <Form
          form={groupForm}
          layout="vertical"
          style={{ marginTop: 16 }}
          onFinish={(v) => updateGroupMutation.mutate({ groupId: editingGroup.id, data: v })}
        >
          <Form.Item name="name" label="Group Name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="topic" label="Topic">
            <Input placeholder="e.g. The future of renewable energy" />
          </Form.Item>
        </Form>
      </Modal>


    </div>
  )
}
