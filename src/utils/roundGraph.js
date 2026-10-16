// An event's rounds are a directed graph. Each (position, type) pair the event hires for is a start
// node (key `pair:<positionId>:<typeId>`): an edge from it into a round starts that pair's
// candidates there. An edge between rounds means passing `from` can unlock `to`. Rounds are keyed
// by their id as text once saved, or a temporary key for a round added but not saved yet.

// What a round's scores are out of when nobody set it.
export const DEFAULT_MAX_SCORE = 100

export const ROUND_TYPES = ['WRITTEN', 'TECHNICAL', 'HR', 'GROUP_DISCUSSION', 'CODING']
export const ROUND_TYPE_COLOR = { WRITTEN: 'purple', TECHNICAL: 'blue', HR: 'green', GROUP_DISCUSSION: 'orange', CODING: 'cyan' }

const COLUMN_WIDTH = 260
const ROW_HEIGHT = 120
const PAIR_ROW_HEIGHT = 70

export const isPairKey = (key) => key.startsWith('pair:')

export const pairLabel = (pair) => `${pair.positionTitle} · ${pair.typeName}`

// One colour per pair, in the event's pair order: its node's outline, its arrows, and the arrows
// into rounds only it takes.
// Mid-tone and evenly muted so they sit together, far enough apart in hue to tell apart.
export const PAIR_COLORS = ['#2a9d8f', '#e76f51', '#4c7bb5', '#c9971c', '#8e6bbf', '#5f9e4a', '#c45b84', '#8d6e63']
export const pairColors = (pairs) => Object.fromEntries(pairs.map((p, i) => [p.key, PAIR_COLORS[i % PAIR_COLORS.length]]))

// Moves boxes ({ id, x, y, w, h }) down until none overlaps another, top ones first, keeping a
// gap; returns each one's y by id. For the read-only view, where nodes can't be dragged apart.
export const spreadOut = (boxes, gap = 16) => {
  const placed = []
  ;[...boxes].sort((a, b) => a.y - b.y || a.x - b.x).forEach((b) => {
    let y = b.y
    for (let hit = true; hit;) {
      const over = placed.find((p) => b.x < p.x + p.w && p.x < b.x + b.w && y < p.y + p.h + gap && p.y < y + b.h + gap)
      hit = Boolean(over)
      if (over) y = over.y + over.h + gap
    }
    placed.push({ ...b, y })
  })
  return Object.fromEntries(placed.map((p) => [p.id, p.y]))
}

// Whose candidates can be at each round, by round key: `inherited` is every pair arriving along
// its arrows (a pair's own arrow, or whoever can be at the round it comes from), `effective` that
// narrowed by its own onlyFor (`explicit`). Pair keys keep `pairOrder`. Rounds are { key, onlyFor }.
export const roundPairs = (rounds, edges, pairOrder = []) => {
  const rank = (k) => { const i = pairOrder.indexOf(k); return i < 0 ? pairOrder.length : i }
  const sorted = (keys) => [...keys].sort((a, b) => rank(a) - rank(b))
  const byKey = Object.fromEntries(rounds.map((r) => [r.key, r]))
  const at = {}
  const visit = (key, path = new Set()) => {
    if (at[key]) return at[key]
    if (path.has(key)) return { inherited: [], effective: [], explicit: false }
    path.add(key)
    const inherited = new Set()
    edges.filter((e) => e.to === key).forEach((e) => {
      if (isPairKey(e.from)) inherited.add(e.from)
      else if (byKey[e.from]) visit(e.from, path).effective.forEach((k) => inherited.add(k))
    })
    const only = byKey[key].onlyFor ?? []
    const effective = only.length ? [...inherited].filter((k) => only.includes(k)) : [...inherited]
    at[key] = { inherited: sorted(inherited), effective: sorted(effective), explicit: only.length > 0 }
    return at[key]
  }
  rounds.forEach((r) => visit(r.key))
  return at
}

// How to draw an arrow, from the pairs whose candidates travel along it (`at` from roundPairs): in
// the pair's colour when it's one, dashed when it's several into a round limited to them, else plain.
export const arrowStyle = (from, to, at, colors) => {
  if (!at[to]) return undefined
  const out = isPairKey(from) ? [from] : at[from]?.effective
  if (!out) return undefined
  const flow = at[to].effective.filter((k) => out.includes(k))
  if (flow.length === 1) return { color: colors[flow[0]] ?? '#595959', dashed: false }
  if (flow.length > 1 && at[to].explicit) return { color: '#595959', dashed: true }
  return undefined
}

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
    onlyFor: n.data.onlyFor ?? [],
    maxScore: n.data.maxScore ?? DEFAULT_MAX_SCORE,
  })),
  edges: edges.map((e) => ({ from: e.source, to: e.target })),
})

// Group Discussion -> Interview -> HR.
export const DEFAULT_TEMPLATE = {
  rounds: [
    { key: 'gd', name: 'Group Discussion', roundType: 'GROUP_DISCUSSION', x: 0, y: 0 },
    { key: 'interview', name: 'Interview', roundType: 'TECHNICAL', x: COLUMN_WIDTH, y: 0 },
    { key: 'hr', name: 'HR Round', roundType: 'HR', x: 2 * COLUMN_WIDTH, y: 0 },
  ],
  edges: [
    { from: 'gd', to: 'interview' },
    { from: 'interview', to: 'hr' },
  ],
}

// A template's rounds and the arrows between them as a new graph for an event with these pairs.
// Arrows from pairs never come along: where each position starts is drawn per event. A round's
// onlyFor keeps the pairs this event hires for. Rounds carry no id, so saving creates them.
export const fitTemplate = (template, pairs) => {
  const keys = new Set(template.rounds.map((r) => r.key))
  const hired = new Set(pairs.map((p) => p.key))
  return {
    pairs,
    rounds: template.rounds.map(({ key, name, roundType, x, y, onlyFor, maxScore }) => ({
      key, name, roundType: roundType ?? null, x, y, onlyFor: (onlyFor ?? []).filter((k) => hired.has(k)), maxScore,
    })),
    edges: template.edges.filter((e) => keys.has(e.from) && keys.has(e.to)),
  }
}

// Every round with a path of arrows into this one, in graph order: where a candidate's earlier scores come from.
export const roundsBefore = (graph, key) => {
  const before = new Set()
  const visit = (to) => graph.edges
    .filter((e) => e.to === to && !isPairKey(e.from) && !before.has(e.from))
    .forEach((e) => { before.add(e.from); visit(e.from) })
  visit(key)
  return graph.rounds.filter((r) => before.has(r.key))
}

// A round status (from /round-progress) that means the candidate has reached the round.
export const hasReached = (status) => status != null && status !== 'LOCKED' && status !== 'NOT_APPLICABLE'

// The fixed pipeline stages around the round graph. Only pair and round arrows are stored; Resume
// before the pairs and Offer after the rounds are drawn from this order. The event page stops at
// Offer: what happens after it is tracked across events on the Offers page.
export const PIPELINE_TAIL = ['Offer']
export const stageKey = (name) => `stage:${name}`
export const isStageKey = (key) => key.startsWith('stage:')
export const stageOf = (key) => key.slice('stage:'.length)

const TAIL_SPACING = 200

// The whole pipeline for the clickable view: Resume → pairs → rounds → Offer.
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
