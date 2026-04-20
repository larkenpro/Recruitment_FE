import { useEffect, useState } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, Tag, message, Space, Divider, InputNumber, List } from 'antd'
import { PlusOutlined, LinkOutlined, CopyOutlined, UnorderedListOutlined, AppstoreOutlined, TeamOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getEvents, createEvent, generateLink, updateEventStatus, getRounds, createRound, getEventPositions, getCandidatesByEvent } from '../api/events'
import { getColleges } from '../api/colleges'
import { getPositions } from '../api/positions'
import { useColumnFilter } from '../hooks/useColumnFilter'
import FilterBar from '../components/FilterBar'

const FILTER_KEYS = [
  { key: 'college',         label: 'College', getVal: r => r.college?.name },
  { key: 'recruitmentYear', label: 'Year',    getVal: r => r.recruitmentYear },
  { key: 'status',          label: 'Status',  getVal: r => r.status },
]

export default function Events() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [roundsModal, setRoundsModal] = useState(null) // holds selected event
  const [positionsModal, setPositionsModal] = useState(null) // holds selected event (read-only)
  const [candidatesModal, setCandidatesModal] = useState(null) // holds selected event
  const [links, setLinks] = useState({})
  const [form] = Form.useForm()
  const [roundForm] = Form.useForm()

  const { data: events, isLoading } = useQuery({ queryKey: ['events'], queryFn: () => getEvents().then(r => r.data.data) })

  const { filteredData, filters, setFilter, removeFilter, optionMap } = useColumnFilter(events, FILTER_KEYS)
  const { data: colleges } = useQuery({ queryKey: ['colleges'], queryFn: () => getColleges().then(r => r.data.data) })
  const { data: rounds } = useQuery({
    queryKey: ['rounds', roundsModal?.id],
    queryFn: () => getRounds(roundsModal.id).then(r => r.data.data),
    enabled: !!roundsModal
  })

  const { data: positions } = useQuery({
    queryKey: ['positions'],
    queryFn: () => getPositions().then(r => r.data.data)
  })

  const { data: eventPositions } = useQuery({
    queryKey: ['eventPositions', positionsModal?.id],
    queryFn: () => getEventPositions(positionsModal.id).then(r => r.data.data),
    enabled: !!positionsModal
  })

  const { data: eventCandidates, isLoading: candidatesLoading } = useQuery({
    queryKey: ['eventCandidates', candidatesModal?.id],
    queryFn: () => getCandidatesByEvent(candidatesModal.id).then(r => r.data.data),
    enabled: !!candidatesModal
  })

  const createMutation = useMutation({
    mutationFn: createEvent,
    onSuccess: () => { queryClient.invalidateQueries(['events']); setOpen(false); form.resetFields() }
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => updateEventStatus(id, status),
    onSuccess: () => { queryClient.invalidateQueries(['events']); message.success('Status updated!') }
  })

  const roundMutation = useMutation({
    mutationFn: ({ eventId, data }) => createRound(eventId, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['rounds', roundsModal?.id])
      roundForm.resetFields()
      message.success('Round added!')
    }
  })

  const handleGenerateLink = async (eventId) => {
    const res = await generateLink(eventId)
    setLinks(prev => ({ ...prev, [eventId]: res.data }))
    message.success('Link generated!')
  }

  const handleCopy = (url) => { navigator.clipboard.writeText(url); message.success('Copied!') }

  const statusColor = { UPCOMING: 'blue', ACTIVE: 'green', COMPLETED: 'default', CANCELLED: 'red' }

  const columns = [
    { title: '#', dataIndex: 'id', width: 60 },
    { title: 'College', render: (_, r) => r.college?.name },
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
          {links[r.id] && <Button size="small" icon={<CopyOutlined />} onClick={() => handleCopy(links[r.id].data)}>Copy</Button>}
          <Button size="small" icon={<UnorderedListOutlined />} onClick={() => setRoundsModal(r)}>
            Rounds
          </Button>
          <Button size="small" icon={<AppstoreOutlined />} onClick={() => setPositionsModal(r)}>
            Positions
          </Button>
          <Button size="small" icon={<TeamOutlined />} onClick={() => setCandidatesModal(r)}>
            Candidates
          </Button>
        </Space>
      )
    },
  ]

  useEffect(() => {
    console.log(links)
  }, [links])
  return (
    <>
      <Card
        title="Recruitment Events"
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>Create Event</Button>}
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
              options={positions?.map(p => ({ value: p.id, label: p.title })) ?? []}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Rounds Modal */}
      <Modal
        title={`Rounds — ${roundsModal?.college?.name} (${roundsModal?.recruitmentYear})`}
        open={!!roundsModal}
        onCancel={() => { setRoundsModal(null); roundForm.resetFields() }}
        footer={null}
        width={560}
      >
        <List
          dataSource={rounds ?? []}
          locale={{ emptyText: 'No rounds added yet' }}
          renderItem={r => (
            <List.Item>
              <List.Item.Meta
                title={<span>{r.sequence}. {r.name}</span>}
                description={r.roundType}
              />
            </List.Item>
          )}
        />
        <Divider>Add New Round</Divider>
        <Form form={roundForm} layout="vertical"
          onFinish={v => roundMutation.mutate({ eventId: roundsModal.id, data: { ...v, sequence: Number(v.sequence) } })}>
          <Form.Item name="name" label="Round Name" rules={[{ required: true }]}>
            <Input placeholder="Aptitude Test" />
          </Form.Item>
          <Form.Item name="roundType" label="Round Type">
            <Select options={['WRITTEN', 'TECHNICAL', 'HR', 'GROUP_DISCUSSION', 'CODING'].map(s => ({ value: s }))} />
          </Form.Item>
          <Form.Item name="sequence" label="Sequence" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} placeholder="1" min={1} />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={roundMutation.isLoading}>Add Round</Button>
        </Form>
      </Modal>
      {/* Candidates Modal */}
      <Modal
        title={`Candidates — ${candidatesModal?.college?.name} (${candidatesModal?.recruitmentYear})`}
        open={!!candidatesModal}
        onCancel={() => setCandidatesModal(null)}
        footer={null}
        width={860}
      >
        <Table
          dataSource={eventCandidates ?? []}
          loading={candidatesLoading}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: 'No candidates have applied yet' }}
          columns={[
            {
              title: 'Name', dataIndex: 'name',
              render: (t, r) => <a onClick={() => { setCandidatesModal(null); navigate(`/candidates/${r.id}`) }}><strong>{t}</strong></a>
            },
            { title: 'Email', dataIndex: 'email' },
            { title: 'Phone', dataIndex: 'phone', render: v => v || '—' },
            { title: 'Branch', dataIndex: 'branch', render: v => v || '—' },
            { title: 'UG CGPA', dataIndex: 'ugCgpa', render: v => v ?? '—' },
            { title: 'Pref. Role 1', render: (_, r) => r.preferredPosition1?.title ?? '—' },
            { title: 'Pref. Role 2', render: (_, r) => r.preferredPosition2?.title ?? '—' },
            {
              title: 'Backlogs', dataIndex: 'backlogs',
              render: v => <Tag color={(v ?? 0) === 0 ? 'green' : 'red'}>{v ?? 0}</Tag>
            },
          ]}
        />
      </Modal>

      {/* Positions Modal (read-only) */}
      <Modal
        title={`Positions — ${positionsModal?.college?.name} (${positionsModal?.recruitmentYear})`}
        open={!!positionsModal}
        onCancel={() => setPositionsModal(null)}
        footer={null}
        width={480}
      >
        <List
          dataSource={eventPositions ?? []}
          locale={{ emptyText: 'No positions linked to this event' }}
          renderItem={p => (
            <List.Item>
              <List.Item.Meta
                title={p.title}
                description={[p.department, p.type].filter(Boolean).join(' · ')}
              />
            </List.Item>
          )}
        />
      </Modal>
    </>
  )
}
