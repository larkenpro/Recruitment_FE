import { useState } from 'react'
import { Card, Table, Button, Modal, Form, Input, InputNumber, Select, DatePicker, Tag, message, Space, Popconfirm, Row, Col } from 'antd'
import dayjs from 'dayjs'
import { EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getCandidates, updateCandidate, deleteCandidate } from '../api/candidates'
import { getColleges } from '../api/colleges'
import { getPositions } from '../api/positions'
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

  const { data: candidates, isLoading } = useQuery({
    queryKey: ['candidates'],
    queryFn: () => getCandidates().then(r => r.data.data),
  })

  const { data: colleges = [] } = useQuery({
    queryKey: ['colleges'],
    queryFn: () => getColleges().then(r => r.data.data),
  })

  const { data: positions = [] } = useQuery({
    queryKey: ['positions'],
    queryFn: () => getPositions().then(r => r.data.data),
  })

  const { filteredData, filters, setFilter, removeFilter, optionMap } = useColumnFilter(candidates, FILTER_KEYS)

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateCandidate(id, data),
    onSuccess: () => { queryClient.invalidateQueries(['candidates']); closeModal(); message.success('Candidate updated!') },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteCandidate,
    onSuccess: () => { queryClient.invalidateQueries(['candidates']); message.success('Candidate deleted!') },
  })

  const openEdit = (record) => {
    setEditing(record)
    form.setFieldsValue({
      ...record,
      collegeId: record.college?.id,
      preferredPosition1Id: record.preferredPosition1?.id ?? null,
      preferredPosition2Id: record.preferredPosition2?.id ?? null,
      internshipAvailability: (() => {
        if (!record.internshipAvailability) return null
        const parts = record.internshipAvailability.split(' to ')
        return parts.length === 2
          ? [dayjs(parts[0], 'MMMM-YYYY'), dayjs(parts[1], 'MMMM-YYYY')]
          : null
      })(),
    })
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
      title: 'Actions',
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/candidates/${r.id}`)}>View</Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>Edit</Button>
          <Popconfirm
            title="Delete this candidate?"
            description="This action cannot be undone."
            onConfirm={() => deleteMutation.mutate(r.id)}
            okText="Yes" cancelText="No" okButtonProps={{ danger: true }}
          >
            <Button size="small" danger icon={<DeleteOutlined />}>Delete</Button>
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
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="preferredPosition1Id" label="Preferred Role 1">
                <Select
                  showSearch optionFilterProp="label" allowClear
                  options={positions.map(p => ({ value: p.id, label: p.title }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="preferredPosition2Id" label="Preferred Role 2">
                <Select
                  showSearch optionFilterProp="label" allowClear
                  options={positions.map(p => ({ value: p.id, label: p.title }))}
                />
              </Form.Item>
            </Col>
          </Row>

        </Form>
      </Modal>
    </>
  )
}
