import { useState } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, Tag, message, Space, Popconfirm } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getPositions, createPosition, updatePosition, deletePosition } from '../api/positions'

const TYPE_COLORS = { 'Full-Time': 'green', 'Part-Time': 'blue', 'Internship': 'orange', 'Contract': 'purple' }
const TYPE_OPTIONS = ['Full-Time', 'Part-Time', 'Internship', 'Contract'].map(v => ({ value: v }))

export default function Positions() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form] = Form.useForm()

  const { data: positions, isLoading } = useQuery({
    queryKey: ['positions'],
    queryFn: () => getPositions().then(r => r.data.data)
  })

  const createMutation = useMutation({
    mutationFn: createPosition,
    onSuccess: () => { queryClient.invalidateQueries(['positions']); closeModal(); message.success('Position created!') }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updatePosition(id, data),
    onSuccess: () => { queryClient.invalidateQueries(['positions']); closeModal(); message.success('Position updated!') }
  })

  const deleteMutation = useMutation({
    mutationFn: deletePosition,
    onSuccess: () => { queryClient.invalidateQueries(['positions']); message.success('Position deleted!') }
  })

  const openCreate = () => { setEditing(null); form.resetFields(); setOpen(true) }
  const openEdit = (record) => { setEditing(record); form.setFieldsValue(record); setOpen(true) }
  const closeModal = () => { setOpen(false); setEditing(null); form.resetFields() }

  const handleSave = (values) => {
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: values })
    } else {
      createMutation.mutate(values)
    }
  }

  const columns = [
    { title: '#', dataIndex: 'id', width: 60 },
    { title: 'Title', dataIndex: 'title', render: t => <strong>{t}</strong> },
    { title: 'Department', dataIndex: 'department', render: d => d || '—' },
    {
      title: 'Type', dataIndex: 'type',
      render: t => t ? <Tag color={TYPE_COLORS[t] ?? 'default'}>{t}</Tag> : '—'
    },
    {
      title: 'Actions', render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>Edit</Button>
          <Popconfirm
            title="Delete this position?"
            onConfirm={() => deleteMutation.mutate(r.id)}
            okText="Yes" cancelText="No"
          >
            <Button size="small" danger icon={<DeleteOutlined />}>Delete</Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <Card
      title="Positions"
      extra={<Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Add Position</Button>}
      bordered={false} style={{ borderRadius: 12 }}
    >
      <Table dataSource={positions ?? []} columns={columns} rowKey="id" loading={isLoading} />

      <Modal
        title={editing ? 'Edit Position' : 'Add Position'}
        open={open}
        onCancel={closeModal}
        onOk={() => form.validateFields().then(handleSave)}
        okText="Save"
        confirmLoading={createMutation.isPending || updateMutation.isPending}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="Title" rules={[{ required: true }]}>
            <Input placeholder="Software Engineer" />
          </Form.Item>
          <Form.Item name="department" label="Department">
            <Input placeholder="Engineering" />
          </Form.Item>
          <Form.Item name="type" label="Type">
            <Select placeholder="Select type" options={TYPE_OPTIONS} allowClear />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
