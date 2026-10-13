import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Card, Col, DatePicker, Descriptions, Empty, Form, Input, Result, Row, Select, Space, Spin, Tag, Typography, Upload, message } from 'antd'
import { FileTextOutlined, LogoutOutlined, MailOutlined, UploadOutlined } from '@ant-design/icons'
import {
  applyToEvent, clearCandidateSession, createCandidateSession, getCandidateSession, getMyPage,
  requestSignInLink, setCandidateSession, updateMyApplication, updateMyProfile, uploadMyResume,
} from '../api/portal'
import { getPublicEventPositions } from '../api/candidates'
import { eventPairs, hasInternship, preferenceKey, preferenceLabel, rankedWithChosenFirst, selectedPreferences, tickedPairs } from '../utils/preferences'
import { academicFormValues, academicPayload } from '../utils/academic'
import { EMAIL_RULE, PHONE_RULE, URL_RULE, requiredRule } from '../components/validation/rules'
import AcademicFields, { BRANCH_OPTIONS, JOB_LOCATION_OPTIONS } from '../components/AcademicFields'
import PreferenceRanker from '../components/PreferenceRanker'
import ConsentField from '../components/ConsentField'
import { GUTTER } from '../theme'

const { Title, Text } = Typography

const errorText = (err, fallback) => err?.response?.data?.message || fallback

const Page = ({ children }) => (
  <div style={{ minHeight: '100vh', background: '#f5f6fa', padding: '40px 16px' }}>
    <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>{children}</div>
  </div>
)

// /candidate?token=<emailed link token>&apply=<application link token>
export default function CandidatePortal() {
  const [params, setParams] = useSearchParams()
  const linkToken = params.get('token')
  const applyToken = params.get('apply')
  const [session, setSession] = useState(getCandidateSession())
  const [linkError, setLinkError] = useState(null)

  useEffect(() => {
    if (!linkToken) return
    createCandidateSession(linkToken)
      .then((r) => {
        setCandidateSession(r.data.data.sessionToken)
        setSession(r.data.data.sessionToken)
      })
      .catch((err) => setLinkError(errorText(err, 'This sign-in link is invalid or has expired')))
      .finally(() => {
        // The link token is single-purpose; keep it out of the address bar and history.
        const next = new URLSearchParams(params)
        next.delete('token')
        setParams(next, { replace: true })
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkToken])

  const signOut = () => {
    clearCandidateSession()
    setSession(null)
  }

  if (linkToken) return <Page><Spin style={{ marginTop: 80 }} /></Page>
  if (!session) return <SignIn applyToken={applyToken} error={linkError} />
  return <MyPage applyToken={applyToken} onSignOut={signOut} clearApplyToken={() => {
    const next = new URLSearchParams(params)
    next.delete('apply')
    setParams(next, { replace: true })
  }} />
}

function SignIn({ applyToken, error }) {
  const [sent, setSent] = useState(false)
  const mutation = useMutation({
    mutationFn: ({ email }) => requestSignInLink({ email, applyToken }),
    onSuccess: () => setSent(true),
    onError: (err) => message.error(errorText(err, 'Could not send the link. Please try again.')),
  })

  return (
    <Page>
      <Card bordered={false} style={{ borderRadius: 16 }}>
        <Title level={3} style={{ marginTop: 0 }}>Your candidate page</Title>
        <Text type="secondary">
          View your applications and update your details. Enter the email you applied with and we'll send you a sign-in link.
        </Text>
        {error && <Alert style={{ marginTop: 16 }} type="error" showIcon message={error} />}
        {sent ? (
          <Alert
            style={{ marginTop: 16 }}
            type="success"
            showIcon
            message="Check your inbox"
            description="If we have you on file, a sign-in link is on its way to your registered email. It expires in 30 minutes."
          />
        ) : (
          <Form layout="vertical" style={{ marginTop: 16 }} onFinish={mutation.mutate}>
            <Form.Item name="email" label="Email" rules={[requiredRule('Email is required'), EMAIL_RULE]}>
              <Input size="large" prefix={<MailOutlined />} placeholder="you@example.com" />
            </Form.Item>
            <Button type="primary" htmlType="submit" size="large" block loading={mutation.isPending}>
              Email me a sign-in link
            </Button>
          </Form>
        )}
      </Card>
    </Page>
  )
}

function MyPage({ applyToken, onSignOut, clearApplyToken }) {
  const queryClient = useQueryClient()
  const { data: page, isLoading, error } = useQuery({
    queryKey: ['candidatePortal', applyToken],
    queryFn: () => getMyPage(applyToken).then((r) => r.data.data),
    retry: false,
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['candidatePortal'] })

  const expired = error?.response?.status === 401
  useEffect(() => {
    if (expired) onSignOut()
  }, [expired, onSignOut])

  const applyMutation = useMutation({
    mutationFn: (payload) => applyToEvent({ ...payload, applyToken: page.pendingEvent.applyToken }),
    onSuccess: () => {
      message.success('Application submitted!')
      clearApplyToken()
      refresh()
    },
    onError: (err) => message.error(errorText(err, 'Could not submit your application')),
  })

  if (isLoading) return <Page><Spin style={{ marginTop: 80 }} /></Page>
  if (error) return <Page><Result status="error" title="Could not load your page" subTitle={errorText(error, 'Please try again later.')} /></Page>

  const { profile, resume, applications, pendingEvent } = page

  return (
    <Page>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Hi {profile.name}</Title>
          <Text type="secondary">{profile.email}</Text>
        </div>
        <Button icon={<LogoutOutlined />} onClick={onSignOut}>Sign out</Button>
      </div>

      {pendingEvent && (
        <Card bordered={false} style={{ borderRadius: 16 }} title={`Apply to ${pendingEvent.collegeName} — ${pendingEvent.recruitmentYear}`}>
          <Alert
            style={{ marginBottom: 16 }}
            type="info"
            showIcon
            message="Your latest details are filled in. Update anything that has changed — your earlier applications keep the details you sent then."
          />
          <ApplicationForm
            eventId={pendingEvent.eventId}
            initial={profile.details}
            chosen={[]}
            askConsent
            submitLabel="Submit application"
            saving={applyMutation.isPending}
            onSubmit={applyMutation.mutate}
          />
        </Card>
      )}

      <Title level={4} style={{ margin: '8px 0 0' }}>Your applications</Title>
      {applications.length === 0 && <Card bordered={false} style={{ borderRadius: 16 }}><Empty description="No applications yet" /></Card>}
      {applications.map((application) => (
        <ApplicationCard key={application.applicationId} application={application} onSaved={refresh} />
      ))}

      <ProfileCard profile={profile} onSaved={refresh} />
      <ResumeCard resume={resume} onSaved={refresh} />
    </Page>
  )
}

function ApplicationCard({ application, onSaved }) {
  const mutation = useMutation({
    mutationFn: (payload) => updateMyApplication(application.eventId, payload),
    onSuccess: () => { message.success('Application updated'); onSaved() },
    onError: (err) => message.error(errorText(err, 'Could not save your changes')),
  })

  return (
    <Card
      bordered={false}
      style={{ borderRadius: 16 }}
      title={`${application.collegeName} — ${application.recruitmentYear}`}
      extra={application.editable
        ? <Tag color="green">Open for changes</Tag>
        : <Tag>{application.eventStatus === 'ACTIVE' ? 'Open' : 'Closed'}</Tag>}
    >
      {application.editable ? (
        <ApplicationForm
          eventId={application.eventId}
          initial={application}
          chosen={application.preferences}
          submitLabel="Save changes"
          saving={mutation.isPending}
          onSubmit={mutation.mutate}
        />
      ) : (
        <>
          <Descriptions column={{ xs: 1, sm: 2 }} size="small" bordered>
            <Descriptions.Item label="Roll No">{application.rollNo || '—'}</Descriptions.Item>
            <Descriptions.Item label="Branch">{application.branch || '—'}</Descriptions.Item>
            <Descriptions.Item label="Year of Graduation">{application.graduationYear ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="UG CGPA">{application.ugCgpa ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="PG CGPA">{application.pgCgpa ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="10th %">{application.tenthMark ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="12th %">{application.twelfthMark ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Backlogs (active / total)">{application.arrears ?? 0} / {application.backlogs ?? 0}</Descriptions.Item>
          </Descriptions>
          <div style={{ marginTop: 12 }}>
            {application.preferences.map((p, i) => (
              <div key={preferenceKey(p)}>{i + 1}. {preferenceLabel(p)}</div>
            ))}
          </div>
          <Text type="secondary" style={{ display: 'block', marginTop: 12 }}>
            This event is no longer open, so these are the details you applied with.
          </Text>
        </>
      )}
    </Card>
  )
}

function ApplicationForm({ eventId, initial, chosen, askConsent = false, submitLabel, saving, onSubmit }) {
  const [form] = Form.useForm()
  const [ranker, setRanker] = useState(null)
  const { data: positions } = useQuery({
    queryKey: ['publicEventPositions', eventId],
    queryFn: () => getPublicEventPositions(eventId).then((r) => r.data.data),
  })

  useEffect(() => {
    if (positions) setRanker(rankedWithChosenFirst(chosen, eventPairs(positions)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions])

  const finish = (values) => {
    const preferences = selectedPreferences(ranker?.ranked ?? [], ranker?.selected ?? new Set())
    if (preferences.length === 0) {
      message.error('Tick at least one position you want to apply for.')
      return
    }
    onSubmit({ ...academicPayload(values), preferences, ...(askConsent && { consent: values.consent }) })
  }

  return (
    <Form form={form} layout="vertical" initialValues={academicFormValues(initial)} onFinish={finish}>
      <Row gutter={GUTTER}>
        <Col xs={24} sm={12}>
          <Form.Item name="rollNo" label="Roll No">
            <Input placeholder="CS2021001" />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item name="branch" label="Branch">
            <Select showSearch placeholder="Select your branch" options={BRANCH_OPTIONS} />
          </Form.Item>
        </Col>
      </Row>
      <AcademicFields size="middle" />
      <Row gutter={GUTTER}>
        <Col xs={24} sm={12}>
          <Form.Item name="jobLocation" label="Preferred Job Location">
            <Select allowClear placeholder="Select location" options={JOB_LOCATION_OPTIONS} />
          </Form.Item>
        </Col>
        {/* Only for internship applications; unticking them drops the field and its value. */}
        {ranker && hasInternship(tickedPairs(ranker.ranked, ranker.selected)) && (
          <Col xs={24} sm={12}>
            <Form.Item name="internshipAvailability" label="Internship Availability" preserve={false}>
              <DatePicker.RangePicker picker="month" style={{ width: '100%' }} format="MMMM YYYY" />
            </Form.Item>
          </Col>
        )}
        <Col xs={24}>
          <Form.Item name="leadershipPositions" label="Leadership Positions Held">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Col>
      </Row>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>Positions you're applying for</div>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
        Tick each position and type you want, then use the arrows to rank them — your top choice goes first.
      </div>
      {ranker ? (
        <PreferenceRanker
          ranked={ranker.ranked}
          selected={ranker.selected}
          onChange={(ranked, selected) => setRanker({ ranked, selected })}
        />
      ) : <Spin />}
      {askConsent && <div style={{ marginTop: 16 }}><ConsentField /></div>}
      <Button type="primary" htmlType="submit" loading={saving} style={{ marginTop: askConsent ? 0 : 16 }}>{submitLabel}</Button>
    </Form>
  )
}

function ProfileCard({ profile, onSaved }) {
  const mutation = useMutation({
    mutationFn: updateMyProfile,
    onSuccess: () => { message.success('Contact details updated'); onSaved() },
    onError: (err) => message.error(errorText(err, 'Could not save your details')),
  })

  return (
    <Card bordered={false} style={{ borderRadius: 16 }} title="Contact details">
      <Form
        layout="vertical"
        initialValues={{ name: profile.name, phone: profile.phone, githubLink: profile.githubLink, linkedinLink: profile.linkedinLink }}
        onFinish={mutation.mutate}
      >
        <Row gutter={GUTTER}>
          <Col xs={24} sm={12}>
            <Form.Item name="name" label="Full Name" rules={[requiredRule('Name is required')]}>
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item label="Email" extra="This is how you sign in, so it can't be changed here.">
              <Input value={profile.email} disabled />
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
            <Form.Item name="githubLink" label="GitHub Link" rules={[URL_RULE]}>
              <Input />
            </Form.Item>
          </Col>
        </Row>
        <Button type="primary" htmlType="submit" loading={mutation.isPending}>Save contact details</Button>
      </Form>
    </Card>
  )
}

function ResumeCard({ resume, onSaved }) {
  const mutation = useMutation({
    mutationFn: uploadMyResume,
    onSuccess: () => { message.success('Resume uploaded'); onSaved() },
    onError: (err) => message.error(errorText(err, 'Could not upload your resume')),
  })

  return (
    <Card bordered={false} style={{ borderRadius: 16 }} title="Resume">
      <Space direction="vertical">
        <Text>
          <FileTextOutlined style={{ marginRight: 6 }} />
          {resume?.fileName || (resume?.sourceUrl ? 'Linked resume' : 'No resume uploaded yet')}
        </Text>
        <Upload
          accept=".pdf,.doc,.docx"
          showUploadList={false}
          beforeUpload={(file) => { mutation.mutate(file); return false }}
        >
          <Button icon={<UploadOutlined />} loading={mutation.isPending}>
            {resume ? 'Replace resume' : 'Upload resume'}
          </Button>
        </Upload>
        <Text type="secondary" style={{ fontSize: 12 }}>One resume is kept for all your applications; uploading replaces it.</Text>
      </Space>
    </Card>
  )
}
