import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  BookOutlined,
  CloseOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  FileTextOutlined,
  LinkOutlined,
  GithubOutlined,
  LinkedinOutlined,
  MailOutlined,
  PhoneOutlined,
  PlusOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Radio,
  Row,
  Select,
  Space,
  Statistic,
  Steps,
  Table,
  Tabs,
  Tag,
  Timeline,
  Typography,
  Upload,
  message,
} from 'antd'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  addStageEntry,
  deleteCandidateDocument,
  getCandidate,
  getCandidateDocuments,
  getCandidateResume,
  getCandidateRoundResults,
  getResumeFile,
  getCandidateStageHistory,
  getOffer,
  getCandidateApplications,
  updateCandidateApplication,
  updateRoundResult,
  upsertOffer,
  uploadCandidateDocument,
} from '../api/candidates'
import { preferenceKey, preferenceLabel } from '../utils/preferences'
import { getEventPositions } from '../api/events'
import OfferPairSelect from '../components/OfferPairSelect'
import { OFFER_RESPONSES, offerResponse } from '../utils/offers'
import { getErrorMessage } from '../utils/errorUtils'
import { GUTTER, useLayoutMetrics } from '../theme'
import { PIPELINE_STAGES, useStageDecision } from '../hooks/useStageDecision'
import { SCORE_RULE } from '../components/validation/rules'

const { Title, Text } = Typography
const STATUS_COLOR = { SHORTLISTED: 'green', HOLD: 'orange', REJECTED: 'red' }

// The offer form selects one of the event's pairs; offers saved before types existed have no type.
const offeredPairKey = (offer) =>
  offer.offeredPosition && offer.offeredType ? `${offer.offeredPosition.id}:${offer.offeredType.id}` : undefined

export default function CandidateDetail() {
  const { id } = useParams()
  const { sectionGap } = useLayoutMetrics()
  const queryClient = useQueryClient()

  const [editingPrefs, setEditingPrefs] = useState(false)
  const [rankedPositions, setRankedPositions] = useState([])
  const [editingRound, setEditingRound] = useState(null)
  const [scoreForm] = Form.useForm()
  const [selectedEventId, setSelectedEventId] = useState(null)
  const [offerForm] = Form.useForm()
  const [editingOffer, setEditingOffer] = useState(false)
  const [docUploadOpen, setDocUploadOpen] = useState(false)
  const [docFile, setDocFile] = useState(null)
  const [docForm] = Form.useForm()
  const [viewingDoc, setViewingDoc] = useState(null)

  const movePosition = (index, dir) => {
    const next = index + dir
    if (next < 0 || next >= rankedPositions.length) return
    const updated = [...rankedPositions]
    ;[updated[index], updated[next]] = [updated[next], updated[index]]
    setRankedPositions(updated)
  }

  const { data: candidate, isLoading } = useQuery({
    queryKey: ['candidate', id],
    queryFn: () => getCandidate(id).then((r) => r.data.data),
  })
  const { data: resumeData } = useQuery({
    queryKey: ['resume', id],
    queryFn: () => getCandidateResume(id).then((r) => r.data.data),
  })

  // /resume/view requires a JWT, which a plain <iframe src>/<a href> can't send —
  // fetch the bytes through the authed axios instance and hand the iframe/download
  // button a blob: URL instead.
  const [resumeBlobUrl, setResumeBlobUrl] = useState(null)
  useEffect(() => {
    if (!resumeData || resumeData.sourceUrl) return
    let url
    getResumeFile(id).then((r) => {
      url = URL.createObjectURL(r.data)
      setResumeBlobUrl(url)
    })
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [id, resumeData])
  const { data: roundResults } = useQuery({
    queryKey: ['round-results', id],
    queryFn: () => getCandidateRoundResults(id).then((r) => r.data),
  })
  const { data: stageHistory } = useQuery({
    queryKey: ['stage-history', id],
    queryFn: () => getCandidateStageHistory(id).then((r) => r.data),
  })

  const { data: applications } = useQuery({
    queryKey: ['applications', id],
    queryFn: () => getCandidateApplications(id).then((r) => r.data.data),
  })

  const activeEventId = selectedEventId ?? stageHistory?.[0]?.eventId ?? applications?.[0]?.eventId
  // What they submitted for the selected event; the profile is the fallback when there's no application.
  const selectedApplication = applications?.find((a) => a.eventId === activeEventId)

  const { data: activeEventPositions } = useQuery({
    queryKey: ['eventPositions', String(activeEventId)],
    queryFn: () => getEventPositions(activeEventId).then((r) => r.data.data),
    enabled: !!activeEventId,
  })

  const { data: offerData } = useQuery({
    queryKey: ['offer', id, activeEventId],
    queryFn: () =>
      activeEventId
        ? getOffer(id, activeEventId).then((r) => r.data.data)
        : null,
    enabled: !!activeEventId,
  })

  const { data: documents, isLoading: docsLoading } = useQuery({
    queryKey: ['documents', id],
    queryFn: () => getCandidateDocuments(id).then((r) => r.data.data),
  })

  const prefMutation = useMutation({
    mutationFn: (preferences) => updateCandidateApplication(id, selectedApplication.eventId, { ...selectedApplication, preferences }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications', id] })
      queryClient.invalidateQueries({ queryKey: ['candidate', id] })
      setEditingPrefs(false)
      message.success('Preferences updated!')
    },
    onError: (err) => message.error(getErrorMessage(err)),
  })

  const roundMutation = useMutation({
    mutationFn: ({ eventId, roundId, ...data }) => updateRoundResult(id, eventId, roundId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['round-results', id] })
      // The backend moves the Rounds stage to match.
      queryClient.invalidateQueries({ queryKey: ['stage-history', id] })
      setEditingRound(null)
      scoreForm.resetFields()
      message.success('Score saved!')
    },
    onError: (err) => message.error(getErrorMessage(err)),
  })

  const stageMutation = useMutation({
    mutationFn: ({ eventId, stageName }) => addStageEntry(id, eventId, { stageName }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stage-history', id] }),
    onError: (err) => message.error(getErrorMessage(err)),
  })

  const statusMutation = useStageDecision({
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stage-history', id] }),
    onError: (err) => message.error(getErrorMessage(err)),
  })

  const offerMutation = useMutation({
    mutationFn: (data) => upsertOffer(id, activeEventId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offer', id, activeEventId] })
      setEditingOffer(false)
      message.success('Offer saved!')
    },
    onError: (err) => message.error(getErrorMessage(err)),
  })

  const uploadDocMutation = useMutation({
    mutationFn: ({ file, documentType, description }) =>
      uploadCandidateDocument(id, file, documentType, description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', id] })
      setDocUploadOpen(false)
      setDocFile(null)
      docForm.resetFields()
      message.success('Document uploaded!')
    },
    onError: (err) => message.error(getErrorMessage(err)),
  })

  const deleteDocMutation = useMutation({
    mutationFn: (documentId) => deleteCandidateDocument(id, documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', id] })
      message.success('Document deleted')
    },
    onError: (err) => message.error(getErrorMessage(err)),
  })

  const openEditPrefs = () => {
    setRankedPositions(selectedApplication?.preferences ?? [])
    setEditingPrefs(true)
  }

  const savePrefs = () => {
    prefMutation.mutate(rankedPositions.map((p) => ({ positionId: p.position.id, typeId: p.type.id })))
  }

  const openEditRound = (eventId, round) => {
    setEditingRound({ eventId, roundId: round.roundId, roundName: round.roundName })
    scoreForm.setFieldsValue({
      score: round.score,
      result: round.result,
      interviewer: round.interviewer,
      comments: round.comments,
    })
  }

  if (isLoading) return <Card loading style={{ borderRadius: 12 }} />
  if (!candidate) return <Empty />

  const selectedEvent = stageHistory?.find((e) => e.eventId === selectedEventId) ?? stageHistory?.[0]

  const shown = selectedApplication ?? candidate

  const getStageData = (stageName) => {
    if (!selectedEvent) return null
    if (selectedEvent.currentStage?.stageName === stageName)
      return { status: selectedEvent.currentStage.status, isCurrent: true }
    const hist = selectedEvent.history?.find((h) => h.stageName === stageName)
    return hist ? { status: hist.status, isCurrent: false } : null
  }

  const currentStageIdx = PIPELINE_STAGES.indexOf(selectedEvent?.currentStage?.stageName)

  const firstRejectedIdx = PIPELINE_STAGES.findIndex((name) => getStageData(name)?.status === 'REJECTED')
  const shouldShowStage = (stageName) => {
    if (!getStageData(stageName)) return false
    if (firstRejectedIdx === -1) return true
    return PIPELINE_STAGES.indexOf(stageName) <= firstRejectedIdx
  }

  const tabLabel = (stageName, icon = null) => {
    const d = getStageData(stageName)
    return (
      <span>
        {icon}
        {stageName}
        {d?.status && (
          <Tag
            color={STATUS_COLOR[d.status]}
            style={{ marginLeft: 6, fontSize: 10, padding: '0 4px', lineHeight: '16px' }}
          >
            {d.status.charAt(0)}
          </Tag>
        )}
      </span>
    )
  }

  const stageDecision = (stageName) => {
    if (!selectedEvent) return null

    if (!selectedEvent.currentStage && stageName === 'Resume') {
      return (
        <div
          style={{
            marginTop: 20,
            padding: 16,
            background: '#f0f9ff',
            borderRadius: 8,
            border: '1px solid #bae6fd',
          }}
        >
          <Button
            type="primary"
            size="small"
            loading={stageMutation.isPending}
            onClick={() => stageMutation.mutate({ eventId: selectedEvent.eventId, stageName: 'Resume' })}
          >
            Begin Resume Review
          </Button>
        </div>
      )
    }

    const d = getStageData(stageName)
    if (!d) return null

    return (
      <div
        style={{
          marginTop: 20,
          padding: 16,
          background: '#f9fafb',
          borderRadius: 8,
          border: '1px solid #e5e7eb',
        }}
      >
        <Space wrap>
          <Text style={{ fontSize: 13, color: '#6b7280' }}>Decision:</Text>
          <Radio.Group
            value={d.status}
            buttonStyle="solid"
            size="small"
            disabled={statusMutation.isPending}
            onChange={(e) =>
              statusMutation.mutate({ candidateId: id, eventId: selectedEvent.eventId, stageName, status: e.target.value })
            }
          >
            <Radio.Button value="SHORTLISTED">Shortlisted</Radio.Button>
            <Radio.Button value="HOLD">{stageName === 'Offer' ? 'WaitList' : 'Hold'}</Radio.Button>
            <Radio.Button value="REJECTED">Rejected</Radio.Button>
          </Radio.Group>
        </Space>
      </div>
    )
  }

  // ── Rounds tab ──
  const eventRounds = roundResults?.find((e) => e.eventId === selectedEvent?.eventId)
  // In graph order; rounds on another position's track don't apply to this candidate.
  const sortedRounds = (eventRounds?.rounds ?? [])
    .filter((r) => r.status !== 'NOT_APPLICABLE')
    .sort((a, b) => a.order - b.order)

  const roundsContent =
    sortedRounds.length > 0 ? (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {sortedRounds.map((round) => {
          // LOCKED: no round leading here has been passed yet (decided by the backend's round graph).
          const locked = round.status === 'LOCKED'
          const isPending = round.result == null
          const resultColor = round.result === 'PASS' ? 'green' : round.result === 'FAIL' ? 'red' : 'orange'

          if (locked) {
            return (
              <Card
                key={round.roundId}
                size="small"
                style={{
                  borderRadius: 10,
                  border: '1.5px solid #e5e7eb',
                  background: '#f9fafb',
                  opacity: 0.5,
                }}
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Tag style={{ fontWeight: 700, minWidth: 28, textAlign: 'center' }}>#{round.order}</Tag>
                    <span style={{ fontWeight: 600, fontSize: 14, color: '#9ca3af' }}>{round.roundName}</span>
                    {round.roundType && <Tag>{round.roundType}</Tag>}
                    <Tag>Locked</Tag>
                  </div>
                }
              />
            )
          }

          return (
            <Card
              key={round.roundId}
              size="small"
              style={{
                borderRadius: 10,
                border: `1.5px solid ${
                  isPending ? '#e5e7eb' : round.result === 'PASS' ? '#bbf7d0' : round.result === 'FAIL' ? '#fecaca' : '#fed7aa'
                }`,
                background: isPending
                  ? '#fff'
                  : round.result === 'PASS'
                  ? '#f0fdf4'
                  : round.result === 'FAIL'
                  ? '#fff1f2'
                  : '#fff7ed',
              }}
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Tag style={{ fontWeight: 700, minWidth: 28, textAlign: 'center' }}>#{round.order}</Tag>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{round.roundName}</span>
                  {round.roundType && <Tag color="blue">{round.roundType}</Tag>}
                  {round.result ? <Tag color={resultColor}>{round.result}</Tag> : <Tag>Pending</Tag>}
                </div>
              }
              extra={
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => openEditRound(selectedEvent?.eventId, round)}
                >
                  {round.score == null && round.result == null ? 'Enter Score' : 'Edit'}
                </Button>
              }
            >
              <Row gutter={[16, 8]}>
                <Col xs={12} sm={6}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Score
                  </Text>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{round.score ?? '—'}</div>
                </Col>
                <Col xs={12} sm={6}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Interviewer
                  </Text>
                  <div style={{ fontWeight: 500 }}>{round.interviewer ?? '—'}</div>
                </Col>
                <Col xs={12} sm={6}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Date
                  </Text>
                  <div>{round.evaluatedAt ? new Date(round.evaluatedAt).toLocaleDateString() : '—'}</div>
                </Col>
                {round.comments && (
                  <Col xs={24}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Comments
                    </Text>
                    <div style={{ fontSize: 13, color: '#374151' }}>{round.comments}</div>
                  </Col>
                )}
              </Row>
            </Card>
          )
        })}
      </div>
    ) : (
      <Empty description="No round data yet" />
    )

  // ── Static info tabs ──
  const staticTabs = [
    {
      key: 'personal',
      label: 'Personal Info',
      children: (
        <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
          <Descriptions.Item label="Full Name">{candidate.name}</Descriptions.Item>
          <Descriptions.Item label="Email">{candidate.email}</Descriptions.Item>
          <Descriptions.Item label="Recruitment data consent">
            {selectedApplication?.consentedAt
              ? `Given ${new Date(selectedApplication.consentedAt).toLocaleString()}`
              : 'Not recorded'}
          </Descriptions.Item>
          <Descriptions.Item label="Phone">{candidate.phone}</Descriptions.Item>
          <Descriptions.Item label="Roll No">{shown.rollNo}</Descriptions.Item>
          <Descriptions.Item label="Branch">{shown.branch}</Descriptions.Item>
          <Descriptions.Item label="College">{candidate.college?.name ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Job Location">{shown.jobLocation}</Descriptions.Item>
          <Descriptions.Item label="GitHub">{candidate.githubLink ? <a href={candidate.githubLink} target="_blank" rel="noreferrer">{candidate.githubLink}</a> : '—'}</Descriptions.Item>
          <Descriptions.Item label="LinkedIn">{candidate.linkedInLink ? <a href={candidate.linkedInLink} target="_blank" rel="noreferrer">{candidate.linkedInLink}</a> : '—'}</Descriptions.Item>
          <Descriptions.Item label="Internship Availability">{shown.internshipAvailability}</Descriptions.Item>
          <Descriptions.Item label="Leadership Positions" span={2}>{shown.leadershipPositions}</Descriptions.Item>
        </Descriptions>
      ),
    },
    {
      key: 'academic',
      label: 'Academic',
      children: (
        <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
          <Descriptions.Item label="Year of Graduation">{shown.graduationYear ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="10th Mark %">{shown.tenthMark}</Descriptions.Item>
          <Descriptions.Item label="12th Mark %">{shown.twelfthMark}</Descriptions.Item>
          <Descriptions.Item label="Diploma Mark %">{shown.diplomaMark ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="KEAM Rank">{shown.keamRank ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="UG Degree">{shown.ugDegree}</Descriptions.Item>
          <Descriptions.Item label="UG CGPA">{shown.ugCgpa}</Descriptions.Item>
          <Descriptions.Item label="PG Degree">{shown.pgDegree ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="PG CGPA">{shown.pgCgpa ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Total Backlogs">
            <Tag color={shown.backlogs === 0 ? 'green' : 'red'}>{shown.backlogs}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Active Backlogs">
            <Tag color={shown.arrears === 0 ? 'green' : 'red'}>{shown.arrears}</Tag>
          </Descriptions.Item>
        </Descriptions>
      ),
    },
    {
      key: 'preferences',
      label: 'Preferences',
      children: editingPrefs ? (
        <div style={{ maxWidth: 480 }}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>
            Use arrows to reorder — top position is most preferred. Remove any the candidate no longer wants.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {rankedPositions.map((pref, index) => (
              <div
                key={preferenceKey(pref)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 12px',
                  border: '1.5px solid #e5e7eb',
                  borderRadius: 8,
                  background: '#fff',
                }}
              >
                <Tag style={{ fontWeight: 600, minWidth: 28, textAlign: 'center', flexShrink: 0 }}>{index + 1}</Tag>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#1e1b4b', flex: 1 }}>{preferenceLabel(pref)}</span>
                <Space size={4}>
                  <Button
                    size="small"
                    icon={<ArrowUpOutlined />}
                    disabled={index === 0}
                    onClick={() => movePosition(index, -1)}
                  />
                  <Button
                    size="small"
                    icon={<ArrowDownOutlined />}
                    disabled={index === rankedPositions.length - 1}
                    onClick={() => movePosition(index, 1)}
                  />
                  <Button
                    size="small"
                    icon={<CloseOutlined />}
                    aria-label="Remove preference"
                    onClick={() => setRankedPositions(rankedPositions.filter((_, i) => i !== index))}
                  />
                </Space>
              </div>
            ))}
          </div>
          <Space>
            <Button type="primary" onClick={savePrefs} loading={prefMutation.isPending}>
              Save
            </Button>
            <Button onClick={() => setEditingPrefs(false)}>Cancel</Button>
          </Space>
        </div>
      ) : (() => {
        const preferred = selectedApplication?.preferences ?? []
        return preferred.length > 0 ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <Button size="small" icon={<EditOutlined />} onClick={openEditPrefs}>
                Edit
              </Button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {preferred.map((pref, index) => (
                <div
                  key={preferenceKey(pref)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    background: '#fafafa',
                  }}
                >
                  <Tag style={{ fontWeight: 600, minWidth: 28, textAlign: 'center', flexShrink: 0 }}>{index + 1}</Tag>
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#1e1b4b' }}>{preferenceLabel(pref)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <Empty description="No application for the selected event" />
        )
      })(),
    },
  ]

  // ── Pipeline tabs ──
  const pipelineTabs = []

  pipelineTabs.push({
    key: 'Resume',
    label: tabLabel('Resume'),
    children: (
      <div>
        {resumeData?.sourceUrl ? (() => {
          // Imported resumes are links, not files. Google Drive renders inline via /preview.
          const driveId = resumeData.sourceUrl.match(/(?:\/d\/|[?&]id=)([\w-]+)/)?.[1]
          return (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, padding: '4px 0' }}>
                <Space>
                  <LinkOutlined style={{ color: '#4f46e5', fontSize: 16 }} />
                  <Text strong>External resume link</Text>
                  <Text type="secondary" style={{ fontSize: 12, wordBreak: 'break-all' }}>{resumeData.sourceUrl}</Text>
                </Space>
                <Button size="small" icon={<LinkOutlined />} href={resumeData.sourceUrl} target="_blank" rel="noreferrer">
                  Open
                </Button>
              </div>
              {driveId ? (
                <iframe
                  src={`https://drive.google.com/file/d/${driveId}/preview`}
                  style={{ width: '100%', height: 640, border: '1px solid #e5e7eb', borderRadius: 8 }}
                  title="Resume"
                />
              ) : (
                <div style={{ textAlign: 'center', padding: 40, background: '#f9fafb', borderRadius: 8, border: '1px dashed #e5e7eb' }}>
                  <FileTextOutlined style={{ fontSize: 40, color: '#9ca3af', marginBottom: 12 }} />
                  <div style={{ color: '#6b7280', marginBottom: 16 }}>
                    This resume lives outside the system and can&apos;t be previewed here.
                  </div>
                  <Button type="primary" icon={<LinkOutlined />} href={resumeData.sourceUrl} target="_blank" rel="noreferrer">
                    Open Resume
                  </Button>
                </div>
              )}
            </div>
          )
        })() : resumeData ? (() => {
          const isPdf = resumeData.fileName?.toLowerCase().endsWith('.pdf')
          return (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, padding: '4px 0' }}>
                <Space>
                  <FileTextOutlined style={{ color: '#4f46e5', fontSize: 16 }} />
                  <Text strong>{resumeData.fileName}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Uploaded: {resumeData.uploadedAt ? new Date(resumeData.uploadedAt).toLocaleDateString() : '—'}
                  </Text>
                </Space>
                <Button size="small" icon={<DownloadOutlined />} href={resumeBlobUrl} download={resumeData.fileName} disabled={!resumeBlobUrl}>
                  Download
                </Button>
              </div>
              {isPdf ? (
                <iframe
                  src={resumeBlobUrl}
                  style={{ width: '100%', height: 640, border: '1px solid #e5e7eb', borderRadius: 8 }}
                  title={resumeData.fileName}
                />
              ) : (
                <div style={{ textAlign: 'center', padding: 40, background: '#f9fafb', borderRadius: 8, border: '1px dashed #e5e7eb' }}>
                  <FileTextOutlined style={{ fontSize: 40, color: '#9ca3af', marginBottom: 12 }} />
                  <div style={{ color: '#6b7280', marginBottom: 16 }}>
                    Preview not available for this file type. Download to view.
                  </div>
                  <Button type="primary" icon={<DownloadOutlined />} href={resumeBlobUrl} download={resumeData.fileName} disabled={!resumeBlobUrl}>
                    Download Resume
                  </Button>
                </div>
              )}
            </div>
          )
        })() : (
          <Empty description="No resume uploaded" />
        )}
        {stageDecision('Resume')}
      </div>
    ),
  })

  if (shouldShowStage('Rounds')) {
    pipelineTabs.push({
      key: 'Rounds',
      label: tabLabel('Rounds'),
      children: (
        <div>
          {roundsContent}
          {stageDecision('Rounds')}
        </div>
      ),
    })
  }

  if (shouldShowStage('Offer')) {
    pipelineTabs.push({
      key: 'Offer',
      label: tabLabel('Offer'),
      children: (
        <div>
          {editingOffer || !offerData ? (
            <div style={{ maxWidth: 520 }}>
              <Form
                form={offerForm}
                layout="vertical"
                initialValues={
                  offerData
                    ? {
                        offerDate: offerData.offerDate ? dayjs(offerData.offerDate) : undefined,
                        location: offerData.location,
                        offeredPair: offeredPairKey(offerData),
                        status: offerData.status ?? '',
                      }
                    : { status: '' }
                }
                onFinish={({ offeredPair, ...values }) => {
                  const [offeredPositionId, offeredTypeId] = offeredPair ? offeredPair.split(':').map(Number) : [null, null]
                  offerMutation.mutate({
                    ...values,
                    offeredPositionId,
                    offeredTypeId,
                    offerDate: values.offerDate?.format('YYYY-MM-DD') ?? null,
                    status: values.status || null,
                  })
                }}
              >
                <Row gutter={GUTTER}>
                  <Col xs={24} sm={12}>
                    <Form.Item name="offerDate" label="Offer Date">
                      <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item name="location" label="Location">
                      <Select
                        placeholder="Select location"
                        allowClear
                        options={[
                          { value: 'Gurugram NCR', label: 'Gurugram NCR' },
                          { value: 'Coimbatore', label: 'Coimbatore' },
                          { value: 'Both', label: 'Both' },
                        ]}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item name="offeredPair" label="Offered Position">
                      <OfferPairSelect eventPositions={activeEventPositions} preferences={selectedApplication?.preferences} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item name="status" label="Offer Response">
                      <Select
                        // '' stands in for "no answer yet", which is stored as null.
                        options={[...OFFER_RESPONSES.map(({ value, label }) => ({ value, label })), { value: '', label: 'No Information' }]}
                      />
                    </Form.Item>
                  </Col>
                </Row>
                <Space>
                  <Button type="primary" htmlType="submit" loading={offerMutation.isPending}>
                    Save Offer
                  </Button>
                  {offerData && <Button onClick={() => setEditingOffer(false)}>Cancel</Button>}
                </Space>
              </Form>
            </div>
          ) : (
            <div>
              <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small" style={{ marginBottom: 16 }}>
                <Descriptions.Item label="Offer Date">
                  {offerData.offerDate ? new Date(offerData.offerDate).toLocaleDateString() : '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Location">
                  {offerData.location ? <Tag color="blue">{offerData.location}</Tag> : '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Offered Position">
                  {offerData.offeredPosition
                    ? `${offerData.offeredPosition.title}${offerData.offeredType ? ` — ${offerData.offeredType.name}` : ''}`
                    : '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Offer Response">
                  <Tag color={offerResponse(offerData.status).color}>{offerResponse(offerData.status).label}</Tag>
                </Descriptions.Item>
              </Descriptions>
              <Button
                icon={<EditOutlined />}
                onClick={() => {
                  offerForm.setFieldsValue({
                    offerDate: offerData.offerDate ? dayjs(offerData.offerDate) : undefined,
                    location: offerData.location,
                    offeredPair: offeredPairKey(offerData),
                    status: offerData.status ?? '',
                  })
                  setEditingOffer(true)
                }}
              >
                Edit
              </Button>
            </div>
          )}
          {stageDecision('Offer')}
        </div>
      ),
    })
  }

  for (const stageName of ['Joining']) {
    if (shouldShowStage(stageName)) {
      pipelineTabs.push({
        key: stageName,
        label: tabLabel(stageName),
        children: (
          <div>
            <Empty description={`No specific data for ${stageName} yet`} />
            {stageDecision(stageName)}
          </div>
        ),
      })
    }
  }

  // ── Stage history tab ──
  const allHistory =
    stageHistory?.flatMap((event) =>
      event.history.map((h) => ({
        ...h,
        collegeName: event.collegeName,
        recruitmentYear: event.recruitmentYear,
      }))
    ) ?? []

  const stageHistoryTab = {
    key: 'stage-history',
    label: 'Stage History',
    children:
      allHistory.length > 0 ? (
        <Timeline
          mode="left"
          items={allHistory.map((h) => ({
            label: h.changedAt ? new Date(h.changedAt).toLocaleString() : '—',
            color: STATUS_COLOR[h.status] ?? 'blue',
            children: (
              <Space size={4} wrap>
                <Text style={{ fontSize: 12, color: '#6b7280' }}>
                  {h.collegeName} {h.recruitmentYear}
                </Text>
                <Tag color="blue">{h.stageName}</Tag>
                {h.status && <Tag color={STATUS_COLOR[h.status]}>{h.status}</Tag>}
                {h.changedBy && <Text type="secondary">by {h.changedBy}</Text>}
              </Space>
            ),
          }))}
        />
      ) : (
        <Empty description="No stage history yet" />
      ),
  }

  // ── Profile info items ──
  const profileItems = [
    candidate.email && { icon: <MailOutlined />, value: candidate.email },
    candidate.phone && { icon: <PhoneOutlined />, value: candidate.phone },
    shown.branch && { icon: <BookOutlined />, value: shown.branch },
    shown.rollNo && { icon: <UserOutlined />, value: `Roll No: ${shown.rollNo}` },
    shown.graduationYear && { icon: <BookOutlined />, value: `Batch of ${shown.graduationYear}` },
    candidate.githubLink && {
      icon: <GithubOutlined />,
      value: (
        <a href={candidate.githubLink} target="_blank" rel="noreferrer">
          GitHub
        </a>
      ),
    },
    candidate.linkedInLink && {
      icon: <LinkedinOutlined />,
      value: (
        <a href={candidate.linkedInLink} target="_blank" rel="noreferrer">
          LinkedIn
        </a>
      ),
    },
  ].filter(Boolean)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: sectionGap }}>
      {/* ── Top grid ── */}
      <Row gutter={GUTTER} align="stretch">
        {/* Profile card */}
        <Col xs={24} md={8}>
          <Card bordered={false} style={{ borderRadius: 12, height: '100%' }}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                paddingBottom: 20,
                borderBottom: '1px solid #f0f0f0',
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 28,
                  color: 'white',
                  marginBottom: 12,
                  flexShrink: 0,
                }}
              >
                {candidate.name?.charAt(0).toUpperCase()}
              </div>
              <Title level={4} style={{ margin: 0, marginBottom: 2 }}>
                {candidate.name}
              </Title>
              <Text type="secondary" style={{ fontSize: 13 }}>
                {candidate.college?.name ?? '—'}
              </Text>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {profileItems.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: '#9ca3af', fontSize: 14, flexShrink: 0 }}>{item.icon}</span>
                  <Text style={{ fontSize: 13 }}>{item.value}</Text>
                </div>
              ))}
            </div>
          </Card>
        </Col>

        {/* Pipeline status card */}
        <Col xs={24} md={8}>
          <Card
            bordered={false}
            style={{ borderRadius: 12, height: '100%' }}
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <span>Pipeline Status</span>
                {stageHistory?.length > 1 && (
                  <Select
                    value={selectedEventId ?? stageHistory[0]?.eventId}
                    size="small"
                    style={{ minWidth: 160 }}
                    options={stageHistory.map((e) => ({
                      value: e.eventId,
                      label: `${e.collegeName} — ${e.recruitmentYear}`,
                    }))}
                    onChange={setSelectedEventId}
                  />
                )}
              </div>
            }
          >
            {selectedEvent ? (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Current Stage
                  </Text>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                    <Tag color="purple" style={{ fontSize: 13, padding: '3px 10px' }}>
                      {selectedEvent.currentStage?.stageName ?? 'Not started'}
                    </Tag>
                    {selectedEvent.currentStage?.status && (
                      <Tag color={STATUS_COLOR[selectedEvent.currentStage.status]}>
                        {selectedEvent.currentStage.status}
                      </Tag>
                    )}
                  </div>
                </div>
                <Steps
                  size="small"
                  direction="vertical"
                  style={{ fontSize: 12 }}
                  items={PIPELINE_STAGES.map((name, i) => ({
                    title: <span style={{ fontSize: 12 }}>{name}</span>,
                    status:
                      currentStageIdx < 0
                        ? 'wait'
                        : i < currentStageIdx
                        ? 'finish'
                        : i === currentStageIdx
                        ? 'process'
                        : 'wait',
                  }))}
                />
              </div>
            ) : (
              <Empty description="No active recruitment" imageStyle={{ height: 40 }} />
            )}
          </Card>
        </Col>

        {/* Academic snapshot card */}
        <Col xs={24} md={8}>
          <Card
            bordered={false}
            style={{ borderRadius: 12, height: '100%' }}
            title={selectedApplication
              ? `Academic Snapshot · ${selectedApplication.collegeName} ${selectedApplication.recruitmentYear}`
              : 'Academic Snapshot'}
          >
            <Row gutter={[16, 20]}>
              <Col span={12}>
                <Statistic
                  title="UG CGPA"
                  value={shown.ugCgpa ?? '—'}
                  valueStyle={{ fontSize: 22, color: '#4f46e5' }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="10th %"
                  value={shown.tenthMark ?? '—'}
                  valueStyle={{ fontSize: 22 }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="12th %"
                  value={shown.twelfthMark ?? '—'}
                  valueStyle={{ fontSize: 22 }}
                />
              </Col>
              <Col span={12}>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Backlogs
                  </Text>
                  <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <Tag color={shown.backlogs === 0 ? 'green' : 'red'} style={{ width: 'fit-content' }}>
                      {shown.backlogs ?? 0} Total
                    </Tag>
                    <Tag color={shown.arrears === 0 ? 'green' : 'orange'} style={{ width: 'fit-content' }}>
                      {shown.arrears ?? 0} Active
                    </Tag>
                  </div>
                </div>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {/* ── Candidate information section ── */}
      <Card
        bordered={false}
        style={{ borderRadius: 12 }}
        title={<Text strong style={{ fontSize: 15 }}>Candidate Information</Text>}
      >
        <Tabs items={staticTabs} />
      </Card>

      {/* ── Recruitment pipeline section ── */}
      <Card
        bordered={false}
        style={{ borderRadius: 12 }}
        title={<Text strong style={{ fontSize: 15 }}>Recruitment Pipeline</Text>}
      >
        <Tabs items={[...pipelineTabs, stageHistoryTab]} />
      </Card>

      {/* ── Documents section ── */}
      <Card
        bordered={false}
        style={{ borderRadius: 12 }}
        title={<Text strong style={{ fontSize: 15 }}>Documents</Text>}
        extra={
          <Button type="primary" icon={<PlusOutlined />} size="small" onClick={() => setDocUploadOpen(true)}>
            Upload
          </Button>
        }
      >
        <Table
          dataSource={documents ?? []}
          loading={docsLoading}
          rowKey="id"
          pagination={false}
          size="small"
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: 'No documents uploaded' }}
          columns={[
            {
              title: 'File Name',
              dataIndex: 'fileName',
              render: (name) => (
                <Space>
                  <FileTextOutlined style={{ color: '#4f46e5' }} />
                  <Text>{name}</Text>
                </Space>
              ),
            },
            { title: 'Type', dataIndex: 'documentType', render: (t) => t ? <Tag>{t}</Tag> : '—' },
            { title: 'Description', dataIndex: 'description', render: (d) => d || '—' },
            {
              title: 'Uploaded',
              dataIndex: 'uploadedAt',
              render: (d) => d ? new Date(d).toLocaleDateString() : '—',
            },
            {
              title: 'Actions',
              width: 120,
              render: (_, record) => {
                const base = `${import.meta.env.VITE_PUBLIC_API_URL}/api/v1/candidates/${id}/documents/${record.id}`
                const viewUrl = `${base}/view`
                const downloadUrl = `${base}/download`
                return (
                  <Space>
                    <Button
                      size="small"
                      icon={<EyeOutlined />}
                      onClick={() => setViewingDoc({ ...record, viewUrl, downloadUrl })}
                    />
                    <Button
                      size="small"
                      icon={<DownloadOutlined />}
                      href={downloadUrl}
                      target="_blank"
                    />
                    <Popconfirm
                      title="Delete this document?"
                      onConfirm={() => deleteDocMutation.mutate(record.id)}
                      okText="Yes"
                      cancelText="No"
                    >
                      <Button size="small" danger icon={<DeleteOutlined />} loading={deleteDocMutation.isPending} />
                    </Popconfirm>
                  </Space>
                )
              },
            },
          ]}
        />
      </Card>

      {/* ── Document preview modal ── */}
      <Modal
        title={
          <Space>
            <FileTextOutlined style={{ color: '#4f46e5' }} />
            <span>{viewingDoc?.fileName}</span>
            {viewingDoc?.documentType && <Tag>{viewingDoc.documentType}</Tag>}
          </Space>
        }
        open={!!viewingDoc}
        onCancel={() => setViewingDoc(null)}
        footer={
          <Space>
            <Button icon={<DownloadOutlined />} href={viewingDoc?.downloadUrl} target="_blank">
              Download
            </Button>
            <Button onClick={() => setViewingDoc(null)}>Close</Button>
          </Space>
        }
        width={860}
        styles={{ body: { padding: 0 } }}
      >
        {viewingDoc && (() => {
          const isPdf = viewingDoc.fileName?.toLowerCase().endsWith('.pdf')
          return isPdf ? (
            <iframe
              src={viewingDoc.viewUrl}
              style={{ width: '100%', height: 600, border: 'none', display: 'block' }}
              title={viewingDoc.fileName}
            />
          ) : (
            <div style={{ textAlign: 'center', padding: 48 }}>
              <FileTextOutlined style={{ fontSize: 48, color: '#9ca3af', marginBottom: 16 }} />
              <div style={{ color: '#6b7280', marginBottom: 20 }}>
                Preview is not available for this file type.
              </div>
              <Button type="primary" icon={<DownloadOutlined />} href={viewingDoc.downloadUrl} target="_blank">
                Download to view
              </Button>
            </div>
          )
        })()}
      </Modal>

      {/* ── Document upload modal ── */}
      <Modal
        title="Upload Document"
        open={docUploadOpen}
        onCancel={() => { setDocUploadOpen(false); setDocFile(null); docForm.resetFields() }}
        onOk={() =>
          docForm.validateFields().then((values) =>
            uploadDocMutation.mutate({ file: docFile, ...values })
          )
        }
        okText="Upload"
        okButtonProps={{ disabled: !docFile }}
        confirmLoading={uploadDocMutation.isPending}
      >
        <Form form={docForm} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item label="File">
            <Upload
              beforeUpload={(file) => { setDocFile(file); return false }}
              maxCount={1}
              onRemove={() => setDocFile(null)}
            >
              <Button icon={<PlusOutlined />}>Select File</Button>
            </Upload>
          </Form.Item>
          <Form.Item name="documentType" label="Document Type">
            <Select
              placeholder="Select type"
              allowClear
              options={[
                'Offer Letter',
                'Appointment Letter',
                'ID Proof',
                'Educational Certificate',
                'Experience Letter',
                'Other',
              ].map((v) => ({ value: v }))}
            />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Optional description" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Score entry modal ── */}
      <Modal
        title={editingRound ? `${editingRound.roundName} — Score` : ''}
        open={!!editingRound}
        onCancel={() => {
          setEditingRound(null)
          scoreForm.resetFields()
        }}
        onOk={() =>
          scoreForm.validateFields().then((values) => roundMutation.mutate({ ...editingRound, ...values }))
        }
        confirmLoading={roundMutation.isPending}
        okText="Save"
      >
        <Form form={scoreForm} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item
            name="score"
            label="Score"
            rules={[SCORE_RULE]}
          >
            <InputNumber style={{ width: '100%' }} min={0} max={100} step={0.5} />
          </Form.Item>
          <Form.Item name="result" label="Result" rules={[{ required: true, message: 'Select a result' }]}>
            <Select options={['PASS', 'FAIL', 'ON_HOLD'].map((v) => ({ value: v }))} />
          </Form.Item>
          <Form.Item name="interviewer" label="Interviewer">
            <Input />
          </Form.Item>
          <Form.Item name="comments" label="Comments">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
