import { useState } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, Tag, message } from 'antd'
import { PlusOutlined, EditOutlined, ExperimentOutlined, DeleteOutlined, TeamOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getColleges, createCollege, updateCollege } from '../api/colleges'
import { useColumnFilter } from '../hooks/useColumnFilter'
import FilterBar from '../components/FilterBar'
import { EMAIL_RULE, PHONE_RULE } from '../components/validation/rules'
import DevOnly from '../components/DevOnly'
import { SPACE } from '../theme'

const FILTER_KEYS = [
  { key: 'city',  label: 'City',  getVal: r => r.city },
  { key: 'state', label: 'State', getVal: r => r.state },
  { key: 'tier',  label: 'Tier',  getVal: r => r.tier },
]

// contactPerson/collegeEmail/phoneNumber each hold a comma-joined, index-aligned
// list of values — contact i is {name[i], email[i], phone[i]}.
const splitList = (s) => (s || '').split(',').map(v => v.trim())

const contactsFromRecord = (r) => {
  const names = splitList(r?.contactPerson)
  const emails = splitList(r?.collegeEmail)
  const phones = splitList(r?.phoneNumber)
  const count = Math.max(names.length, emails.length, phones.length, 1)
  return Array.from({ length: count }, (_, i) => ({
    contactPerson: names[i] || '',
    collegeEmail: emails[i] || '',
    phoneNumber: phones[i] || '',
  }))
}

const contactsToFields = (contacts) => ({
  contactPerson: contacts.map(c => c.contactPerson || '').join(','),
  collegeEmail: contacts.map(c => c.collegeEmail || '').join(','),
  phoneNumber: contacts.map(c => c.phoneNumber || '').join(','),
})

export default function Colleges() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editingCollege, setEditingCollege] = useState(null)
  const [form] = Form.useForm()

  const [contactsCollege, setContactsCollege] = useState(null)
  const [contactsForm] = Form.useForm()

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

  const updateContactsMutation = useMutation({
    mutationFn: ({ id, data }) => updateCollege(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['colleges'] }); closeContactsModal(); message.success('Contacts updated!') },
    onError: (err) => message.error(err.response?.data?.message || `Failed to update contacts (${err.response?.status ?? 'network error'})`),
  })

  const fillTestData = () => {
    const colleges = [
      { name: 'IIT Madras', city: 'Chennai', state: 'Tamil Nadu' },
      { name: 'NIT Calicut', city: 'Calicut', state: 'Kerala' },
      { name: 'CUSAT', city: 'Kochi', state: 'Kerala' },
      { name: 'BITS Pilani', city: 'Pilani', state: 'Rajasthan' },
      { name: 'VIT Vellore', city: 'Vellore', state: 'Tamil Nadu' },
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
    if (editingCollege) {
      const { id, ...base } = editingCollege
      updateMutation.mutate({ id, data: { ...base, ...values } })
    } else {
      createMutation.mutate(values)
    }
  })

  const openContacts = (record) => {
    setContactsCollege(record)
    contactsForm.setFieldsValue({ contacts: contactsFromRecord(record) })
  }

  const closeContactsModal = () => { setContactsCollege(null); contactsForm.resetFields() }

  const handleContactsOk = () => contactsForm.validateFields().then(({ contacts }) => {
    const { id, ...base } = contactsCollege
    updateContactsMutation.mutate({ id, data: { ...base, ...contactsToFields(contacts) } })
  })

  const columns = [
    { title: '#', dataIndex: 'id', width: 60 },
    { title: 'Name', dataIndex: 'name', render: t => <strong>{t}</strong> },
    { title: 'City', dataIndex: 'city' },
    { title: 'State', dataIndex: 'state' },
    { title: 'Tier', dataIndex: 'tier', render: t => <Tag color={t === 'Tier 1' ? 'blue' : t === 'Tier 2' ? 'green' : 'default'}>{t}</Tag> },
    {
      title: 'Contacts', width: 140, render: (_, record) => {
        const n = contactsFromRecord(record).filter(c => c.contactPerson || c.collegeEmail || c.phoneNumber).length
        return (
          <Button size="small" icon={<TeamOutlined />} onClick={() => openContacts(record)}>
            {n} contact{n === 1 ? '' : 's'}
          </Button>
        )
      }
    },
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
      <Table dataSource={filteredData} columns={columns} rowKey="id" loading={isLoading} scroll={{ x: 'max-content' }} />

      <Modal
        title={editingCollege ? 'Edit College' : 'Add College'}
        open={open}
        onCancel={closeModal}
        onOk={handleOk}
        okText="Save"
        confirmLoading={createMutation.isPending || updateMutation.isPending}
      >
        <DevOnly>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: SPACE.sm }}>
            <Button icon={<ExperimentOutlined />} size="small" onClick={fillTestData}>Fill Test Data</Button>
          </div>
        </DevOnly>
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

      <Modal
        title={`Contacts — ${contactsCollege?.name ?? ''}`}
        open={!!contactsCollege}
        onCancel={closeContactsModal}
        onOk={handleContactsOk}
        okText="Save"
        confirmLoading={updateContactsMutation.isPending}
        destroyOnClose
      >
        <Form form={contactsForm} layout="vertical">
          <Form.List name="contacts" initialValue={[{}]}>
            {(fields, { add, remove }) => (
              <>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', paddingBottom: 8 }}>Contact Person</th>
                      <th style={{ textAlign: 'left', paddingBottom: 8 }}>Email</th>
                      <th style={{ textAlign: 'left', paddingBottom: 8 }}>Phone</th>
                      <th style={{ width: 32 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map(({ key, name, ...field }) => (
                      <tr key={key}>
                        <td style={{ paddingRight: 8, paddingBottom: 8 }}>
                          <Form.Item {...field} name={[name, 'contactPerson']} noStyle>
                            <Input placeholder="Contact Person" />
                          </Form.Item>
                        </td>
                        <td style={{ paddingRight: 8, paddingBottom: 8 }}>
                          <Form.Item {...field} name={[name, 'collegeEmail']} rules={[EMAIL_RULE]} noStyle>
                            <Input placeholder="Email" />
                          </Form.Item>
                        </td>
                        <td style={{ paddingRight: 8, paddingBottom: 8 }}>
                          <Form.Item {...field} name={[name, 'phoneNumber']} rules={[PHONE_RULE]} noStyle>
                            <Input placeholder="Phone" />
                          </Form.Item>
                        </td>
                        <td style={{ paddingBottom: 8 }}>
                          {fields.length > 1 && (
                            <Button icon={<DeleteOutlined />} size="small" danger onClick={() => remove(name)} />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Button icon={<PlusOutlined />} size="small" onClick={() => add()}>Add Contact</Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>
    </Card>
  )
}
