import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { Form, Input, Select, Button, Card, Row, Col, Typography, Divider, Upload, Alert, Steps, Result, DatePicker, Modal, message } from 'antd'
import { UploadOutlined, UserOutlined, BookOutlined, AimOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { getApplyForm, submitApplication, checkApplication, getPublicEventPositions } from '../api/candidates'
import { requestSignInLink } from '../api/portal'
import { eventPairs, hasInternship, hasItPosition, preferenceKey, tickedPairs } from '../utils/preferences'
import { academicPayload } from '../utils/academic'
import { EMAIL_RULE, PHONE_RULE, URL_RULE, requiredRule } from '../components/validation/rules'
import AcademicFields, { BRANCH_OPTIONS, JOB_LOCATION_OPTIONS } from '../components/AcademicFields'
import PreferenceRanker from '../components/PreferenceRanker'
import ConsentField from '../components/ConsentField'
import { eventMode } from '../utils/eventModes'
import DevOnly from '../components/DevOnly'
import { RESUME_TOO_LARGE, resumeTooLarge } from '../utils/resume'
import { SPACE, GUTTER } from '../theme'

const { Title, Text } = Typography

export default function PublicApply() {
  const { token } = useParams()
  const [form] = Form.useForm()
  const [eventInfo, setEventInfo] = useState(null)
  // Every (position, type) pair the event is hiring for, in the candidate's ranked order;
  // only the ticked ones are submitted.
  const [rankedPairs, setRankedPairs] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [positionsLoaded, setPositionsLoaded] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resumeFile, setResumeFile] = useState(null)
  const [step, setStep] = useState(0)
  const [checking, setChecking] = useState(false)
  // { matchedBy, maskedEmail, linkSent } when the email or roll number is already on file.
  const [existing, setExisting] = useState(null)
  const [sendingLink, setSendingLink] = useState(false)
  // Set by a submit with nothing ticked; the prompt shows by the ranker until one is ticked.
  const [prefError, setPrefError] = useState(false)
  const rankerRef = useRef(null)
  // GitHub and internship availability are only asked for when a ticked position calls for them.
  const ticked = tickedPairs(rankedPairs, selected)

  useEffect(() => {
    getApplyForm(token)
      .then(r => {
        setEventInfo(r.data)
        return getPublicEventPositions(r.data.data.event.id)
      })
      .then(r => { setRankedPairs(eventPairs(r.data.data)); setPositionsLoaded(true) })
      .catch((err) => setError(err.response?.data?.message || 'Invalid or expired link'))
  }, [token])

  // An existing candidate updates their details from the candidate page, not this form —
  // so check before they fill everything in.
  const lookUpExisting = async () => {
    const { data } = await checkApplication(token, {
      email: form.getFieldValue('email'),
      rollNo: form.getFieldValue('rollNo') || null,
    })
    const result = data.data
    if (result.exists) setExisting({ ...result, linkSent: false })
    return result.exists
  }

  const handleFirstStepNext = async () => {
    await form.validateFields(['name', 'email', 'branch'])
    setChecking(true)
    try {
      if (!(await lookUpExisting())) setStep(1)
    } catch (err) {
      // An expired link is the one hard stop; anything else shouldn't block applying.
      const message = err.response?.data?.message
      if (message?.toLowerCase().includes('expired')) setError(message)
      else setStep(1)
    } finally {
      setChecking(false)
    }
  }

  const sendSignInLink = async () => {
    setSendingLink(true)
    try {
      await requestSignInLink({
        applyToken: token,
        email: form.getFieldValue('email'),
        rollNo: form.getFieldValue('rollNo') || null,
      })
      setExisting(prev => ({ ...prev, linkSent: true }))
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send the link. Please try again.')
      setExisting(null)
    } finally {
      setSendingLink(false)
    }
  }

  const handleSubmit = async (values) => {
    if (selected.size === 0) {
      setPrefError(true)
      rankerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    if (!resumeFile) {
      setError('Please upload your resume before submitting.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await submitApplication(token, {
        ...academicPayload(values),
        preferences: rankedPairs.map(preferenceKey).filter(key => selected.has(key)),
      }, resumeFile)
      setSubmitted(true)
    } catch (err) {
      // 409: they became a known candidate since the first check (or skipped it).
      if (err.response?.status === 409) {
        setStep(0)
        await lookUpExisting().catch(() => setError(err.response.data?.message))
      } else {
        setError(err.response?.data?.message || 'Submission failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (error && !eventInfo) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f6fa' }}>
      <Result status="error" title="Invalid Link" subTitle={error} />
    </div>
  )

  if (submitted) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f6fa' }}>
      <Result status="success" title="Application Submitted!" subTitle="Thank you for applying. We will get back to you soon." />
    </div>
  )

  if (!eventInfo) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Text>Loading...</Text>
    </div>
  )

  if (positionsLoaded && rankedPairs.length === 0) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f6fa' }}>
      <Result status="warning" title="No Open Positions" subTitle="This event doesn't have any positions open for applications yet. Please check back later or contact the recruiter." />
    </div>
  )

  const steps = [
    { title: 'Personal Info', icon: <UserOutlined /> },
    { title: 'Academic Details', icon: <BookOutlined /> },
    { title: 'Preferences', icon: <AimOutlined /> },
  ]

  return (
    <div style={{ minHeight: '100vh', background: ' ', padding: '40px 16px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24, color: 'white' }}>
          <Title level={2} style={{ color: 'black', margin: 0 }}>Campus Recruitment</Title>
          <Text style={{ color: 'black', fontSize: 16 }}>
            {eventInfo.data.event?.college?.name} — {eventInfo.data.event?.recruitmentYear}
            {eventInfo.data.event?.mode && ` · ${eventMode(eventInfo.data.event.mode).label}`}
          </Text>
        </div>

        <Modal
          open={!!existing}
          title="You're already registered with us"
          onCancel={() => setExisting(null)}
          footer={existing?.linkSent ? [
            <Button key="close" type="primary" onClick={() => setExisting(null)}>Close</Button>,
          ] : [
            <Button key="cancel" onClick={() => setExisting(null)}>Cancel</Button>,
            <Button key="send" type="primary" loading={sendingLink} onClick={sendSignInLink}>Send me a link</Button>,
          ]}
        >
          {existing?.linkSent ? (
            <Alert
              type="success"
              showIcon
              message="Check your inbox"
              description={`We've emailed a sign-in link to ${existing.maskedEmail}. Open it to update your details and apply to this event from your candidate page. The link expires in 30 minutes.`}
            />
          ) : (
            <p>
              A candidate with this {existing?.matchedBy === 'ROLL_NO' ? 'roll number' : 'email'} already exists.
              We can email a sign-in link to <strong>{existing?.maskedEmail}</strong> so you can update your
              details and apply to this event from your candidate page.
            </p>
          )}
        </Modal>

        <Card bordered={false} style={{ borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
          <Steps current={step} items={steps} style={{ marginBottom: 32 }} />

          {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} closable onClose={() => setError('')} />}

          <Form form={form} layout="vertical" onFinish={handleSubmit} onFinishFailed={() => setPrefError(selected.size === 0)}>

            {/* Step 0 - Personal Info */}
            <div style={{ display: step === 0 ? 'block' : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Divider orientation="left" style={{ flex: 1 }}>Personal Information</Divider>
                <DevOnly>
                  <Button
                    size="small"
                    icon={<ThunderboltOutlined />}
                    style={{ marginLeft: SPACE.sm, flexShrink: 0 }}
                    onClick={() => form.setFieldsValue({
                      name: 'Arun Kumar',
                      email: 'arun.kumar@example.com',
                      phone: '9876543210',
                      rollNo: 'CS2021001',
                      branch: 'Computer Science & Engineering',
                    })}
                  >
                    Fill Test Data
                  </Button>
                </DevOnly>
              </div>
              <Row gutter={GUTTER}>
                <Col xs={24} sm={12}>
                  <Form.Item name="name" label="Full Name" rules={[requiredRule('Name is required')]}>
                    <Input placeholder="John Doe" size="large" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="email"
                    label="Email"
                    rules={[requiredRule('Email is required'), EMAIL_RULE]}
                    extra="All updates about your application are sent here, and this is how you'll sign in later. Use an address you'll keep access to."
                  >
                    <Input placeholder="john@example.com" size="large" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="phone" label="Mobile Number" rules={[PHONE_RULE]}>
                    <Input placeholder="9876543210" size="large" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="rollNo" label="Roll No">
                    <Input placeholder="CS2021001" size="large" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="branch"
                    label="Branch"
                    rules={[{ required: true, message: 'Please select your branch!' }]}
                  >
                    <Select showSearch size="large" placeholder="Select your branch" options={BRANCH_OPTIONS} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="linkedinLink" label="LinkedIn Profile URL" rules={[URL_RULE]}>
                    <Input placeholder="https://linkedin.com/in/username" size="large" />
                  </Form.Item>
                </Col>
              </Row>
              <Button type="primary" size="large" block loading={checking} onClick={handleFirstStepNext}>Next →</Button>
            </div>

            {/* Step 1 - Academic */}
            <div style={{ display: step === 1 ? 'block' : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Divider orientation="left" style={{ flex: 1 }}>Academic Details</Divider>
                <DevOnly>
                  <Button
                    size="small"
                    icon={<ThunderboltOutlined />}
                    style={{ marginLeft: SPACE.sm, flexShrink: 0 }}
                    onClick={() => form.setFieldsValue({
                      graduationYear: '2026',
                      tenthMark: '92.5',
                      twelfthMark: '88.0',
                      ugDegree: 'B.Tech Computer Science',
                      ugCgpa: '8.5',
                      arrears: '0',
                      backlogs: '0',
                    })}
                  >
                    Fill Test Data
                  </Button>
                </DevOnly>
              </div>
              <AcademicFields />
              <Row gutter={8}>
                <Col span={12}><Button size="large" block onClick={() => setStep(0)}>← Back</Button></Col>
                <Col span={12}>
                  <Button type="primary" size="large" block onClick={() => {
                    form.validateFields(['graduationYear', 'ugCgpa']).then(() => setStep(2))
                  }}>Next →</Button>
                </Col>
              </Row>
            </div>

            {/* Step 2 - Preferences */}
            <div style={{ display: step === 2 ? 'block' : 'none' }}>
              <Divider orientation="left">Role Preferences</Divider>
              <Row gutter={GUTTER}>
                <Col xs={24}>
                  <div ref={rankerRef} style={{ marginBottom: 16 }}>
                    <div style={{ fontWeight: 600, marginBottom: 6, color: '#1e1b4b' }}>
                      Rank Positions by Preference <span style={{ color: '#ff4d4f' }}>*</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
                      Tick each position and type you want to apply for, then use the arrows to reorder — your top choice goes first.
                    </div>
                    <PreferenceRanker
                      ranked={rankedPairs}
                      selected={selected}
                      onChange={(ranked, nextSelected) => { setRankedPairs(ranked); setSelected(nextSelected) }}
                    />
                    {prefError && selected.size === 0 && (
                      <div role="alert" style={{ color: '#ff4d4f', fontSize: 14, marginTop: 8 }}>
                        Tick at least one position you want to apply for.
                      </div>
                    )}
                  </div>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="jobLocation" label="Preferred Job Location">
                    <Select size="large" placeholder="Select location" options={JOB_LOCATION_OPTIONS} />
                  </Form.Item>
                </Col>
                {/* Unticking the position that calls for a field drops the field and its value (preserve={false}). */}
                {hasItPosition(ticked) && (
                  <Col xs={24} sm={12}>
                    <Form.Item name="githubLink" label="GitHub Link" rules={[URL_RULE]} preserve={false}>
                      <Input placeholder="https://github.com/username" size="large" />
                    </Form.Item>
                  </Col>
                )}
                <Col xs={24}>
                  <Form.Item name="leadershipPositions" label="Leadership Positions Held">
                    <Input.TextArea rows={3} placeholder="Class Representative, Coding Club Lead..." size="large" />
                  </Form.Item>
                </Col>
                {hasInternship(ticked) && (
                  <Col xs={24} sm={12}>
                    <Form.Item name="internshipAvailability" label="Internship Availability" preserve={false}>
                      <DatePicker.RangePicker
                        picker="month"
                        size="large"
                        style={{ width: '100%' }}
                        format="MMMM YYYY"
                      />
                    </Form.Item>
                  </Col>
                )}
                <Col xs={24} sm={12}>
                  <Form.Item
                    label={<span>Resume (PDF/DOC, up to 5 MB) <span style={{ color: '#ff4d4f' }}>*</span></span>}
                    validateStatus={resumeFile ? '' : 'warning'}
                  >
                    <Upload
                      beforeUpload={file => {
                        if (resumeTooLarge(file)) { message.error(RESUME_TOO_LARGE); return Upload.LIST_IGNORE }
                        setResumeFile(file); return false
                      }}
                      onRemove={() => setResumeFile(null)}
                      maxCount={1}
                      accept=".pdf,.doc,.docx"
                    >
                      <Button icon={<UploadOutlined />} size="large" block>Upload Resume</Button>
                    </Upload>
                  </Form.Item>
                </Col>
              </Row>
              <ConsentField />
              <Row gutter={8}>
                <Col span={12}><Button size="large" block onClick={() => setStep(1)}>← Back</Button></Col>
                <Col span={12}>
                  <Button type="primary" htmlType="submit" size="large" block loading={loading}>
                    Submit Application
                  </Button>
                </Col>
              </Row>
            </div>
          </Form>
        </Card>
      </div>
    </div>
  )
}
