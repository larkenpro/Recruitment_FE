import { describe, it, expect } from 'vitest'
import { DEFAULT_TEMPLATE, PAIR_COLORS, arrowStyle, roundPairs, spreadOut, createsCycle, fitTemplate, pairColors, hasReached, isPairKey, isStageKey, layoutPairs, layoutRounds, pairLabel, pipelineLayout, roundsBefore, stageOf, toGraphPayload } from '../../utils/roundGraph'

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
      { id: '7', position: { x: 10.4, y: 0 }, data: { id: 7, name: 'Coding', roundType: 'ASSESSMENT' } },
      { id: 'new-1', position: { x: 300, y: 0 }, data: { name: 'HR' } },
    ]

    expect(toGraphPayload(nodes, [{ source: 'pair:4:2', target: '7' }, { source: '7', target: 'new-1' }])).toEqual({
      rounds: [
        { id: 7, key: '7', name: 'Coding', roundType: 'ASSESSMENT', x: 10, y: 0, onlyFor: [], maxScore: 10 },
        { id: null, key: 'new-1', name: 'HR', roundType: null, x: 300, y: 0, onlyFor: [], maxScore: 10 },
      ],
      edges: [{ from: 'pair:4:2', to: '7' }, { from: '7', to: 'new-1' }],
    })
  })
})

describe('fitTemplate', () => {
  it('lays out the default template\'s chain with no arrows from pairs', () => {
    const { pairs: kept, rounds, edges: arrows } = fitTemplate(DEFAULT_TEMPLATE, pairs)
    expect(kept).toBe(pairs)
    expect(rounds.map((r) => r.name)).toEqual(['Group Discussion', 'Interview', 'HR Round'])
    expect(arrows).toEqual([{ from: 'gd', to: 'interview' }, { from: 'interview', to: 'hr' }])
  })

  it('drops arrows from pairs and round ids', () => {
    const template = {
      rounds: [{ id: 9, key: '9', name: 'Coding' }, { key: '10', name: 'Technical' }],
      edges: [{ from: 'pair:4:2', to: '9' }, { from: '9', to: '10' }],
    }
    const fitted = fitTemplate(template, pairs)
    expect(fitted.rounds.every((r) => r.id === undefined)).toBe(true)
    expect(fitted.edges).toEqual([{ from: '9', to: '10' }])
  })

  it('keeps only the pairs the event hires for in a round\'s onlyFor', () => {
    const template = { rounds: [{ key: '1', name: 'GD2', onlyFor: ['pair:4:2', 'pair:9:9'] }, { key: '2', name: 'HR' }], edges: [] }
    expect(fitTemplate(template, pairs).rounds.map((r) => r.onlyFor)).toEqual([['pair:4:2'], []])
  })
})

describe('pair colours and arrows', () => {
  const colors = pairColors(pairs)

  it('gives each pair the next colour in order', () => {
    expect(colors).toEqual({ 'pair:4:2': PAIR_COLORS[0], 'pair:5:2': PAIR_COLORS[1] })
  })

  // Dev → A, QA → B, both into GD, GD → D (only Dev) → E, and GD → F.
  const rounds = [{ key: 'A' }, { key: 'B' }, { key: 'GD' }, { key: 'D', onlyFor: ['pair:4:2'] }, { key: 'E' }, { key: 'F' }]
  const arrows = [
    { from: 'pair:4:2', to: 'A' }, { from: 'pair:5:2', to: 'B' }, { from: 'A', to: 'GD' }, { from: 'B', to: 'GD' },
    { from: 'GD', to: 'D' }, { from: 'D', to: 'E' }, { from: 'GD', to: 'F' },
  ]
  const at = roundPairs(rounds, arrows, ['pair:4:2', 'pair:5:2'])

  it('passes each round the pairs arriving along its arrows, narrowed by its Only for', () => {
    expect(at.A).toEqual({ inherited: ['pair:4:2'], effective: ['pair:4:2'], explicit: false })
    expect(at.GD.effective).toEqual(['pair:4:2', 'pair:5:2'])
    expect(at.D).toEqual({ inherited: ['pair:4:2', 'pair:5:2'], effective: ['pair:4:2'], explicit: true })
    expect(at.E).toEqual({ inherited: ['pair:4:2'], effective: ['pair:4:2'], explicit: false })
    expect(at.F.effective).toEqual(['pair:4:2', 'pair:5:2'])
  })

  it('colours an arrow carrying one pair, dashes several into a limited round, leaves the rest plain', () => {
    expect(arrowStyle('pair:5:2', 'B', at, colors)).toEqual({ color: PAIR_COLORS[1], dashed: false })
    expect(arrowStyle('A', 'GD', at, colors)).toEqual({ color: PAIR_COLORS[0], dashed: false })
    expect(arrowStyle('GD', 'D', at, colors)).toEqual({ color: PAIR_COLORS[0], dashed: false })
    expect(arrowStyle('D', 'E', at, colors)).toEqual({ color: PAIR_COLORS[0], dashed: false })
    expect(arrowStyle('GD', 'F', at, colors)).toBeUndefined()
    expect(arrowStyle('stage:Resume', 'pair:4:2', at, colors)).toBeUndefined()
    const both = roundPairs([{ key: 'X' }, { key: 'Y', onlyFor: ['pair:4:2', 'pair:5:2'] }],
      [{ from: 'pair:4:2', to: 'X' }, { from: 'pair:5:2', to: 'X' }, { from: 'X', to: 'Y' }])
    expect(arrowStyle('X', 'Y', both, colors)).toMatchObject({ dashed: true })
  })
})

describe('spreadOut', () => {
  it('moves overlapping boxes down below the ones above, and leaves the rest', () => {
    const ys = spreadOut([
      { id: 'coding', x: 0, y: 0, w: 200, h: 120 },
      { id: 'aptitude', x: 20, y: 100, w: 200, h: 120 },
      { id: 'hr', x: 20, y: 150, w: 200, h: 50 },
      { id: 'beside', x: 400, y: 10, w: 100, h: 100 },
    ])
    expect(ys).toEqual({ coding: 0, aptitude: 136, hr: 272, beside: 10 })
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

describe('roundsBefore', () => {
  // Coding and Aptitude both lead into GD, which leads into HR; a pair starts at Coding.
  const graph = {
    rounds: [{ key: '9', name: 'Coding' }, { key: '6', name: 'Aptitude' }, { key: '7', name: 'GD' }, { key: '8', name: 'HR' }],
    edges: [{ from: 'pair:1:1', to: '9' }, { from: '9', to: '7' }, { from: '6', to: '7' }, { from: '7', to: '8' }],
  }

  it('collects every round upstream, in graph order, skipping pairs', () => {
    expect(roundsBefore(graph, '8').map((r) => r.name)).toEqual(['Coding', 'Aptitude', 'GD'])
    expect(roundsBefore(graph, '7').map((r) => r.name)).toEqual(['Coding', 'Aptitude'])
  })

  it('a starting round has none', () => {
    expect(roundsBefore(graph, '9')).toEqual([])
  })
})
