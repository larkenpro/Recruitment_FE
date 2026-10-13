import { BankOutlined, CalendarOutlined, GiftOutlined, MailOutlined, PhoneOutlined, TeamOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Card, Col, Empty, Result, Row, Statistic, Table, Tag, Typography } from 'antd'
import { useNavigate, useParams } from 'react-router-dom'
import { getCollege, getCollegeEvents } from '../api/colleges'
import { useAuth } from '../context/AuthContext'
import { COLLEGE_STATUS_COLOR, tierColor } from '../utils/colleges'
import { eventMode } from '../utils/eventModes'
import { GUTTER, useLayoutMetrics } from '../theme'

const { Title, Text } = Typography

const EVENT_STATUS_COLOR = { UPCOMING: 'blue', ACTIVE: 'green', COMPLETED: 'default', CANCELLED: 'red' }

export default function CollegeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { hasPage } = useAuth()
  const { sectionGap } = useLayoutMetrics()

  const { data: college, isLoading, error } = useQuery({
    queryKey: ['college', id],
    queryFn: () => getCollege(id).then((r) => r.data.data),
    retry: false,
  })
  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['collegeEvents', id],
    queryFn: () => getCollegeEvents(id).then((r) => r.data.data),
    enabled: !!college,
  })

  if (isLoading) return <Card loading style={{ borderRadius: 12 }} />
  if (error || !college) {
    return <Result status="404" title="College not found" subTitle="It may have been removed, or the link is wrong." />
  }

  const totalApplicants = events.reduce((sum, e) => sum + e.applicantCount, 0)
  const totalOffers = events.reduce((sum, e) => sum + e.offerCount, 0)
  // The event page needs Events access of its own.
  const canOpenEvents = hasPage('EVENTS')

  const columns = [
    {
      title: 'Year',
      dataIndex: 'recruitmentYear',
      render: (year, e) => (canOpenEvents
        ? <a onClick={() => navigate(`/events/${e.id}`)}><strong>{year}</strong></a>
        : <strong>{year}</strong>),
    },
    { title: 'Mode', dataIndex: 'mode', render: (m) => <Tag color={eventMode(m).color}>{eventMode(m).label}</Tag> },
    { title: 'Status', dataIndex: 'status', render: (s) => (s ? <Tag color={EVENT_STATUS_COLOR[s] ?? 'default'}>{s}</Tag> : '—') },
    { title: 'Start Date', dataIndex: 'startDate', render: (d) => d ?? '—' },
    {
      title: 'Positions',
      dataIndex: 'positions',
      render: (positions) => (positions?.length
        ? positions.map((p) => (
          <Tag key={p.id} style={{ marginBottom: 4 }}>
            {p.title}{p.types?.length ? ` · ${p.types.map((t) => t.name).join(', ')}` : ''}
          </Tag>
        ))
        : '—'),
    },
    { title: 'Applicants', dataIndex: 'applicantCount', align: 'right' },
    { title: 'Offers', dataIndex: 'offerCount', align: 'right' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: sectionGap }}>
      <Row gutter={GUTTER} align="stretch">
        {/* College card */}
        <Col xs={24} md={10}>
          <Card bordered={false} style={{ borderRadius: 12, height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingBottom: 20, borderBottom: '1px solid #f0f0f0', marginBottom: 16 }}>
              <div
                style={{
                  width: 56, height: 56, borderRadius: 12, flexShrink: 0,
                  background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <BankOutlined style={{ fontSize: 24, color: '#fff' }} />
              </div>
              <div>
                <Title level={4} style={{ margin: 0, marginBottom: 2 }}>{college.name}</Title>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  {[college.city, college.state].filter(Boolean).join(', ') || '—'}
                </Text>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {college.tier && <Tag color={tierColor(college.tier)}>{college.tier}</Tag>}
              {college.status && <Tag color={COLLEGE_STATUS_COLOR[college.status] ?? 'default'}>{college.status}</Tag>}
            </div>
          </Card>
        </Col>

        {/* Summary card */}
        <Col xs={24} md={7}>
          <Card bordered={false} style={{ borderRadius: 12, height: '100%' }} title="Summary">
            <Row gutter={[16, 24]}>
              <Col span={12}>
                <Statistic title="Events" value={events.length} prefix={<CalendarOutlined />} valueStyle={{ color: '#4f46e5', fontSize: 22 }} />
              </Col>
              <Col span={12}>
                <Statistic title="Offers" value={totalOffers} prefix={<GiftOutlined />} valueStyle={{ fontSize: 22 }} />
              </Col>
              <Col span={24}>
                <Statistic title="Applicants (all events)" value={totalApplicants} prefix={<TeamOutlined />} valueStyle={{ fontSize: 22 }} />
              </Col>
            </Row>
          </Card>
        </Col>

        {/* Contacts card */}
        <Col xs={24} md={7}>
          <Card bordered={false} style={{ borderRadius: 12, height: '100%' }} title="Contacts">
            {college.contacts?.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {college.contacts.map((c, i) => (
                  <div key={i}>
                    <Text strong>{c.name || '—'}</Text>
                    {c.designation && <div><Text type="secondary" style={{ fontSize: 12 }}>{c.designation}</Text></div>}
                    {c.email && (
                      <div style={{ fontSize: 13 }}>
                        <MailOutlined style={{ marginRight: 6, color: '#9ca3af' }} />
                        <a href={`mailto:${c.email}`}>{c.email}</a>
                      </div>
                    )}
                    {c.phone && (
                      <div style={{ fontSize: 13 }}>
                        <PhoneOutlined style={{ marginRight: 6, color: '#9ca3af' }} />
                        {c.phone}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <Empty description="No contacts yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>
        </Col>
      </Row>

      <Card bordered={false} style={{ borderRadius: 12 }} title={<Text strong style={{ fontSize: 15 }}>Events at {college.name}</Text>}>
        <Table
          dataSource={events}
          columns={columns}
          rowKey="id"
          size="small"
          loading={eventsLoading}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: <Empty description="No events at this college yet" /> }}
        />
      </Card>
    </div>
  )
}
