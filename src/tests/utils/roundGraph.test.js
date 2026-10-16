import { describe, it, expect } from 'vitest'
import { createsCycle, defaultTemplate, hasReached, isPairKey, isStageKey, layoutPairs, layoutRounds, pairLabel, pipelineLayout, stageOf, toGraphPayload } from '../../utils/roundGraph'

const edges = [{ from: 'coding', to: 'tech' }, { from: 'tech', to: 'hr' }, { from: 'aptitude', to: 'hr' }]

describe('createsCycle', () => {
  it('flags an arrow back to an earlier round, and a round to itself', () => {
    expect(createsCycle(edges, 'hr', 'coding')).toBe(true)
    expect(createsCycle(edges, 'tech', 'tech')).toBe(true)
  })

  it('allows forward arrows, including a second path into a merge', () => {
    expect(createsCycle(edges, 'coding', 'hr')).toBe(false)
    expect(createsCycle(edges, 'aptitude', 'tech')).toBe(false)
  })
})

describe('layoutRounds', () => {
  it('places unplaced rounds one column per step, stacking parallel ones', () => {
    const rounds = ['coding', 'tech', 'aptitude', 'hr'].map((key) => ({ key }))
    const placed = Object.fromEntries(layoutRounds(rounds, edges).map((r) => [r.key, [r.x, r.y]]))

    expect(placed.coding).toEqual([0, 0])
    expect(placed.aptitude).toEqual([0, 120])
    expect(placed.tech).toEqual([260, 0])
    expect(placed.hr).toEqual([520, 0])
  })

  it('keeps rounds that already have a position', () => {
    expect(layoutRounds([{ key: 'a', x: 40, y: 70 }], [])).toEqual([{ key: 'a', x: 40, y: 70 }])
  })
})

const pairs = [
  { key: 'pair:4:2', positionId: 4, typeId: 2, positionTitle: 'Developer', typeName: 'FTE' },
  { key: 'pair:5:2', positionId: 5, typeId: 2, positionTitle: 'QA', typeName: 'FTE' },
]

describe('pairs', () => {
  it('are told apart by key and labelled position · type', () => {
    expect(isPairKey('pair:4:2')).toBe(true)
    expect(isPairKey('12')).toBe(false)
    expect(pairLabel(pairs[0])).toBe('Developer · FTE')
  })

  it('sit in a column left of the leftmost round', () => {
    expect(layoutPairs(pairs, [{ x: -100 }, { x: 300 }]).map((p) => [p.x, p.y])).toEqual([[-360, 0], [-360, 70]])
  })
})

describe('toGraphPayload', () => {
  it('sends the rounds, not the pair nodes, and every arrow including the ones from pairs', () => {
    const nodes = [
      { id: 'pair:4:2', type: 'pair', position: { x: -260, y: 0 }, data: { label: 'Developer · FTE' } },
      { id: '7', position: { x: 10.4, y: 0 }, data: { id: 7, name: 'Coding', roundType: 'CODING' } },
      { id: 'new-1', position: { x: 300, y: 0 }, data: { name: 'HR' } },
    ]

    expect(toGraphPayload(nodes, [{ source: 'pair:4:2', target: '7' }, { source: '7', target: 'new-1' }])).toEqual({
      rounds: [
        { id: 7, key: '7', name: 'Coding', roundType: 'CODING', x: 10, y: 0 },
        { id: null, key: 'new-1', name: 'HR', roundType: null, x: 300, y: 0 },
      ],
      edges: [{ from: 'pair:4:2', to: '7' }, { from: '7', to: 'new-1' }],
    })
  })
})

describe('defaultTemplate', () => {
  it('is a three-round chain that every pair starts', () => {
    const { rounds, edges: arrows } = defaultTemplate(pairs)
    expect(rounds.map((r) => r.name)).toEqual(['Group Discussion', 'Interview', 'HR Round'])
    expect(arrows).toEqual([
      { from: 'pair:4:2', to: 'gd' }, { from: 'pair:5:2', to: 'gd' },
      { from: 'gd', to: 'interview' }, { from: 'interview', to: 'hr' },
    ])
  })
})

describe('hasReached', () => {
  it('is true once the round is open or marked', () => {
    expect(['OPEN', 'PASS', 'FAIL', 'ON_HOLD'].every(hasReached)).toBe(true)
    expect([undefined, 'LOCKED', 'NOT_APPLICABLE'].some(hasReached)).toBe(false)
  })
})

describe('pipelineLayout', () => {
  const graph = {
    pairs,
    rounds: [{ key: '1', name: 'Coding', x: 0, y: 0 }, { key: '2', name: 'HR', x: 260, y: 0 }],
    edges: [{ from: 'pair:4:2', to: '1' }, { from: 'pair:5:2', to: '2' }, { from: '1', to: '2' }],
  }

  it('wraps the rounds in Resume before and Offer after, and stops there', () => {
    const { stages } = pipelineLayout(graph)
    expect(stages.map((s) => s.key)).toEqual(['stage:Resume', 'stage:Offer'])
    expect(stageOf('stage:Offer')).toBe('Offer')
    expect(isStageKey('stage:Offer')).toBe(true)
    expect(isStageKey('pair:4:2')).toBe(false)
  })

  it('draws Resume into each pair and the final rounds into Offer, with nothing after it', () => {
    const { edges } = pipelineLayout(graph)
    expect(edges).toEqual(expect.arrayContaining([
      { from: 'stage:Resume', to: 'pair:4:2' }, { from: 'stage:Resume', to: 'pair:5:2' },
      { from: '2', to: 'stage:Offer' },
    ]))
    expect(edges.some((e) => e.from === 'stage:Offer')).toBe(false)
    expect(edges).not.toContainEqual({ from: '1', to: 'stage:Offer' })
  })

  it('places Resume left of the pairs and the tail right of the rounds', () => {
    const { stages, pairs: placed } = pipelineLayout(graph)
    expect(stages[0].x).toBeLessThan(placed[0].x)
    expect(stages[1].x).toBeGreaterThan(260)
  })

  it('with no rounds yet, the pairs lead straight to Offer', () => {
    const { edges } = pipelineLayout({ pairs, rounds: [], edges: [] })
    expect(edges).toContainEqual({ from: 'pair:4:2', to: 'stage:Offer' })
  })
})
