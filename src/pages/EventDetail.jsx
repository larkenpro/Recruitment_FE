import {
  AppstoreOutlined,
  CalendarOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  FilterOutlined,
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
  Switch,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd'
import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  addDummyCandidates,
  setRoundInterviewer,
  exportOfferStatus,
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
import { EVENT_MODE_OPTIONS, eventMode } from '../utils/eventModes'
import PositionTypeFields, { toEventPositions } from '../components/PositionTypeFields'
import { getOffers, updateRoundResult, pickRoundTracks, addStageEntry, updateStageStatusByName } from '../api/candidates'
import { useAuth } from '../context/AuthContext'
import { OfferResponseCell, OfferedPositionCell } from '../components/OfferPairSelect'
import { getErrorMessage } from '../utils/errorUtils'
import { GUTTER, useLayoutMetrics } from '../theme'
import { decideStage, useStageDecision } from '../hooks/useStageDecision'
import { useColumnFilter } from '../hooks/useColumnFilter'
import FilterBar from '../components/FilterBar'
import { useCandidateColumns } from '../components/CandidateColumns'
import PipelineGraph from '../components/PipelineGraph'
import { DEFAULT_MAX_SCORE, hasReached, isStageKey, pairColors, pairLabel, roundsBefore, stageKey, stageOf } from '../utils/roundGraph'
import { useColumnChoice } from '../components/ColumnPicker'
import DownloadExcel from '../components/DownloadExcel'
import DownloadOfferStatus from '../components/DownloadOfferStatus'
import ScreeningSettings from '../components/ScreeningSettings'
import { fitScore, screen } from '../utils/screening'
import { labelFor } from '../utils/columns'
import { offerResponse, offeredLabel } from '../utils/offers'
import { DATE_FORMAT, defaultLinkExpiry, formatDate } from '../utils/dates'

const { Title, Text } = Typography

// A search box on every table here: matches a candidate's name, roll number, email or phone.
const CANDIDATE_SEARCH = {
  key: 'candidate',
  label: 'Candidate',
  type: 'text',
  getVal: (r) => [r.name, r.rollNo, r.email, r.phone].filter(Boolean).join(' '),
}

const CANDIDATE_FILTER_KEYS = [
  CANDIDATE_SEARCH,
  { key: 'branch', label: 'Branch', getVal: (r) => r.branch },
  { key: 'graduationYear', label: 'Batch', getVal: (r) => r.graduationYear },
  { key: 'ugCgpa', label: 'CGPA', type: 'min', getVal: (r) => r.ugCgpa },
  { key: 'backlogs', label: 'Backlogs', type: 'max', getVal: (r) => r.backlogs ?? 0 },
  { key: 'resumeStatus', label: 'Decision', getVal: (r) => r.resumeStatus },
]

// How a Group Discussion round's groups are made (CandidateGroupService.generate). bySize ones ask
// for the most per group and make as many groups as that needs; the rest ask for a number of groups.
const GROUP_STRATEGIES = [
  { value: 'RANDOM', label: 'Random', hint: 'Shuffled evenly across the groups.' },
  { value: 'SAME_PREFERENCES', label: 'Same preferences', bySize: true, hint: 'Everyone who applied for the same set of positions, in any order, together. A set bigger than the maximum is split evenly.' },
  { value: 'SAME_BRANCH', label: 'Same branch', bySize: true, hint: 'Everyone from one branch together. A branch bigger than the maximum is split evenly.' },
  { value: 'MIXED_BRANCHES', label: 'Mixed branches', hint: 'Each group gets a spread of branches.' },
  { value: 'BALANCED_SCORE', label: 'Balanced by fit score', hint: 'Every group gets a similar mix of strong and weaker candidates (by the event\'s fit score).' },
  { value: 'SIMILAR_SCORE', label: 'Similar fit score', hint: 'Candidates with close fit scores together, best group first.' },
]

// Rounds whose interviewer can be set for everyone, or per discussion group, at once.
const BULK_INTERVIEWER_TYPES = ['GROUP_DISCUSSION', 'INTERVIEW']

const ROUND_FILTER_KEYS = [
  CANDIDATE_SEARCH,
  { key: 'branch', label: 'Branch', getVal: (r) => r.branch },
  { key: 'graduationYear', label: 'Batch', getVal: (r) => r.graduationYear },
  { key: 'backlogs', label: 'Backlogs', type: 'max', getVal: (r) => r.backlogs ?? 0 },
  { key: 'roundsDecision', label: 'Overall Rounds Decision', getVal: (r) => r.roundsDecision },
]

const LATE_STAGE_FILTER_KEYS = [
  CANDIDATE_SEARCH,
  { key: 'branch', label: 'Branch', getVal: (r) => r.branch },
  { key: 'graduationYear', label: 'Batch', getVal: (r) => r.graduationYear },
  { key: 'stageStatus', label: 'Offer Status', getVal: (r) => r.stageStatus },
]

const RESUME_STATUS_OPTIONS = [
  { value: 'SHORTLISTED', label: 'Shortlisted' },
  { value: 'HOLD', label: 'Hold' },
  { value: 'REJECTED', label: 'Rejected' },
]

const ROUND_DECISION_OPTIONS = RESUME_STATUS_OPTIONS

// Same stored values; at Offer, HOLD reads as a waitlist.
const OFFER_DECISION_OPTIONS = RESUME_STATUS_OPTIONS.map((o) => (o.value === 'HOLD' ? { ...o, label: 'WaitList' } : o))

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
  const queryClient = useQueryClient()

  // { url, until } once generated; `until` is the expiry it was generated with.
  const [link, setLink] = useState(null)
  // null until picked: the default follows the event's start date, which loads later.
  const [pickedLinkExpiry, setLinkExpiry] = useState(null)
  const [positionForm] = Form.useForm()
  const [pendingCandidateId, setPendingCandidateId] = useState(null)
  const [groupCount, setGroupCount] = useState(null)
  const [groupStrategy, setGroupStrategy] = useState('RANDOM')
  const [groupMaxSize, setGroupMaxSize] = useState(null)
  const [editingGroup, setEditingGroup] = useState(null)
  const [bulkInterviewer, setBulkInterviewer] = useState('')
  const [draggingMember, setDraggingMember] = useState(null)
  const [dragOverGroupId, setDragOverGroupId] = useState(null)
  const [groupForm] = Form.useForm()
  const [editingRoundId, setEditingRoundId] = useState(null)
  const [roundTableEdits, setRoundTableEdits] = useState({})
  const [pendingRoundCandidateId, setPendingRoundCandidateId] = useState(null)
  const [pendingPipelineCandidateId, setPendingPipelineCandidateId] = useState(null)
  // The pipeline graph node whose candidates are listed: a stage key, or a round id as text.
  const [selectedStage, setSelectedStage] = useState(stageKey('Resume'))
  const [roundStatusFilter, setRoundStatusFilter] = useState([])
  const columnsFor = useColumnChoice()

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

  // Every row here is from this event, so the editor always gets its positions.
  const { columns: col, modals: candidateModals, addCandidate } = useCandidateColumns(() => eventPositions)

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

  // Offer records live under /candidates (PAGE_CANDIDATES), shared with the Offers page's cache.
  const { hasPage, user } = useAuth()
  const { data: eventOffers } = useQuery({
    queryKey: ['offers'],
    queryFn: () => getOffers().then((r) => r.data.data),
    enabled: hasPage('CANDIDATES'),
    select: (rows) => Object.fromEntries(rows.filter((o) => o.eventId === Number(id)).map((o) => [o.candidateId, o.offer])),
  })

  const { data: offerStageSummaryList } = useQuery({
    queryKey: ['eventStageSummary', id, 'Offer'],
    queryFn: () => getEventStageSummary(id, 'Offer').then((r) => r.data.data),
  })

  const stageSummaryMap = useMemo(
    () => Object.fromEntries((stageSummaryList ?? []).map((s) => [s.candidateId, s])),
    [stageSummaryList]
  )

  // Screened against the event's criteria and sorted best fit first.
  const candidatesWithStatus = useMemo(
    () => (candidates ?? [])
      .map((c) => {
        const { eligible, reasons, score } = screen(c, event?.screening)
        return { ...c, resumeStatus: stageSummaryMap[c.id]?.status ?? null, eligible, ineligibleReasons: reasons, fitScore: score }
      })
      .sort((a, b) => (b.fitScore ?? -1) - (a.fitScore ?? -1)),
    [candidates, stageSummaryMap, event?.screening]
  )
  const [showIneligible, setShowIneligible] = useState(false)
  const ineligibleCount = candidatesWithStatus.filter((c) => !c.eligible).length
  // Undecided only: a Hold or Reject set by hand stays.
  const toShortlist = candidatesWithStatus.filter((c) => c.eligible && !c.resumeStatus)

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
  // At split rounds: { [candidateId]: { [roundId]: { track, options, picked } } }.
  const tracksByCandidate = useMemo(
    () => Object.fromEntries((roundProgress ?? []).map((p) => [p.candidateId, p.tracks ?? {}])),
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

  // Fit score at a point in the pipeline: academics plus the candidate's scores in these rounds so far.
  const roundMaxScore = Object.fromEntries((roundGraph?.rounds ?? []).map((r) => [r.id, r.maxScore ?? DEFAULT_MAX_SCORE]))
  const fitScoreUpTo = (c, roundIds) => (event?.screening ? fitScore(c, event.screening, roundIds.map((roundId) => ({
    roundId, score: roundResultMap[roundId]?.[c.id]?.score, maxScore: roundMaxScore[roundId],
  }))) : null)
  const byFitScore = (a, b) => (b.fitScore ?? -1) - (a.fitScore ?? -1)
  const fitScoreColumn = {
    key: 'fitScore',
    title: 'Fit Score',
    dataIndex: 'fitScore',
    sorter: (a, b) => (a.fitScore ?? -1) - (b.fitScore ?? -1),
    render: (v) => v ?? '—',
  }

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

  // A discussion group's interviewer in its round: the one name all its members share, null if none, or MIXED.
  const MIXED = 'mixed'
  const groupInterviewer = (g) => {
    const names = new Set(g.members.filter((m) => shortlistedIds.has(m.id))
      .map((m) => roundResultMap[selectedGdRoundId]?.[m.id]?.interviewer || null))
    return names.size === 1 ? [...names][0] : names.size === 0 ? null : MIXED
  }

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
      // At Offer the fit score counts every round.
      list.map((s) => ({ ...candidateMap[s.candidateId], key: s.candidateId, stageStatus: s.status }))
        .filter((r) => r.id)
        .map((r) => ({ ...r, fitScore: fitScoreUpTo(r, (roundGraph?.rounds ?? []).map((x) => x.id)) }))
        .sort(byFitScore),
    ])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [lateStageLists, candidateMap, roundResultMap, roundGraph, event?.screening])

  const { filteredData: filteredOfferData, filters: offerFilters, setFilter: setOfferFilter, removeFilter: removeOfferFilter, optionMap: offerOptionMap } = useColumnFilter(lateStageEnrichedData['Offer'], LATE_STAGE_FILTER_KEYS)

  const lateStageFilterProps = {
    'Offer': { filteredData: filteredOfferData, filters: offerFilters, setFilter: setOfferFilter, removeFilter: removeOfferFilter, optionMap: { ...offerOptionMap, stageStatus: OFFER_DECISION_OPTIONS } },
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

  const shortlistEligibleMutation = useMutation({
    mutationFn: async (rows) => {
      for (const r of rows) {
        await decideStage({ candidateId: r.id, eventId: Number(id), stageName: 'Resume', status: 'SHORTLISTED', ensureStarted: true })
      }
      return rows.length
    },
    onSuccess: (n) => message.success(`Shortlisted ${n} eligible candidate${n === 1 ? '' : 's'} at Resume`),
    onError: (err) => message.error(getErrorMessage(err)),
    // Some may have gone through before one failed.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['eventStageSummary', id] }),
  })

  const dummyCandidatesMutation = useMutation({
    mutationFn: () => addDummyCandidates(id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['eventCandidates', id] })
      queryClient.invalidateQueries({ queryKey: ['eventStageSummary', id] })
      queryClient.invalidateQueries({ queryKey: ['roundProgress', id] })
      message.success(res.data.message)
    },
    onError: (err) => message.error(getErrorMessage(err)),
  })

  const generateGroupsMutation = useMutation({
    mutationFn: () => generateGroups(id, selectedGdRoundId, { strategy: groupStrategy, count: groupCount, maxSize: groupMaxSize }),
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

  const interviewerMutation = useMutation({
    mutationFn: ({ roundId, interviewer, groupId }) => setRoundInterviewer(id, roundId, { interviewer, groupId }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['eventRoundResults', id] })
      message.success(res.data.message)
    },
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

  const trackMutation = useMutation({
    mutationFn: ({ candidateId, roundId, tracks }) => pickRoundTracks(candidateId, Number(id), roundId, tracks),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roundProgress', id] })
      queryClient.invalidateQueries({ queryKey: ['eventStageSummary', id] })
      message.success('Track saved')
    },
    onError: (err) => message.error(getErrorMessage(err)),
  })

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
  const linkExpiry = pickedLinkExpiry ?? defaultLinkExpiry(event.startDate)
  const eventTitle = `${event.college?.name ?? 'Event'} ${event.recruitmentYear ?? ''}`.trim()
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
    const { shown: offerColumns, picker: offerColumnPicker } = columnsFor(`stage:${stageName}`, [
      {
        key: 'decision',
        title: 'Offer Status',
        exportValue: (r) => labelFor(OFFER_DECISION_OPTIONS, summaryMap[r.id]?.status),
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
            options={OFFER_DECISION_OPTIONS}
          />
        ),
      },
      fitScoreColumn,
      col.name, col.rollNo, col.email, col.phone, col.branch, col.batch, col.tenthMark, col.twelfthMark, col.diplomaMark, col.ugCgpa, col.pgCgpa, col.keamRank, col.preferences, col.activeBacklogs, col.backlogs, col.resume,
      // Shown once the offers are in, so a pick never saves over details not yet loaded.
      ...(eventOffers ? [{
        key: 'offered',
        title: 'Offered position',
        exportValue: (r) => offeredLabel(eventOffers[r.id]),
        render: (_, r) => (
          <OfferedPositionCell
            candidateId={r.id}
            eventId={Number(id)}
            offer={eventOffers[r.id]}
            eventPositions={eventPositions}
            preferences={r.preferences}
          />
        ),
      }, {
        key: 'response',
        title: 'Offer Response',
        exportValue: (r) => (summaryMap[r.id]?.status === 'SHORTLISTED' ? offerResponse(eventOffers[r.id]?.status).label : null),
        // Only an offer actually made (Shortlisted) can be accepted or rejected.
        render: (_, r) => (summaryMap[r.id]?.status === 'SHORTLISTED'
          ? <OfferResponseCell candidateId={r.id} eventId={Number(id)} offer={eventOffers[r.id]} />
          : '—'),
      }] : []),
      col.details,
    ], ['decision', 'response', 'fitScore', 'name', 'rollNo', 'branch', 'offered'])
    return (
      <>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
          {offerColumnPicker}
          <DownloadOfferStatus
            disabled={filteredData.length === 0}
            fileName={`${eventTitle} - Offer Status.xlsx`}
            request={() => exportOfferStatus(id, filteredData.map((r) => r.id))}
          />
        </div>
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
          columns={offerColumns}
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
    {
      key: 'screening',
      label: (
        <span>
          <FilterOutlined style={{ marginRight: 4 }} />
          Screening
        </span>
      ),
      children: <ScreeningSettings eventId={id} screening={event?.screening} applications={candidates} rounds={roundGraph?.rounds ?? []} />,
    },
  ]

  // The selected Group Discussion round's groups: generate them by a strategy, rename, move people.
  const strategy = GROUP_STRATEGIES.find((st) => st.value === groupStrategy)
  const groupSizing = strategy.bySize ? groupMaxSize : groupCount
  const canGenerate = !!groupSizing && gdEligible.length > 0
  const groupsContent = (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 6 }}>
        <Select
          value={groupStrategy}
          onChange={setGroupStrategy}
          options={GROUP_STRATEGIES.map(({ value, label }) => ({ value, label }))}
          style={{ width: 210 }}
        />
        {strategy.bySize ? (
          <InputNumber
            min={1}
            precision={0}
            placeholder="Max per group"
            value={groupMaxSize}
            onChange={setGroupMaxSize}
            style={{ width: 160 }}
          />
        ) : (
          <InputNumber
            min={1}
            precision={0}
            max={gdEligible.length || undefined}
            placeholder="Number of groups"
            value={groupCount}
            onChange={setGroupCount}
            style={{ width: 160 }}
          />
        )}
        {(groups?.length ?? 0) > 0 ? (
          <Popconfirm
            title="Regenerate groups?"
            description="This deletes the current groups and makes new ones."
            onConfirm={() => generateGroupsMutation.mutate()}
            okText="Regenerate"
            cancelText="Cancel"
            okButtonProps={{ danger: true }}
            disabled={!canGenerate}
          >
            <Button type="primary" loading={generateGroupsMutation.isPending} disabled={!canGenerate}>
              Regenerate Groups
            </Button>
          </Popconfirm>
        ) : (
          <Button
            type="primary"
            onClick={() => generateGroupsMutation.mutate()}
            loading={generateGroupsMutation.isPending}
            disabled={!canGenerate}
          >
            Generate Groups
          </Button>
        )}
      </div>
      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 20 }}>
        {strategy.hint}
        {gdEligible.length > 0 && ` ${gdEligible.length} candidate${gdEligible.length === 1 ? '' : 's'} in ${gdRound?.name}.`}
      </Text>
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
                title={<Text strong style={{ whiteSpace: 'normal' }}>Group {g.name}</Text>}
                extra={
                  <Button
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => {
                      // A group whose members have different interviewers starts blank and is left alone unless one is typed.
                      const interviewer = groupInterviewer(g)
                      const shown = interviewer === MIXED ? '' : (interviewer ?? '')
                      setEditingGroup({ ...g, shownInterviewer: shown })
                      groupForm.setFieldsValue({ name: g.name, topic: g.topic ?? '', interviewer: shown })
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
                <div style={{ marginBottom: 10 }}>
                  <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>
                    INTERVIEWER
                  </Text>
                  {(() => {
                    const interviewer = groupInterviewer(g)
                    return interviewer === MIXED
                      ? <Text type="secondary" italic style={{ fontSize: 13 }}>Different interviewers</Text>
                      : interviewer
                        ? <Text>{interviewer}</Text>
                        : <Text type="secondary" italic style={{ fontSize: 13 }}>Not set</Text>
                  })()}
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
                              // Just the letter in the row; the list shows full names like "B · Developer (FTE)".
                              labelRender={({ label }) => String(label).split(' · ')[0]}
                              popupMatchSelectWidth={false}
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

    const earlierRounds = roundsBefore(roundGraph, String(round.id))
    // Fit score here counts this round and every round leading into it; best fit first.
    const scoredRounds = [...earlierRounds.map((r) => r.id), round.id]
    const displayCandidates = candidatesReachingRound(filteredShortlisted, round)
      .filter((c) => roundStatusFilter.length === 0 || roundStatusFilter.includes(roundStatusByCandidate[c.id]?.[round.id]))
      .map((c) => ({ ...c, fitScore: fitScoreUpTo(c, scoredRounds) }))
      .sort(byFitScore)

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

    // A split for someone here: they applied for more than one of the tracks it leads into.
    const splitsHere = displayCandidates.some((c) => tracksByCandidate[c.id]?.[round.id])
    const pairByKey = Object.fromEntries((roundGraph?.pairs ?? []).map((p) => [p.key, p]))
    const colorOf = pairColors(roundGraph?.pairs ?? [])
    const trackLabel = (key) => (pairByKey[key] ? pairLabel(pairByKey[key]) : key)

    const allRoundColumns = [
      {
        key: 'result',
        title: 'Round Decision',
        exportValue: (r) => labelFor(ROUND_RESULT_OPTIONS, roundResultMap[round.id]?.[r.id]?.result) ?? 'Pending',
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
      ...(splitsHere ? [{
        key: 'track',
        title: 'Next tracks',
        exportValue: (r) => {
          const t = tracksByCandidate[r.id]?.[round.id]
          return t ? t.tracks.map(trackLabel).join(' + ') + (t.picked ? '' : ' (top preference)') : null
        },
        render: (_, r) => {
          const t = tracksByCandidate[r.id]?.[round.id]
          if (!t) return '—'
          return (
            <Space size={4}>
              {/* One or several tracks; clearing them all goes back to the top preference. */}
              <Select
                mode="multiple"
                size="small"
                style={{ minWidth: 210 }}
                value={t.tracks}
                allowClear={t.picked}
                loading={trackMutation.isPending && trackMutation.variables?.candidateId === r.id}
                options={t.options.map((k) => ({ value: k, label: <span style={{ color: colorOf[k] }}>{trackLabel(k)}</span> }))}
                onChange={(tracks) => trackMutation.mutate({ candidateId: r.id, roundId: round.id, tracks })}
              />
              {!t.picked && <Text type="secondary" style={{ fontSize: 11 }}>top preference</Text>}
            </Space>
          )
        },
      }] : []),
      fitScoreColumn,
      col.name,
      col.rollNo,
      {
        key: 'score',
        title: `Score (out of ${round.maxScore ?? DEFAULT_MAX_SCORE})`,
        exportValue: (r) => roundResultMap[round.id]?.[r.id]?.score,
        render: (_, r) => {
          if (isEditing) return (
            <InputNumber
              size="small"
              style={{ width: 80 }}
              min={0}
              max={round.maxScore ?? DEFAULT_MAX_SCORE}
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
      ...earlierRounds.map((prev) => ({
        key: `score:${prev.key}`,
        title: `${prev.name} score (out of ${prev.maxScore ?? DEFAULT_MAX_SCORE})`,
        exportValue: (r) => roundResultMap[prev.id]?.[r.id]?.score,
        render: (_, r) => roundResultMap[prev.id]?.[r.id]?.score ?? '—',
      })),
      {
        key: 'interviewer',
        title: 'Interviewer',
        exportValue: (r) => roundResultMap[round.id]?.[r.id]?.interviewer,
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
      col.email, col.phone, col.branch, col.batch, col.tenthMark, col.twelfthMark, col.diplomaMark, col.ugCgpa, col.pgCgpa, col.keamRank, col.preferences, col.activeBacklogs, col.backlogs, col.resume, col.details,
      {
        key: 'comments',
        title: 'Comments',
        exportValue: (r) => roundResultMap[round.id]?.[r.id]?.comments,
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
        key: 'roundsDecision',
        title: 'Overall Rounds Decision',
        exportValue: (r) => labelFor(ROUND_DECISION_OPTIONS, roundsStageSummaryMap[r.id]?.status),
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
    const { shown: roundColumns, picker: roundColumnPicker } = columnsFor(
      `round:${round.id}`,
      allRoundColumns,
      ['result', 'track', 'fitScore', 'name', 'rollNo', 'score', ...earlierRounds.map((prev) => `score:${prev.key}`), 'interviewer'],
    )

    // A GD round shown as group cards downloads as one sheet, with each candidate's group first.
    const groupOf = Object.fromEntries((groups ?? []).flatMap((g) => g.members.map((m) => [m.id, g.name])))
    const byGroup = round.roundType === 'GROUP_DISCUSSION' && (groups ?? []).length > 0
    const roundExportColumns = byGroup
      ? [{ title: 'Group', exportValue: (r) => groupOf[r.id] ?? 'Unassigned' }, ...roundColumns]
      : roundColumns
    // A GD round's download keeps each group's candidates together (in group order, best fit first
    // within it; unassigned last) and merges the Group cell down them.
    const groupIndex = Object.fromEntries((groups ?? []).flatMap((g, i) => g.members.map((m) => [m.id, i])))
    const roundExportRows = byGroup
      ? [...displayCandidates].sort((a, b) => (groupIndex[a.id] ?? Infinity) - (groupIndex[b.id] ?? Infinity))
      : displayCandidates

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
        <Space wrap>
          {BULK_INTERVIEWER_TYPES.includes(round.roundType) && !isEditing && (() => {
            const reached = candidatesReachingRound(shortlistedCandidates, round).length
            return (
              <Space.Compact size="small">
                <Input
                  size="small"
                  placeholder="Interviewer"
                  value={bulkInterviewer}
                  onChange={(e) => setBulkInterviewer(e.target.value)}
                  style={{ width: 150 }}
                  aria-label={`Interviewer for everyone in ${round.name}`}
                />
                <Popconfirm
                  title={`Set the interviewer for all ${reached} candidate${reached === 1 ? '' : 's'} in ${round.name}?`}
                  description="Replaces any interviewer already set. Scores and results stay."
                  onConfirm={() => interviewerMutation.mutate(
                    { roundId: round.id, interviewer: bulkInterviewer },
                    { onSuccess: () => setBulkInterviewer('') },
                  )}
                  disabled={!bulkInterviewer.trim() || reached === 0}
                >
                  <Button size="small" disabled={!bulkInterviewer.trim() || reached === 0} loading={interviewerMutation.isPending}>
                    Set for all ({reached})
                  </Button>
                </Popconfirm>
              </Space.Compact>
            )
          })()}
          {roundColumnPicker}
          <DownloadExcel title={`${eventTitle} - ${round.name}`} columns={roundExportColumns} rows={roundExportRows} mergeColumns={byGroup ? [0] : undefined} />
          {isEditing ? (
            <>
              <Button size="small" onClick={() => { setEditingRoundId(null); setRoundTableEdits({}) }}>Cancel</Button>
              <Button size="small" type="primary" onClick={handleRoundSave} loading={eventRoundScoreMutation.isPending}>Save</Button>
            </>
          ) : (
            <Button size="small" icon={<EditOutlined />} onClick={initRoundEdit}>Edit Scores</Button>
          )}
        </Space>
      </div>
    )

    // GD round with assigned groups — render per-group cards
    if (round.roundType === 'GROUP_DISCUSSION' && (groups ?? []).length > 0) {
      const displayCandidateIds = new Set(displayCandidates.map((c) => c.id))
      const displayById = Object.fromEntries(displayCandidates.map((c) => [c.id, c]))
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
                ...(displayById[m.id] ?? candidateMap[m.id] ?? {}),
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

  const { shown: resumeColumns, picker: resumeColumnPicker } = columnsFor('stage:Resume', [
    {
      key: 'decision',
      title: 'Decision',
      exportValue: (r) => labelFor(RESUME_STATUS_OPTIONS, r.resumeStatus),
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
    fitScoreColumn,
    {
      key: 'eligibility',
      title: 'Eligibility',
      exportValue: (r) => (r.eligible ? 'Eligible' : `Ineligible: ${r.ineligibleReasons.join('; ')}`),
      render: (_, r) => (r.eligible
        ? <Tag color="green">Eligible</Tag>
        : <Tooltip title={r.ineligibleReasons.join(', ')}><Tag color="red">Ineligible</Tag></Tooltip>),
    },
    col.name, col.rollNo, col.email, col.phone, col.branch, col.batch, col.tenthMark, col.twelfthMark, col.diplomaMark, col.ugCgpa, col.pgCgpa, col.keamRank, col.preferences, col.activeBacklogs, col.backlogs, col.resume, col.details,
  ], ['decision', 'fitScore', 'eligibility', 'name', 'rollNo', 'branch', 'tenthMark', 'twelfthMark', 'ugCgpa', 'activeBacklogs', 'backlogs', 'resume'])
  const resumeRows = showIneligible ? filteredCandidates : filteredCandidates.filter((c) => c.eligible)

  const resumeContent = (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <Space style={{ marginRight: 'auto' }} wrap>
          <Switch size="small" checked={showIneligible} onChange={setShowIneligible} />
          <Text>Show ineligible ({ineligibleCount})</Text>
          <Popconfirm
            title={`Shortlist ${toShortlist.length} eligible candidate${toShortlist.length === 1 ? '' : 's'} with no decision yet?`}
            description="They move on to Rounds."
            onConfirm={() => shortlistEligibleMutation.mutate(toShortlist)}
            okText="Shortlist"
            disabled={toShortlist.length === 0}
          >
            <Button size="small" type="primary" disabled={toShortlist.length === 0} loading={shortlistEligibleMutation.isPending}>
              Shortlist eligible ({toShortlist.length})
            </Button>
          </Popconfirm>
        </Space>
        {resumeColumnPicker}
        <DownloadExcel title={`${eventTitle} - Resume`} columns={resumeColumns} rows={resumeRows} />
        {/* Testing tool: only for users whose role can use testing tools (the "Testing" role). */}
        {user?.canUseTestTools && (
          <Button icon={<UsergroupAddOutlined />} loading={dummyCandidatesMutation.isPending} onClick={() => dummyCandidatesMutation.mutate()}>
            Add 100 Dummy Candidates
          </Button>
        )}
        <Button icon={<UserAddOutlined />} onClick={() => addCandidate(id)}>
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
        dataSource={resumeRows}
        loading={candidatesLoading}
        rowKey="id"
        size="small"
        pagination={{ pageSize: 10 }}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: 'No candidates have applied yet' }}
        columns={resumeColumns}
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
              <Descriptions.Item label="Start Date">{formatDate(event.startDate)}</Descriptions.Item>
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
                  format={DATE_FORMAT}
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
                  <Text type="secondary" style={{ fontSize: 12 }}>Valid through {link.until.format(DATE_FORMAT)}</Text>
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


      {candidateModals}

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
          onFinish={({ interviewer, ...data }) => {
            if ((interviewer ?? '') !== editingGroup.shownInterviewer) {
              interviewerMutation.mutate({ roundId: selectedGdRoundId, interviewer, groupId: editingGroup.id })
            }
            updateGroupMutation.mutate({ groupId: editingGroup.id, data })
          }}
        >
          <Form.Item name="name" label="Group Name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="topic" label="Topic">
            <Input placeholder="e.g. The future of renewable energy" />
          </Form.Item>
          <Form.Item name="interviewer" label="Interviewer" extra="Set for every member of this group in this round.">
            <Input placeholder="e.g. Priya Nair" />
          </Form.Item>
        </Form>
      </Modal>


    </div>
  )
}
