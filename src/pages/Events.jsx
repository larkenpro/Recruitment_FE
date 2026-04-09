import { useState } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, Tag, message, Space, Divider, InputNumber, List } from 'antd'
import { PlusOutlined, LinkOutlined, CopyOutlined, UnorderedListOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getEvents, createEvent, generateLink, updateEventStatus, getRounds, createRound } from '../api/events'
import { getColleges } from '../api/colleges'

export default function Events() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [roundsModal, setRoundsModal] = useState(null) // holds selected event
  const [links, setLinks] = useState({})
  const [form] = Form.useForm()
  const [roundForm] = Form.useForm()

  const { data: events, isLoading } = useQuery({ queryKey: ['events'], queryFn: () => getEvents().then(r => r.data.data) })
  const { data: colleges } = useQuery({ queryKey: ['colleges'], queryFn: () => getColleges().then(r => r.data.data) })
  const { data: rounds } = useQuery({
    queryKey: ['rounds', roundsModal?.id],
    queryFn: () => getRounds(roundsModal.id).then(r => r.data.data),
    enabled: !!roundsModal
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
    setLinks(prev => ({ ...prev, [eventId]: res.data.data.applyUrl }))
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
          {links[r.id] && <Button size="small" icon={<CopyOutlined />} onClick={() => handleCopy(links[r.id])}>Copy</Button>}
          <Button size="small" icon={<UnorderedListOutlined />} onClick={() => setRoundsModal(r)}>
            Rounds
          </Button>
        </Space>
      )
    },
  ]

  return (
    <>
      <Card
        title="Recruitment Events"
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>Create Event</Button>}
        bordered={false} style={{ borderRadius: 12 }}
      >
        <Table dataSource={events ?? []} columns={columns} rowKey="id" loading={isLoading} />
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
    </>
  )
}
