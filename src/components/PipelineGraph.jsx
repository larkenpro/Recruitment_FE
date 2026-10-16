import { useEffect, useMemo, useRef, useState } from 'react'
import { Background, Controls, Handle, Position, ReactFlow, useEdgesState, useNodesState } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Modal, Segmented, Typography } from 'antd'
import { EditOutlined, EyeOutlined } from '@ant-design/icons'
import RoundGraphEditor, {
  HANDLE_STYLE, PairInfo, PairNode, RoundNode, colorEdges, pairInfoOf, toFlowEdge, toPairNode, toRoundNode,
} from './RoundGraphEditor'
import { pipelineLayout, roundPairs, spreadOut } from '../utils/roundGraph'

const { Text } = Typography

// A fixed pipeline stage (Resume, Offer, Joining, …): not part of the editable round graph.
function StageNode({ data, selected }) {
  return (
    <div
      style={{
        padding: '8px 14px',
        minWidth: 120,
        borderRadius: 8,
        background: selected ? '#eef2ff' : '#f8fafc',
        border: `1.5px solid ${selected ? '#4f46e5' : '#cbd5e1'}`,
        boxShadow: selected ? '0 0 0 3px rgba(79,70,229,0.15)' : 'none',
        cursor: 'pointer',
      }}
    >
      <Handle type="target" position={Position.Left} style={HANDLE_STYLE} />
      <div style={{ fontWeight: 600, fontSize: 13 }}>{data.name}</div>
      <div style={{ fontSize: 11, color: '#64748b' }}>{data.count ?? 0} candidate{data.count === 1 ? '' : 's'}</div>
      <Handle type="source" position={Position.Right} style={HANDLE_STYLE} />
    </div>
  )
}

const viewNodeTypes = { stage: StageNode, round: RoundNode, pair: PairNode }

// The whole pipeline, read-only: click a stage or round to show its candidates below.
function PipelineView({ graph, counts, selectedStage, onSelectStage }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges] = useEdgesState([])
  const info = useMemo(() => pairInfoOf(graph.pairs), [graph])
  const pairsAt = useMemo(() => roundPairs(graph.rounds, graph.edges, (graph.pairs ?? []).map((p) => p.key)), [graph])
  // Each node's measured { w, h }: rounds placed close together in the editor can overlap once
  // their tags and counts show, so the view moves them apart when it knows how big they are.
  const sizes = useRef({})
  const flow = useRef(null)
  const settle = (ns) => {
    if (ns.some((n) => !sizes.current[n.id])) return ns
    const ys = spreadOut(ns.map((n) => ({ id: n.id, x: n.position.x, y: n.position.y, ...sizes.current[n.id] })))
    return ns.map((n) => (ys[n.id] === n.position.y ? n : { ...n, position: { ...n.position, y: ys[n.id] } }))
  }

  useEffect(() => {
    if (!nodes.length || nodes.some((n) => !n.measured?.height)) return
    if (nodes.every((n) => sizes.current[n.id]?.h === n.measured.height && sizes.current[n.id]?.w === n.measured.width)) return
    nodes.forEach((n) => { sizes.current[n.id] = { w: n.measured.width, h: n.measured.height } })
    setNodes(settle(nodes))
    requestAnimationFrame(() => flow.current?.fitView({ maxZoom: 1 }))
  }, [nodes]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const view = pipelineLayout(graph)
    setNodes(settle([
      ...view.stages.map((s) => ({
        id: s.key,
        type: 'stage',
        position: { x: s.x, y: s.y },
        data: { name: s.name, count: counts[s.key] },
        selected: s.key === selectedStage,
      })),
      ...view.pairs.map(toPairNode),
      ...view.rounds.map((r) => {
        const node = toRoundNode(r)
        return { ...node, data: { ...node.data, count: counts[r.key] ?? { pending: 0, passed: 0, failed: 0 } }, selected: r.key === selectedStage, style: { cursor: 'pointer' } }
      }),
    ]))
    setEdges(colorEdges(view.edges.map((e) => toFlowEdge(e.from, e.to)), pairsAt, info))
  }, [graph, counts, selectedStage, setNodes, setEdges, info, pairsAt]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ height: 360, border: '1px solid #e5e7eb', borderRadius: 8 }}>
      <PairInfo.Provider value={{ info, at: pairsAt }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={viewNodeTypes}
          onNodesChange={onNodesChange}
          onInit={(instance) => { flow.current = instance }}
          onNodeClick={(_, node) => node.type !== 'pair' && onSelectStage(node.id)}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          deleteKeyCode={null}
          fitView
          fitViewOptions={{ maxZoom: 1 }}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={16} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </PairInfo.Provider>
    </div>
  )
}

// The event's pipeline as one graph. View: click a stage to see who is in it. Edit: the round
// graph editor (pairs, rounds and arrows).
export default function PipelineGraph({ eventId, graph, onSaved, counts, selectedStage, onSelectStage }) {
  const [mode, setMode] = useState('view')
  const [dirty, setDirty] = useState(false)

  const switchMode = (next) => {
    if (next === 'view' && dirty) {
      Modal.confirm({
        centered: true,
        title: 'Leave without saving?',
        content: 'Your unsaved changes to the rounds will be lost.',
        okText: 'Leave',
        okButtonProps: { danger: true },
        onOk: () => { setDirty(false); setMode('view') },
      })
      return
    }
    setMode(next)
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <Segmented
          value={mode}
          onChange={switchMode}
          options={[
            { value: 'view', label: 'View', icon: <EyeOutlined /> },
            { value: 'edit', label: 'Edit rounds', icon: <EditOutlined /> },
          ]}
        />
        {mode === 'view' && (
          <Text type="secondary" style={{ fontSize: 12 }}>Click a stage or round to see the candidates in it.</Text>
        )}
      </div>
      {!graph ? null : mode === 'view' ? (
        <PipelineView graph={graph} counts={counts} selectedStage={selectedStage} onSelectStage={onSelectStage} />
      ) : (
        <RoundGraphEditor eventId={eventId} graph={graph} onSaved={onSaved} onDirtyChange={setDirty} />
      )}
    </div>
  )
}
