import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Background, Controls, Handle, MarkerType, Position, ReactFlow, addEdge, useEdgesState, useNodesState,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Button, Empty, Input, Modal, Select, Space, Tag, Typography, message } from 'antd'
import { DeleteOutlined, DisconnectOutlined, PlusOutlined, SaveOutlined, ThunderboltOutlined, UndoOutlined } from '@ant-design/icons'
import { saveRoundGraph } from '../api/events'
import { getErrorMessage } from '../utils/errorUtils'
import {
  ROUND_TYPES, ROUND_TYPE_COLOR, createsCycle, defaultTemplate, isPairKey, layoutPairs, layoutRounds, pairLabel,
  toGraphPayload,
} from '../utils/roundGraph'

const { Text } = Typography

const ARROW = { type: MarkerType.ArrowClosed, width: 18, height: 18 }
// The connection dots: big enough to grab without hunting for them.
export const HANDLE_STYLE = { width: 14, height: 14, background: '#4f46e5', border: '2px solid #fff' }
export const toFlowEdge = (from, to) => ({ id: `${from}->${to}`, source: from, target: to, markerEnd: ARROW })

// `count` is only set in the pipeline view: { pending, passed, failed } at the round.
export function RoundNode({ data, selected }) {
  return (
    <div
      style={{
        padding: '8px 12px',
        minWidth: 170,
        maxWidth: 220,
        borderRadius: 8,
        background: '#fff',
        border: `1.5px solid ${selected ? '#4f46e5' : '#d1d5db'}`,
        boxShadow: selected ? '0 0 0 3px rgba(79,70,229,0.15)' : 'none',
      }}
    >
      <Handle type="target" position={Position.Left} style={HANDLE_STYLE} />
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: data.roundType ? 4 : 0 }}>{data.name || 'Untitled round'}</div>
      {data.roundType && (
        <Tag color={ROUND_TYPE_COLOR[data.roundType] ?? 'default'} style={{ fontSize: 10, margin: 0 }}>{data.roundType}</Tag>
      )}
      {data.count != null && (
        <div style={{ fontSize: 11, marginTop: 4 }}>
          <span style={{ color: '#d48806' }}>{data.count.pending} pending</span>,{' '}
          <span style={{ color: '#389e0d' }}>{data.count.passed} passed</span>,{' '}
          <span style={{ color: '#cf1322' }}>{data.count.failed} failed</span>
        </div>
      )}
      <Handle type="source" position={Position.Right} style={HANDLE_STYLE} />
    </div>
  )
}

// A (position, type) pair the event hires for: where its candidates' rounds start.
export function PairNode({ data }) {
  return (
    <div
      style={{
        padding: '6px 14px',
        borderRadius: 999,
        background: '#eef2ff',
        border: '1.5px solid #c7d2fe',
        color: '#3730a3',
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {data.label}
      <Handle type="source" position={Position.Right} style={HANDLE_STYLE} />
    </div>
  )
}

const nodeTypes = { round: RoundNode, pair: PairNode }

export const toRoundNode = (round) => ({
  id: round.key,
  type: 'round',
  position: { x: round.x, y: round.y },
  data: { id: round.id ?? null, name: round.name, roundType: round.roundType ?? null },
})

// Pairs come from the event's positions, so they can't be moved, renamed or deleted here.
export const toPairNode = (pair) => ({
  id: pair.key,
  type: 'pair',
  position: { x: pair.x, y: pair.y },
  data: { label: pairLabel(pair) },
  draggable: false,
  selectable: false,
  deletable: false,
})

// The event's round graph as a node canvas. On the left, one node per (position, type) pair the
// event hires for; drag from a pair to the round its candidates start at, and from a round to the
// round passing it unlocks. Nothing is stored until Save, which sends the whole canvas.
export default function RoundGraphEditor({ eventId, graph, onSaved, onDirtyChange }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [selectedKey, setSelectedKey] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const newRounds = useRef(0)

  const selected = nodes.find((n) => n.id === selectedKey)
  const rounds = nodes.filter((n) => n.type === 'round')

  const load = useCallback((g) => {
    const placed = layoutRounds(g.rounds, g.edges)
    setNodes([...layoutPairs(g.pairs ?? [], placed).map(toPairNode), ...placed.map(toRoundNode)])
    setEdges(g.edges.map((e) => toFlowEdge(e.from, e.to)))
    setSelectedKey(null)
    setDirty(false)
  }, [setNodes, setEdges])

  useEffect(() => {
    if (graph) load(graph)
  }, [graph, load])

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  const handleNodesChange = (changes) => {
    onNodesChange(changes)
    if (changes.some((c) => c.type === 'position' || c.type === 'remove')) setDirty(true)
  }

  const handleEdgesChange = (changes) => {
    onEdgesChange(changes)
    if (changes.some((c) => c.type === 'remove')) setDirty(true)
  }

  const arrows = edges.map((e) => ({ from: e.source, to: e.target }))
  const isValidConnection = (c) =>
    !isPairKey(c.target)
    && !createsCycle(arrows, c.source, c.target)
    && !edges.some((e) => e.source === c.source && e.target === c.target)

  const onConnect = (c) => {
    setEdges((eds) => addEdge(toFlowEdge(c.source, c.target), eds))
    setDirty(true)
  }

  const addRound = () => {
    const key = `new-${++newRounds.current}`
    const right = rounds.reduce((x, n) => Math.max(x, n.position.x), -260) + 260
    setNodes((ns) => [
      ...ns.map((n) => ({ ...n, selected: false })),
      { ...toRoundNode({ key, name: 'New round', x: right, y: 0 }), selected: true },
    ])
    setSelectedKey(key)
    setDirty(true)
  }

  const updateSelected = (patch) => {
    setNodes((ns) => ns.map((n) => (n.id === selectedKey ? { ...n, data: { ...n.data, ...patch } } : n)))
    setDirty(true)
  }

  const removeSelected = () => {
    setNodes((ns) => ns.filter((n) => n.id !== selectedKey))
    setEdges((eds) => eds.filter((e) => e.source !== selectedKey && e.target !== selectedKey))
    setSelectedKey(null)
    setDirty(true)
  }

  // Every arrow goes — pair starts and round-to-round — so the flow can be redrawn from scratch.
  // Not stored until Save, so Discard brings them back.
  const clearArrows = () => {
    setEdges([])
    setDirty(true)
    message.info('All arrows removed. Save to keep it this way, or Discard to bring them back.')
  }

  const applyTemplate = () => {
    load(defaultTemplate(graph?.pairs ?? []))
    setDirty(true)
  }

  const save = () => {
    if (rounds.some((n) => !n.data.name?.trim())) {
      message.error('Every round needs a name')
      return
    }
    const send = async () => {
      setSaving(true)
      try {
        const res = await saveRoundGraph(eventId, toGraphPayload(nodes, edges))
        message.success('Rounds saved')
        onSaved(res.data.data)
      } catch (err) {
        message.error(getErrorMessage(err))
      } finally {
        setSaving(false)
      }
    }
    const kept = new Set(rounds.map((n) => n.data.id).filter(Boolean))
    const removed = (graph?.rounds ?? []).filter((r) => !kept.has(r.id))
    if (removed.length === 0) {
      send()
      return
    }
    Modal.confirm({
      centered: true,
      title: `Delete ${removed.map((r) => r.name).join(', ')}?`,
      content: 'Any results already recorded for these rounds are deleted with them.',
      okText: 'Delete and save',
      okButtonProps: { danger: true },
      onOk: send,
    })
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Button icon={<PlusOutlined />} onClick={addRound}>Add round</Button>
        <Button icon={<DisconnectOutlined />} disabled={edges.length === 0} onClick={clearArrows}>Clear arrows</Button>
        {rounds.length === 0 && (
          <Button icon={<ThunderboltOutlined />} onClick={applyTemplate}>Default template</Button>
        )}
        <div style={{ flex: 1 }} />
        {dirty && <Text type="warning" style={{ fontSize: 12 }}>Unsaved changes</Text>}
        <Button icon={<UndoOutlined />} disabled={!dirty || saving} onClick={() => graph && load(graph)}>Discard changes</Button>
        <Button type="primary" icon={<SaveOutlined />} disabled={!dirty} loading={saving} onClick={save}>Save rounds</Button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ flex: '1 1 420px', height: 440, border: '1px solid #e5e7eb', borderRadius: 8 }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={onConnect}
            isValidConnection={isValidConnection}
            onSelectionChange={({ nodes: picked }) => setSelectedKey(picked.length === 1 ? picked[0].id : null)}
            deleteKeyCode={['Backspace', 'Delete']}
            fitView
            fitViewOptions={{ maxZoom: 1 }}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={16} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>

        <div style={{ flex: '0 1 260px', minWidth: 220 }}>
          {selected ? (
            <Space orientation="vertical" style={{ width: '100%' }}>
              <Text strong>Round</Text>
              <Input
                value={selected.data.name}
                placeholder="Round name"
                onChange={(e) => updateSelected({ name: e.target.value })}
              />
              <Select
                value={selected.data.roundType ?? undefined}
                placeholder="Type"
                allowClear
                style={{ width: '100%' }}
                options={ROUND_TYPES.map((t) => ({ value: t, label: t }))}
                onChange={(t) => updateSelected({ roundType: t ?? null })}
              />
              <Button danger icon={<DeleteOutlined />} onClick={removeSelected}>Remove round</Button>
            </Space>
          ) : (graph?.pairs ?? []).length === 0 ? (
            <Empty description="Add positions with their types to this event first — each becomes a starting point here" />
          ) : (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Each position and type this event hires for is a node on the left. Drag from it to the round its
              candidates start at, and from a round to the round passing it unlocks. A round opens once{' '}
              <strong>any</strong> arrow into it is satisfied. Candidates take every round reachable from what they
              applied for. Select a round to edit it, or an arrow or round and press Delete to remove it.
            </Text>
          )}
        </div>
      </div>
    </div>
  )
}
