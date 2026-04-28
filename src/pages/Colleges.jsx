import { useState } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, Tag } from 'antd'
import { PlusOutlined, EditOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getColleges, createCollege, updateCollege } from '../api/colleges'
import { useColumnFilter } from '../hooks/useColumnFilter'
import FilterBar from '../components/FilterBar'

const FILTER_KEYS = [
  { key: 'city',  label: 'City',  getVal: r => r.city },
  { key: 'state', label: 'State', getVal: r => r.state },
  { key: 'tier',  label: 'Tier',  getVal: r => r.tier },
]

export default function Colleges() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editingCollege, setEditingCollege] = useState(null)
  const [form] = Form.useForm()

  const { data: colleges, isLoading } = useQuery({ queryKey: ['colleges'], queryFn: () => getColleges().then(r => r.data.data) })

  const { filteredData, filters, setFilter, removeFilter, optionMap } = useColumnFilter(colleges, FILTER_KEYS)

  const createMutation = useMutation({
    mutationFn: createCollege,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['colleges'] }); closeModal() }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateCollege(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['colleges'] }); closeModal() }
  })

  const openAdd = () => { setEditingCollege(null); form.resetFields(); setOpen(true) }

  const openEdit = (record) => { setEditingCollege(record); form.setFieldsValue(record); setOpen(true) }

  const closeModal = () => { setOpen(false); setEditingCollege(null); form.resetFields() }

  const handleOk = () => form.validateFields().then(values => {
    if (editingCollege) updateMutation.mutate({ id: editingCollege.id, data: values })
    else createMutation.mutate(values)
  })

  const columns = [
    { title: '#', dataIndex: 'id', width: 60 },
    { title: 'Name', dataIndex: 'name', render: t => <strong>{t}</strong> },
    { title: 'City', dataIndex: 'city' },
    { title: 'State', dataIndex: 'state' },
    { title: 'Tier', dataIndex: 'tier', render: t => <Tag color={t === 'Tier 1' ? 'blue' : t === 'Tier 2' ? 'green' : 'default'}>{t}</Tag> },
    {
      title: 'Actions', width: 80, render: (_, record) => (
        <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(record)} />
      )
    },
  ]

  return (
    <Card
      title="Colleges"
      extra={<Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>Add College</Button>}
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

      <Modal
        title={editingCollege ? 'Edit College' : 'Add College'}
        open={open}
        onCancel={closeModal}
        onOk={handleOk}
        okText="Save"
        confirmLoading={createMutation.isPending || updateMutation.isPending}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="College Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="city" label="City"><Input /></Form.Item>
          <Form.Item name="state" label="State"><Input /></Form.Item>
          <Form.Item name="tier" label="Tier">
            <Select options={[{ value: 'Tier 1' }, { value: 'Tier 2' }, { value: 'Tier 3' }]} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
