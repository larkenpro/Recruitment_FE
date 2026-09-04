import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Form, Input, Select, Button, Card, Row, Col, Typography, Divider, Upload, Alert, Steps, Result, DatePicker, Tag, Space, Modal } from 'antd'
import { UploadOutlined, UserOutlined, BookOutlined, AimOutlined, ArrowUpOutlined, ArrowDownOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { getApplyForm, submitApplication, checkApplication } from '../api/candidates'
import { getEventPositions } from '../api/events'
import { EMAIL_RULE, PHONE_RULE, URL_RULE, CGPA_RULE, SCORE_RULE, requiredRule } from '../components/validation/rules'
import DevOnly from '../components/DevOnly'
import { SPACE, GUTTER } from '../theme'

const { Title, Text } = Typography

export default function PublicApply() {
  const { token } = useParams()
  const [form] = Form.useForm()
  const [eventInfo, setEventInfo] = useState(null)
  const [rankedPositions, setRankedPositions] = useState([])
  const [positionsLoaded, setPositionsLoaded] = useState(false)

  const movePosition = (index, dir) => {
    const next = index + dir
    if (next < 0 || next >= rankedPositions.length) return
    const updated = [...rankedPositions]
    ;[updated[index], updated[next]] = [updated[next], updated[index]]
    setRankedPositions(updated)
  }
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resumeFile, setResumeFile] = useState(null)
  const [step, setStep] = useState(0)
  const [checking, setChecking] = useState(false)
  const [duplicate, setDuplicate] = useState(null)

  useEffect(() => {
    getApplyForm(token)
      .then(r => {
        setEventInfo(r.data)
        return getEventPositions(r.data.data.event.id)
      })
      .then(r => { setRankedPositions(r.data.data); setPositionsLoaded(true) })
      .catch(() => setError('Invalid or expired link'))
  }, [token])

  useEffect(() => {
    console.log(eventInfo)
  }, [eventInfo]);

  /**
   * Runs before the candidate leaves step 0. A repeat application is not blocked —
   * submitting again overwrites the earlier details, so the point is to make that
   * overwrite a conscious choice rather than something that happens silently.
   */
  const handleFirstStepNext = async () => {
    const values = await form.validateFields(['name', 'email', 'branch'])
    const rollNo = form.getFieldValue('rollNo')
    if (!rollNo) { setStep(1); return }

    setChecking(true)
    try {
      const { data } = await checkApplication(token, { rollNo, email: values.email })
      const result = data.data
      if (result.alreadyApplied || result.sameEmailNewRollNo) {
        setDuplicate(result)
        return
      }
      setStep(1)
    } catch (err) {
      // An expired link is the one hard stop; anything else shouldn't block applying.
      const message = err.response?.data?.message
      if (message?.toLowerCase().includes('expired')) setError(message)
      else setStep(1)
    } finally {
      setChecking(false)
    }
  }

  const continueWithUpdate = () => {
    if (duplicate?.prefill) {
      const { email, ...rest } = duplicate.prefill
      form.setFieldsValue(rest)
    }
    setDuplicate(null)
    setStep(1)
  }

  const handleSubmit = async (values) => {
    if (!resumeFile) {
      setError('Please upload your resume before submitting.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const [start, end] = values.internshipAvailability ?? []
      const internshipAvailability = start && end
        ? `${start.format('MMMM-YYYY')} to ${end.format('MMMM-YYYY')}`
        : null

      await submitApplication(token, {
        ...values,
        internshipAvailability,
        ugCgpa: values.ugCgpa ? Number(values.ugCgpa) : null,
        tenthMark: values.tenthMark ? Number(values.tenthMark) : null,
        twelfthMark: values.twelfthMark ? Number(values.twelfthMark) : null,
        diplomaMark: values.diplomaMark ? Number(values.diplomaMark) : null,
        pgCgpa: values.pgCgpa ? Number(values.pgCgpa) : null,
        keamRank: values.keamRank ? Number(values.keamRank) : null,
        arrears: values.arrears ? Number(values.arrears) : 0,
        backlogs: values.backlogs ? Number(values.backlogs) : 0,
        preferredPositionIds: rankedPositions.map(p => p.id),
      }, resumeFile)
      setSubmitted(true)
    } catch (err) {
      if (err.response?.status === 409) {
        // A conflict is now either the roll number or the email — attribute it to the
        // field the backend actually named, rather than always blaming rollNo.
        const message = err.response.data?.message || 'That application conflicts with an existing one'
        const field = message.toLowerCase().includes('email') ? 'email' : 'rollNo'
        form.setFields([{ name: field, errors: [message] }])
        setStep(0)
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

  if (positionsLoaded && rankedPositions.length === 0) return (
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
          {/* <div style={{ fontSize: 40, marginBottom: 8 }}>🎯</div>q¯ */}
          <Title level={2} style={{ color: 'black', margin: 0 }}>Campus Recruitment</Title>
          <Text style={{ color: 'black', fontSize: 16 }}>
            {eventInfo.data.event?.college?.name} — {eventInfo.data.event?.recruitmentYear}
          </Text>
        </div>

        <Modal
          open={!!duplicate}
          title={duplicate?.alreadyApplied ? 'You have already applied to this event' : 'Welcome back'}
          onCancel={() => setDuplicate(null)}
          footer={duplicate?.alreadyApplied ? [
            <Button key="cancel" onClick={() => setDuplicate(null)}>Cancel</Button>,
            <Button key="continue" type="primary" onClick={continueWithUpdate}>
              Continue and update my application
            </Button>,
          ] : [
            <Button key="cancel" onClick={() => setDuplicate(null)}>Go back</Button>,
            <Button key="continue" type="primary" onClick={continueWithUpdate}>
              Yes, that's me — continue
            </Button>,
          ]}
        >
          {duplicate?.alreadyApplied ? (
            <>
              <p>
                An application for roll number <strong>{form.getFieldValue('rollNo')}</strong> already
                exists for this event, registered to <strong>{duplicate.maskedEmail}</strong>.
              </p>
              {duplicate.emailMatches ? (
                <p>
                  Continuing will <strong>replace your previous details and resume</strong> with what you
                  submit now. Your earlier answers have been filled in below so you only need to change
                  what's different.
                </p>
              ) : (
                <Alert
                  type="warning"
                  showIcon
                  message="This isn't the email on that application"
                  description={
                    "For your privacy we can't show you the existing details. If this is your application, " +
                    "go back and enter the email you originally applied with. Continuing will still replace " +
                    "the previous submission."
                  }
                />
              )}
            </>
          ) : (
            <>
              <p>
                We already have you registered under roll number <strong>{duplicate?.knownRollNo}</strong> with
                the email <strong>{duplicate?.maskedEmail}</strong>. Applying now with a new roll number —
                for a PG intake, for example — updates that same record rather than creating a second one.
              </p>
              <Alert
                type="info"
                showIcon
                message="Your details carry over"
                description={
                  "Your existing record keeps your earlier marks and history. Fill in the form with your " +
                  "current details and anything you change will be saved against you. If this email isn't " +
                  "yours, go back and use your own — it's where every update is sent."
                }
              />
            </>
          )}
        </Modal>

        <Card bordered={false} style={{ borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
          <Steps current={step} items={steps} style={{ marginBottom: 32 }} />

          {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} closable onClose={() => setError('')} />}

          <Form form={form} layout="vertical" onFinish={handleSubmit}>

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
                  <Form.Item name="name" label="Full Name" rules={[{ required: true }]}>
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
                    <Select
                      showSearch
                      size="large"
                      placeholder="Select your branch"
                      options={[
                        'Computer Science & Engineering',
                        'Electronics & Communication Engineering',
                        'Electrical Engineering',
                        'Mechanical Engineering',
                        'Chemical Engineering',
                        'Civil Engineering',
                        'Information Technology',
                        'Production Engineering',
                        'Biomedical Engineering',
                        'Biotechnology',
                        'Instrumentation Engineering',
                        'Metallurgical Engineering',
                        'Others',
                      ].map(v => ({ value: v, label: v }))}
                    />
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
              <Row gutter={GUTTER}>
                <Col xs={24} sm={12}>
                  <Form.Item name="tenthMark" label="10th Mark %" rules={[SCORE_RULE]}>
                    <Input type="number" step="0.01" placeholder="92.5" size="large" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="twelfthMark" label="12th Mark %" rules={[SCORE_RULE]}>
                    <Input type="number" step="0.01" placeholder="88.0" size="large" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="diplomaMark" label="Diploma Mark % (if applicable)" rules={[SCORE_RULE]}>
                    <Input type="number" step="0.01" placeholder="85.0" size="large" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="keamRank" label="KEAM Rank (if applicable)">
                    <Input type="number" placeholder="1234" size="large" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="ugDegree" label="UG Specialization (if applicable)">
                    <Input placeholder="B.Tech Computer Science" size="large" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="ugCgpa" label="UG CGPA" rules={[{ required: true, message: 'UG CGPA is required' }, CGPA_RULE]}>
                    <Input type="number" step="0.01" placeholder="8.5" size="large" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}> 
                  <Form.Item name="pgDegree" label="PG Degree (if applicable)">
                    <Input placeholder="M.Tech CSE" size="large" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="pgCgpa" label="PG CGPA (if applicable)" rules={[CGPA_RULE]}>
                    <Input type="number" step="0.01" placeholder="9.0" size="large" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="arrears" label="Active Backlogs">
                    <Input type="number" placeholder="0" size="large" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="backlogs" label="Total Backlogs">
                    <Input type="number" placeholder="0" size="large" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={8}>
                <Col span={12}><Button size="large" block onClick={() => setStep(0)}>← Back</Button></Col>
                <Col span={12}>
                  <Button type="primary" size="large" block onClick={() => {
                    form.validateFields(['ugCgpa']).then(() => setStep(2))
                  }}>Next →</Button>
                </Col>
              </Row>
            </div>

            {/* Step 2 - Preferences */}
            <div style={{ display: step === 2 ? 'block' : 'none' }}>
              <Divider orientation="left">Role Preferences</Divider>
              <Row gutter={GUTTER}>
                <Col xs={24}>
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontWeight: 600, marginBottom: 6, color: '#1e1b4b' }}>
                      Rank Positions by Preference
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
                      Use arrows to reorder — your top choice goes first.
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {rankedPositions.map((pos, index) => (
                        <div
                          key={pos.id}
                          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, background: '#fff' }}
                        >
                          <Tag style={{ fontWeight: 600, minWidth: 36, textAlign: 'center', flexShrink: 0 }}>{index + 1}</Tag>
                          <span style={{ fontWeight: 500, color: '#1e1b4b', fontSize: 14, flex: 1 }}>
                            {pos.title}
                            {pos.type && <span style={{ fontWeight: 400, color: '#6b7280', marginLeft: 6 }}>— {pos.type}</span>}
                          </span>
                          <Space size={4}>
                            <Button size="small" icon={<ArrowUpOutlined />} disabled={index === 0} onClick={() => movePosition(index, -1)} />
                            <Button size="small" icon={<ArrowDownOutlined />} disabled={index === rankedPositions.length - 1} onClick={() => movePosition(index, 1)} />
                          </Space>
                        </div>
                      ))}
                    </div>
                  </div>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="jobLocation" label="Preferred Job Location">
                    <Select size="large" placeholder="Select location" options={[
                      { value: 'Gurugram NCR', label: 'Gurugram NCR' },
                      { value: 'Coimbatore', label: 'Coimbatore' },
                      { value: 'Both', label: 'Both' },
                    ]} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="githubLink" label="GitHub Link (for Technical BA)" rules={[URL_RULE]}>
                    <Input placeholder="https://github.com/username" size="large" />
                  </Form.Item>
                </Col>
                <Col xs={24}>
                  <Form.Item name="leadershipPositions" label="Leadership Positions Held">
                    <Input.TextArea rows={3} placeholder="Class Representative, Coding Club Lead..." size="large" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="internshipAvailability" label="Internship Availability">
                    <DatePicker.RangePicker
                      picker="month"
                      size="large"
                      style={{ width: '100%' }}
                      format="MMMM YYYY"
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label={<span>Resume (PDF/DOC) <span style={{ color: '#ff4d4f' }}>*</span></span>}
                    validateStatus={resumeFile ? '' : 'warning'}
                  >
                    <Upload
                      beforeUpload={file => { setResumeFile(file); return false }}
                      onRemove={() => setResumeFile(null)}
                      maxCount={1}
                      accept=".pdf,.doc,.docx"
                    >
                      <Button icon={<UploadOutlined />} size="large" block>Upload Resume</Button>
                    </Upload>
                  </Form.Item>
                </Col>
              </Row>
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
