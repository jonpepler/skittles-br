import { describe, it, expect } from 'vitest'
import { mergeExpr, summarise, type Buckets } from './summary.js'
import type { Transfer } from './contracts.js'

const empty: Buckets = {
  onSign: [],
  onEvent: [],
  onReceive: [],
  onEliminate: [],
  onDefault: []
}

describe('mergeExpr', () => {
  it('adds two literals', () => {
    expect(mergeExpr(3, 5)).toBe(8)
  })

  it('adds two percentages of the same base', () => {
    expect(mergeExpr({ percent: 10, of: { all: 'red' } }, { percent: 10, of: { all: 'red' } })).toEqual({
      percent: 20,
      of: { all: 'red' }
    })
  })

  it('keeps unmergeable amounts as a sum', () => {
    expect(mergeExpr(3, { all: 'red' })).toEqual({ sum: [3, { all: 'red' }] })
  })
})

describe('summarise', () => {
  it('merges the user’s example: two 10% onSign clauses become one 20%', () => {
    const clause: Transfer = { from: 'me', to: 'you', give: { red: { percent: 10, of: { all: 'red' } } } }
    const result = summarise({ ...empty, onSign: [clause, clause] })
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      trigger: 'onSign',
      from: 'me',
      to: 'you',
      give: { red: { percent: 20, of: { all: 'red' } } }
    })
  })

  it('merges literal amounts per colour', () => {
    const a: Transfer = { from: 'me', to: 'you', give: { red: 3, green: 1 } }
    const b: Transfer = { from: 'me', to: 'you', give: { red: 5 } }
    const result = summarise({ ...empty, onSign: [a, b] })
    expect(result[0]!.give).toEqual({ red: 8, green: 1 })
  })

  it('keeps separate statements for different giver/recipient pairs', () => {
    const a: Transfer = { from: 'me', to: 'you', give: { red: 1 } }
    const b: Transfer = { from: 'you', to: 'me', give: { green: 1 } }
    const result = summarise({ ...empty, onSign: [a, b] })
    expect(result).toHaveLength(2)
  })

  it('groups by trigger, ordering sign → event → receive', () => {
    const t: Transfer = { from: 'me', to: 'you', give: { red: 1 } }
    const result = summarise({
      onSign: [t],
      onEvent: [t],
      onReceive: [t],
      onEliminate: [t],
      onDefault: [t]
    })
    expect(result.map((s) => s.trigger)).toEqual([
      'onSign',
      'onEvent',
      'onReceive',
      'onEliminate',
      'onDefault'
    ])
  })
})
