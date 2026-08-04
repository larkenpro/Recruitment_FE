import { useState } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, Tag, message, Space } from 'antd'
import { PlusOutlined, LinkOutlined, CopyOutlined, ExperimentOutlined, ImportOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getEvents, createEvent, generateLink, updateEventStatus } from '../api/events'
import { getColleges } from '../api/colleges'
import { getPositions } from '../api/positions'
import { useColumnFilter } from '../hooks/useColumnFilter'
import FilterBar from '../components/FilterBar'
import { getErrorMessage } from '../utils/errorUtils'

const FILTER_KEYS = [
  { key: 'college',         label: 'College', getVal: r => r.college?.name },
  { key: 'recruitmentYear', label: 'Year',    getVal: r => r.recruitmentYear },
  { key: 'status',          label: 'Status',  getVal: r => r.status },
]

export default function Events() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [links, setLinks] = useState({})
  const [form] = Form.useForm()

  const { data: events, isLoading } = useQuery({ queryKey: ['events'], queryFn: () => getEvents().then(r => r.data.data) })
  const { filteredData, filters, setFilter, removeFilter, optionMap } = useColumnFilter(events, FILTER_KEYS)
  const { data: colleges } = useQuery({ queryKey: ['colleges'], queryFn: () => getColleges().then(r => r.data.data) })
  const { data: positions } = useQuery({ queryKey: ['positions'], queryFn: () => getPositions().then(r => r.data.data) })

  const createMutation = useMutation({
    mutationFn: createEvent,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['events'] }); setOpen(false); form.resetFields() },
    onError: (err) => message.error(getErrorMessage(err)),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => updateEventStatus(id, status),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['events'] }); message.success('Status updated!') },
    onError: (err) => message.error(getErrorMessage(err)),
  })

  const fillEventTestData = () => {
    const college = colleges?.[Math.floor(Math.random() * (colleges?.length ?? 1))]
    const year = 2024 + Math.floor(Math.random() * 2)
    const month = String(Math.floor(Math.random() * 6) + 6).padStart(2, '0')
    form.setFieldsValue({
      collegeId: college?.id,
      recruitmentYear: year,
      startDate: `${year}-${month}-01`,
      status: 'UPCOMING',
    })
  }

  const handleGenerateLink = async (eventId) => {
    try {
      const res = await generateLink(eventId)
      setLinks(prev => ({ ...prev, [eventId]: res.data }))
      message.success('Link generated!')
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const handleCopy = (url) => { navigator.clipboard.writeText(url); message.success('Copied!') }

  const statusColor = { UPCOMING: 'blue', ACTIVE: 'green', COMPLETED: 'default', CANCELLED: 'red' }

  const columns = [
    { title: '#', dataIndex: 'id', width: 60 },
    { title: 'College', render: (_, r) => <a onClick={() => navigate(`/events/${r.id}`)}><strong>{r.college?.name}</strong></a> },
    { title: 'Year', dataIndex: 'recruitmentYear' },
    { title: 'Start Date', dataIndex: 'startDate' },
    {
      title: 'Status', dataIndex: 'status', render: (s, r) => (
        <Select value={s} size="small" style={{ width: 130 }}
          onChange={val => statusMutation.mutate({ id: r.id, status: val })}
          options={['UPCOMING', 'ACTIVE', 'COMPLETED', 'CANCELLED'].map(v => ({
            value: v, label: <Tag color={statusColor[v] ?? 'default'}>{v}</Tag>
          }))} />
      )
    },
    {
      title: 'Actions', render: (_, r) => (
        <Space>
          <Button size="small" icon={<LinkOutlined />}
            onClick={() => handleGenerateLink(r.id)}
            disabled={r.status !== 'ACTIVE'}>
            Generate Link
          </Button>
          {links[r.id] && (
            <Button size="small" icon={<CopyOutlined />} onClick={() => handleCopy(links[r.id].data)}>
              Copy
            </Button>
          )}
        </Space>
      )
    },
  ]

  return (
    <>
      <Card
        title="Recruitment Events"
        extra={
          <Space>
            <Button icon={<ImportOutlined />} onClick={() => navigate('/import')}>Import from Excel</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>Create Event</Button>
          </Space>
        }
        bordered={false} style={{ borderRadius: 12 }}
      >
        <FilterBar
          filterKeys={FILTER_KEYS}
          optionMap={optionMap}
          filters={filters}
          setFilter={setFilter}
          removeFilter={removeFilter}
        />
        <Table dataSource={filteredData} columns={columns} rowKey="id" loading={isLoading} />
      </Card>

      {/* Create Event Modal */}
      <Modal title="Create Event" open={open} onCancel={() => setOpen(false)}
        onOk={() => form.validateFields().then(v => createMutation.mutate({
          ...v, collegeId: Number(v.collegeId), recruitmentYear: Number(v.recruitmentYear)
        }))} okText="Save">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <Button icon={<ExperimentOutlined />} size="small" onClick={fillEventTestData}>Fill Test Data</Button>
        </div>
        <Form form={form} layout="vertical">
          <Form.Item name="collegeId" label="College" rules={[{ required: true }]}>
            <Select options={colleges?.map(c => ({ value: c.id, label: c.name })) ?? []} />
          </Form.Item>
          <Form.Item name="recruitmentYear" label="Year" rules={[{ required: true }]}>
            <Input type="number" />
          </Form.Item>
          <Form.Item name="startDate" label="Start Date"><Input type="date" /></Form.Item>
          <Form.Item name="status" label="Status" initialValue="UPCOMING">
            <Select options={['UPCOMING', 'ACTIVE', 'COMPLETED', 'CANCELLED'].map(s => ({ value: s }))} />
          </Form.Item>
          <Form.Item name="positionIds" label="Positions">
            <Select
              mode="multiple"
              placeholder="Select positions for this event"
              options={positions?.map(p => ({ value: p.id, label: p.type ? `${p.title} — ${p.type}` : p.title })) ?? []}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
