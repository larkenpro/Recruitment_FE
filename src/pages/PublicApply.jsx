import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Form, Input, Select, Button, Card, Row, Col, Typography, Divider, Upload, Alert, Steps, Result } from 'antd'
import { UploadOutlined, UserOutlined, BookOutlined, AimOutlined } from '@ant-design/icons'
import { getApplyForm, submitApplication, uploadResume } from '../api/candidates'
import axios from 'axios'

const { Title, Text } = Typography

export default function PublicApply() {
  const { token } = useParams()
  const [form] = Form.useForm()
  const [eventInfo, setEventInfo] = useState(null)
  const [positions, setPositions] = useState([])
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resumeFile, setResumeFile] = useState(null)
  const [step, setStep] = useState(0)

  useEffect(() => {
    getApplyForm(token).then(r => setEventInfo(r.data)).catch(() => setError('Invalid or expired link'))
    axios.get(`${import.meta.env.VITE_PUBLIC_API_URL}/public/positions`).then(r => setPositions(r.data))
  }, [token])

  const handleSubmit = async (values) => {
    setLoading(true)
    setError('')
    try {
      const res = await submitApplication(token, {
        ...values,
        ugCgpa: values.ugCgpa ? Number(values.ugCgpa) : null,
        tenthMark: values.tenthMark ? Number(values.tenthMark) : null,
        twelfthMark: values.twelfthMark ? Number(values.twelfthMark) : null,
        diplomaMark: values.diplomaMark ? Number(values.diplomaMark) : null,
        pgCgpa: values.pgCgpa ? Number(values.pgCgpa) : null,
        keamRank: values.keamRank ? Number(values.keamRank) : null,
        backlogs: values.backlogs ? Number(values.backlogs) : 0,
        preferredPositionId1: values.preferredPositionId1 ? Number(values.preferredPositionId1) : null,
        preferredPositionId2: values.preferredPositionId2 ? Number(values.preferredPositionId2) : null,
      })
      const candidateId = res.data.data.candidate?.id
      if (resumeFile && candidateId) await uploadResume(candidateId, resumeFile)
      setSubmitted(true)
    } catch (err) {
      setError(err.response?.data?.message || 'Submission failed. Please try again.')
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

  const steps = [
    { title: 'Personal Info', icon: <UserOutlined /> },
    { title: 'Academic Details', icon: <BookOutlined /> },
    { title: 'Preferences', icon: <AimOutlined /> },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '40px 16px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24, color: 'white' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🎯</div>
          <Title level={2} style={{ color: 'white', margin: 0 }}>Campus Recruitment</Title>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 16 }}>
            {eventInfo.event?.college?.name} — {eventInfo.event?.recruitmentYear}
          </Text>
        </div>

        <Card bordered={false} style={{ borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
          <Steps current={step} items={steps} style={{ marginBottom: 32 }} />

          {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} closable onClose={() => setError('')} />}

          <Form form={form} layout="vertical" onFinish={handleSubmit}>

            {/* Step 0 - Personal Info */}
            <div style={{ display: step === 0 ? 'block' : 'none' }}>
              <Divider orientation="left">Personal Information</Divider>
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item name="name" label="Full Name" rules={[{ required: true }]}>
                    <Input placeholder="John Doe" size="large" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="username" label="Username" rules={[{ required: true }]}>
                    <Input placeholder="john_doe" size="large" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
                    <Input placeholder="john@example.com" size="large" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="phone" label="Mobile Number">
                    <Input placeholder="9876543210" size="large" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="rollNo" label="Roll No">
                    <Input placeholder="CS2021001" size="large" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="branch" label="Branch">
                    <Input placeholder="Computer Science" size="large" />
                  </Form.Item>
                </Col>
              </Row>
              <Button type="primary" size="large" block onClick={() => {
                form.validateFields(['name', 'username', 'email']).then(() => setStep(1))
              }}>Next →</Button>
            </div>

            {/* Step 1 - Academic */}
            <div style={{ display: step === 1 ? 'block' : 'none' }}>
              <Divider orientation="left">Academic Details</Divider>
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item name="tenthMark" label="10th Mark %">
                    <Input type="number" step="0.01" placeholder="92.5" size="large" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="twelfthMark" label="12th Mark %">
                    <Input type="number" step="0.01" placeholder="88.0" size="large" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="diplomaMark" label="Diploma Mark % (if applicable)">
                    <Input type="number" step="0.01" placeholder="85.0" size="large" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="keamRank" label="KEAM Rank (if applicable)">
                    <Input type="number" placeholder="1234" size="large" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="ugDegree" label="UG Degree & Specialization">
                    <Input placeholder="B.Tech Computer Science" size="large" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="ugCgpa" label="UG CGPA">
                    <Input type="number" step="0.01" placeholder="8.5" size="large" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}> 
                  <Form.Item name="pgDegree" label="PG Degree (if applicable)">
                    <Input placeholder="M.Tech CSE" size="large" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="pgCgpa" label="PG CGPA (if applicable)">
                    <Input type="number" step="0.01" placeholder="9.0" size="large" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="backlogs" label="No. of Current Backlogs">
                    <Input type="number" placeholder="0" size="large" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={8}>
                <Col span={12}><Button size="large" block onClick={() => setStep(0)}>← Back</Button></Col>
                <Col span={12}><Button type="primary" size="large" block onClick={() => setStep(2)}>Next →</Button></Col>
              </Row>
            </div>

            {/* Step 2 - Preferences */}
            <div style={{ display: step === 2 ? 'block' : 'none' }}>
              <Divider orientation="left">Role Preferences</Divider>
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item name="preferredPositionId1" label="Interested Role - Preference 1" rules={[{ required: true, message: 'Select at least one role' }]}>
                    <Select size="large" placeholder="Select role" options={positions.map(p => ({ value: p.id, label: p.title }))} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="preferredPositionId2" label="Interested Role - Preference 2">
                    <Select size="large" placeholder="Select role" options={positions.map(p => ({ value: p.id, label: p.title }))} allowClear />
                  </Form.Item>
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
                  <Form.Item name="githubLink" label="GitHub Link (for Technical BA)">
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
                    <Input placeholder="June 2026 - August 2026" size="large" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item label="Resume (PDF/DOC)">
                    <Upload beforeUpload={file => { setResumeFile(file); return false }} maxCount={1} accept=".pdf,.doc,.docx">
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
