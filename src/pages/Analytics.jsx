import { useMemo, useState } from 'react'
import { Card, Col, Row, Statistic, Empty, Spin, Select, Descriptions, Table } from 'antd'
import { UserOutlined, TrophyOutlined, BookOutlined, AimOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { getCandidates, getCandidateRoundResults } from '../api/candidates'
import { getAllRoundResults } from '../api/roundResults'
import { computeAnalytics, computeScoreByRoundType, groupAndAggregate, avg } from '../utils/analyticsHelpers'

const COLORS = ['#4f46e5', '#7c3aed', '#2563eb', '#0891b2', '#059669', '#d97706', '#dc2626', '#db2777']

const DATA_SOURCES = {
  candidates: {
    label: 'Candidates',
    dimensions: [
      { key: 'branch', label: 'Branch', get: c => c.branch },
      { key: 'collegeName', label: 'College', get: c => c.college?.name },
      { key: 'collegeCity', label: 'College City', get: c => c.college?.city },
      { key: 'collegeState', label: 'College State', get: c => c.college?.state },
      { key: 'collegeTier', label: 'College Tier', get: c => c.college?.tier },
      { key: 'jobLocation', label: 'Job Location', get: c => c.jobLocation },
    ],
    metrics: [
      { key: 'count', label: 'Count', get: null },
      { key: 'avgCgpa', label: 'Avg UG CGPA', get: c => c.ugCgpa },
      { key: 'avg10th', label: 'Avg 10th Mark', get: c => c.tenthMark },
      { key: 'avg12th', label: 'Avg 12th Mark', get: c => c.twelfthMark },
      { key: 'avgBacklogs', label: 'Avg Backlogs', get: c => c.backlogs },
    ],
  },
  rounds: {
    label: 'Interview Rounds',
    dimensions: [
      { key: 'roundType', label: 'Round Type', get: r => r.roundType },
      { key: 'collegeName', label: 'College', get: r => r.collegeName },
      { key: 'recruitmentYear', label: 'Recruitment Year', get: r => r.recruitmentYear },
    ],
    metrics: [
      { key: 'count', label: 'Count', get: null },
      { key: 'avgScore', label: 'Avg Score', get: r => r.score },
    ],
  },
}

function ConfigurableChart({ candidates, roundResults }) {
  const [source, setSource] = useState('candidates')
  const [dimKey, setDimKey] = useState('branch')
  const [metricKey, setMetricKey] = useState('count')

  const config = DATA_SOURCES[source]
  const data = source === 'candidates' ? candidates : roundResults
  const dimension = config.dimensions.find(d => d.key === dimKey) ?? config.dimensions[0]
  const metric = config.metrics.find(m => m.key === metricKey) ?? config.metrics[0]

  const chartData = useMemo(() => {
    if (!data.length) return []
    return groupAndAggregate(
      data,
      dimension.get,
      metric.get ? (items => Number(avg(items, metric.get))) : (items => items.length)
    )
  }, [data, dimension, metric])

  const handleSourceChange = (value) => {
    setSource(value)
    setDimKey(DATA_SOURCES[value].dimensions[0].key)
    setMetricKey('count')
  }

  return (
    <Card title="Custom Chart" bordered={false} style={{ borderRadius: 12 }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <Select
          value={source} onChange={handleSourceChange} style={{ width: 180 }}
          options={Object.entries(DATA_SOURCES).map(([key, c]) => ({ value: key, label: c.label }))}
        />
        <Select
          value={dimension.key} onChange={setDimKey} style={{ width: 180 }}
          options={config.dimensions.map(d => ({ value: d.key, label: d.label }))}
        />
        <Select
          value={metric.key} onChange={setMetricKey} style={{ width: 180 }}
          options={config.metrics.map(m => ({ value: m.key, label: m.label }))}
        />
      </div>
      {chartData.length ? (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 160, right: 24 }}>
            <XAxis type="number" />
            <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="value" name={metric.label} radius={[0, 4, 4, 0]}>
              {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : <Empty description="No data for this combination" />}
    </Card>
  )
}

const ROUND_RESULT_COLUMNS = [
  { title: 'Round', dataIndex: 'roundName' },
  { title: 'Type', dataIndex: 'roundType', render: v => v ?? '—' },
  { title: 'Score', dataIndex: 'score', render: v => v ?? '—' },
  { title: 'Result', dataIndex: 'result', render: v => v ?? '—' },
]

function CandidatePanel({ candidate, rounds }) {
  if (!candidate) return <Empty description="Select a candidate" />
  return (
    <div>
      <Descriptions column={1} size="small" bordered>
        <Descriptions.Item label="Name">{candidate.name}</Descriptions.Item>
        <Descriptions.Item label="Branch">{candidate.branch ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="College">{candidate.college?.name ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="UG CGPA">{candidate.ugCgpa ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="10th Mark">{candidate.tenthMark ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="12th Mark">{candidate.twelfthMark ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="Backlogs (active/total)">{candidate.arrears ?? 0} / {candidate.backlogs ?? 0}</Descriptions.Item>
      </Descriptions>

      {rounds.length > 0 && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {rounds.map(ev => (
            <div key={ev.eventId}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>{ev.collegeName} ({ev.recruitmentYear})</div>
              <Table
                size="small"
                pagination={false}
                rowKey="roundId"
                dataSource={ev.rounds}
                columns={ROUND_RESULT_COLUMNS}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CandidateCompare({ candidates }) {
  const [idA, setIdA] = useState()
  const [idB, setIdB] = useState()

  const candA = candidates.find(c => c.id === idA)
  const candB = candidates.find(c => c.id === idB)

  const { data: roundsA = [] } = useQuery({
    queryKey: ['candidateRoundResults', idA],
    queryFn: () => getCandidateRoundResults(idA).then(r => r.data),
    enabled: !!idA,
  })
  const { data: roundsB = [] } = useQuery({
    queryKey: ['candidateRoundResults', idB],
    queryFn: () => getCandidateRoundResults(idB).then(r => r.data),
    enabled: !!idB,
  })

  const toOption = c => ({ value: c.id, label: `${c.name} — ${c.college?.name ?? ''}` })
  const optionsForA = candidates.filter(c => c.id !== idB).map(toOption)
  const optionsForB = candidates.filter(c => c.id !== idA).map(toOption)
  const filterOption = (input, option) => option.label.toLowerCase().includes(input.toLowerCase())

  return (
    <Card title="Compare Candidates" bordered={false} style={{ borderRadius: 12 }}>
      <Row gutter={16}>
        <Col xs={24} sm={12}>
          <Select
            showSearch placeholder="Select candidate A" style={{ width: '100%', marginBottom: 16 }}
            options={optionsForA} value={idA} onChange={setIdA} filterOption={filterOption}
          />
          <CandidatePanel candidate={candA} rounds={roundsA} />
        </Col>
        <Col xs={24} sm={12}>
          <Select
            showSearch placeholder="Select candidate B" style={{ width: '100%', marginBottom: 16 }}
            options={optionsForB} value={idB} onChange={setIdB} filterOption={filterOption}
          />
          <CandidatePanel candidate={candB} rounds={roundsB} />
        </Col>
      </Row>
    </Card>
  )
}

export default function Analytics() {
  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ['candidates'],
    queryFn: () => getCandidates().then(r => r.data.data),
  })

  const { data: roundResults = [] } = useQuery({
    queryKey: ['roundResults'],
    queryFn: () => getAllRoundResults().then(r => r.data),
  })

  const stats = useMemo(() => computeAnalytics(candidates), [candidates])
  const scoreByRoundType = useMemo(() => computeScoreByRoundType(roundResults), [roundResults])

  if (isLoading) return <Spin size="large" style={{ display: 'block', marginTop: 80, textAlign: 'center' }} />
  if (!stats) return <Empty description="No candidate data available" style={{ marginTop: 80 }} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Summary cards */}
      <Row gutter={16}>
        {[
          { title: 'Total Candidates', value: stats.total, icon: <UserOutlined />, color: '#4f46e5' },
          { title: 'Avg UG CGPA', value: stats.avgCgpa, icon: <BookOutlined />, color: '#7c3aed' },
          { title: 'Avg 10th Mark %', value: stats.avg10th, icon: <BookOutlined />, color: '#2563eb' },
          { title: 'Active Backlogs', value: `${stats.withActiveBacklogs} / ${stats.total}`, icon: <TrophyOutlined />, color: '#d97706' },
          { title: 'Total Backlogs', value: `${stats.withTotalBacklogs} / ${stats.total}`, icon: <TrophyOutlined />, color: '#dc2626' },
        ].map(({ title, value, icon, color }) => (
          <Col xs={24} sm={12} lg={6} key={title}>
            <Card bordered={false} style={{ borderRadius: 12 }}>
              <Statistic title={title} value={value} prefix={<span style={{ color }}>{icon}</span>} />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Branch distribution | Position preferences */}
      <Row gutter={16}>
        <Col xs={24} lg={14}>
          <Card title="Candidates by Branch" bordered={false} style={{ borderRadius: 12 }}>
            {stats.byBranch.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.byBranch} layout="vertical" margin={{ left: 160, right: 24 }}>
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" name="Candidates" radius={[0, 4, 4, 0]}>
                    {stats.byBranch.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <Empty />}
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card title={<span><AimOutlined style={{ marginRight: 6 }} />Position Preferences</span>} bordered={false} style={{ borderRadius: 12 }}>
            {stats.byPosition.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.byPosition} layout="vertical" margin={{ left: 120, right: 24 }}>
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" name="Selections" radius={[0, 4, 4, 0]}>
                    {stats.byPosition.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <Empty description="No preference data" />}
          </Card>
        </Col>
      </Row>

      {/* College distribution | Location preference */}
      <Row gutter={16}>
        <Col xs={24} lg={14}>
          <Card title="Candidates by College" bordered={false} style={{ borderRadius: 12 }}>
            {stats.byCollege.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={stats.byCollege} layout="vertical" margin={{ left: 160, right: 24 }}>
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" name="Candidates" radius={[0, 4, 4, 0]}>
                    {stats.byCollege.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <Empty />}
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card title="Job Location Preference" bordered={false} style={{ borderRadius: 12 }}>
            {stats.byLocation.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={stats.byLocation}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {stats.byLocation.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <Empty description="No location data" />}
          </Card>
        </Col>
      </Row>

      {/* Exam / round scores */}
      <Row gutter={16}>
        <Col xs={24}>
          <Card title="Average Score by Round Type" bordered={false} style={{ borderRadius: 12 }}>
            {scoreByRoundType.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={scoreByRoundType} layout="vertical" margin={{ left: 160, right: 24 }}>
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" name="Avg Score" radius={[0, 4, 4, 0]}>
                    {scoreByRoundType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <Empty description="No round scores recorded yet" />}
          </Card>
        </Col>
      </Row>

      {/* Configurable graph */}
      <Row gutter={16}>
        <Col xs={24}>
          <ConfigurableChart candidates={candidates} roundResults={roundResults} />
        </Col>
      </Row>

      {/* Candidate comparison */}
      <Row gutter={16}>
        <Col xs={24}>
          <CandidateCompare candidates={candidates} />
        </Col>
      </Row>

    </div>
  )
}
