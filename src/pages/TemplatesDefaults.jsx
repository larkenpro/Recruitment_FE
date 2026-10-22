import { useState } from 'react'
import {
  Button, Card, Col, Divider, Empty, Form, Input, InputNumber, List, Modal, Row, Space, Tabs, Typography, message,
} from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import RoundGraphEditor from '../components/RoundGraphEditor'
import {
  createRoundGraphTemplate, deleteRoundGraphTemplate, getRoundGraphTemplates, updateRoundGraphTemplate,
} from '../api/events'
import { updateDefaults } from '../api/defaults'
import { useDefaults } from '../hooks/useDefaults'
import { getErrorMessage } from '../utils/errorUtils'
import { GUTTER } from '../theme'

const { Text, Title } = Typography

const NEW = 'new'
const EMPTY_GRAPH = { rounds: [], edges: [] }
// The editor draws position nodes from `pairs`; a template has none.
const asCanvas = (graph) => ({ ...(graph ?? EMPTY_GRAPH), pairs: [] })

// Round-graph templates, each edited on the same canvas as an event's rounds.
function Templates() {
  const queryClient = useQueryClient()
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['roundGraphTemplates'],
    queryFn: () => getRoundGraphTemplates().then((r) => r.data.data),
  })
  const [selected, setSelected] = useState(null)
  const [graph, setGraph] = useState(null)
  const [name, setName] = useState('')
  const [dirty, setDirty] = useState(false)

  const current = templates.find((t) => t.id === selected)
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['roundGraphTemplates'] })

  const open = (key) => {
    const go = () => {
      setSelected(key)
      setDirty(false)
      if (key === NEW) {
        setGraph(asCanvas(EMPTY_GRAPH))
        setName('')
      } else {
        const t = templates.find((x) => x.id === key)
        setGraph(asCanvas(t.graph))
        setName(t.name)
      }
    }
    if (!dirty) return go()
    Modal.confirm({
      centered: true,
      title: 'Leave without saving?',
      content: 'The changes to this template will be lost.',
      okText: 'Leave',
      okButtonProps: { danger: true },
      onOk: go,
    })
  }

  // Called by the editor's Save. A new one saves as a new template.
  const saveGraph = async ({ rounds, edges }) => {
    if (!name.trim()) {
      // Shaped like an API error so the editor shows this message.
      throw { response: { data: { message: 'Give the template a name first' } } }
    }
    const res = current
      ? await updateRoundGraphTemplate(current.id, name.trim(), { rounds, edges })
      : await createRoundGraphTemplate(name.trim(), { rounds, edges })
    const saved = res.data.data
    setSelected(saved.id)
    setName(saved.name)
    await refresh()
    return asCanvas(saved.graph)
  }

  const rename = useMutation({
    mutationFn: () => updateRoundGraphTemplate(current.id, name.trim(), current.graph),
    onSuccess: (res) => {
      setName(res.data.data.name)
      refresh()
      message.success('Template renamed')
    },
    onError: (err) => message.error(getErrorMessage(err)),
  })

  const remove = () => Modal.confirm({
    centered: true,
    title: `Delete the template ${current.name}?`,
    content: 'It goes for everyone. Events already using it keep their rounds.',
    okText: 'Delete',
    okButtonProps: { danger: true },
    onOk: () => deleteRoundGraphTemplate(current.id)
      .then(() => {
        setSelected(null)
        setGraph(null)
        setDirty(false)
        refresh()
      })
      .catch((err) => message.error(getErrorMessage(err))),
  })

  return (
    <Row gutter={GUTTER}>
      <Col xs={24} md={7}>
        <Button type="primary" icon={<PlusOutlined />} block style={{ marginBottom: 12 }} onClick={() => open(NEW)}>
          New template
        </Button>
        <List
          size="small"
          bordered
          loading={isLoading}
          dataSource={templates}
          locale={{ emptyText: 'No templates yet' }}
          renderItem={(t) => (
            <List.Item
              onClick={() => open(t.id)}
              style={{ cursor: 'pointer', background: selected === t.id ? '#eef2ff' : undefined }}
            >
              <Space orientation="vertical" size={0}>
                <Text strong>{t.name}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t.graph.rounds.length} round{t.graph.rounds.length === 1 ? '' : 's'}
                </Text>
              </Space>
            </List.Item>
          )}
        />
      </Col>
      <Col xs={24} md={17}>
        {!graph ? (
          <Empty description="Pick a template to edit, or start a new one" style={{ marginTop: 48 }} />
        ) : (
          <>
            <Space wrap style={{ marginBottom: 12 }}>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Template name"
                maxLength={100}
                style={{ width: 280 }}
                aria-label="Template name"
              />
              {current && name.trim() && name.trim() !== current.name && (
                <Button icon={<EditOutlined />} loading={rename.isPending} onClick={() => rename.mutate()}>Rename</Button>
              )}
              {current && <Button danger icon={<DeleteOutlined />} onClick={remove}>Delete template</Button>}
            </Space>
            <RoundGraphEditor
              key={selected}
              template
              graph={graph}
              saveGraph={saveGraph}
              onSaved={setGraph}
              onDirtyChange={setDirty}
            />
          </>
        )}
      </Col>
    </Row>
  )
}

// What new events and rounds start with. Existing events and rounds keep their own values.
function Defaults() {
  const queryClient = useQueryClient()
  const { data: defaults, isLoading } = useDefaults()
  const save = useMutation({
    mutationFn: updateDefaults,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['defaults'] })
      message.success('Defaults saved')
    },
    onError: (err) => message.error(getErrorMessage(err)),
  })

  const number = (name, label, props) => (
    <Col key={name} xs={24} sm={12} md={8}>
      <Form.Item name={name} label={label}>
        <InputNumber style={{ width: '100%' }} {...props} />
      </Form.Item>
    </Col>
  )

  if (isLoading || !defaults) return null
  return (
    <Form key={JSON.stringify(defaults)} layout="vertical" initialValues={defaults} onFinish={(v) => save.mutate(v)} style={{ maxWidth: 900 }}>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        New events and rounds start with these. Changing them leaves existing events and rounds as they are —
        each event&apos;s own values are on its Screening tab.
      </Text>
      <Divider orientation="left" style={{ marginTop: 0 }}>New event — eligibility</Divider>
      <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>Leave a field empty to not check it.</Text>
      <Row gutter={GUTTER}>
        {number('minTenth', 'Minimum 10th %', { min: 0, max: 100, placeholder: 'Off' })}
        {number('minTwelfth', 'Minimum 12th / Diploma %', { min: 0, max: 100, placeholder: 'Off' })}
        {number('minCgpa', 'Minimum CGPA', { min: 0, max: 10, step: 0.1, placeholder: 'Off' })}
        {number('maxActiveBacklogs', 'Maximum active backlogs', { min: 0, precision: 0, placeholder: 'Off' })}
        {number('maxTotalBacklogs', 'Maximum total backlogs', { min: 0, precision: 0, placeholder: 'Off' })}
      </Row>
      <Divider orientation="left">New event — fit score weights</Divider>
      <Row gutter={GUTTER}>
        {number('weightTenth', '10th weight', { min: 0, step: 0.1 })}
        {number('weightTwelfth', '12th / Diploma weight', { min: 0, step: 0.1 })}
        {number('weightCgpa', 'CGPA weight', { min: 0, step: 0.1 })}
      </Row>
      <Divider orientation="left">New round</Divider>
      <Row gutter={GUTTER}>
        {number('roundMaxScore', 'Maximum marks', { min: 1, max: 999, precision: 0 })}
        {number('roundWeight', 'Fit score weight', { min: 0, step: 0.1 })}
      </Row>
      <Button type="primary" htmlType="submit" loading={save.isPending}>Save defaults</Button>
    </Form>
  )
}

export default function TemplatesDefaults() {
  return (
    <Card bordered={false} style={{ borderRadius: 12 }}>
      <Title level={4} style={{ marginTop: 0 }}>Templates &amp; Defaults</Title>
      <Tabs
        items={[
          { key: 'templates', label: 'Round templates', children: <Templates /> },
          { key: 'defaults', label: 'Defaults', children: <Defaults /> },
        ]}
      />
    </Card>
  )
}
