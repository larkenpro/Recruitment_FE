import { useState } from 'react'
import { Card, Row, Col, Descriptions, Tag, Typography, Tabs, Empty, Button, Table, Timeline, Select, Space, message } from 'antd'
import { DownloadOutlined, FileTextOutlined, EditOutlined } from '@ant-design/icons'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCandidate, getCandidateResume, getCandidateScores, getCandidateStageHistory, updateCandidate } from '../api/candidates'
import { getPositions } from '../api/positions'
import { useColumnFilter } from '../hooks/useColumnFilter'
import FilterBar from '../components/FilterBar'

const SCORE_FILTER_KEYS = [
  { key: 'round',  label: 'Round',  getVal: r => r.round?.name },
  { key: 'type',   label: 'Type',   getVal: r => r.round?.roundType },
  { key: 'result', label: 'Result', getVal: r => r.result },
]

const { Title, Text } = Typography

export default function CandidateDetail() {
  const { id } = useParams()
  const queryClient = useQueryClient()
  const [editingPrefs, setEditingPrefs] = useState(false)
  const [pref1Id, setPref1Id] = useState(null)
  const [pref2Id, setPref2Id] = useState(null)

  const { data: candidate, isLoading } = useQuery({
    queryKey: ['candidate', id],
    queryFn: () => getCandidate(id).then(r => r.data.data)
  })
  const { data: resumeData } = useQuery({
    queryKey: ['resume', id],
    queryFn: () => getCandidateResume(id).then(r => r.data.data)
  })
  const { data: scores } = useQuery({
    queryKey: ['scores', id],
    queryFn: () => getCandidateScores(id).then(r => r.data.data)
  })
  const { data: stageHistory } = useQuery({
    queryKey: ['stage-history', id],
    queryFn: () => getCandidateStageHistory(id).then(r => r.data.data)
  })

  const { data: positions = [] } = useQuery({
    queryKey: ['positions'],
    queryFn: () => getPositions().then(r => r.data.data),
  })

  const prefMutation = useMutation({
    mutationFn: (data) => updateCandidate(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['candidate', id])
      setEditingPrefs(false)
      message.success('Preferences updated!')
    },
    onError: () => message.error('Failed to update preferences'),
  })

  const openEditPrefs = () => {
    setPref1Id(candidate.preferredPosition1?.id ?? null)
    setPref2Id(candidate.preferredPosition2?.id ?? null)
    setEditingPrefs(true)
  }

  const savePrefs = () => {
    const payload = {
      username: candidate.username,
      name: candidate.name,
      email: candidate.email,
      collegeId: candidate.college?.id,
    }
    if (pref1Id != null) payload.preferredPosition1Id = pref1Id
    if (pref2Id != null) payload.preferredPosition2Id = pref2Id
    prefMutation.mutate(payload)
  }

  const { filteredData: filteredScores, filters: scoreFilters, setFilter: setScoreFilter, removeFilter: removeScoreFilter, optionMap: scoreOptionMap } = useColumnFilter(scores, SCORE_FILTER_KEYS)

  if (isLoading) return <Card loading style={{ borderRadius: 12 }} />
  if (!candidate) return <Empty />

  const scoreColumns = [
    { title: 'Round', render: (_, r) => r.round?.name ?? '-' },
    { title: 'Type', render: (_, r) => r.round?.roundType ?? '-' },
    { title: 'Score', dataIndex: 'score', render: v => v ?? '-' },
    { title: 'Result', dataIndex: 'result', render: v => v ? <Tag color={v === 'PASS' ? 'green' : v === 'FAIL' ? 'red' : 'orange'}>{v}</Tag> : '-' },
    { title: 'Interviewer', dataIndex: 'interviewer' },
    { title: 'Comments', dataIndex: 'comments' },
    { title: 'Date', dataIndex: 'evaluatedAt', render: v => v ? new Date(v).toLocaleDateString() : '-' },
  ]

  const tabs = [
    {
      key: 'personal', label: 'Personal Info',
      children: (
        <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
          <Descriptions.Item label="Full Name">{candidate.name}</Descriptions.Item>
          <Descriptions.Item label="Username">{candidate.username}</Descriptions.Item>
          <Descriptions.Item label="Email">{candidate.email}</Descriptions.Item>
          <Descriptions.Item label="Phone">{candidate.phone}</Descriptions.Item>
          <Descriptions.Item label="Roll No">{candidate.rollNo}</Descriptions.Item>
          <Descriptions.Item label="Branch">{candidate.branch}</Descriptions.Item>
          <Descriptions.Item label="College">{candidate.college?.name ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="Job Location">{candidate.jobLocation}</Descriptions.Item>
          <Descriptions.Item label="GitHub">{candidate.githubLink ? <a href={candidate.githubLink} target="_blank" rel="noreferrer">{candidate.githubLink}</a> : '-'}</Descriptions.Item>
          <Descriptions.Item label="Internship Availability">{candidate.internshipAvailability}</Descriptions.Item>
          <Descriptions.Item label="Leadership Positions" span={2}>{candidate.leadershipPositions}</Descriptions.Item>
        </Descriptions>
      )
    },
    {
      key: 'academic', label: 'Academic',
      children: (
        <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
          <Descriptions.Item label="10th Mark %">{candidate.tenthMark}</Descriptions.Item>
          <Descriptions.Item label="12th Mark %">{candidate.twelfthMark}</Descriptions.Item>
          <Descriptions.Item label="Diploma Mark %">{candidate.diplomaMark ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="KEAM Rank">{candidate.keamRank ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="UG Degree">{candidate.ugDegree}</Descriptions.Item>
          <Descriptions.Item label="UG CGPA">{candidate.ugCgpa}</Descriptions.Item>
          <Descriptions.Item label="PG Degree">{candidate.pgDegree ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="PG CGPA">{candidate.pgCgpa ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="Backlogs"><Tag color={candidate.backlogs === 0 ? 'green' : 'red'}>{candidate.backlogs}</Tag></Descriptions.Item>
          <Descriptions.Item label="Arrears"><Tag color={candidate.arrears === 0 ? 'green' : 'red'}>{candidate.arrears}</Tag></Descriptions.Item>
        </Descriptions>
      )
    },
    {
      key: 'preferences', label: 'Preferences',
      children: editingPrefs ? (
        <div style={{ maxWidth: 400 }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ marginBottom: 4, fontWeight: 500 }}>Preferred Role 1</div>
            <Select
              showSearch optionFilterProp="label" allowClear style={{ width: '100%' }}
              value={pref1Id}
              onChange={v => { setPref1Id(v ?? null); if (v === pref2Id) setPref2Id(null) }}
              options={positions.map(p => ({ value: p.id, label: p.type ? `${p.title} — ${p.type}` : p.title }))}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 4, fontWeight: 500 }}>Preferred Role 2</div>
            <Select
              showSearch optionFilterProp="label" allowClear style={{ width: '100%' }}
              value={pref2Id}
              onChange={v => setPref2Id(v ?? null)}
              options={positions.filter(p => p.id !== pref1Id).map(p => ({ value: p.id, label: p.type ? `${p.title} — ${p.type}` : p.title }))}
            />
          </div>
          <Space>
            <Button type="primary" onClick={savePrefs} loading={prefMutation.isPending}>Save</Button>
            <Button onClick={() => setEditingPrefs(false)}>Cancel</Button>
          </Space>
        </div>
      ) : (
        <Descriptions column={1} bordered size="small"
          extra={<Button size="small" icon={<EditOutlined />} onClick={openEditPrefs}>Edit</Button>}
        >
          <Descriptions.Item label="Preferred Role 1">{candidate.preferredPosition1?.title ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="Preferred Role 2">{candidate.preferredPosition2?.title ?? '-'}</Descriptions.Item>
        </Descriptions>
      )
    },
    {
      key: 'scores', label: `Scores (${scores?.length ?? 0})`,
      children: scores?.length > 0
        ? <>
            <FilterBar
              filterKeys={SCORE_FILTER_KEYS}
              optionMap={scoreOptionMap}
              filters={scoreFilters}
              setFilter={setScoreFilter}
              removeFilter={removeScoreFilter}
            />
            <Table dataSource={filteredScores} columns={scoreColumns} rowKey={(r) => `${r.id?.roundId}`} pagination={false} size="small" />
          </>
        : <Empty description="No scores recorded yet" />
    },
    {
      key: 'stage-history', label: 'Stage History',
      children: stageHistory?.length > 0 ? (
        <Timeline mode="left" items={stageHistory.map(s => ({
          label: s.stageTimestamp ? new Date(s.stageTimestamp).toLocaleString() : '-',
          children: (
            <div>
              <Tag color="blue">{s.stage?.name}</Tag>
              {s.changedBy && <Text type="secondary"> by {s.changedBy}</Text>}
            </div>
          )
        }))} />
      ) : <Empty description="No stage history yet" />
    },
    {
      key: 'resume', label: 'Resume',
      children: resumeData ? (
        <div style={{ textAlign: 'center', padding: 32 }}>
          <FileTextOutlined style={{ fontSize: 48, color: '#4f46e5', marginBottom: 16 }} />
          <div style={{ marginBottom: 8 }}><strong>{resumeData.fileName}</strong></div>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            Uploaded: {resumeData.uploadedAt ? new Date(resumeData.uploadedAt).toLocaleDateString() : '-'}
          </Text>
          <Button type="primary" icon={<DownloadOutlined />} size="large"
            href={`${import.meta.env.VITE_PUBLIC_API_URL}/api/v1/candidates/${id}/resume/download`} target="_blank">
            Download Resume
          </Button>
        </div>
      ) : <Empty description="No resume uploaded" />
    }
  ]

  return (
    <div>
      <Card bordered={false} style={{ borderRadius: 12, marginBottom: 16, background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
        <Row align="middle" gutter={16}>
          <Col>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: 'white' }}>
              {candidate.name?.charAt(0).toUpperCase()}
            </div>
          </Col>
          <Col>
            <Title level={3} style={{ color: 'white', margin: 0 }}>{candidate.name}</Title>
            <Text style={{ color: 'rgba(255,255,255,0.85)' }}>{candidate.email}</Text><br />
            <Text style={{ color: 'rgba(255,255,255,0.85)' }}>{candidate.college?.name}</Text>
          </Col>
        </Row>
      </Card>

      <Card bordered={false} style={{ borderRadius: 12 }}>
        <Tabs items={tabs} />
      </Card>
    </div>
  )
}
