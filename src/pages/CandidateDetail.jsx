import { ArrowDownOutlined, ArrowRightOutlined, ArrowUpOutlined, DownloadOutlined, EditOutlined, FileTextOutlined, LogoutOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Col, Collapse, DatePicker, Descriptions, Divider, Empty, Form, Input, InputNumber, Modal, Popconfirm, Radio, Row, Select, Space, Steps, Table, Tabs, Tag, Timeline, Typography, message } from 'antd'
import dayjs from 'dayjs'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { addStageEntry, createExitRecord, deleteExitRecord, getCandidate, getCandidateEvent, getCandidateResume, getCandidateRoundResults, getCandidateStageHistory, getExitRecord, updateCandidate, updateExitRecord, updateRoundResult, updateStageStatus } from '../api/candidates'
import { getEventPositions } from '../api/events'

const { Title, Text } = Typography

const PIPELINE_STAGES = ['Resume', 'Tests', 'Offer', 'Joining', '6 Month Review', '12 Month Retained', 'Exit']

export default function CandidateDetail() {
  const { id } = useParams()
  const queryClient = useQueryClient()
  const [editingPrefs, setEditingPrefs] = useState(false)
  const [rankedPositions, setRankedPositions] = useState([])
  const [editingRound, setEditingRound] = useState(null)
  const [scoreForm] = Form.useForm()
  const [stageSelections, setStageSelections] = useState({})

  const movePosition = (index, dir) => {
    const next = index + dir
    if (next < 0 || next >= rankedPositions.length) return
    const updated = [...rankedPositions]
    ;[updated[index], updated[next]] = [updated[next], updated[index]]
    setRankedPositions(updated)
  }

  const { data: candidate, isLoading } = useQuery({
    queryKey: ['candidate', id],
    queryFn: () => getCandidate(id).then(r => r.data.data)
  })
  const { data: resumeData } = useQuery({
    queryKey: ['resume', id],
    queryFn: () => getCandidateResume(id).then(r => r.data.data)
  })
  const { data: roundResults } = useQuery({
    queryKey: ['round-results', id],
    queryFn: () => getCandidateRoundResults(id).then(r => r.data)
  })
  const { data: stageHistory } = useQuery({
    queryKey: ['stage-history', id],
    queryFn: () => getCandidateStageHistory(id).then(r => r.data)
  })
  const { data: exitRecord, isLoading: exitLoading } = useQuery({
    queryKey: ['exit', id],
    queryFn: () => getExitRecord(id).then(r => r.data.data).catch(e => e.response?.status === 404 ? null : Promise.reject(e))
  })

  const [exitForm] = Form.useForm()
  const [editingExit, setEditingExit] = useState(false)

  const exitMutation = useMutation({
    mutationFn: (data) => exitRecord
      ? updateExitRecord(id, data)
      : createExitRecord(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exit', id] })
      setEditingExit(false)
      message.success(exitRecord ? 'Exit record updated!' : 'Exit record saved!')
    },
    onError: () => message.error('Failed to save exit record'),
  })

  const deleteExitMutation = useMutation({
    mutationFn: () => deleteExitRecord(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exit', id] })
      message.success('Exit record removed')
    },
    onError: () => message.error('Failed to remove exit record'),
  })

  const prefMutation = useMutation({
    mutationFn: (data) => updateCandidate(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidate', id] })
      setEditingPrefs(false)
      message.success('Preferences updated!')
    },
    onError: () => message.error('Failed to update preferences'),
  })

  const roundMutation = useMutation({
    mutationFn: ({ eventId, roundId, ...data }) => updateRoundResult(id, eventId, roundId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['round-results', id] })
      setEditingRound(null)
      scoreForm.resetFields()
      message.success('Score saved!')
    },
    onError: () => message.error('Failed to save score'),
  })

  const stageMutation = useMutation({
    mutationFn: ({ eventId, stageName }) => addStageEntry(id, eventId, { stageName }),
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ['stage-history', id] })
      setStageSelections(prev => { const next = { ...prev }; delete next[eventId]; return next })
      message.success('Stage updated!')
    },
    onError: () => message.error('Failed to update stage'),
  })

  const statusMutation = useMutation({
    mutationFn: ({ eventId, status }) => updateStageStatus(id, eventId, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stage-history', id] }),
    onError: () => message.error('Failed to update status'),
  })

  const openEditPrefs = async () => {
    const eventId = await getCandidateEvent(candidate.id).then(r => r.data.data?.id).catch(() => null)
    const eventPositions = eventId
      ? await getEventPositions(eventId).then(r => r.data.data)
      : []
    const preferred = candidate.preferredPositions ?? []
    const preferredIds = new Set(preferred.map(p => p.id))
    setRankedPositions([...preferred, ...eventPositions.filter(p => !preferredIds.has(p.id))])
    setEditingPrefs(true)
  }

  const savePrefs = () => {
    prefMutation.mutate({
      username: candidate.username,
      name: candidate.name,
      email: candidate.email,
      collegeId: candidate.college?.id,
      preferredPositionIds: rankedPositions.map(p => p.id),
    })
  }

  const openEditRound = (eventId, round) => {
    setEditingRound({ eventId, roundId: round.roundId, roundName: round.roundName })
    scoreForm.setFieldsValue({
      score: round.score,
      result: round.result,
      interviewer: round.interviewer,
      comments: round.comments,
    })
  }

  if (isLoading) return <Card loading style={{ borderRadius: 12 }} />
  if (!candidate) return <Empty />

  const roundColumns = (eventId) => [
    { title: '#', dataIndex: 'sequence', width: 40 },
    { title: 'Round', dataIndex: 'roundName' },
    { title: 'Type', dataIndex: 'roundType' },
    { title: 'Score', dataIndex: 'score', render: v => v ?? '—' },
    { title: 'Result', dataIndex: 'result', render: v => v ? <Tag color={v === 'PASS' ? 'green' : v === 'FAIL' ? 'red' : 'orange'}>{v}</Tag> : '—' },
    { title: 'Interviewer', dataIndex: 'interviewer', render: v => v ?? '—' },
    { title: 'Comments', dataIndex: 'comments', render: v => v ?? '—' },
    { title: 'Date', dataIndex: 'evaluatedAt', render: v => v ? new Date(v).toLocaleDateString() : '—' },
    {
      title: '',
      render: (_, round) => (
        <Button size="small" icon={<EditOutlined />} onClick={() => openEditRound(eventId, round)}>
          {round.score == null ? 'Enter' : 'Edit'}
        </Button>
      )
    }
  ]

  const tabs = [
    {
      key: 'personal', label: 'Personal Info',
      children: (
        <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
          <Descriptions.Item label="Full Name">{candidate.name}</Descriptions.Item>
          <Descriptions.Item label="Username">{candidate.username}</Descriptions.Item>
          <Descriptions.Item label="Email">{candidate.email}</Descriptions.Item>
          <Descriptions.Item label="Phone">{candidate.phone}</Descriptions.Item>
          <Descriptions.Item label="Roll No">{candidate.rollNo}</Descriptions.Item>
          <Descriptions.Item label="Branch">{candidate.branch}</Descriptions.Item>
          <Descriptions.Item label="College">{candidate.college?.name ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Job Location">{candidate.jobLocation}</Descriptions.Item>
          <Descriptions.Item label="GitHub">{candidate.githubLink ? <a href={candidate.githubLink} target="_blank" rel="noreferrer">{candidate.githubLink}</a> : '—'}</Descriptions.Item>
          <Descriptions.Item label="Internship Availability">{candidate.internshipAvailability}</Descriptions.Item>
          <Descriptions.Item label="Leadership Positions" span={2}>{candidate.leadershipPositions}</Descriptions.Item>
        </Descriptions>
      )
    },
    {
      key: 'academic', label: 'Academic',
      children: (
        <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
          <Descriptions.Item label="10th Mark %">{candidate.tenthMark}</Descriptions.Item>
          <Descriptions.Item label="12th Mark %">{candidate.twelfthMark}</Descriptions.Item>
          <Descriptions.Item label="Diploma Mark %">{candidate.diplomaMark ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="KEAM Rank">{candidate.keamRank ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="UG Degree">{candidate.ugDegree}</Descriptions.Item>
          <Descriptions.Item label="UG CGPA">{candidate.ugCgpa}</Descriptions.Item>
          <Descriptions.Item label="PG Degree">{candidate.pgDegree ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="PG CGPA">{candidate.pgCgpa ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="Total Backlogs"><Tag color={candidate.backlogs === 0 ? 'green' : 'red'}>{candidate.backlogs}</Tag></Descriptions.Item>
          <Descriptions.Item label="Active Backlogs"><Tag color={candidate.arrears === 0 ? 'green' : 'red'}>{candidate.arrears}</Tag></Descriptions.Item>
        </Descriptions>
      )
    },
    {
      key: 'preferences', label: 'Preferences',
      children: editingPrefs ? (
        <div style={{ maxWidth: 480 }}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>Use arrows to reorder — top position is most preferred.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {rankedPositions.map((pos, index) => (
              <div
                key={pos.id}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, background: '#fff' }}
              >
                <Tag style={{ fontWeight: 600, minWidth: 28, textAlign: 'center', flexShrink: 0 }}>{index + 1}</Tag>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#1e1b4b', flex: 1 }}>
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
          <Space>
            <Button type="primary" onClick={savePrefs} loading={prefMutation.isPending}>Save</Button>
            <Button onClick={() => setEditingPrefs(false)}>Cancel</Button>
          </Space>
        </div>
      ) : (() => {
        const preferred = candidate.preferredPositions ?? []
        return preferred.length > 0 ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <Button size="small" icon={<EditOutlined />} onClick={openEditPrefs}>Edit</Button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {preferred.map((pos, index) => (
                <div key={pos.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fafafa' }}>
                  <Tag style={{ fontWeight: 600, minWidth: 28, textAlign: 'center', flexShrink: 0 }}>{index + 1}</Tag>
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#1e1b4b' }}>
                    {pos.title}
                    {pos.type && <span style={{ fontWeight: 400, color: '#6b7280', marginLeft: 6 }}>— {pos.type}</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <Button size="small" icon={<EditOutlined />} onClick={openEditPrefs}>Edit</Button>
          </div>
        )
      })()
    },
    {
      key: 'scores', label: 'Scores',
      children: roundResults?.length > 0 ? (
        <Collapse
          accordion
          defaultActiveKey={[String(roundResults[0]?.eventId)]}
          items={roundResults.map(event => ({
            key: String(event.eventId),
            label: `${event.collegeName} — ${event.recruitmentYear}`,
            children: (
              <Table
                dataSource={event.rounds}
                rowKey="roundId"
                columns={roundColumns(event.eventId)}
                pagination={false}
                size="small"
                scroll={{ x: 700 }}
              />
            )
          }))}
        />
      ) : <Empty description="No round data yet" />
    },
    {
      key: 'stage-history', label: 'Stage History',
      children: stageHistory?.length > 0 ? (
        <Collapse
          accordion
          defaultActiveKey={[String(stageHistory[0]?.eventId)]}
          items={stageHistory.map(event => {
            const currentIdx = event.currentStage
              ? PIPELINE_STAGES.indexOf(event.currentStage.stageName)
              : -1
            const currentStatus = event.currentStage?.status ?? null
            const isShortlisted = currentStatus === 'SHORTLISTED'
            const statusColor = { SHORTLISTED: 'green', HOLD: 'orange', REJECTED: 'red' }

            return {
              key: String(event.eventId),
              label: (
                <span>
                  {event.collegeName} — {event.recruitmentYear}
                  {event.currentStage && (
                    <>
                      <Tag color="blue" style={{ marginLeft: 10 }}>{event.currentStage.stageName}</Tag>
                      {currentStatus && <Tag color={statusColor[currentStatus]}>{currentStatus}</Tag>}
                    </>
                  )}
                </span>
              ),
              children: (
                <div>
                  <Steps
                    size="small"
                    style={{ marginBottom: 20 }}
                    items={PIPELINE_STAGES.map((name, i) => ({
                      title: name,
                      status: currentIdx < 0 ? 'wait'
                        : i < currentIdx ? 'finish'
                        : i === currentIdx ? 'process'
                        : 'wait'
                    }))}
                  />

                  {currentIdx < 0 ? (
                    <Button
                      type="primary" size="small" style={{ marginBottom: 16 }}
                      loading={stageMutation.isPending}
                      onClick={() => stageMutation.mutate({ eventId: event.eventId, stageName: PIPELINE_STAGES[0] })}
                    >
                      Start with {PIPELINE_STAGES[0]}
                    </Button>
                  ) : (
                    <div style={{ marginBottom: 16 }}>
                      <Space wrap>
                        <Text style={{ fontSize: 13 }}><strong>{event.currentStage.stageName}</strong>:</Text>
                        <Radio.Group
                          value={currentStatus}
                          buttonStyle="solid"
                          size="small"
                          onChange={e => statusMutation.mutate({ eventId: event.eventId, status: e.target.value })}
                        >
                          <Radio.Button value="SHORTLISTED">Shortlisted</Radio.Button>
                          <Radio.Button value="HOLD">Hold</Radio.Button>
                          <Radio.Button value="REJECTED">Rejected</Radio.Button>
                        </Radio.Group>
                      </Space>
                    </div>
                  )}

                  <Space wrap style={{ marginBottom: 20 }}>
                    {isShortlisted && currentIdx < PIPELINE_STAGES.length - 1 && (
                      <Button
                        type="primary" size="small" icon={<ArrowRightOutlined />}
                        loading={stageMutation.isPending}
                        onClick={() => stageMutation.mutate({ eventId: event.eventId, stageName: PIPELINE_STAGES[currentIdx + 1] })}
                      >
                        Advance to {PIPELINE_STAGES[currentIdx + 1]}
                      </Button>
                    )}
                    {currentIdx > 0 && (
                      <>
                        <Select
                          placeholder="Revert to stage"
                          size="small"
                          style={{ width: 180 }}
                          options={PIPELINE_STAGES.slice(0, currentIdx).map(name => ({ value: name, label: name }))}
                          value={stageSelections[event.eventId] ?? null}
                          onChange={val => setStageSelections(prev => ({ ...prev, [event.eventId]: val }))}
                        />
                        <Button
                          size="small" danger
                          disabled={!stageSelections[event.eventId]}
                          loading={stageMutation.isPending}
                          onClick={() => stageMutation.mutate({ eventId: event.eventId, stageName: stageSelections[event.eventId] })}
                        >
                          Revert
                        </Button>
                      </>
                    )}
                  </Space>

                  {event.history.length > 0 && (
                    <>
                      <Divider orientation="left" style={{ fontSize: 12 }}>History</Divider>
                      <Timeline mode="left" items={event.history.map(h => ({
                        label: h.changedAt ? new Date(h.changedAt).toLocaleString() : '—',
                        color: h.status === 'SHORTLISTED' ? 'green' : h.status === 'REJECTED' ? 'red' : h.status === 'HOLD' ? 'orange' : 'blue',
                        children: (
                          <Space size={4}>
                            <Tag color="blue">{h.stageName}</Tag>
                            {h.status && <Tag color={statusColor[h.status]}>{h.status}</Tag>}
                            {h.changedBy && <Text type="secondary">by {h.changedBy}</Text>}
                          </Space>
                        )
                      }))} />
                    </>
                  )}
                  {event.history.length === 0 && currentIdx >= 0 && (
                    <Empty description="No history yet" />
                  )}
                </div>
              )
            }
          })}
        />
      ) : <Empty description="No stage history yet" />
    },
    {
      key: 'exit', label: <span style={{ color: exitRecord ? '#ef4444' : undefined }}><LogoutOutlined /> Exit</span>,
      children: exitLoading ? null : editingExit || !exitRecord ? (
        <div style={{ maxWidth: 480 }}>
          <Form
            form={exitForm}
            layout="vertical"
            initialValues={exitRecord ? { exitDate: dayjs(exitRecord.exitDate), reason: exitRecord.reason } : {}}
            onFinish={(values) => exitMutation.mutate({ exitDate: values.exitDate.format('YYYY-MM-DD'), reason: values.reason })}
          >
            <Form.Item name="exitDate" label="Exit Date" rules={[{ required: true, message: 'Exit date is required' }]}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="reason" label="Reason for Leaving">
              <Input.TextArea rows={4} placeholder="Resignation, contract end, termination…" />
            </Form.Item>
            <Space>
              <Button type="primary" danger htmlType="submit" loading={exitMutation.isPending}>
                {exitRecord ? 'Update' : 'Record Exit'}
              </Button>
              {exitRecord && <Button onClick={() => setEditingExit(false)}>Cancel</Button>}
            </Space>
          </Form>
        </div>
      ) : (
        <div>
          <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small" style={{ marginBottom: 16 }}>
            <Descriptions.Item label="Exit Date">
              <Tag color="red">{new Date(exitRecord.exitDate).toLocaleDateString()}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Reason" span={2}>{exitRecord.reason || '—'}</Descriptions.Item>
          </Descriptions>
          <Space>
            <Button icon={<EditOutlined />} onClick={() => { exitForm.setFieldsValue({ exitDate: dayjs(exitRecord.exitDate), reason: exitRecord.reason }); setEditingExit(true) }}>Edit</Button>
            <Popconfirm title="Remove exit record?" onConfirm={() => deleteExitMutation.mutate()} okText="Yes" cancelText="No">
              <Button danger loading={deleteExitMutation.isPending}>Remove</Button>
            </Popconfirm>
          </Space>
        </div>
      )
    },
    {
      key: 'resume', label: 'Resume',
      children: resumeData ? (
        <div style={{ textAlign: 'center', padding: 32 }}>
          <FileTextOutlined style={{ fontSize: 48, color: '#4f46e5', marginBottom: 16 }} />
          <div style={{ marginBottom: 8 }}><strong>{resumeData.fileName}</strong></div>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            Uploaded: {resumeData.uploadedAt ? new Date(resumeData.uploadedAt).toLocaleDateString() : '—'}
          </Text>
          <Button type="primary" icon={<DownloadOutlined />} size="large"
            href={`${import.meta.env.VITE_PUBLIC_API_URL}/api/v1/candidates/${id}/resume/download`} target="_blank">
            Download Resume
          </Button>
        </div>
      ) : <Empty description="No resume uploaded" />
    }
  ]

  return (
    <div>
      <Card bordered={false} style={{ borderRadius: 12, marginBottom: 16, background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
        <Row align="middle" gutter={16}>
          <Col>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: 'white' }}>
              {candidate.name?.charAt(0).toUpperCase()}
            </div>
          </Col>
          <Col>
            <Title level={3} style={{ color: 'white', margin: 0 }}>{candidate.name}</Title>
            <Text style={{ color: 'rgba(255,255,255,0.85)' }}>{candidate.email}</Text><br />
            <Text style={{ color: 'rgba(255,255,255,0.85)' }}>{candidate.college?.name}</Text>
          </Col>
        </Row>
      </Card>

      <Card bordered={false} style={{ borderRadius: 12 }}>
        <Tabs items={tabs} />
      </Card>

      <Modal
        title={editingRound ? `${editingRound.roundName} — Score` : ''}
        open={!!editingRound}
        onCancel={() => { setEditingRound(null); scoreForm.resetFields() }}
        onOk={() => scoreForm.validateFields().then(values => roundMutation.mutate({ ...editingRound, ...values }))}
        confirmLoading={roundMutation.isPending}
        okText="Save"
      >
        <Form form={scoreForm} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item name="score" label="Score">
            <InputNumber style={{ width: '100%' }} min={0} max={100} step={0.5} />
          </Form.Item>
          <Form.Item name="result" label="Result">
            <Select options={['PASS', 'FAIL', 'ON_HOLD'].map(v => ({ value: v }))} allowClear />
          </Form.Item>
          <Form.Item name="interviewer" label="Interviewer">
            <Input />
          </Form.Item>
          <Form.Item name="comments" label="Comments">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
