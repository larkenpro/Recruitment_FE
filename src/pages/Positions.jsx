import { useState } from 'react'
import { Card, Table, Button, Modal, Form, Input, message, Space, Popconfirm, Tag, Upload } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, ExperimentOutlined, FilePdfOutlined, UploadOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getPositions, createPosition, updatePosition, deletePosition, uploadPositionJd, getPositionJd, deletePositionJd } from '../api/positions'
import { getErrorMessage } from '../utils/errorUtils'
import { useColumnFilter } from '../hooks/useColumnFilter'
import FilterBar from '../components/FilterBar'
import DevOnly from '../components/DevOnly'
import { SPACE } from '../theme'
import { isSimilar, isSimilarOrBlank } from '../utils/similarity'

const FILTER_KEYS = [
  { key: 'department', label: 'Department', getVal: r => r.department },
]

export default function Positions() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form] = Form.useForm()

  const { data: positions, isLoading } = useQuery({
    queryKey: ['positions'],
    queryFn: () => getPositions().then(r => r.data.data)
  })

  const { filteredData, filters, setFilter, removeFilter, optionMap } = useColumnFilter(positions, FILTER_KEYS)

  const createMutation = useMutation({
    mutationFn: createPosition,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['positions'] }); closeModal(); message.success('Position created!') }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updatePosition(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['positions'] }); closeModal(); message.success('Position updated!') }
  })

  const deleteMutation = useMutation({
    mutationFn: deletePosition,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['positions'] }); message.success('Position deleted!') }
  })

  const jdUploadMutation = useMutation({
    mutationFn: ({ id, file }) => uploadPositionJd(id, file),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['positions'] }); message.success('JD PDF uploaded') },
    onError: (err) => message.error(getErrorMessage(err)),
  })

  const jdDeleteMutation = useMutation({
    mutationFn: deletePositionJd,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['positions'] }); message.success('JD PDF removed') },
    onError: (err) => message.error(getErrorMessage(err)),
  })

  // The tab is opened before the fetch so the popup blocker treats it as part of the click.
  const viewJd = async (id) => {
    const tab = window.open('', '_blank')
    try {
      const res = await getPositionJd(id)
      tab.location = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
    } catch (err) {
      tab.close()
      message.error(getErrorMessage(err))
    }
  }

  const fillTestData = () => {
    const titles = ['Software Engineer', 'Business Analyst', 'Data Analyst', 'QA Engineer', 'DevOps Engineer', 'Product Manager', 'Technical BA', 'Cloud Engineer']
    const departments = ['Engineering', 'Product', 'Analytics', 'Quality Assurance', 'Infrastructure', 'Operations']
    form.setFieldsValue({
      title: titles[Math.floor(Math.random() * titles.length)],
      department: departments[Math.floor(Math.random() * departments.length)],
      jobDescription: 'Work with the team to design, build and test features end to end. Freshers welcome; training provided.',
    })
  }

  const openCreate = () => { setEditing(null); form.resetFields(); setOpen(true) }
  const openEdit = (record) => { setEditing(record); form.setFieldsValue(record); setOpen(true) }
  const closeModal = () => { setOpen(false); setEditing(null); form.resetFields() }

  const save = (values) => editing
    ? updateMutation.mutate({ id: editing.id, data: values })
    : createMutation.mutate(values)

  const handleSave = (values) => {
    const dupes = (positions ?? []).filter(p =>
      p.id !== editing?.id
      && isSimilarOrBlank(p.department, values.department)
      && isSimilar(p.title, values.title))
    if (!dupes.length) return save(values)
    Modal.confirm({
      centered: true,
      title: 'Possible duplicate position',
      content: (
        <>
          <p>Similar positions already exist:</p>
          <ul>{dupes.map(p => <li key={p.id}><strong>{p.title}</strong>{p.department ? ` — ${p.department}` : ''}</li>)}</ul>
        </>
      ),
      okText: 'Save anyway', cancelText: 'Go back',
      onOk: () => save(values),
    })
  }

  const columns = [
    { title: 'Title', dataIndex: 'title', render: t => <strong>{t}</strong> },
    { title: 'Department', dataIndex: 'department', render: d => d || '—' },
    {
      // Sent to colleges in automated emails, so a missing one is flagged rather than hidden.
      title: 'Job Description', dataIndex: 'jobDescription', width: 360, ellipsis: true,
      render: jd => jd || <Tag color="red">Missing</Tag>,
    },
    {
      title: 'JD PDF', dataIndex: 'jdFileName', render: (name, r) => (
        <Space size={4}>
          {name && <Button size="small" type="link" icon={<FilePdfOutlined />} onClick={() => viewJd(r.id)} style={{ padding: 0 }}>{name}</Button>}
          <Upload accept="application/pdf,.pdf" showUploadList={false} beforeUpload={(file) => { jdUploadMutation.mutate({ id: r.id, file }); return false }}>
            <Button size="small" icon={<UploadOutlined />} loading={jdUploadMutation.isPending && jdUploadMutation.variables?.id === r.id}>
              {name ? 'Replace' : 'Upload'}
            </Button>
          </Upload>
          {name && (
            <Popconfirm title="Remove this JD PDF?" onConfirm={() => jdDeleteMutation.mutate(r.id)} okText="Remove" cancelText="No">
              <Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label="Remove JD PDF" />
            </Popconfirm>
          )}
        </Space>
      ),
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
      <FilterBar
        filterKeys={FILTER_KEYS}
        optionMap={optionMap}
        filters={filters}
        setFilter={setFilter}
        removeFilter={removeFilter}
      />
      <Table dataSource={filteredData} columns={columns} rowKey="id" loading={isLoading} scroll={{ x: 'max-content' }} />

      <Modal
        title={editing ? 'Edit Position' : 'Add Position'}
        open={open}
        onCancel={closeModal}
        onOk={() => form.validateFields().then(handleSave)}
        okText="Save"
        confirmLoading={createMutation.isPending || updateMutation.isPending}
      >
        <DevOnly>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: SPACE.sm }}>
            <Button icon={<ExperimentOutlined />} size="small" onClick={fillTestData}>Fill Test Data</Button>
          </div>
        </DevOnly>
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="Title" rules={[{ required: true }]}>
            <Input placeholder="Software Engineer" />
          </Form.Item>
          <Form.Item name="department" label="Department">
            <Input placeholder="Engineering" />
          </Form.Item>
          <Form.Item
            name="jobDescription"
            label="Job Description"
            extra="Included in the automated emails sent to colleges."
            rules={[{ required: true, whitespace: true, message: 'Job description is required' }]}
          >
            <Input.TextArea rows={6} placeholder="Responsibilities, skills, eligibility…" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
