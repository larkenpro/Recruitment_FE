import { useEffect, useState } from 'react'
import { Col, DatePicker, Divider, Form, Input, Modal, Row, Select, message } from 'antd'
import { addEventApplication, updateEventApplication } from '../api/events'
import { eventPairs, rankedWithChosenFirst, selectedPreferences } from '../utils/preferences'
import { academicFormValues, academicPayload } from '../utils/academic'
import { getErrorMessage } from '../utils/errorUtils'
import { EMAIL_RULE, PHONE_RULE, URL_RULE, requiredRule } from './validation/rules'
import AcademicFields, { BRANCH_OPTIONS, JOB_LOCATION_OPTIONS } from './AcademicFields'
import PreferenceRanker from './PreferenceRanker'
import ConsentField from './ConsentField'
import { GUTTER } from '../theme'

// Admin entry of a candidate into an event (application == null), or correction of their
// application to it. `eventPositions` is the event's positions with their open types.
export default function EventApplicationModal({ open, eventId, eventPositions, application, onClose, onSaved }) {
  const [form] = Form.useForm()
  const [ranker, setRanker] = useState({ ranked: [], selected: new Set() })
  const [saving, setSaving] = useState(false)
  const editing = !!application

  useEffect(() => {
    if (!open) return
    form.resetFields()
    if (editing) {
      form.setFieldsValue({ ...academicFormValues(application), name: application.name, email: application.email,
        phone: application.phone, githubLink: application.githubLink, linkedinLink: application.linkedinLink })
    }
    setRanker(rankedWithChosenFirst(application?.preferences ?? [], eventPairs(eventPositions)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, application])

  const save = async () => {
    // Failed validation is already shown on the fields.
    const values = await form.validateFields().catch(() => null)
    if (!values) return
    const preferences = selectedPreferences(ranker.ranked, ranker.selected)
    if (preferences.length === 0) {
      message.error('Tick at least one position the candidate is applying for.')
      return
    }
    setSaving(true)
    try {
      const payload = { ...academicPayload(values), preferences }
      if (editing) await updateEventApplication(eventId, application.candidateId, payload)
      else await addEventApplication(eventId, payload)
      message.success(editing ? 'Application updated' : 'Candidate added to the event')
      onSaved()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      title={editing ? `Edit application — ${application.name}` : 'Add candidate to this event'}
      onCancel={onClose}
      onOk={save}
      okText={editing ? 'Save changes' : 'Add candidate'}
      confirmLoading={saving}
      width={820}
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
        <Row gutter={GUTTER}>
          <Col xs={24} sm={12}>
            <Form.Item name="name" label="Full Name" rules={[requiredRule('Name is required')]}>
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="email"
              label="Email"
              rules={editing ? [] : [requiredRule('Email is required'), EMAIL_RULE]}
              extra={editing
                ? 'Email identifies the candidate and is how they sign in; change it from their candidate record.'
                : 'If this email (or roll number at this college) is already on file, that candidate is added to the event.'}
            >
              <Input disabled={editing} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="phone" label="Mobile Number" rules={[PHONE_RULE]}>
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="linkedinLink" label="LinkedIn Profile URL" rules={[URL_RULE]}>
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="rollNo" label="Roll No">
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="branch" label="Branch">
              <Select showSearch allowClear options={BRANCH_OPTIONS} />
            </Form.Item>
          </Col>
        </Row>

        <Divider orientation="left" style={{ fontSize: 13 }}>Academic details for this event</Divider>
        <AcademicFields size="middle" requireCore={false} />
        <Row gutter={GUTTER}>
          <Col xs={24} sm={12}>
            <Form.Item name="jobLocation" label="Preferred Job Location">
              <Select allowClear options={JOB_LOCATION_OPTIONS} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="internshipAvailability" label="Internship Availability">
              <DatePicker.RangePicker picker="month" style={{ width: '100%' }} format="MMMM YYYY" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="githubLink" label="GitHub Link" rules={[URL_RULE]}>
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="leadershipPositions" label="Leadership Positions Held">
              <Input />
            </Form.Item>
          </Col>
        </Row>

        <Divider orientation="left" style={{ fontSize: 13 }}>Positions applied for</Divider>
        {ranker.ranked.length === 0
          ? <div style={{ color: '#6b7280' }}>This event has no positions open yet.</div>
          : (
            <PreferenceRanker
              ranked={ranker.ranked}
              selected={ranker.selected}
              onChange={(ranked, selected) => setRanker({ ranked, selected })}
            />
          )}

        {!editing && (
          <div style={{ marginTop: 16 }}>
            <ConsentField label="The candidate has agreed to J&J Sourcing storing and using their information for recruitment purposes." />
          </div>
        )}
      </Form>
    </Modal>
  )
}
