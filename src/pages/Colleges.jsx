import { useState } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, Tag, message } from 'antd'
import { PlusOutlined, EditOutlined, ExperimentOutlined, TeamOutlined, DeleteOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getColleges, createCollege, updateCollege } from '../api/colleges'
import { useColumnFilter } from '../hooks/useColumnFilter'
import FilterBar from '../components/FilterBar'

const FILTER_KEYS = [
  { key: 'city',  label: 'City',  getVal: r => r.city },
  { key: 'state', label: 'State', getVal: r => r.state },
  { key: 'tier',  label: 'Tier',  getVal: r => r.tier },
]

// Additional contacts are stored as a flat string on the college: "name,email,phone"
// entries joined by ";", in the order they were added — no separate contacts table.
// ponytail: naive split, breaks if a value itself contains ',' or ';'.
const parseContacts = (str) =>
  (str || '')
    .split(';')
    .map(s => s.trim())
    .filter(Boolean)
    .map(entry => {
      const [name = '', email = '', phone = ''] = entry.split(',').map(s => s.trim())
      return { name, email, phone }
    })

const serializeContacts = (contacts) =>
  contacts.map(c => [c.name, c.email, c.phone].join(',')).join(';')

// Merges the primary contact fields with the parsed additionalContacts entries
// into one ordered list of rows for display as a table.
const buildContactRows = (college) => {
  const rows = []
  if (college?.contactPerson || college?.collegeEmail || college?.phoneNumber) {
    rows.push({ key: 'primary', name: college.contactPerson, email: college.collegeEmail, phone: college.phoneNumber, primary: true })
  }
  parseContacts(college?.additionalContacts).forEach((c, i) => rows.push({ key: i, contactIndex: i, ...c }))
  return rows
}

const buildCollegeRequestPayload = (college, additionalContacts) => ({
  name: college.name,
  city: college.city,
  state: college.state,
  tier: college.tier,
  contactPerson: college.contactPerson,
  collegeEmail: college.collegeEmail,
  phoneNumber: college.phoneNumber,
  additionalContacts,
})

export default function Colleges() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editingCollege, setEditingCollege] = useState(null)
  const [form] = Form.useForm()
  const [contactsFor, setContactsFor] = useState(null)
  const [contactForm] = Form.useForm()

  const { data: colleges, isLoading } = useQuery({ queryKey: ['colleges'], queryFn: () => getColleges().then(r => r.data.data) })

  const { filteredData, filters, setFilter, removeFilter, optionMap } = useColumnFilter(colleges, FILTER_KEYS)

  const createMutation = useMutation({
    mutationFn: createCollege,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['colleges'] }); closeModal(); message.success('College created!') },
    onError: (err) => message.error(err.response?.data?.message || `Failed to create college (${err.response?.status ?? 'network error'})`),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateCollege(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['colleges'] }); closeModal(); message.success('College updated!') },
    onError: (err) => message.error(err.response?.data?.message || `Failed to update college (${err.response?.status ?? 'network error'})`),
  })

  const contactsMutation = useMutation({
    mutationFn: ({ id, data }) => updateCollege(id, data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['colleges'] })
      setContactsFor(res.data.data)
      contactForm.resetFields()
    },
    onError: (err) => message.error(err.response?.data?.message || `Failed to update contacts (${err.response?.status ?? 'network error'})`),
  })

  const openContacts = (record) => setContactsFor(record)
  const closeContacts = () => { setContactsFor(null); contactForm.resetFields() }

  const addContact = (values) => {
    const updated = [...parseContacts(contactsFor.additionalContacts), values]
    contactsMutation.mutate({ id: contactsFor.id, data: buildCollegeRequestPayload(contactsFor, serializeContacts(updated)) })
  }

  const removeContact = (index) => {
    const updated = parseContacts(contactsFor.additionalContacts).filter((_, i) => i !== index)
    contactsMutation.mutate({ id: contactsFor.id, data: buildCollegeRequestPayload(contactsFor, serializeContacts(updated)) })
  }

  const fillTestData = () => {
    const colleges = [
      { name: 'IIT Madras', city: 'Chennai', state: 'Tamil Nadu', contactPerson: 'Dr. Ramesh Kumar', collegeEmail: 'placement@iitm.ac.in', phoneNumber: '9876543210' },
      { name: 'NIT Calicut', city: 'Calicut', state: 'Kerala', contactPerson: 'Prof. Anil Nair', collegeEmail: 'tpo@nitc.ac.in', phoneNumber: '9876543211' },
      { name: 'CUSAT', city: 'Kochi', state: 'Kerala', contactPerson: 'Dr. Priya Menon', collegeEmail: 'placements@cusat.ac.in', phoneNumber: '9876543212' },
      { name: 'BITS Pilani', city: 'Pilani', state: 'Rajasthan', contactPerson: 'Prof. Suresh Sharma', collegeEmail: 'cd@bits-pilani.ac.in', phoneNumber: '9876543213' },
      { name: 'VIT Vellore', city: 'Vellore', state: 'Tamil Nadu', contactPerson: 'Ms. Lakshmi Devi', collegeEmail: 'placements@vit.ac.in', phoneNumber: '9876543214' },
    ]
    const tiers = ['Tier 1', 'Tier 2', 'Tier 3']
    const idx = Math.floor(Math.random() * colleges.length)
    form.setFieldsValue({
      ...colleges[idx],
      tier: tiers[Math.floor(Math.random() * tiers.length)],
    })
  }

  const openAdd = () => { setEditingCollege(null); form.resetFields(); setOpen(true) }

  const openEdit = (record) => { setEditingCollege(record); form.setFieldsValue(record); setOpen(true) }

  const closeModal = () => { setOpen(false); setEditingCollege(null); form.resetFields() }

  const handleOk = () => form.validateFields().then(values => {
    if (editingCollege) updateMutation.mutate({ id: editingCollege.id, data: values })
    else createMutation.mutate(values)
  })

  const contactColumns = [
    { title: 'Name', dataIndex: 'name', render: v => v || '—' },
    { title: 'Email', dataIndex: 'email', render: v => v || '—' },
    { title: 'Phone', dataIndex: 'phone', render: v => v || '—' },
    {
      title: '', width: 40, render: (_, record) => record.primary ? null : (
        <Button
          size="small" type="text" danger icon={<DeleteOutlined />}
          onClick={() => removeContact(record.contactIndex)}
          loading={contactsMutation.isPending}
        />
      )
    },
  ]

  const columns = [
    { title: '#', dataIndex: 'id', width: 60 },
    { title: 'Name', dataIndex: 'name', render: t => <strong>{t}</strong> },
    { title: 'City', dataIndex: 'city' },
    { title: 'State', dataIndex: 'state' },
    { title: 'Tier', dataIndex: 'tier', render: t => <Tag color={t === 'Tier 1' ? 'blue' : t === 'Tier 2' ? 'green' : 'default'}>{t}</Tag> },
    {
      title: 'Actions', width: 120, render: (_, record) => (
        <>
          <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(record)} />
          <Button icon={<TeamOutlined />} size="small" style={{ marginLeft: 8 }} onClick={() => openContacts(record)} />
        </>
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
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <Button icon={<ExperimentOutlined />} size="small" onClick={fillTestData}>Fill Test Data</Button>
        </div>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="College Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="city" label="City"><Input /></Form.Item>
          <Form.Item name="state" label="State"><Input /></Form.Item>
          <Form.Item name="tier" label="Tier">
            <Select options={[{ value: 'Tier 1' }, { value: 'Tier 2' }, { value: 'Tier 3' }]} />
          </Form.Item>
          <Form.Item name="contactPerson" label="Contact Person"><Input /></Form.Item>
          <Form.Item name="collegeEmail" label="College Email" rules={[{ type: 'email', message: 'Enter a valid email' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phoneNumber" label="Phone Number"><Input /></Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Contacts — ${contactsFor?.name ?? ''}`}
        open={!!contactsFor}
        onCancel={closeContacts}
        footer={null}
      >
        <Table
          dataSource={buildContactRows(contactsFor)}
          columns={contactColumns}
          pagination={false}
          size="small"
          style={{ marginBottom: 20 }}
        />
        <Form form={contactForm} layout="inline" onFinish={addContact} style={{ rowGap: 12, columnGap: 12 }}>
          <Form.Item name="name" style={{ marginRight: 0 }} rules={[{ required: true, message: 'Name required' }]}>
            <Input placeholder="Name" />
          </Form.Item>
          <Form.Item name="email" style={{ marginRight: 0 }} rules={[{ type: 'email', message: 'Invalid email' }]}>
            <Input placeholder="Email" />
          </Form.Item>
          <Form.Item name="phone" style={{ marginRight: 0 }}>
            <Input placeholder="Phone" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={contactsMutation.isPending}>Add Contact</Button>
        </Form>
      </Modal>
    </Card>
  )
}
