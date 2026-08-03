import { useState } from 'react'
import { Card, Button, Form, Select, Input, Upload, Radio, message } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { uploadStudentDataSheet, uploadSheetToEvent, getEvents } from '../api/events'
import { getColleges } from '../api/colleges'
import { getErrorMessage } from '../utils/errorUtils'

export default function StudentDataSheet() {
  const [mode, setMode] = useState('new')   // 'new' = create event, 'existing' = add to event
  const [file, setFile] = useState(null)
  const [form] = Form.useForm()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const { data: colleges } = useQuery({ queryKey: ['colleges'], queryFn: () => getColleges().then(r => r.data.data) })
  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: ['events'], queryFn: () => getEvents().then(r => r.data.data), enabled: mode === 'existing',
  })

  const uploadMutation = useMutation({
    mutationFn: (v) => mode === 'new' ? uploadStudentDataSheet(file, v) : uploadSheetToEvent(v.eventId, file),
    onSuccess: (res, v) => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      message.success(mode === 'new' ? 'Sheet uploaded — event created!' : 'Sheet uploaded!')
      form.resetFields(); setFile(null)
      const eventId = mode === 'new' ? res.data?.data?.id : v.eventId
      if (eventId) navigate(`/events/${eventId}`)
    },
    onError: (err) => message.error(getErrorMessage(err)),
  })

  return (
    <Card title="Upload Student Data Sheet" bordered={false} style={{ borderRadius: 12, maxWidth: 600 }}>
      <Radio.Group
        value={mode}
        onChange={e => { setMode(e.target.value); form.resetFields() }}
        optionType="button" buttonStyle="solid" style={{ marginBottom: 20 }}
        options={[
          { value: 'new', label: 'Create new events' },
          { value: 'existing', label: 'Add to existing event' },
        ]}
      />

      <Form form={form} layout="vertical" onFinish={v => uploadMutation.mutate(v)}>
        {mode === 'new' ? (
          <>
            <Form.Item name="collegeId" label="College" rules={[{ required: true }]}>
              <Select placeholder="Select college" options={colleges?.map(c => ({ value: c.id, label: c.name })) ?? []} />
            </Form.Item>
            <Form.Item name="recruitmentYear" label="Recruitment Year" rules={[{ required: true }]}
              initialValue={new Date().getFullYear()}>
              <Input type="number" />
            </Form.Item>
            <Form.Item name="startDate" label="Start Date">
              <Input type="date" />
            </Form.Item>
          </>
        ) : (
          <Form.Item name="eventId" label="Event" rules={[{ required: true }]}>
            <Select
              placeholder="Select event"
              loading={eventsLoading}
              options={events?.map(e => ({ value: e.id, label: `${e.college?.name} — ${e.recruitmentYear}` })) ?? []}
            />
          </Form.Item>
        )}

        <Form.Item label="Student Data Sheet" required>
          <Upload
            accept=".xlsx,.xls,.csv"
            maxCount={1}
            fileList={file ? [{ uid: '1', name: file.name }] : []}
            beforeUpload={f => { setFile(f); return false }}
            onRemove={() => setFile(null)}
          >
            <Button icon={<UploadOutlined />}>Choose File</Button>
          </Upload>
        </Form.Item>
        <Button type="primary" htmlType="submit" disabled={!file} loading={uploadMutation.isPending}>
          {mode === 'new' ? 'Upload & Create Event' : 'Upload'}
        </Button>
      </Form>
    </Card>
  )
}
