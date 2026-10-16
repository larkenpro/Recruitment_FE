import {
  AppstoreOutlined,
  CalendarOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  LinkOutlined,
  TeamOutlined,
  UnorderedListOutlined,
  UserAddOutlined,
  UsergroupAddOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  DatePicker,
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
  generateLink,
  getCandidatesByEvent,
  getEvent,
  getEventPositions,
  getEventRoundResults,
  getEventStageSummary,
  getGroups,
  generateGroups,
  updateGroup,
  moveGroupMember,
  getRoundGraph,
  getRoundProgress,
  removeEventPosition,
  setEventPositionTypes,
  updateEventMode,
  updateEventStatus,
} from '../api/events'
import { getPositions, getPositionTypes } from '../api/positions'
import { preferenceLabel } from '../utils/preferences'
import { EVENT_MODE_OPTIONS, eventMode } from '../utils/eventModes'
import PositionTypeFields, { toEventPositions } from '../components/PositionTypeFields'
import { getCandidateResume, getResumeFile, updateRoundResult, addStageEntry, updateStageStatusByName } from '../api/candidates'
import { getErrorMessage } from '../utils/errorUtils'
import { GUTTER, useLayoutMetrics } from '../theme'
import { useStageDecision } from '../hooks/useStageDecision'
import { useColumnFilter } from '../hooks/useColumnFilter'
import FilterBar from '../components/FilterBar'
import EventApplicationModal from '../components/EventApplicationModal'
import PipelineGraph from '../components/PipelineGraph'
import { hasReached, isStageKey, stageKey, stageOf } from '../utils/roundGraph'

const { Title, Text } = Typography

const CANDIDATE_FILTER_KEYS = [
  { key: 'branch', label: 'Branch', getVal: (r) => r.branch },
  { key: 'graduationYear', label: 'Batch', getVal: (r) => r.graduationYear },
  { key: 'ugCgpa', label: 'CGPA', type: 'min', getVal: (r) => r.ugCgpa },
  { key: 'backlogs', label: 'Backlogs', type: 'max', getVal: (r) => r.backlogs ?? 0 },
  { key: 'resumeStatus', label: 'Resume Result', getVal: (r) => r.resumeStatus },
]

const ROUND_FILTER_KEYS = [
  { key: 'branch', label: 'Branch', getVal: (r) => r.branch },
  { key: 'graduationYear', label: 'Batch', getVal: (r) => r.graduationYear },
  { key: 'backlogs', label: 'Backlogs', type: 'max', getVal: (r) => r.backlogs ?? 0 },
  { key: 'roundsDecision', label: 'Decision', getVal: (r) => r.roundsDecision },
]

const LATE_STAGE_FILTER_KEYS = [
  { key: 'branch', label: 'Branch', getVal: (r) => r.branch },
  { key: 'graduationYear', label: 'Batch', getVal: (r) => r.graduationYear },
  { key: 'stageStatus', label: 'Decision', getVal: (r) => r.stageStatus },
]

const RESUME_STATUS_OPTIONS = [
  { value: 'SHORTLISTED', label: 'Shortlisted' },
  { value: 'HOLD', label: 'Hold' },
  { value: 'REJECTED', label: 'Rejected' },
]

const ROUND_DECISION_OPTIONS = RESUME_STATUS_OPTIONS

// Which candidates a round's list shows, by where they stand in it. Defaults to who is there now.
const ROUND_STATUS_OPTIONS = [
  { value: 'OPEN', label: 'Open' },
  { value: 'ON_HOLD', label: 'On hold' },
  { value: 'PASS', label: 'Passed' },
  { value: 'FAIL', label: 'Failed' },
]

const ROUND_RESULT_OPTIONS = [
  { value: 'PASS', label: 'Pass' },
  { value: 'FAIL', label: 'Fail' },
  { value: 'ON_HOLD', label: 'On Hold' },
]

const STATUS_COLOR = { UPCOMING: 'blue', ACTIVE: 'green', COMPLETED: 'default', CANCELLED: 'red' }

export default function EventDetail() {
  const { id } = useParams()
  const { sectionGap } = useLayoutMetrics()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // { url, until } once generated; `until` is the expiry it was generated with.
  const [link, setLink] = useState(null)
  const [linkExpiry, setLinkExpiry] = useState(() => dayjs().add(30, 'day'))
  const [positionForm] = Form.useForm()
  const [resumeModal, setResumeModal] = useState({ open: false, candidateId: null, fileName: null, blobUrl: null })
  const [pendingCandidateId, setPendingCandidateId] = useState(null)
  const [groupCount, setGroupCount] = useState(null)
  const [editingGroup, setEditingGroup] = useState(null)
  const [draggingMember, setDraggingMember] = useState(null)
  const [dragOverGroupId, setDragOverGroupId] = useState(null)
  const [groupForm] = Form.useForm()
  const [editingRoundId, setEditingRoundId] = useState(null)
  const [roundTableEdits, setRoundTableEdits] = useState({})
  const [pendingRoundCandidateId, setPendingRoundCandidateId] = useState(null)
  const [pendingPipelineCandidateId, setPendingPipelineCandidateId] = useState(null)
  // { application: null } to add a candidate, { application: row } to edit theirs; null when closed.
  const [applicationModal, setApplicationModal] = useState(null)
  // The pipeline graph node whose candidates are listed: a stage key, or a round id as text.
  const [selectedStage, setSelectedStage] = useState(stageKey('Resume'))
  const [roundStatusFilter, setRoundStatusFilter] = useState([])

  const { data: event, isLoading } = useQuery({
    queryKey: ['event', id],
    queryFn: () => getEvent(id).then((r) => r.data.data),
  })

  // { rounds (in graph order), edges }; see utils/roundGraph.js
  const { data: roundGraph } = useQuery({
    queryKey: ['roundGraph', id],
    queryFn: () => getRoundGraph(id).then((r) => r.data.data),
  })

  // Who has reached which round, decided by the backend from the graph.
  const { data: roundProgress } = useQuery({
    queryKey: ['roundProgress', id],
    queryFn: () => getRoundProgress(id).then((r) => r.data.data),
  })

  const { data: eventPositions } = useQuery({
    queryKey: ['eventPositions', id],
    queryFn: () => getEventPositions(id).then((r) => r.data.data),
  })

  const { data: allPositions } = useQuery({
    queryKey: ['positions'],
    queryFn: () => getPositions().then((r) => r.data.data),
  })

  const { data: positionTypes } = useQuery({
    queryKey: ['positionTypes'],
    queryFn: () => getPositionTypes().then((r) => r.data.data),
  })

  const { data: candidates, isLoading: candidatesLoading } = useQuery({
    queryKey: ['eventCandidates', id],
    // One row per application, carrying this event's details; every table here keys on the candidate.
    queryFn: () => getCandidatesByEvent(id).then((r) => r.data.data.map((a) => ({ ...a, id: a.candidateId }))),
  })

  const { data: stageSummaryList } = useQuery({
    queryKey: ['eventStageSummary', id],
    queryFn: () => getEventStageSummary(id).then((r) => r.data.data),
  })

  // Each Group Discussion round has its own groups; the one picked in the pipeline graph is loaded.
  const selectedGdRoundId = (roundGraph?.rounds ?? [])
    .find((r) => String(r.id) === selectedStage && r.roundType === 'GROUP_DISCUSSION')?.id
  const { data: groups } = useQuery({
    queryKey: ['roundGroups', id, selectedGdRoundId],
    queryFn: () => getGroups(id, selectedGdRoundId).then((r) => r.data.data),
    enabled: !!selectedGdRoundId,
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

  const roundStatusByCandidate = useMemo(
    () => Object.fromEntries((roundProgress ?? []).map((p) => [p.candidateId, p.rounds])),
    [roundProgress]
  )

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

  // The event page stops at Offer; later stages live on the Offers page.
  const lateStageLists = useMemo(() => ({
    'Offer': offerStageSummaryList ?? [],
  }), [offerStageSummaryList])

  const lateStageSummaryMaps = useMemo(() => Object.fromEntries(
    Object.entries(lateStageLists).map(([stage, list]) => [
      stage,
      Object.fromEntries(list.map((s) => [s.candidateId, s])),
    ])
  ), [lateStageLists])

  // What each pipeline graph node shows as its count: applicants at Resume, each round's pending
  // (open or on hold) / passed / failed, and everyone at each later stage.
  const stageCounts = useMemo(() => {
    const counts = { [stageKey('Resume')]: candidates?.length ?? 0 }
    ;(roundGraph?.rounds ?? []).forEach((r) => {
      const statuses = shortlistedCandidates.map((c) => roundStatusByCandidate[c.id]?.[r.id])
      counts[String(r.id)] = {
        pending: statuses.filter((s) => s === 'OPEN' || s === 'ON_HOLD').length,
        passed: statuses.filter((s) => s === 'PASS').length,
        failed: statuses.filter((s) => s === 'FAIL').length,
      }
    })
    Object.entries(lateStageLists).forEach(([stage, list]) => { counts[stageKey(stage)] = list.length })
    return counts
  }, [candidates, roundGraph, shortlistedCandidates, roundStatusByCandidate, lateStageLists])

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

  const lateStageFilterProps = {
    'Offer': { filteredData: filteredOfferData, filters: offerFilters, setFilter: setOfferFilter, removeFilter: removeOfferFilter, optionMap: { ...offerOptionMap, stageStatus: ROUND_DECISION_OPTIONS } },
  }

  const modeMutation = useMutation({
    mutationFn: (mode) => updateEventMode(id, mode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', id] })
      queryClient.invalidateQueries({ queryKey: ['events'] })
      message.success('Mode updated!')
    },
    onError: (err) => message.error(getErrorMessage(err)),
  })

  const statusMutation = useMutation({
    mutationFn: (status) => updateEventStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', id] })
      queryClient.invalidateQueries({ queryKey: ['events'] })
      message.success('Status updated!')
    },
    onError: (err) => message.error(getErrorMessage(err)),
  })

  const addPositionsMutation = useMutation({
    mutationFn: (positions) => addEventPositions(id, positions),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eventPositions', id] })
      queryClient.invalidateQueries({ queryKey: ['roundGraph', id] })
      positionForm.resetFields()
      message.success('Position(s) added!')
    },
    onError: (err) => message.error(getErrorMessage(err)),
  })

  const removePositionMutation = useMutation({
    mutationFn: (positionId) => removeEventPosition(id, positionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eventPositions', id] })
      // Its (position, type) pairs leave the round graph, with their arrows.
      queryClient.invalidateQueries({ queryKey: ['roundGraph', id] })
      message.success('Position removed!')
    },
    onError: (err) => message.error(getErrorMessage(err)),
  })

  const positionTypesMutation = useMutation({
    mutationFn: ({ positionId, typeIds }) => setEventPositionTypes(id, positionId, typeIds),
    // Returns every event position with its types, so it goes straight into the cache. The round
    // graph's pair nodes follow the types.
    onSuccess: (res) => {
      queryClient.setQueryData(['eventPositions', id], res.data.data)
      queryClient.invalidateQueries({ queryKey: ['roundGraph', id] })
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
    mutationFn: (count) => generateGroups(id, selectedGdRoundId, count),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roundGroups', id, selectedGdRoundId] })
      message.success('Groups generated!')
    },
    onError: (err) => message.error(getErrorMessage(err)),
  })

  const moveMemberMutation = useMutation({
    mutationFn: ({ groupId, candidateId }) => moveGroupMember(id, selectedGdRoundId, groupId, candidateId),
    // The endpoint returns every group of the round, so drop it straight into the cache — no refetch.
    onSuccess: (res) => queryClient.setQueryData(['roundGroups', id, selectedGdRoundId], res.data.data),
    onError: (err) => message.error(getErrorMessage(err)),
  })

  const updateGroupMutation = useMutation({
    mutationFn: ({ groupId, data }) => updateGroup(id, selectedGdRoundId, groupId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roundGroups', id, selectedGdRoundId] })
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
    // The backend settles the Rounds stage (and opens Offer) from the round graph on every save.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eventRoundResults', id] })
      queryClient.invalidateQueries({ queryKey: ['roundProgress', id] })
      queryClient.invalidateQueries({ queryKey: ['eventStageSummary', id] })
      message.success('Score saved!')
    },
    onError: (err) => message.error(getErrorMessage(err)),
  })

  // /resume/view and /resume/download require a JWT, which a plain <iframe src>/<a href>
  // can't send — fetch the bytes through the authed axios instance and hand the
  // iframe/download button a blob: URL instead (mirrors CandidateDetail.jsx).
  const handleViewResume = async (candidateId) => {
    try {
      const res = await getCandidateResume(candidateId)
      const fileName = res.data.data?.fileName ?? null
      const fileRes = await getResumeFile(candidateId)
      const blobUrl = URL.createObjectURL(fileRes.data)
      setResumeModal({ open: true, candidateId, fileName, blobUrl })
    } catch {
      message.error('No resume found for this candidate')
    }
  }

  const closeResumeModal = () => {
    setResumeModal((prev) => {
      if (prev.blobUrl) URL.revokeObjectURL(prev.blobUrl)
      return { open: false, candidateId: null, fileName: null, blobUrl: null }
    })
  }

  const handleGenerateLink = async () => {
    if ((eventPositions?.length ?? 0) === 0) {
      message.warning('Add at least one position before generating the application link.')
      return
    }
    if ((roundGraph?.rounds?.length ?? 0) === 0) {
      message.warning('Add at least one interview round before generating the application link.')
      return
    }
    if (untypedPositions.length > 0) {
      message.warning('Choose at least one type for every position before generating the application link.')
      return
    }
    try {
      const res = await generateLink(Number(id), linkExpiry.format('YYYY-MM-DD'))
      setLink({ url: res.data.data, until: linkExpiry })
      message.success('Link generated!')
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  if (isLoading) return <Card loading style={{ borderRadius: 12 }} />
  if (!event) return <Empty />

  const sortedRounds = roundGraph?.rounds ?? []
  const untypedPositions = (eventPositions ?? []).filter((p) => !(p.types?.length))

  // Candidates the round graph has brought to this round (it's open for them, or already marked).
  const candidatesReachingRound = (base, round) =>
    base.filter((c) => hasReached(roundStatusByCandidate[c.id]?.[round.id]))

  const gdRound = sortedRounds.find((r) => r.id === selectedGdRoundId)
  const gdEligible = gdRound ? candidatesReachingRound(shortlistedCandidates, gdRound) : []
  const availablePositions = (allPositions ?? []).filter(
    (p) => !(eventPositions ?? []).some((ep) => ep.id === p.id)
  )

  const LATE_STAGE_NAMES = ['Offer']

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
          scroll={{ x: 'max-content' }}
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
            { title: 'Roll No', dataIndex: 'rollNo', render: (v) => v || '—' },
            { title: 'Email', dataIndex: 'email' },
            { title: 'Branch', dataIndex: 'branch', render: (v) => v || '—' },
            { title: 'Batch', dataIndex: 'graduationYear', render: (v) => v ?? '—' },
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
                    description={
                      <>
                        {p.department && <div>{p.department}</div>}
                        <Checkbox.Group
                          value={(p.types ?? []).map((t) => t.id)}
                          options={(positionTypes ?? []).map((t) => ({ value: t.id, label: t.name }))}
                          disabled={positionTypesMutation.isPending}
                          onChange={(typeIds) => positionTypesMutation.mutate({ positionId: p.id, typeIds })}
                          style={{ marginTop: 4 }}
                        />
                      </>
                    }
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
            onFinish={(v) => addPositionsMutation.mutate(toEventPositions(v))}
          >
            <Form.Item name="positionIds" rules={[{ required: true, message: 'Select at least one position' }]}>
              <Select
                mode="multiple"
                placeholder="Select positions to add"
                optionFilterProp="label"
                showSearch
                options={availablePositions.map((p) => ({
                  value: p.id,
                  label: p.title,
                }))}
              />
            </Form.Item>
            <PositionTypeFields positions={availablePositions} positionTypes={positionTypes} />
            <Button type="primary" htmlType="submit" loading={addPositionsMutation.isPending}>
              Add
            </Button>
          </Form>
        </div>
      ),
    },
  ]

  // The selected Group Discussion round's groups: generate them at random, rename, move people.
  const groupsContent = (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <InputNumber
          min={1}
          precision={0}
          max={gdEligible.length || undefined}
          placeholder="Number of groups"
          value={groupCount}
          onChange={setGroupCount}
          style={{ width: 160 }}
        />
        {gdEligible.length > 0 && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            Max {gdEligible.length} group{gdEligible.length === 1 ? '' : 's'} ({gdEligible.length} candidate{gdEligible.length === 1 ? '' : 's'} in {gdRound?.name})
          </Text>
        )}
        {(groups?.length ?? 0) > 0 ? (
          <Popconfirm
            title="Regenerate groups?"
            description="This will delete all existing groups and randomly assign new ones."
            onConfirm={() => generateGroupsMutation.mutate(groupCount)}
            okText="Regenerate"
            cancelText="Cancel"
            okButtonProps={{ danger: true }}
            disabled={!groupCount || !gdEligible.length}
          >
            <Button
              type="primary"
              loading={generateGroupsMutation.isPending}
              disabled={!groupCount || !gdEligible.length}
            >
              Regenerate Groups
            </Button>
          </Popconfirm>
        ) : (
          <Button
            type="primary"
            onClick={() => generateGroupsMutation.mutate(groupCount)}
            loading={generateGroupsMutation.isPending}
            disabled={!groupCount || !gdEligible.length}
          >
            Generate Groups
          </Button>
        )}
      </div>
      {!gdEligible.length ? (
        <Empty description={`No candidates have reached ${gdRound?.name ?? 'this round'} yet`} />
      ) : (groups?.length ?? 0) === 0 ? (
        <Empty description="No groups generated yet" />
      ) : (
        <>
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 10 }}>
          Drag a candidate onto another group to move them, or use the group picker on their row.
        </Text>
        <Row gutter={GUTTER}>
          {groups.map((g) => (
            <Col key={g.id} xs={24} sm={12} lg={8}>
              <div
                style={{ height: '100%' }}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  setDragOverGroupId(g.id)
                }}
                onDragLeave={() => setDragOverGroupId((cur) => (cur === g.id ? null : cur))}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOverGroupId(null)
                  if (draggingMember && draggingMember.fromGroupId !== g.id) {
                    moveMemberMutation.mutate({ groupId: g.id, candidateId: draggingMember.candidateId })
                  }
                  setDraggingMember(null)
                }}
              >
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
                style={{
                  height: '100%',
                  outline: dragOverGroupId === g.id ? '2px dashed #1677ff' : undefined,
                }}
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
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.effectAllowed = 'move'
                              e.dataTransfer.setData('text/plain', String(m.id))
                              setDraggingMember({ candidateId: m.id, fromGroupId: g.id })
                            }}
                            onDragEnd={() => {
                              setDraggingMember(null)
                              setDragOverGroupId(null)
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              marginBottom: 4,
                              cursor: 'grab',
                              opacity: draggingMember?.candidateId === m.id ? 0.4 : 1,
                            }}
                          >
                            <Text style={{ fontSize: 13, flex: 1 }}>
                              {m.name}
                              {m.rollNo && (
                                <Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>
                                  {m.rollNo}
                                </Text>
                              )}
                            </Text>
                            {m.branch && (
                              <Tag style={{ fontSize: 11, margin: 0 }}>{m.branch}</Tag>
                            )}
                            {/* Keyboard-reachable equivalent of dragging the row. */}
                            <Select
                              size="small"
                              variant="borderless"
                              value={g.id}
                              options={groups.map((x) => ({ value: x.id, label: x.name }))}
                              onChange={(toGroupId) =>
                                moveMemberMutation.mutate({ groupId: toGroupId, candidateId: m.id })
                              }
                              style={{ width: 62 }}
                              aria-label={`Group for ${m.name}`}
                            />
                          </div>
                        ))
                      )}
                    </>
                  )
                })()}
              </Card>
              </div>
            </Col>
          ))}
        </Row>
        </>
      )}
    </div>
  )

  const renderRoundTabContent = (round) => {
    if (shortlistedCandidates.length === 0) {
      return <Empty description="No candidates have passed the Resume stage yet" />
    }

    const isLastRound = !(roundGraph?.edges ?? []).some((e) => e.from === String(round.id))
    const roundFilterKeys = isLastRound
      ? ROUND_FILTER_KEYS
      : ROUND_FILTER_KEYS.filter((k) => k.key !== 'roundsDecision')

    const displayCandidates = candidatesReachingRound(filteredShortlisted, round)
      .filter((c) => roundStatusFilter.length === 0 || roundStatusFilter.includes(roundStatusByCandidate[c.id]?.[round.id]))

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
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <Select
          mode="multiple"
          size="small"
          style={{ minWidth: 260 }}
          value={roundStatusFilter}
          onChange={setRoundStatusFilter}
          options={ROUND_STATUS_OPTIONS}
          placeholder="Every status"
          maxTagCount="responsive"
        />
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
      { title: 'Roll No', dataIndex: 'rollNo', render: (v) => v || '—' },
      { title: 'Branch', dataIndex: 'branch', render: (v) => v || '—' },
      { title: 'Batch', dataIndex: 'graduationYear', render: (v) => v ?? '—' },
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
              precision={2}
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
                rollNo: m.rollNo,
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
                {groupData.length === 0 ? (
                  <Text type="secondary" italic style={{ fontSize: 12 }}>
                    No candidates in this group at this stage
                  </Text>
                ) : (
                  <Table
                    dataSource={groupData}
                    rowKey="key"
                    size="small"
                    pagination={false}
                    columns={roundColumns}
                    scroll={{ x: 'max-content' }}
                  />
                )}
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
                scroll={{ x: 'max-content' }}
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
          scroll={{ x: 'max-content' }}
        />
      </>
    )
  }

  const resumeContent = (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Button icon={<UserAddOutlined />} onClick={() => setApplicationModal({ application: null })}>
          Add Candidate
        </Button>
      </div>
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
        scroll={{ x: 'max-content' }}
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
          { title: 'Roll No', dataIndex: 'rollNo', render: (v) => v || '—' },
          { title: 'Email', dataIndex: 'email' },
          { title: 'Phone', dataIndex: 'phone', render: (v) => v || '—' },
          { title: 'Branch', dataIndex: 'branch', render: (v) => v || '—' },
          { title: 'Batch', dataIndex: 'graduationYear', render: (v) => v ?? '—' },
          { title: 'UG CGPA', dataIndex: 'ugCgpa', render: (v) => v ?? '—' },
          {
            title: 'Preferences',
            render: (_, r) => (r.preferences ?? []).map((p, i) => (
              <div key={i} style={{ whiteSpace: 'nowrap' }}>{i + 1}. {preferenceLabel(p)}</div>
            )),
          },
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
          {
            title: 'Details',
            render: (_, r) => (
              <Button size="small" icon={<EditOutlined />} onClick={() => setApplicationModal({ application: r })}>
                Edit
              </Button>
            ),
          },
        ]}
      />
    </>
  )

  const selectedRound = sortedRounds.find((r) => String(r.id) === selectedStage)
  const selectedLaterStage = isStageKey(selectedStage) && LATE_STAGE_NAMES.includes(stageOf(selectedStage))
    ? stageOf(selectedStage)
    : null
  const stagePanel = selectedRound
    ? {
        title: selectedRound.name,
        content: selectedRound.roundType === 'GROUP_DISCUSSION'
          ? (
            <Tabs
              items={[
                { key: 'scores', label: 'Scores', children: renderRoundTabContent(selectedRound) },
                {
                  key: 'groups',
                  label: (
                    <span>
                      <UsergroupAddOutlined style={{ marginRight: 4 }} />
                      Groups{(groups?.length ?? 0) > 0 ? ` (${groups.length})` : ''}
                    </span>
                  ),
                  children: groupsContent,
                },
              ]}
            />
          )
          : renderRoundTabContent(selectedRound),
      }
    : selectedLaterStage
      ? { title: selectedLaterStage, content: renderLateStageTab(selectedLaterStage) }
      : { title: 'Resume', content: resumeContent }

  const missingPositions = (eventPositions?.length ?? 0) === 0
  const missingRounds = sortedRounds.length === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: sectionGap }}>
      {(missingPositions || missingRounds || untypedPositions.length > 0) && (
        <Alert
          type="warning"
          showIcon
          message="This event isn't ready to accept applications yet"
          description={
            <>
              {missingPositions && <div>Add at least one position in the Positions tab.</div>}
              {missingRounds && <div>Add at least one interview round: Pipeline → Edit rounds.</div>}
              {untypedPositions.length > 0 && (
                <div>Choose at least one type in the Positions tab for: {untypedPositions.map((p) => p.title).join(', ')}.</div>
              )}
            </>
          }
        />
      )}

      {/* Top row */}
      <Row gutter={GUTTER} align="stretch">
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
              <Descriptions.Item label="Mode">
                <Select
                  value={event.mode}
                  size="small"
                  style={{ width: 150 }}
                  loading={modeMutation.isPending}
                  onChange={(val) => modeMutation.mutate(val)}
                  options={EVENT_MODE_OPTIONS.map((m) => ({ value: m.value, label: <Tag color={eventMode(m.value).color}>{m.label}</Tag> }))}
                />
              </Descriptions.Item>
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
                <Tag color="green" style={{ margin: 0 }}>ACTIVE</Tag> and has at least one position (each with a type) and round set up.
              </Text>
              <div>
                <Text style={{ fontSize: 13 }}>Accepts applications until</Text>
                <DatePicker
                  value={linkExpiry}
                  onChange={setLinkExpiry}
                  allowClear={false}
                  format="D MMM YYYY"
                  disabledDate={(d) => d.isBefore(dayjs(), 'day')}
                  style={{ width: '100%', marginTop: 4 }}
                />
              </div>
              <Button
                type="primary"
                icon={<LinkOutlined />}
                onClick={handleGenerateLink}
                disabled={event.status !== 'ACTIVE' || missingPositions || missingRounds || untypedPositions.length > 0}
              >
                Generate Link
              </Button>
              {link && (
                <>
                  <Space.Compact style={{ width: '100%' }}>
                    <Input value={link.url} readOnly size="small" />
                    <Button
                      size="small"
                      icon={<CopyOutlined />}
                      onClick={() => {
                        navigator.clipboard.writeText(link.url)
                        message.success('Copied!')
                      }}
                    >
                      Copy
                    </Button>
                  </Space.Compact>
                  <Text type="secondary" style={{ fontSize: 12 }}>Valid through {link.until.format('D MMM YYYY')}</Text>
                </>
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

      {/* The pipeline as one graph; the clicked stage's candidates are listed under it */}
      <Card
        bordered={false}
        style={{ borderRadius: 12 }}
        title={<Text strong style={{ fontSize: 15 }}>Pipeline</Text>}
      >
        <PipelineGraph
          eventId={id}
          graph={roundGraph}
          counts={stageCounts}
          selectedStage={selectedStage}
          onSelectStage={setSelectedStage}
          onSaved={(graph) => {
            queryClient.setQueryData(['roundGraph', id], graph)
            queryClient.invalidateQueries({ queryKey: ['roundProgress', id] })
            queryClient.invalidateQueries({ queryKey: ['eventRoundResults', id] })
          }}
        />
        <div style={{ marginTop: 20 }}>
          <Title level={5} style={{ marginTop: 0 }}>{stagePanel.title}</Title>
          {stagePanel.content}
        </div>
      </Card>

      {/* Resume viewer modal */}
      <Modal
        open={resumeModal.open}
        title={
          <Space>
            <FileTextOutlined style={{ color: '#4f46e5' }} />
            <span>{resumeModal.fileName ?? 'Resume'}</span>
          </Space>
        }
        onCancel={closeResumeModal}
        footer={[
          <Button
            key="download"
            href={resumeModal.blobUrl}
            download={resumeModal.fileName}
            disabled={!resumeModal.blobUrl}
          >
            Download
          </Button>,
          <Button key="close" type="primary" onClick={closeResumeModal}>
            Close
          </Button>,
        ]}
        width={900}
        styles={{ body: { padding: 0 } }}
      >
        {resumeModal.blobUrl && resumeModal.fileName?.toLowerCase().endsWith('.pdf') ? (
          <iframe
            src={resumeModal.blobUrl}
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

      <EventApplicationModal
        open={!!applicationModal}
        eventId={id}
        eventPositions={eventPositions}
        application={applicationModal?.application}
        onClose={() => setApplicationModal(null)}
        onSaved={() => {
          setApplicationModal(null)
          queryClient.invalidateQueries({ queryKey: ['eventCandidates', id] })
          queryClient.invalidateQueries({ queryKey: ['eventStageSummary', id] })
          queryClient.invalidateQueries({ queryKey: ['roundGroups', id] })
        }}
      />

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
