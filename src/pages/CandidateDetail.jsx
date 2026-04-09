import { Card, Row, Col, Descriptions, Tag, Typography, Tabs, Empty, Button, Table, Timeline } from 'antd'
import { DownloadOutlined, FileTextOutlined } from '@ant-design/icons'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getCandidate } from '../api/candidates'
import api from '../api/axios'

const { Title, Text } = Typography

export default function CandidateDetail() {
  const { id } = useParams()

  const { data: candidate, isLoading } = useQuery({
    queryKey: ['candidate', id],
    queryFn: () => getCandidate(id).then(r => r.data.data)
  })
  const { data: resumeData } = useQuery({
    queryKey: ['resume', id],
    queryFn: () => api.get(`/candidates/${id}/resume`).then(r => r.data.data)
  })
  const { data: scores } = useQuery({
    queryKey: ['scores', id],
    queryFn: () => api.get(`/candidates/${id}/scores`).then(r => r.data.data)
  })
  const { data: stageHistory } = useQuery({
    queryKey: ['stage-history', id],
    queryFn: () => api.get(`/candidates/${id}/stage-history`).then(r => r.data.data)
  })

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
      children: (
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="Preferred Role 1">{candidate.preferredPosition1?.title ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="Preferred Role 2">{candidate.preferredPosition2?.title ?? '-'}</Descriptions.Item>
        </Descriptions>
      )
    },
    {
      key: 'scores', label: `Scores (${scores?.length ?? 0})`,
      children: scores?.length > 0
        ? <Table dataSource={scores} columns={scoreColumns} rowKey={(r) => `${r.id?.roundId}`} pagination={false} size="small" />
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
