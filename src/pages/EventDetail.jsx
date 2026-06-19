import {
  AppstoreOutlined,
  CalendarOutlined,
  CopyOutlined,
  DeleteOutlined,
  FileTextOutlined,
  LinkOutlined,
  TeamOutlined,
  UnorderedListOutlined,
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
  generateLink,
  getCandidatesByEvent,
  getEvent,
  getEventPositions,
  getEventStageSummary,
  getRounds,
  removeEventPosition,
  updateEventStatus,
} from '../api/events'
import { getPositions } from '../api/positions'
import { getCandidateResume } from '../api/candidates'
import { getErrorMessage } from '../utils/errorUtils'
import { useStageDecision } from '../hooks/useStageDecision'
import { useColumnFilter } from '../hooks/useColumnFilter'
import FilterBar from '../components/FilterBar'

const { Title, Text } = Typography

const CANDIDATE_FILTER_KEYS = [
  { key: 'ugCgpa', label: 'CGPA', type: 'min', getVal: (r) => r.ugCgpa },
  { key: 'backlogs', label: 'Backlogs', type: 'max', getVal: (r) => r.backlogs ?? 0 },
  { key: 'resumeStatus', label: 'Resume Result', getVal: (r) => r.resumeStatus },
]

const RESUME_STATUS_OPTIONS = [
  { value: 'SHORTLISTED', label: 'Shortlisted' },
  { value: 'HOLD', label: 'Hold' },
  { value: 'REJECTED', label: 'Rejected' },
]

const STATUS_COLOR = { UPCOMING: 'blue', ACTIVE: 'green', COMPLETED: 'default', CANCELLED: 'red' }
const ROUND_TYPE_COLOR = { WRITTEN: 'purple', TECHNICAL: 'blue', HR: 'green', GROUP_DISCUSSION: 'orange', CODING: 'cyan' }

export default function EventDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [link, setLink] = useState(null)
  const [roundForm] = Form.useForm()
  const [positionForm] = Form.useForm()
  const [resumeModal, setResumeModal] = useState({ open: false, candidateId: null, fileName: null })
  const [pendingCandidateId, setPendingCandidateId] = useState(null)

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

  if (isLoading) return <Card loading style={{ borderRadius: 12 }} />
  if (!event) return <Empty />

  const sortedRounds = [...(rounds ?? [])].sort((a, b) => a.sequence - b.sequence)
  const availablePositions = (allPositions ?? []).filter(
    (p) => !(eventPositions ?? []).some((ep) => ep.id === p.id)
  )

  const tabItems = [
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
          {sortedRounds.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {sortedRounds.map((r) => (
                <Card
                  key={r.id}
                  size="small"
                  style={{ borderRadius: 10, border: '1.5px solid #e5e7eb' }}
                >
                  <Space>
                    <Tag style={{ fontWeight: 700, minWidth: 28, textAlign: 'center' }}>#{r.sequence}</Tag>
                    <Text strong style={{ fontSize: 14 }}>{r.name}</Text>
                    {r.roundType && (
                      <Tag color={ROUND_TYPE_COLOR[r.roundType] ?? 'default'}>{r.roundType}</Tag>
                    )}
                  </Space>
                </Card>
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
    {
      key: 'candidates',
      label: (
        <span>
          <TeamOutlined style={{ marginRight: 4 }} />
          Candidates
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

      {/* Tabbed detail section */}
      <Card
        bordered={false}
        style={{ borderRadius: 12 }}
        title={<Text strong style={{ fontSize: 15 }}>Event Details</Text>}
      >
        <Tabs items={tabItems} />
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

    </div>
  )
}
