import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import {
  Background, Controls, Handle, MarkerType, Position, ReactFlow, addEdge, useEdgesState, useNodesState,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Button, Empty, Input, InputNumber, Modal, Select, Space, Tag, Typography, message } from 'antd'
import { DeleteOutlined, DisconnectOutlined, PlusOutlined, SaveOutlined, SnippetsOutlined, UndoOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createRoundGraphTemplate, deleteRoundGraphTemplate, getRoundGraphTemplates, saveRoundGraph,
} from '../api/events'
import { getErrorMessage } from '../utils/errorUtils'
import {
  DEFAULT_MAX_SCORE, DEFAULT_TEMPLATE, ROUND_TYPES, ROUND_TYPE_COLOR, arrowStyle, createsCycle, fitTemplate, isPairKey, layoutPairs,
  layoutRounds, pairColors, pairLabel, roundPairs, toGraphPayload,
} from '../utils/roundGraph'

const { Text } = Typography

const ARROW = { type: MarkerType.ArrowClosed, width: 18, height: 18 }
// The connection dots: big enough to grab without hunting for them.
export const HANDLE_STYLE = { width: 14, height: 14, background: '#4f46e5', border: '2px solid #fff' }
export const toFlowEdge = (from, to) => ({ id: `${from}->${to}`, source: from, target: to, markerEnd: ARROW })

// For the nodes to read: `info` is each pair's { label, color } by key, `at` roundPairs' result.
export const PairInfo = createContext({ info: {}, at: {} })
export const pairInfoOf = (pairs = []) => {
  const colors = pairColors(pairs)
  return Object.fromEntries(pairs.map((p) => [p.key, { label: pairLabel(p), color: colors[p.key] }]))
}

// Arrows coloured by arrowStyle: by the pairs whose candidates travel along them.
export const colorEdges = (edges, at, info) => {
  const colors = Object.fromEntries(Object.entries(info).map(([k, v]) => [k, v.color]))
  return edges.map((e) => {
    const look = arrowStyle(e.source, e.target, at, colors)
    if (!look) return e
    return {
      ...e,
      markerEnd: { ...ARROW, color: look.color },
      style: { stroke: look.color, strokeWidth: 2, ...(look.dashed && { strokeDasharray: '6 4' }) },
    }
  })
}

// Whose candidates can be at a round, each in its colour, when that's not everyone: solid when the
// round's Only for set it, dashed when it follows from the arrows into it.
function OnlyForTags({ roundKey }) {
  const { info, at } = useContext(PairInfo)
  const here = at[roundKey]
  if (!here || here.effective.length === 0 || here.effective.length === Object.keys(info).length) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
      {here.effective.map((k) => (
        <Tag
          key={k}
          title={here.explicit ? 'Set by Only for' : 'From the arrows into this round'}
          style={{
            fontSize: 10, margin: 0, color: info[k]?.color, background: `${info[k]?.color}14`,
            border: `1px ${here.explicit ? 'solid' : 'dashed'} ${info[k]?.color}`,
          }}
        >
          {info[k]?.label ?? 'Removed position'} only
        </Tag>
      ))}
    </div>
  )
}

// `count` is only set in the pipeline view: { pending, passed, failed } at the round.
export function RoundNode({ id, data, selected }) {
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
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{data.name || 'Untitled round'}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {data.roundType && (
          <Tag color={ROUND_TYPE_COLOR[data.roundType] ?? 'default'} style={{ fontSize: 10, margin: 0 }}>{data.roundType}</Tag>
        )}
        <span style={{ fontSize: 11, color: '#64748b' }}>Out of {data.maxScore ?? DEFAULT_MAX_SCORE}</span>
      </div>
      <OnlyForTags roundKey={id} />
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
export function PairNode({ id, data }) {
  const color = useContext(PairInfo).info[id]?.color
  return (
    <div
      style={{
        padding: '6px 14px',
        borderRadius: 999,
        background: color ? `${color}14` : '#eef2ff',
        border: `2px solid ${color ?? '#c7d2fe'}`,
        color: '#334155',
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
  data: {
    id: round.id ?? null, name: round.name, roundType: round.roundType ?? null, onlyFor: round.onlyFor ?? [],
    maxScore: round.maxScore ?? DEFAULT_MAX_SCORE,
  },
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
  const [templateName, setTemplateName] = useState(null)
  const queryClient = useQueryClient()
  const { data: templates = [] } = useQuery({
    queryKey: ['roundGraphTemplates'],
    queryFn: () => getRoundGraphTemplates().then((r) => r.data.data),
  })

  const selected = nodes.find((n) => n.id === selectedKey)
  const rounds = nodes.filter((n) => n.type === 'round')
  const pairInfo = pairInfoOf(graph?.pairs)
  const pairsAt = roundPairs(
    rounds.map((n) => ({ key: n.id, onlyFor: n.data.onlyFor })),
    edges.map((e) => ({ from: e.source, to: e.target })),
    (graph?.pairs ?? []).map((p) => p.key),
  )
  // Only for can only narrow who arrives: offer the pairs coming in (all of them for a round nothing
  // leads into yet), plus any already picked so they still show.
  const onlyForChoices = selected
    ? (graph?.pairs ?? []).filter((p) => {
      const incoming = pairsAt[selected.id]?.inherited ?? []
      return incoming.length === 0 || incoming.includes(p.key) || (selected.data.onlyFor ?? []).includes(p.key)
    })
    : []

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

  // Replaces the canvas; nothing is stored until Save, so Discard brings the old rounds back.
  const applyTemplate = (id) => {
    const template = id === 'default' ? DEFAULT_TEMPLATE : templates.find((t) => t.id === id)?.graph
    if (!template) return
    load(fitTemplate(template, graph?.pairs ?? []))
    setDirty(true)
    message.info(rounds.length
      ? 'Template applied. Draw where each position starts, then Save to replace the rounds, or Discard to keep them.'
      : 'Template applied. Draw where each position starts, then Save.')
  }

  const saveTemplate = async () => {
    try {
      const { rounds: saved, edges: arrows } = toGraphPayload(nodes, edges)
      await createRoundGraphTemplate(templateName.trim(), { rounds: saved, edges: arrows.filter((e) => !isPairKey(e.from)) })
      message.success('Template saved')
      setTemplateName(null)
      queryClient.invalidateQueries({ queryKey: ['roundGraphTemplates'] })
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const removeTemplate = (t) => Modal.confirm({
    centered: true,
    title: `Delete the template ${t.name}?`,
    content: 'It goes for everyone. Events already using it keep their rounds.',
    okText: 'Delete',
    okButtonProps: { danger: true },
    onOk: () => deleteRoundGraphTemplate(t.id)
      .then(() => queryClient.invalidateQueries({ queryKey: ['roundGraphTemplates'] }))
      .catch((err) => message.error(getErrorMessage(err))),
  })

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
        <Select
          value={null}
          placeholder="Apply template"
          style={{ width: 220 }}
          popupMatchSelectWidth={false}
          onChange={applyTemplate}
          options={[
            { value: 'default', label: 'Default (GD → Interview → HR)' },
            ...templates.map((t) => ({ value: t.id, label: t.name, template: t })),
          ]}
          optionRender={(o) => (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ flex: 1 }}>{o.label}</span>
              {o.data.template && (
                <Button
                  size="small"
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  aria-label={`Delete template ${o.label}`}
                  onClick={(e) => { e.stopPropagation(); removeTemplate(o.data.template) }}
                />
              )}
            </div>
          )}
        />
        <Button icon={<SnippetsOutlined />} disabled={rounds.length === 0} onClick={() => setTemplateName('')}>
          Save as template
        </Button>
        <div style={{ flex: 1 }} />
        {dirty && <Text type="warning" style={{ fontSize: 12 }}>Unsaved changes</Text>}
        <Button icon={<UndoOutlined />} disabled={!dirty || saving} onClick={() => graph && load(graph)}>Discard changes</Button>
        <Button type="primary" icon={<SaveOutlined />} disabled={!dirty} loading={saving} onClick={save}>Save rounds</Button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ flex: '1 1 420px', height: 440, border: '1px solid #e5e7eb', borderRadius: 8 }}>
          <PairInfo.Provider value={{ info: pairInfo, at: pairsAt }}>
            <ReactFlow
              nodes={nodes}
              edges={colorEdges(edges, pairsAt, pairInfo)}
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
          </PairInfo.Provider>
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
              <Text strong style={{ marginTop: 8 }}>Maximum marks</Text>
              <InputNumber
                value={selected.data.maxScore ?? DEFAULT_MAX_SCORE}
                min={1}
                max={999}
                precision={0}
                style={{ width: '100%' }}
                onChange={(v) => updateSelected({ maxScore: v ?? DEFAULT_MAX_SCORE })}
              />
              <Text strong style={{ marginTop: 8 }}>Only for</Text>
              <Select
                mode="multiple"
                value={selected.data.onlyFor ?? []}
                placeholder="Everyone who reaches it"
                style={{ width: '100%' }}
                options={onlyForChoices.map((p) => ({
                  value: p.key,
                  label: <span style={{ color: pairInfo[p.key]?.color }}>{pairLabel(p)}</span>,
                }))}
                onChange={(keys) => updateSelected({ onlyFor: keys })}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                A round already takes only the positions its arrows bring in (the dashed tags). Pick some of
                them to narrow it further, so tracks that met at a shared round can split again. Arrows
                carrying one position take its colour.
              </Text>
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

      <Modal
        title="Save as template"
        open={templateName != null}
        onCancel={() => setTemplateName(null)}
        onOk={saveTemplate}
        okText="Save"
        okButtonProps={{ disabled: !templateName?.trim() }}
        destroyOnHidden
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
          Saves these rounds and the arrows between them, as they are on the canvas, for anyone to apply to any event. Arrows from positions aren't saved.
        </Text>
        <Input
          autoFocus
          maxLength={100}
          placeholder="Template name"
          value={templateName ?? ''}
          onChange={(e) => setTemplateName(e.target.value)}
          onPressEnter={() => templateName?.trim() && saveTemplate()}
        />
      </Modal>
    </div>
  )
}
