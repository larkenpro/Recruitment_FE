import { useState } from 'react'
import { Card, Table, Button, Modal, Form, Input, InputNumber, Select, DatePicker, Tag, message, Space, Popconfirm, Row, Col, Divider } from 'antd'
import dayjs from 'dayjs'
import { EditOutlined, DeleteOutlined, EyeOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getCandidates, getCandidate, getCandidateEvent, updateCandidate, deleteCandidate } from '../api/candidates'
import { getColleges } from '../api/colleges'
import { getEventPositions } from '../api/events'
import { useColumnFilter } from '../hooks/useColumnFilter'
import FilterBar from '../components/FilterBar'

const FILTER_KEYS = [
  { key: 'college', label: 'College', getVal: r => r.college?.name },
  { key: 'branch',  label: 'Branch',  getVal: r => r.branch },
]

export default function Candidates() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(null)
  const [form] = Form.useForm()
  const [rankedPositions, setRankedPositions] = useState([])

  const movePosition = (index, dir) => {
    const next = index + dir
    if (next < 0 || next >= rankedPositions.length) return
    const updated = [...rankedPositions]
    ;[updated[index], updated[next]] = [updated[next], updated[index]]
    setRankedPositions(updated)
  }

  const { data: candidates, isLoading } = useQuery({
    queryKey: ['candidates'],
    queryFn: () => getCandidates().then(r => r.data.data),
  })

  const { data: colleges = [] } = useQuery({
    queryKey: ['colleges'],
    queryFn: () => getColleges().then(r => r.data.data),
  })

  const { filteredData, filters, setFilter, removeFilter, optionMap } = useColumnFilter(candidates, FILTER_KEYS)

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateCandidate(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['candidates'] }); closeModal(); message.success('Candidate updated!') },
    onError: (err) => message.error(err.response?.data?.message || 'Failed to update candidate'),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteCandidate,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['candidates'] }); message.success('Candidate deleted!') },
    onError: (err) => message.error(err.response?.data?.message || 'Failed to delete candidate'),
  })

  const openEdit = async (record) => {
    setEditing(record)
    const full = await getCandidate(record.id).then(r => r.data.data)
    form.setFieldsValue({
      ...full,
      collegeId: full.college?.id,
      internshipAvailability: (() => {
        if (!full.internshipAvailability) return null
        const parts = full.internshipAvailability.split(' to ')
        return parts.length === 2
          ? [dayjs(parts[0], 'MMMM-YYYY'), dayjs(parts[1], 'MMMM-YYYY')]
          : null
      })(),
    })
    const eventId = await getCandidateEvent(full.id).then(r => r.data.data?.id).catch(() => null)
    const eventPositions = eventId
      ? await getEventPositions(eventId).then(r => r.data.data)
      : []
    const preferred = full.preferredPositions ?? []
    const preferredIds = new Set(preferred.map(p => p.id))
    setRankedPositions([...preferred, ...eventPositions.filter(p => !preferredIds.has(p.id))])
  }

  const closeModal = () => { setEditing(null); form.resetFields() }

  const handleSave = (values) => {
    const payload = {
      ...values,
      internshipAvailability: (() => {
        const [start, end] = values.internshipAvailability ?? []
        return start && end
          ? `${start.format('MMMM-YYYY')} to ${end.format('MMMM-YYYY')}`
          : null
      })(),
      preferredPositionIds: rankedPositions.map(p => p.id),
    }
    updateMutation.mutate({ id: editing.id, data: payload })
  }

  const columns = [
    {
      title: 'Name', dataIndex: 'name',
      render: (t, r) => <a onClick={() => navigate(`/candidates/${r.id}`)}><strong>{t}</strong></a>,
    },
    { title: 'Email', dataIndex: 'email' },
    { title: 'Phone', dataIndex: 'phone', render: v => v || '—' },
    { title: 'College', render: (_, r) => r.college?.name ?? '—' },
    { title: 'Branch', dataIndex: 'branch', render: v => v || '—' },
    { title: 'UG CGPA', dataIndex: 'ugCgpa', render: v => v ?? '—' },
    {
      title: 'Total Backlogs', dataIndex: 'backlogs',
      render: v => <Tag color={(v ?? 0) === 0 ? 'green' : 'red'}>{v ?? 0}</Tag>,
    },
    {
      title: 'Preferred Positions',
      render: (_, r) => {
        const preferred = r.preferredPositions ?? [r.preferredPosition1, r.preferredPosition2].filter(Boolean)
        if (!preferred.length) return <span style={{ color: '#9ca3af' }}>—</span>
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {preferred.map((p, i) => (
              <span key={p.id} style={{ fontSize: 12 }}>
                <Tag style={{ fontWeight: 600, minWidth: 22, textAlign: 'center', marginRight: 4 }}>{i + 1}</Tag>
                {p.title}{p.type ? ` — ${p.type}` : ''}
              </span>
            ))}
          </div>
        )
      },
    },
    {
      title: 'Actions',
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/candidates/${r.id}`)}>View</Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>Edit</Button>
          <Popconfirm
            title="Delete this candidate?"
            description="This action cannot be undone."
            onConfirm={() => deleteMutation.mutate(r.id)}
            okText="Yes" cancelText="No" okButtonProps={{ danger: true, loading: deleteMutation.isPending }}
          >
            <Button size="small" danger icon={<DeleteOutlined />} loading={deleteMutation.isPending && deleteMutation.variables === r.id}>Delete</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <>
      <Card title="Candidates" bordered={false} style={{ borderRadius: 12 }}>
        <FilterBar
          filterKeys={FILTER_KEYS}
          optionMap={optionMap}
          filters={filters}
          setFilter={setFilter}
          removeFilter={removeFilter}
        />
        <Table
          dataSource={filteredData}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          scroll={{ x: 900 }}
        />
      </Card>

      <Modal
        title="Edit Candidate"
        open={!!editing}
        onCancel={closeModal}
        onOk={() => form.validateFields().then(handleSave)}
        okText="Save"
        confirmLoading={updateMutation.isPending}
        width={720}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>

          {/* ── Required fields ── */}
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="Full Name" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="username" label="Username" rules={[{ required: true }]}>
                <Input disabled />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="collegeId" label="College" rules={[{ required: true }]}>
                <Select showSearch optionFilterProp="label" options={colleges.map(c => ({ value: c.id, label: c.name }))} />
              </Form.Item>
            </Col>
          </Row>

          {/* ── Contact & basic ── */}
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="phone" label="Phone">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="branch" label="Branch">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="rollNo" label="Roll No">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="jobLocation" label="Job Location">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="internshipAvailability" label="Internship Availability">
                <DatePicker.RangePicker picker="month" style={{ width: '100%' }} format="MMMM YYYY" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="leadershipPositions" label="Leadership Positions">
                <Input />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="githubLink" label="GitHub Link">
                <Input />
              </Form.Item>
            </Col>
          </Row>

          {/* ── Academic ── */}
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="tenthMark" label="10th Mark %">
                <InputNumber style={{ width: '100%' }} min={0} max={100} step={0.01} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="twelfthMark" label="12th Mark %">
                <InputNumber style={{ width: '100%' }} min={0} max={100} step={0.01} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="diplomaMark" label="Diploma Mark %">
                <InputNumber style={{ width: '100%' }} min={0} max={100} step={0.01} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="ugDegree" label="UG Degree">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="ugCgpa" label="UG CGPA">
                <InputNumber style={{ width: '100%' }} min={0} max={10} step={0.01} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="keamRank" label="KEAM Rank">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="pgDegree" label="PG Degree">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="pgCgpa" label="PG CGPA">
                <InputNumber style={{ width: '100%' }} min={0} max={10} step={0.01} />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item name="backlogs" label="Total Backlogs">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item name="arrears" label="Active Backlogs">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
          </Row>

          {/* ── Preferences ── */}
          <Divider orientation="left" style={{ fontSize: 13 }}>Role Preferences</Divider>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>Use arrows to reorder — top position is most preferred.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {rankedPositions.map((pos, index) => (
              <div
                key={pos.id}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, background: '#fff' }}
              >
                <Tag style={{ fontWeight: 600, minWidth: 28, textAlign: 'center', flexShrink: 0 }}>{index + 1}</Tag>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#1e1b4b', flex: 1 }}>
                  {pos.title}
                  {pos.type && <span style={{ fontWeight: 400, color: '#6b7280', marginLeft: 6 }}>— {pos.type}</span>}
                </span>
                <Space size={4}>
                  <Button size="small" icon={<ArrowUpOutlined />} disabled={index === 0} onClick={() => movePosition(index, -1)} />
                  <Button size="small" icon={<ArrowDownOutlined />} disabled={index === rankedPositions.length - 1} onClick={() => movePosition(index, 1)} />
                </Space>
              </div>
            ))}
          </div>

        </Form>
      </Modal>
    </>
  )
}
