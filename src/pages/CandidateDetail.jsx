import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  BookOutlined,
  DownloadOutlined,
  EditOutlined,
  FileTextOutlined,
  GithubOutlined,
  LogoutOutlined,
  MailOutlined,
  PhoneOutlined,
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
  Tabs,
  Tag,
  Timeline,
  Typography,
  message,
} from 'antd'
import dayjs from 'dayjs'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  addStageEntry,
  createExitRecord,
  deleteExitRecord,
  getCandidate,
  getCandidateEvent,
  getCandidateResume,
  getCandidateRoundResults,
  getCandidateStageHistory,
  getExitRecord,
  updateCandidate,
  updateExitRecord,
  updateRoundResult,
} from '../api/candidates'
import { getEventPositions } from '../api/events'
import { getErrorMessage } from '../utils/errorUtils'
import { PIPELINE_STAGES, useStageDecision } from '../hooks/useStageDecision'

const { Title, Text } = Typography
const STATUS_COLOR = { SHORTLISTED: 'green', HOLD: 'orange', REJECTED: 'red' }

export default function CandidateDetail() {
  const { id } = useParams()
  const queryClient = useQueryClient()

  const [editingPrefs, setEditingPrefs] = useState(false)
  const [rankedPositions, setRankedPositions] = useState([])
  const [editingRound, setEditingRound] = useState(null)
  const [scoreForm] = Form.useForm()
  const [selectedEventId, setSelectedEventId] = useState(null)
  const [exitForm] = Form.useForm()
  const [editingExit, setEditingExit] = useState(false)

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
  const { data: roundResults } = useQuery({
    queryKey: ['round-results', id],
    queryFn: () => getCandidateRoundResults(id).then((r) => r.data),
  })
  const { data: stageHistory } = useQuery({
    queryKey: ['stage-history', id],
    queryFn: () => getCandidateStageHistory(id).then((r) => r.data),
  })
  const { data: exitRecord, isLoading: exitLoading } = useQuery({
    queryKey: ['exit', id],
    queryFn: () =>
      getExitRecord(id)
        .then((r) => r.data.data)
        .catch((e) => (e.response?.status === 404 ? null : Promise.reject(e))),
  })

  const prefMutation = useMutation({
    mutationFn: (data) => updateCandidate(id, data),
    onSuccess: () => {
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

  const exitMutation = useMutation({
    mutationFn: (data) => (exitRecord ? updateExitRecord(id, data) : createExitRecord(id, data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exit', id] })
      setEditingExit(false)
      message.success(exitRecord ? 'Exit record updated!' : 'Exit record saved!')
    },
    onError: (err) => message.error(getErrorMessage(err)),
  })

  const deleteExitMutation = useMutation({
    mutationFn: () => deleteExitRecord(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exit', id] })
      message.success('Exit record removed')
    },
    onError: (err) => message.error(getErrorMessage(err)),
  })

  const openEditPrefs = async () => {
    const eventId = await getCandidateEvent(candidate.id)
      .then((r) => r.data.data?.id)
      .catch(() => null)
    const eventPositions = eventId ? await getEventPositions(eventId).then((r) => r.data.data) : []
    const preferred = candidate.preferredPositions ?? []
    const preferredIds = new Set(preferred.map((p) => p.id))
    setRankedPositions([...preferred, ...eventPositions.filter((p) => !preferredIds.has(p.id))])
    setEditingPrefs(true)
  }

  const savePrefs = () => {
    prefMutation.mutate({
      username: candidate.username,
      name: candidate.name,
      email: candidate.email,
      collegeId: candidate.college?.id,
      preferredPositionIds: rankedPositions.map((p) => p.id),
    })
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
            <Radio.Button value="HOLD">Hold</Radio.Button>
            <Radio.Button value="REJECTED">Rejected</Radio.Button>
          </Radio.Group>
        </Space>
      </div>
    )
  }

  // ── Rounds tab ──
  const eventRounds = roundResults?.find((e) => e.eventId === selectedEvent?.eventId)
  const sortedRounds = [...(eventRounds?.rounds ?? [])].sort((a, b) => a.sequence - b.sequence)

  const roundsContent =
    sortedRounds.length > 0 ? (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {sortedRounds.map((round, idx) => {
          const prevPassed = idx === 0 || sortedRounds[idx - 1]?.result === 'PASS'
          const isPending = round.result == null
          const resultColor = round.result === 'PASS' ? 'green' : round.result === 'FAIL' ? 'red' : 'orange'

          if (!prevPassed) {
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
                    <Tag style={{ fontWeight: 700, minWidth: 28, textAlign: 'center' }}>#{round.sequence}</Tag>
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
                  <Tag style={{ fontWeight: 700, minWidth: 28, textAlign: 'center' }}>#{round.sequence}</Tag>
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
          <Descriptions.Item label="Username">{candidate.username}</Descriptions.Item>
          <Descriptions.Item label="Email">{candidate.email}</Descriptions.Item>
          <Descriptions.Item label="Phone">{candidate.phone}</Descriptions.Item>
          <Descriptions.Item label="Roll No">{candidate.rollNo}</Descriptions.Item>
          <Descriptions.Item label="Branch">{candidate.branch}</Descriptions.Item>
          <Descriptions.Item label="College">{candidate.college?.name ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Job Location">{candidate.jobLocation}</Descriptions.Item>
          <Descriptions.Item label="GitHub">
            {candidate.githubLink ? (
              <a href={candidate.githubLink} target="_blank" rel="noreferrer">
                {candidate.githubLink}
              </a>
            ) : (
              '—'
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Internship Availability">
            {candidate.internshipAvailability}
          </Descriptions.Item>
          <Descriptions.Item label="Leadership Positions" span={2}>
            {candidate.leadershipPositions}
          </Descriptions.Item>
        </Descriptions>
      ),
    },
    {
      key: 'academic',
      label: 'Academic',
      children: (
        <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
          <Descriptions.Item label="10th Mark %">{candidate.tenthMark}</Descriptions.Item>
          <Descriptions.Item label="12th Mark %">{candidate.twelfthMark}</Descriptions.Item>
          <Descriptions.Item label="Diploma Mark %">{candidate.diplomaMark ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="KEAM Rank">{candidate.keamRank ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="UG Degree">{candidate.ugDegree}</Descriptions.Item>
          <Descriptions.Item label="UG CGPA">{candidate.ugCgpa}</Descriptions.Item>
          <Descriptions.Item label="PG Degree">{candidate.pgDegree ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="PG CGPA">{candidate.pgCgpa ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Total Backlogs">
            <Tag color={candidate.backlogs === 0 ? 'green' : 'red'}>{candidate.backlogs}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Active Backlogs">
            <Tag color={candidate.arrears === 0 ? 'green' : 'red'}>{candidate.arrears}</Tag>
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
            Use arrows to reorder — top position is most preferred.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {rankedPositions.map((pos, index) => (
              <div
                key={pos.id}
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
                <span style={{ fontSize: 13, fontWeight: 500, color: '#1e1b4b', flex: 1 }}>
                  {pos.title}
                  {pos.type && (
                    <span style={{ fontWeight: 400, color: '#6b7280', marginLeft: 6 }}>— {pos.type}</span>
                  )}
                </span>
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
        const preferred = candidate.preferredPositions ?? []
        return preferred.length > 0 ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <Button size="small" icon={<EditOutlined />} onClick={openEditPrefs}>
                Edit
              </Button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {preferred.map((pos, index) => (
                <div
                  key={pos.id}
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
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#1e1b4b' }}>
                    {pos.title}
                    {pos.type && (
                      <span style={{ fontWeight: 400, color: '#6b7280', marginLeft: 6 }}>— {pos.type}</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <Button size="small" icon={<EditOutlined />} onClick={openEditPrefs}>
              Edit
            </Button>
          </div>
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
        {resumeData ? (() => {
          const isPdf = resumeData.fileName?.toLowerCase().endsWith('.pdf')
          const baseResumeUrl = `${import.meta.env.VITE_PUBLIC_API_URL}/api/v1/candidates/${id}/resume`
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
                <Button size="small" icon={<DownloadOutlined />} href={`${baseResumeUrl}/download`} target="_blank">
                  Download
                </Button>
              </div>
              {isPdf ? (
                <iframe
                  src={`${baseResumeUrl}/view`}
                  style={{ width: '100%', height: 640, border: '1px solid #e5e7eb', borderRadius: 8 }}
                  title={resumeData.fileName}
                />
              ) : (
                <div style={{ textAlign: 'center', padding: 40, background: '#f9fafb', borderRadius: 8, border: '1px dashed #e5e7eb' }}>
                  <FileTextOutlined style={{ fontSize: 40, color: '#9ca3af', marginBottom: 12 }} />
                  <div style={{ color: '#6b7280', marginBottom: 16 }}>
                    Preview not available for this file type. Download to view.
                  </div>
                  <Button type="primary" icon={<DownloadOutlined />} href={`${baseResumeUrl}/download`} target="_blank">
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

  for (const stageName of ['Offer', 'Joining', '6 Month Review', '12 Month Retained']) {
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

  if (shouldShowStage('Exit')) {
    pipelineTabs.push({
      key: 'Exit',
      label: tabLabel('Exit', <LogoutOutlined style={{ marginRight: 4 }} />),
      children: exitLoading ? null : editingExit || !exitRecord ? (
        <div style={{ maxWidth: 480 }}>
          <Form
            form={exitForm}
            layout="vertical"
            initialValues={
              exitRecord
                ? { exitDate: dayjs(exitRecord.exitDate), reason: exitRecord.reason }
                : {}
            }
            onFinish={(values) =>
              exitMutation.mutate({ exitDate: values.exitDate.format('YYYY-MM-DD'), reason: values.reason })
            }
          >
            <Form.Item name="exitDate" label="Exit Date" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="reason" label="Reason for Leaving">
              <Input.TextArea rows={4} placeholder="Resignation, contract end, termination…" />
            </Form.Item>
            <Space>
              <Button type="primary" danger htmlType="submit" loading={exitMutation.isPending}>
                {exitRecord ? 'Update' : 'Record Exit'}
              </Button>
              {exitRecord && <Button onClick={() => setEditingExit(false)}>Cancel</Button>}
            </Space>
          </Form>
        </div>
      ) : (
        <div>
          <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small" style={{ marginBottom: 16 }}>
            <Descriptions.Item label="Exit Date">
              <Tag color="red">{new Date(exitRecord.exitDate).toLocaleDateString()}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Reason" span={2}>
              {exitRecord.reason || '—'}
            </Descriptions.Item>
          </Descriptions>
          <Space>
            <Button
              icon={<EditOutlined />}
              onClick={() => {
                exitForm.setFieldsValue({ exitDate: dayjs(exitRecord.exitDate), reason: exitRecord.reason })
                setEditingExit(true)
              }}
            >
              Edit
            </Button>
            <Popconfirm
              title="Remove exit record?"
              onConfirm={() => deleteExitMutation.mutate()}
              okText="Yes"
              cancelText="No"
            >
              <Button danger loading={deleteExitMutation.isPending}>
                Remove
              </Button>
            </Popconfirm>
          </Space>
        </div>
      ),
    })
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
    candidate.branch && { icon: <BookOutlined />, value: candidate.branch },
    candidate.rollNo && { icon: <UserOutlined />, value: `Roll No: ${candidate.rollNo}` },
    candidate.githubLink && {
      icon: <GithubOutlined />,
      value: (
        <a href={candidate.githubLink} target="_blank" rel="noreferrer">
          GitHub
        </a>
      ),
    },
  ].filter(Boolean)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── Top grid ── */}
      <Row gutter={[16, 16]} align="stretch">
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
            title="Academic Snapshot"
          >
            <Row gutter={[16, 20]}>
              <Col span={12}>
                <Statistic
                  title="UG CGPA"
                  value={candidate.ugCgpa ?? '—'}
                  valueStyle={{ fontSize: 22, color: '#4f46e5' }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="10th %"
                  value={candidate.tenthMark ?? '—'}
                  valueStyle={{ fontSize: 22 }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="12th %"
                  value={candidate.twelfthMark ?? '—'}
                  valueStyle={{ fontSize: 22 }}
                />
              </Col>
              <Col span={12}>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Backlogs
                  </Text>
                  <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <Tag color={candidate.backlogs === 0 ? 'green' : 'red'} style={{ width: 'fit-content' }}>
                      {candidate.backlogs ?? 0} Total
                    </Tag>
                    <Tag color={candidate.arrears === 0 ? 'green' : 'orange'} style={{ width: 'fit-content' }}>
                      {candidate.arrears ?? 0} Active
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
          <Form.Item name="score" label="Score">
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
