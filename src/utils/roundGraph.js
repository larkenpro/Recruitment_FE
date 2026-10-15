// An event's rounds are a directed graph. Each (position, type) pair the event hires for is a start
// node (key `pair:<positionId>:<typeId>`): an edge from it into a round starts that pair's
// candidates there. An edge between rounds means passing `from` can unlock `to`. Rounds are keyed
// by their id as text once saved, or a temporary key for a round added but not saved yet.

export const ROUND_TYPES = ['WRITTEN', 'TECHNICAL', 'HR', 'GROUP_DISCUSSION', 'CODING']
export const ROUND_TYPE_COLOR = { WRITTEN: 'purple', TECHNICAL: 'blue', HR: 'green', GROUP_DISCUSSION: 'orange', CODING: 'cyan' }

const COLUMN_WIDTH = 260
const ROW_HEIGHT = 120
const PAIR_ROW_HEIGHT = 70

export const isPairKey = (key) => key.startsWith('pair:')

export const pairLabel = (pair) => `${pair.positionTitle} · ${pair.typeName}`

// Pair nodes go in one column to the left of every round.
export const layoutPairs = (pairs, rounds) => {
  const left = Math.min(0, ...rounds.map((r) => r.x ?? 0)) - COLUMN_WIDTH
  return pairs.map((p, i) => ({ ...p, x: left, y: i * PAIR_ROW_HEIGHT }))
}

// Would an arrow from -> to close a loop? It does when `from` is already reachable from `to`.
export const createsCycle = (edges, from, to) => {
  if (from === to) return true
  const next = {}
  edges.forEach((e) => { (next[e.from] ??= []).push(e.to) })
  const seen = new Set()
  const stack = [to]
  while (stack.length) {
    const key = stack.pop()
    if (key === from) return true
    if (seen.has(key)) continue
    seen.add(key)
    stack.push(...(next[key] ?? []))
  }
  return false
}

// Canvas positions for rounds that don't have one yet: one column per step along the longest path
// into the round, stacked top to bottom within a column. Rounds that already have x/y keep them.
export const layoutRounds = (rounds, edges) => {
  const depth = Object.fromEntries(rounds.map((r) => [r.key, 0]))
  // The graph is acyclic, so relaxing every edge once per round settles the longest paths.
  rounds.forEach(() => edges.forEach((e) => {
    if (e.from in depth && e.to in depth) depth[e.to] = Math.max(depth[e.to], depth[e.from] + 1)
  }))
  const rowsUsed = {}
  return rounds.map((r) => {
    if (r.x != null && r.y != null) return r
    const column = depth[r.key]
    const row = rowsUsed[column] ?? 0
    rowsUsed[column] = row + 1
    return { ...r, x: column * COLUMN_WIDTH, y: row * ROW_HEIGHT }
  })
}

// What PUT /events/{id}/round-graph takes, from the editor's React Flow nodes and edges.
export const toGraphPayload = (nodes, edges) => ({
  rounds: nodes.filter((n) => !isPairKey(n.id)).map((n) => ({
    id: n.data.id ?? null,
    key: n.id,
    name: n.data.name,
    roundType: n.data.roundType ?? null,
    x: Math.round(n.position.x),
    y: Math.round(n.position.y),
  })),
  edges: edges.map((e) => ({ from: e.source, to: e.target })),
})

// Group Discussion -> Interview -> HR, with every pair starting at Group Discussion.
export const defaultTemplate = (pairs) => ({
  pairs,
  rounds: [
    { key: 'gd', name: 'Group Discussion', roundType: 'GROUP_DISCUSSION', x: 0, y: 0 },
    { key: 'interview', name: 'Interview', roundType: 'TECHNICAL', x: COLUMN_WIDTH, y: 0 },
    { key: 'hr', name: 'HR Round', roundType: 'HR', x: 2 * COLUMN_WIDTH, y: 0 },
  ],
  edges: [
    ...pairs.map((p) => ({ from: p.key, to: 'gd' })),
    { from: 'gd', to: 'interview' },
    { from: 'interview', to: 'hr' },
  ],
})

// A round status (from /round-progress) that means the candidate has reached the round.
export const hasReached = (status) => status != null && status !== 'LOCKED' && status !== 'NOT_APPLICABLE'

// The fixed pipeline stages around the round graph. Only pair and round arrows are stored; Resume
// before the pairs and Offer → … → Exit after the rounds are drawn from this order.
export const PIPELINE_TAIL = ['Offer', 'Joining', '6 Month Review', '12 Month Retained', 'Exit']
export const stageKey = (name) => `stage:${name}`
export const isStageKey = (key) => key.startsWith('stage:')
export const stageOf = (key) => key.slice('stage:'.length)

const TAIL_SPACING = 200

// The whole pipeline for the clickable view: Resume → pairs → rounds → Offer → … → Exit.
export const pipelineLayout = (graph) => {
  const rounds = layoutRounds(graph.rounds, graph.edges)
  const pairs = layoutPairs(graph.pairs ?? [], rounds)
  const left = (pairs[0]?.x ?? 0) - COLUMN_WIDTH
  const middle = pairs.length ? pairs[pairs.length - 1].y / 2 : 0
  const resume = { key: stageKey('Resume'), name: 'Resume', x: left, y: middle }

  // Rounds no round arrow leaves: passing them is where the rounds end and Offer begins.
  const finals = rounds.filter((r) => !graph.edges.some((e) => e.from === r.key))
  const right = Math.max(0, ...rounds.map((r) => r.x)) + COLUMN_WIDTH
  const tailY = finals.length ? finals.reduce((sum, r) => sum + r.y, 0) / finals.length : middle
  const tail = PIPELINE_TAIL.map((name, i) => ({ key: stageKey(name), name, x: right + i * TAIL_SPACING, y: tailY }))

  const intoRounds = pairs.length ? pairs.map((p) => ({ from: resume.key, to: p.key })) : [{ from: resume.key, to: rounds[0]?.key ?? tail[0].key }]
  const outOfRounds = finals.map((r) => ({ from: r.key, to: tail[0].key }))
  return {
    stages: [resume, ...tail],
    pairs,
    rounds,
    edges: [
      ...intoRounds,
      ...graph.edges,
      ...(rounds.length ? outOfRounds : pairs.map((p) => ({ from: p.key, to: tail[0].key }))),
      ...tail.slice(1).map((stage, i) => ({ from: tail[i].key, to: stage.key })),
    ],
  }
}
