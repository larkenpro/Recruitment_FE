import { useMemo } from 'react'
import { Card, Col, Row, Statistic, Empty, Spin } from 'antd'
import { UserOutlined, TrophyOutlined, BookOutlined, AimOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { getCandidates } from '../api/candidates'
import { computeAnalytics } from '../utils/analyticsHelpers'

const COLORS = ['#4f46e5', '#7c3aed', '#2563eb', '#0891b2', '#059669', '#d97706', '#dc2626', '#db2777']

export default function Analytics() {
  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ['candidates'],
    queryFn: () => getCandidates().then(r => r.data.data),
  })

  const stats = useMemo(() => computeAnalytics(candidates), [candidates])

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

    </div>
  )
}
