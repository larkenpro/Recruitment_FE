import { useMemo, useState } from 'react'
import { Card, Col, Row, Statistic, Empty, Spin, Select, Table, Button, Tag, Space } from 'antd'
import { UserOutlined, TrophyOutlined, BookOutlined, AimOutlined } from '@ant-design/icons'
import { useQuery, useQueries } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { getCandidates, getCandidateRoundResults } from '../api/candidates'
import { getAllRoundResults } from '../api/roundResults'
import { getStageSummaries } from '../api/analytics'
import { computeAnalytics, computeScoreByRoundType, groupAndAggregate, avg, buildRoundComparisonRows, buildFunnel, buildCampusRows, buildPositionPreferenceTable } from '../utils/analyticsHelpers'
import { SPACE, GUTTER, RADIUS, FONT_SIZE, FONT_WEIGHT, INK, TEXT, useLayoutMetrics } from '../theme'

const COLORS = ['#4f46e5', '#7c3aed', '#2563eb', '#0891b2', '#059669', '#d97706', '#dc2626', '#db2777']

// One hue for every bar: these are single-series charts, so a per-bar colour would
// encode rank rather than identity — noise that gets worse the more bars there are.
const BAR_COLOR = INK.brand
const ROW_HEIGHT = 26
const TOP_N = 12

const truncateLabel = (s, max = 24) => (s.length > max ? `${s.slice(0, max - 1)}…` : s)

/**
 * Horizontal bar chart that stays readable from 3 to 50+ categories: the plot grows
 * with the row count instead of squeezing bars into a fixed height, and long lists
 * collapse to the top N until expanded. Data is expected pre-sorted descending.
 */
function CategoryBarChart({ data, seriesName, labelWidth = 170, allowDecimals = true, empty }) {
  const [showAll, setShowAll] = useState(false)
  const { isNarrow: isMobile } = useLayoutMetrics()

  if (!data.length) return empty ?? <Empty />

  const collapsed = data.length > TOP_N && !showAll
  const shown = collapsed ? data.slice(0, TOP_N) : data
  // A 170px label gutter eats half a phone screen, so shrink the axis and
  // truncate harder rather than leaving no room for the bars themselves.
  const axisWidth = isMobile ? 92 : labelWidth
  const maxLabel = isMobile ? 12 : 24

  return (
    <>
      <ResponsiveContainer width="100%" height={shown.length * ROW_HEIGHT + 44}>
        <BarChart data={shown} layout="vertical" margin={{ left: 0, right: isMobile ? 12 : 32, top: 4, bottom: 4 }}>
          <CartesianGrid horizontal={false} stroke="#eef0f4" />
          <XAxis type="number" allowDecimals={allowDecimals} tick={{ fontSize: FONT_SIZE.caption, fill: INK.faint }} />
          <YAxis
            type="category" dataKey="name" width={axisWidth}
            tick={{ fontSize: isMobile ? FONT_SIZE.caption : FONT_SIZE.small, fill: INK.secondary }} tickLine={false} axisLine={false}
            tickFormatter={(v) => truncateLabel(v, maxLabel)}
          />
          <Tooltip cursor={{ fill: 'rgba(79, 70, 229, 0.06)' }} />
          <Bar dataKey="value" name={seriesName} fill={BAR_COLOR} radius={[0, 4, 4, 0]} barSize={14} />
        </BarChart>
      </ResponsiveContainer>
      {data.length > TOP_N && (
        <Button type="link" size="small" style={{ paddingLeft: 0 }} onClick={() => setShowAll(!showAll)}>
          {collapsed ? `Show all ${data.length}` : `Show top ${TOP_N}`}
        </Button>
      )}
    </>
  )
}

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
  const { isNarrow } = useLayoutMetrics()
  const selectWidth = isNarrow ? '100%' : 180

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
    <Card title="Custom Chart" bordered={false} style={{ borderRadius: RADIUS.card }}>
      <div style={{ display: 'flex', gap: SPACE.sm, marginBottom: SPACE.md, flexWrap: 'wrap' }}>
        <Select
          value={source} onChange={handleSourceChange} style={{ width: selectWidth }}
          options={Object.entries(DATA_SOURCES).map(([key, c]) => ({ value: key, label: c.label }))}
        />
        <Select
          value={dimension.key} onChange={setDimKey} style={{ width: selectWidth }}
          options={config.dimensions.map(d => ({ value: d.key, label: d.label }))}
        />
        <Select
          value={metric.key} onChange={setMetricKey} style={{ width: selectWidth }}
          options={config.metrics.map(m => ({ value: m.key, label: m.label }))}
        />
      </div>
      <CategoryBarChart
        data={chartData}
        seriesName={metric.label}
        empty={<Empty description="No data for this combination" />}
      />
    </Card>
  )
}

/**
 * Columns of the campus table, in display order. `stage` counts distinct candidates from
 * the college who reached that stage; `status` narrows it to one decision; a metric with
 * neither just counts candidates. Adding early attrition is one more entry here — nothing
 * else changes, front or back, since /analytics/stage-summary already returns every stage a
 * candidate reached, Exit included.
 */
const CAMPUS_METRICS = [
  { key: 'applications', label: 'Applications' },
  { key: 'shortlists', label: 'Shortlists', stage: 'Resume', status: 'SHORTLISTED' },
  { key: 'offered', label: 'Offered', stage: 'Offer' },
  { key: 'joined', label: 'Joined', stage: 'Joining' },
]

function CampusEffectiveness({ candidates }) {
  const { byStage, isPending } = useStageSummaries()
  const rows = buildCampusRows(candidates, byStage, CAMPUS_METRICS)

  const columns = [
    {
      title: 'College',
      dataIndex: 'college',
      key: 'college',
      fixed: 'left',
      width: 240,
      sorter: (a, b) => a.college.localeCompare(b.college),
      render: (college) => <span style={{ fontWeight: FONT_WEIGHT.medium }}>{college}</span>,
    },
    ...CAMPUS_METRICS.map(metric => ({
      title: metric.label,
      dataIndex: metric.key,
      key: metric.key,
      align: 'right',
      width: 130,
      sorter: (a, b) => a[metric.key] - b[metric.key],
      render: (value) => (value === 0 ? <span style={{ color: INK.faint }}>0</span> : value),
    })),
  ]

  return (
    <Card title="Campus Effectiveness" bordered={false} style={{ borderRadius: RADIUS.card }}>
      {isPending ? <Spin style={{ display: 'block', margin: `${SPACE.xl}px auto` }} /> : (
        <Table
          size="small"
          pagination={false}
          rowKey="college"
          dataSource={rows}
          columns={columns}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: <Empty description="No college data" /> }}
        />
      )}
    </Card>
  )
}

function PositionPreferences({ candidates }) {
  const { positions, rows } = buildPositionPreferenceTable(candidates)

  const columns = [
    {
      title: 'Rank',
      dataIndex: 'label',
      key: 'label',
      fixed: 'left',
      width: 130,
      render: (label) => <span style={{ fontWeight: FONT_WEIGHT.medium }}>{label}</span>,
    },
    ...positions.map(title => ({
      title,
      dataIndex: title,
      key: title,
      align: 'right',
      width: 130,
      sorter: (a, b) => a[title] - b[title],
      render: (value) => (value === 0 ? <span style={{ color: INK.faint }}>0</span> : value),
    })),
    {
      title: 'Total',
      dataIndex: 'total',
      key: 'total',
      align: 'right',
      width: 90,
      sorter: (a, b) => a.total - b.total,
      render: (value) => <span style={{ fontWeight: FONT_WEIGHT.semibold }}>{value}</span>,
    },
  ]

  return (
    <Card
      title={<span><AimOutlined style={{ marginRight: 6 }} />Position Preferences</span>}
      bordered={false}
      style={{ borderRadius: RADIUS.card }}
    >
      <Table
        size="small"
        pagination={false}
        rowKey="key"
        dataSource={rows}
        columns={columns}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: <Empty description="No preference data" /> }}
      />
    </Card>
  )
}

const PROFILE_CRITERIA = [
  { key: 'branch', label: 'Branch', get: c => c.branch },
  { key: 'college', label: 'College', get: c => c.college?.name },
  { key: 'ugCgpa', label: 'UG CGPA', get: c => c.ugCgpa },
  { key: 'tenthMark', label: '10th Mark', get: c => c.tenthMark },
  { key: 'twelfthMark', label: '12th Mark', get: c => c.twelfthMark },
  { key: 'backlogs', label: 'Backlogs (active/total)', get: c => `${c.arrears ?? 0} / ${c.backlogs ?? 0}` },
]

const RESULT_COLOR = { PASS: 'green', FAIL: 'red', ON_HOLD: 'orange' }

function RoundCell({ round }) {
  if (!round) return <span style={{ color: INK.faint }}>—</span>
  return (
    <Space size={SPACE.xs} wrap>
      <span>{round.score ?? '—'}</span>
      {round.result && <Tag color={RESULT_COLOR[round.result]}>{round.result}</Tag>}
    </Space>
  )
}

function CandidateCompare({ candidates }) {
  const [selectedIds, setSelectedIds] = useState([])

  // One query per selected candidate. Keys match the single-candidate fetches
  // elsewhere, so switching a candidate in or out usually hits the cache.
  const roundQueries = useQueries({
    queries: selectedIds.map(id => ({
      queryKey: ['candidateRoundResults', id],
      queryFn: () => getCandidateRoundResults(id).then(r => r.data),
    })),
  })

  const selected = selectedIds
    .map(id => candidates.find(c => c.id === id))
    .filter(Boolean)

  const options = candidates.map(c => ({ value: c.id, label: `${c.name} — ${c.college?.name ?? ''}` }))
  const filterOption = (input, option) => option.label.toLowerCase().includes(input.toLowerCase())

  const roundsById = selectedIds.map((id, i) => ({ id, events: roundQueries[i]?.data ?? [] }))

  const profileRows = selected.length
    ? PROFILE_CRITERIA.map(criterion => ({
        key: criterion.key,
        label: criterion.label,
        type: 'profile',
        values: Object.fromEntries(selected.map(c => [c.id, criterion.get(c)])),
      }))
    : []
  const rows = [...profileRows, ...buildRoundComparisonRows(roundsById)]

  const columns = [
    {
      title: 'Criterion',
      dataIndex: 'label',
      key: 'label',
      width: 220,
      fixed: 'left',
      render: (label, row) => (
        <span style={{ fontWeight: FONT_WEIGHT.semibold, color: row.type === 'round' ? INK.muted : INK.primary }}>
          {label}
        </span>
      ),
    },
    ...selected.map(candidate => ({
      title: candidate.name,
      key: candidate.id,
      width: 180,
      render: (_, row) => {
        const value = row.values[candidate.id]
        if (row.type === 'round') return <RoundCell round={value} />
        return value ?? <span style={{ color: INK.faint }}>—</span>
      },
    })),
  ]

  return (
    <Card
      title="Compare Candidates"
      bordered={false}
      style={{ borderRadius: RADIUS.card }}
      extra={selected.length > 0 && (
        <span style={{ ...TEXT.label }}>{selected.length} selected</span>
      )}
    >
      <Select
        mode="multiple"
        showSearch
        allowClear
        placeholder="Add candidates to compare"
        style={{ width: '100%', marginBottom: SPACE.md }}
        options={options}
        value={selectedIds}
        onChange={setSelectedIds}
        filterOption={filterOption}
        maxTagCount="responsive"
      />

      {rows.length ? (
        <Table
          size="small"
          pagination={false}
          rowKey="key"
          dataSource={rows}
          columns={columns}
          scroll={{ x: 'max-content' }}
        />
      ) : <Empty description="Add candidates to compare them side by side" />}
    </Card>
  )
}

// Ordered bottom-up so the stack reads left-to-right as "got through" → "still moving"
// → "stopped here", which is also the order the eye scans the shrinking funnel.
const FUNNEL_SEGMENTS = [
  { key: 'advanced', label: 'Advanced', color: '#059669' },
  { key: 'inProgress', label: 'In pipeline', color: '#d97706' },
  { key: 'rejected', label: 'Rejected', color: '#dc2626' },
]

const pct = (v) => (v == null ? '—' : `${v.toFixed(1)}%`)

/** Stage rows for the whole pipeline, grouped by stage name. */
function useStageSummaries() {
  const { data = [], isPending } = useQuery({
    queryKey: ['analyticsStageSummary'],
    queryFn: () => getStageSummaries().then(r => r.data),
  })

  const byStage = useMemo(() => {
    const map = {}
    data.forEach(row => (map[row.stageName] ??= []).push(row))
    return map
  }, [data])

  return { byStage, isPending }
}

function RecruitmentFunnel({ candidates }) {
  const { isNarrow } = useLayoutMetrics()
  const { byStage, isPending } = useStageSummaries()
  // Legend click toggles a segment; Bar `hide` keeps the entry in the legend but greys it out.
  const [hidden, setHidden] = useState(new Set())
  const toggleSegment = ({ dataKey }) => setHidden(prev => {
    const next = new Set(prev)
    next.has(dataKey) ? next.delete(dataKey) : next.add(dataKey)
    return next
  })

  const funnel = buildFunnel(new Set(candidates.map(c => c.id)), byStage)
  const joined = funnel[funnel.length - 1]

  const conversionRows = [
    ...funnel.filter(step => step.from).map(step => ({
      key: step.name, from: step.from, to: step.name, count: step.reached, conversion: step.conversion,
    })),
    {
      key: 'overall',
      from: 'Applied',
      to: joined.name,
      count: joined.reached,
      conversion: funnel[0].reached ? (joined.reached / funnel[0].reached) * 100 : null,
      overall: true,
    },
  ]

  const columns = [
    {
      title: 'Step',
      key: 'step',
      render: (_, row) => (
        <span style={{ fontWeight: row.overall ? FONT_WEIGHT.semibold : FONT_WEIGHT.regular }}>
          {row.from} → {row.to}
        </span>
      ),
    },
    { title: 'Candidates', dataIndex: 'count', key: 'count', align: 'right', width: 100 },
    {
      title: 'Conversion',
      dataIndex: 'conversion',
      key: 'conversion',
      align: 'right',
      width: 110,
      render: (value, row) => (
        <span style={{ fontWeight: FONT_WEIGHT.semibold, color: row.overall ? INK.brand : INK.primary }}>
          {pct(value)}
        </span>
      ),
    },
  ]

  return (
    <Card title="Recruitment Funnel" bordered={false} style={{ borderRadius: RADIUS.card }}>
      {isPending ? <Spin style={{ display: 'block', margin: `${SPACE.xl}px auto` }} /> : (
        <Row gutter={GUTTER}>
          <Col xs={24} lg={14}>
            <ResponsiveContainer width="100%" height={funnel.length * 44 + 48}>
              <BarChart data={funnel} layout="vertical" margin={{ left: 0, right: isNarrow ? 12 : 24, top: 4, bottom: 4 }}>
                <CartesianGrid horizontal={false} stroke="#eef0f4" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: FONT_SIZE.caption, fill: INK.faint }} />
                <YAxis
                  type="category" dataKey="name" width={isNarrow ? 74 : 108}
                  tick={{ fontSize: isNarrow ? FONT_SIZE.caption : FONT_SIZE.small, fill: INK.secondary }}
                  tickLine={false} axisLine={false}
                />
                <Tooltip cursor={{ fill: 'rgba(79, 70, 229, 0.06)' }} />
                <Legend
                  onClick={toggleSegment}
                  wrapperStyle={{ cursor: 'pointer' }}
                  formatter={(value, entry) => (
                    <span className="legend-toggle" style={{ textDecoration: entry.inactive ? 'line-through' : 'none' }}>{value}</span>
                  )}
                />
                {FUNNEL_SEGMENTS.map(segment => (
                  <Bar key={segment.key} dataKey={segment.key} name={segment.label} stackId="funnel" fill={segment.color} barSize={20} hide={hidden.has(segment.key)} />
                ))}
              </BarChart>
            </ResponsiveContainer>
            <div style={{ ...TEXT.caption, textAlign: 'center', marginTop: SPACE.xs }}>Click a legend item to show or hide it</div>
          </Col>
          <Col xs={24} lg={10}>
            <Table size="small" pagination={false} rowKey="key" dataSource={conversionRows} columns={columns} />
          </Col>
        </Row>
      )}
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
  const { sectionGap } = useLayoutMetrics()

  if (isLoading) return <Spin size="large" style={{ display: 'block', marginTop: 80, textAlign: 'center' }} />
  if (!stats) return <Empty description="No candidate data available" style={{ marginTop: 80 }} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: sectionGap }}>

      {/* Summary cards */}
      <Row gutter={GUTTER}>
        {[
          { title: 'Total Candidates', value: stats.total, icon: <UserOutlined />, color: '#4f46e5' },
          { title: 'Avg UG CGPA', value: stats.avgCgpa, icon: <BookOutlined />, color: '#7c3aed' },
          { title: 'Avg 10th Mark %', value: stats.avg10th, icon: <BookOutlined />, color: '#2563eb' },
          { title: 'Active Backlogs', value: `${stats.withActiveBacklogs} / ${stats.total}`, icon: <TrophyOutlined />, color: '#d97706' },
          { title: 'Total Backlogs', value: `${stats.withTotalBacklogs} / ${stats.total}`, icon: <TrophyOutlined />, color: '#dc2626' },
        ].map(({ title, value, icon, color }) => (
          <Col xs={24} sm={12} lg={6} key={title}>
            <Card bordered={false} style={{ borderRadius: RADIUS.card }}>
              <Statistic title={title} value={value} prefix={<span style={{ color }}>{icon}</span>} />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Recruitment funnel */}
      <Row gutter={GUTTER}>
        <Col xs={24}>
          <RecruitmentFunnel candidates={candidates} />
        </Col>
      </Row>

      {/* Campus effectiveness */}
      <Row gutter={GUTTER}>
        <Col xs={24}>
          <CampusEffectiveness candidates={candidates} />
        </Col>
      </Row>

      {/* Branch distribution */}
      <Row gutter={GUTTER}>
        <Col xs={24}>
          <Card title="Candidates by Branch" bordered={false} style={{ borderRadius: RADIUS.card }}>
            <CategoryBarChart data={stats.byBranch} seriesName="Candidates" allowDecimals={false} />
          </Card>
        </Col>
      </Row>

      {/* Position preferences by rank */}
      <Row gutter={GUTTER}>
        <Col xs={24}>
          <PositionPreferences candidates={candidates} />
        </Col>
      </Row>

      {/* College distribution | Location preference */}
      <Row gutter={GUTTER}>
        <Col xs={24} lg={14}>
          <Card title="Candidates by College" bordered={false} style={{ borderRadius: RADIUS.card }}>
            <CategoryBarChart data={stats.byCollege} seriesName="Candidates" allowDecimals={false} />
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card title="Job Location Preference" bordered={false} style={{ borderRadius: RADIUS.card }}>
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
      <Row gutter={GUTTER}>
        <Col xs={24}>
          <Card title="Average Score by Round Type" bordered={false} style={{ borderRadius: RADIUS.card }}>
            <CategoryBarChart
              data={scoreByRoundType} seriesName="Avg Score"
              empty={<Empty description="No round scores recorded yet" />}
            />
          </Card>
        </Col>
      </Row>

      {/* Configurable graph */}
      <Row gutter={GUTTER}>
        <Col xs={24}>
          <ConfigurableChart candidates={candidates} roundResults={roundResults} />
        </Col>
      </Row>

      {/* Candidate comparison */}
      <Row gutter={GUTTER}>
        <Col xs={24}>
          <CandidateCompare candidates={candidates} />
        </Col>
      </Row>

    </div>
  )
}
