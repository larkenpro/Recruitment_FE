import { useState } from 'react'
import {
  Card, Steps, Upload, Button, Table, Select, InputNumber, Form, Input, Radio,
  Progress, Alert, Space, Tag, Typography, message,
} from 'antd'
import { InboxOutlined, DownloadOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import {
  getImportFields, parseWorkbook, preflightImport, importBatch, downloadFailures,
  chunk, distinctPositions, BATCH_SIZE,
} from '../api/imports'
import { getEvents } from '../api/events'
import { getColleges } from '../api/colleges'
import { getErrorMessage } from '../utils/errorUtils'

const { Text } = Typography

// Prefill only — every dropdown stays editable, the mapping is the user's call.
const GUESSES = {
  name: 'name',
  email: 'email', personalemail: 'email',
  retnumber: 'rollNo', rollno: 'rollNo', registrationnumber: 'rollNo',
  phone: 'phone', phonenumber: 'phone',
  ugprogramme: 'branch', branch: 'branch',
  '10th': 'tenthMark', '12th': 'twelfthMark',
  btechcgpa: 'ugCgpa',
  existingarrears: 'arrears', arrears: 'arrears',
  githublink: 'githubLink',
  linkedinlink: 'linkedinLink',
  interestedpositions: 'preferredPositions',
  interestedlocations: 'jobLocation',
  leadershippositions: 'leadershipPositions',
  resumelink: 'resumeLink',
  scoretype: 'scoreType',
}

const normalize = (header) => String(header ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

const REQUIRED = ['name', 'email', 'rollNo', 'preferredPositions']

export default function ImportCandidates() {
  const [step, setStep] = useState(0)
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [mapping, setMapping] = useState({})
  const [divisor, setDivisor] = useState(9.5)
  const [mode, setMode] = useState('existing')
  const [eventId, setEventId] = useState(null)
  // Captured when leaving step 2 — the Form unmounts there, so its instance can't be read later.
  const [newEvent, setNewEvent] = useState(null)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState(null)
  const [failures, setFailures] = useState([])
  const [corrections, setCorrections] = useState([])
  const [newEventForm] = Form.useForm()

  const { data: fields } = useQuery({
    queryKey: ['import-fields'],
    queryFn: () => getImportFields().then((r) => r.data.data),
  })
  const { data: events } = useQuery({ queryKey: ['events'], queryFn: () => getEvents().then((r) => r.data.data) })
  const { data: colleges } = useQuery({ queryKey: ['colleges'], queryFn: () => getColleges().then((r) => r.data.data) })

  const positionColumn = headers.findIndex((h) => mapping[h] === 'preferredPositions')
  const positionTitles = distinctPositions(rows, positionColumn)
  const mappedTargets = Object.values(mapping).filter(Boolean)
  const missing = REQUIRED.filter((t) => !mappedTargets.includes(t))

  const handleUpload = async (file) => {
    try {
      const res = await parseWorkbook(file)
      const { headers: parsedHeaders, rows: parsedRows } = res.data.data
      setHeaders(parsedHeaders)
      setRows(parsedRows)
      setMapping(Object.fromEntries(parsedHeaders.map((h) => [h, GUESSES[normalize(h)] ?? ''])))
      setStep(1)
      message.success(`Read ${parsedRows.length} rows`)
    } catch (err) {
      message.error(getErrorMessage(err))
    }
    return Upload.LIST_IGNORE
  }

  const goToImportStep = async () => {
    if (mode === 'existing') {
      setNewEvent(null)
      setStep(3)
      return
    }
    try {
      const values = await newEventForm.validateFields()
      // An empty date input posts '' — the backend can't parse that as a LocalDate.
      setNewEvent(Object.fromEntries(Object.entries(values).filter(([, v]) => v !== '' && v != null)))
      setStep(3)
    } catch {
      // validateFields already highlights the offending field
    }
  }

  const basePayload = () => ({
    headers,
    mapping: Object.fromEntries(Object.entries(mapping).filter(([, target]) => target)),
    positionTitles,
    divisor,
  })

  const runImport = async () => {
    setRunning(true)
    setProgress(0)
    setResult(null)
    setFailures([])
    setCorrections([])
    try {
      const preflight = await preflightImport({
        ...basePayload(),
        rows,
        eventId: mode === 'existing' ? eventId : null,
        newEvent: mode === 'new' ? newEvent : null,
      })
      const checked = preflight.data.data
      setCorrections(checked.corrections ?? [])
      // Rows preflight rejected are not an abort — they ride along to the failure workbook.
      const rejected = [...(checked.failures ?? [])]

      // No eventId means nothing at all survived validation, so there is nothing to batch.
      if (!checked.eventId) {
        setFailures(rejected)
        setResult({ imported: 0, total: rows.length, blocked: true })
        return
      }

      // Preflight hands back the auto-corrected, validated rows — batch from those.
      const importRows = checked.rows ?? rows
      const batches = chunk(importRows, BATCH_SIZE)
      let imported = 0
      for (let i = 0; i < batches.length; i++) {
        const res = await importBatch(checked.eventId, { ...basePayload(), rows: batches[i] })
        imported += res.data.data.imported
        rejected.push(...(res.data.data.failures ?? []))
        setProgress(Math.round(((i + 1) / batches.length) * 100))
      }
      setFailures(rejected)
      setResult({
        imported,
        total: rows.length,
        eventId: checked.eventId,
        blocked: false,
        createdPositions: checked.createdPositions,
      })
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setRunning(false)
    }
  }

  const handleDownloadFailures = async () => {
    try {
      const res = await downloadFailures({ headers, failures })
      const url = URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.download = 'import-failures.xlsx'
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const mappingColumns = [
    { title: 'Sheet column', dataIndex: 'header', width: '35%', render: (h) => <Text strong>{h}</Text> },
    {
      title: 'Sample value',
      width: '30%',
      render: (_, r) => <Text type="secondary">{rows[0]?.values[r.index] || '—'}</Text>,
    },
    {
      title: 'Maps to',
      render: (_, r) => (
        <Select
          style={{ width: '100%' }}
          allowClear
          placeholder="— ignore this column —"
          value={mapping[r.header] || undefined}
          onChange={(value) => setMapping((prev) => ({ ...prev, [r.header]: value ?? '' }))}
          options={(fields ?? []).map((f) => ({
            value: f,
            label: f,
            disabled: mappedTargets.includes(f) && mapping[r.header] !== f,
          }))}
        />
      ),
    },
  ]

  const failureColumns = [
    { title: 'Sheet', dataIndex: 'sheet', width: 140 },
    { title: 'Row', dataIndex: 'rowNum', width: 80 },
    { title: 'Reason', dataIndex: 'reason' },
  ]

  return (
    <Card title="Import Candidates from Excel" bordered={false} style={{ borderRadius: 12 }}>
      <Steps
        current={step}
        style={{ marginBottom: 24 }}
        items={[{ title: 'Upload' }, { title: 'Map columns' }, { title: 'Event' }, { title: 'Import' }]}
      />

      {step === 0 && (
        <Upload.Dragger accept=".xlsx" beforeUpload={handleUpload} showUploadList={false}>
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p className="ant-upload-text">Click or drag an .xlsx workbook here</p>
          <p className="ant-upload-hint">Every worksheet is read into the same event. All sheets must share one header row.</p>
        </Upload.Dragger>
      )}

      {step === 1 && (
        <>
          <Space style={{ marginBottom: 16 }} wrap>
            <Tag color="blue">{rows.length} rows</Tag>
            <Tag color="blue">{new Set(rows.map((r) => r.sheet)).size} worksheets</Tag>
            {positionTitles.map((t) => <Tag key={t}>{t}</Tag>)}
          </Space>
          <Table
            size="small"
            pagination={false}
            rowKey="header"
            columns={mappingColumns}
            dataSource={headers.map((header, index) => ({ header, index }))}
            scroll={{ x: 'max-content' }}
          />
          <Space style={{ marginTop: 16 }} align="center">
            <Text>Percentage → CGPA divisor</Text>
            <InputNumber min={1} step={0.1} value={divisor} onChange={(v) => setDivisor(v ?? 9.5)} />
            <Text type="secondary">Applied when the score-type column says “Percentage”.</Text>
          </Space>
          {missing.length > 0 && (
            <Alert style={{ marginTop: 16 }} type="warning" showIcon
              message={`Still to map: ${missing.join(', ')}`} />
          )}
          <div style={{ marginTop: 16 }}>
            <Space>
              <Button onClick={() => setStep(0)}>Back</Button>
              <Button type="primary" disabled={missing.length > 0} onClick={() => setStep(2)}>Next</Button>
            </Space>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <Radio.Group value={mode} onChange={(e) => setMode(e.target.value)} style={{ marginBottom: 16 }}>
            <Radio.Button value="existing">Add to an existing event</Radio.Button>
            <Radio.Button value="new">Create a new event</Radio.Button>
          </Radio.Group>

          {mode === 'existing' ? (
            <>
              <Select
                style={{ width: '100%', maxWidth: 480 }}
                placeholder="Select an event"
                value={eventId}
                onChange={setEventId}
                options={(events ?? []).map((e) => ({
                  value: e.id,
                  label: `${e.college?.name ?? 'Event'} — ${e.recruitmentYear} (${e.status})`,
                }))}
              />
              <Alert style={{ marginTop: 16 }} type="info" showIcon
                message="The import is rejected if any position in the workbook isn't part of the event."
                description={`Workbook positions: ${positionTitles.join(', ') || 'none found'}`} />
            </>
          ) : (
            <>
              <Form form={newEventForm} layout="vertical" style={{ maxWidth: 480 }}>
                <Form.Item name="collegeId" label="College" rules={[{ required: true }]}>
                  <Select options={(colleges ?? []).map((c) => ({ value: c.id, label: c.name }))} />
                </Form.Item>
                <Form.Item name="recruitmentYear" label="Year" rules={[{ required: true }]}
                  initialValue={new Date().getFullYear()}>
                  <InputNumber style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="startDate" label="Start Date"><Input type="date" /></Form.Item>
                <Form.Item name="status" label="Status" initialValue="UPCOMING">
                  <Select options={['UPCOMING', 'ACTIVE', 'COMPLETED', 'CANCELLED'].map((s) => ({ value: s }))} />
                </Form.Item>
              </Form>
              <Alert type="info" showIcon
                message="The workbook's positions are attached to the new event automatically, and any title missing from the Positions table is created with placeholder department/type."
                description={positionTitles.join(', ') || 'none found'} />
            </>
          )}

          <div style={{ marginTop: 16 }}>
            <Space>
              <Button onClick={() => setStep(1)}>Back</Button>
              <Button type="primary" disabled={mode === 'existing' && !eventId} onClick={goToImportStep}>Next</Button>
            </Space>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <Alert style={{ marginBottom: 16 }} type="info" showIcon
            message={`${rows.length} rows in ${chunk(rows, BATCH_SIZE).length} batches of ${BATCH_SIZE}`}
            description="Every row is checked first; a row that fails goes to the failure workbook and the rest carry on. Each batch is then written in its own transaction — a batch that fails is rolled back and joins the same workbook." />

          {(running || progress > 0) && <Progress percent={progress} status={running ? 'active' : undefined} />}

          {result && (
            <Alert
              style={{ margin: '16px 0' }}
              type={result.blocked ? 'error' : failures.length ? 'warning' : 'success'}
              showIcon
              message={result.blocked
                ? 'No row passed validation — nothing was imported'
                : `Imported ${result.imported} of ${result.total} rows`}
              description={[
                failures.length ? `${failures.length} row(s) rejected.` : null,
                result.createdPositions?.length
                  ? `Created ${result.createdPositions.length} new position(s) with placeholder department/type: ${result.createdPositions.join(', ')} — fill them in on the Positions page.`
                  : null,
              ].filter(Boolean).join(' ') || null}
            />
          )}

          {corrections.length > 0 && (
            <>
              <Alert style={{ marginBottom: 12 }} type="info" showIcon
                message={`${corrections.length} row(s) auto-corrected before importing`} />
              <Table
                style={{ marginBottom: 16 }}
                size="small"
                rowKey={(r) => `fix-${r.sheet}-${r.rowNum}`}
                columns={[...failureColumns.slice(0, 2), { title: 'Correction', dataIndex: 'reason' }]}
                dataSource={corrections}
                pagination={{ pageSize: 5 }}
                scroll={{ x: 'max-content' }}
              />
            </>
          )}

          {failures.length > 0 && (
            <>
              <Space style={{ marginBottom: 12 }}>
                <Button icon={<DownloadOutlined />} onClick={handleDownloadFailures}>
                  Download failed rows (.xlsx)
                </Button>
              </Space>
              <Table
                size="small"
                rowKey={(r) => `${r.sheet}-${r.rowNum}`}
                columns={failureColumns}
                dataSource={failures}
                pagination={{ pageSize: 10 }}
                scroll={{ x: 'max-content' }}
              />
            </>
          )}

          <div style={{ marginTop: 16 }}>
            <Space>
              <Button onClick={() => setStep(2)} disabled={running}>Back</Button>
              <Button type="primary" loading={running} onClick={runImport}>
                {result ? 'Run again' : 'Start import'}
              </Button>
            </Space>
          </div>
        </>
      )}
    </Card>
  )
}
