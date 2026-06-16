import { describe, it, expect } from 'vitest'
import {
  clausesToBuckets,
  contractToClauses,
  materialize,
  newAmount,
  newClause,
  parseAmount,
  type ClauseDraft,
  type DraftAmount
} from './contractDraft.js'
import type { Contract } from '../game/contracts.js'

const amt = (p: Partial<DraftAmount> = {}): DraftAmount => ({ ...newAmount(), ...p })

describe('materialize', () => {
  it('fills the clause colour into each amount kind', () => {
    expect(materialize(amt({ kind: 'number', count: 2 }), 'green')).toBe(2)
    expect(materialize(amt({ kind: 'all' }), 'green')).toEqual({ all: 'green' })
    expect(materialize(amt({ kind: 'eventReq' }), 'red')).toEqual({ eventReq: 'red' })
    expect(materialize(amt({ kind: 'received' }), 'red')).toEqual({ received: 'red' })
    expect(materialize(amt({ kind: 'percent', percent: 25 }), 'red')).toEqual({
      percent: 25,
      of: { received: 'red' }
    })
  })

  it('wraps a cap as min and a top-up as sum', () => {
    expect(
      materialize(amt({ kind: 'percent', percent: 50, modifier: 'cap', modAmount: 3 }), 'red')
    ).toEqual({ min: [{ percent: 50, of: { received: 'red' } }, 3] })
    expect(
      materialize(amt({ kind: 'number', count: 2, modifier: 'plus', modAmount: 1 }), 'red')
    ).toEqual({ sum: [2, 1] })
  })
})

describe('clausesToBuckets', () => {
  it('routes clauses into the right bucket and applies the colour to each', () => {
    const clauses: ClauseDraft[] = [
      { key: 'a', trigger: 'now', from: 'me', to: 'you', colours: ['green', 'red'], amount: amt({ count: 2 }) },
      { key: 'b', trigger: 'event', from: 'me', to: 'you', colours: ['red'], amount: amt({ kind: 'eventReq' }) },
      {
        key: 'c',
        trigger: 'receive',
        from: 'me',
        to: 'you',
        colours: ['red'],
        amount: amt({ kind: 'percent', percent: 50 })
      }
    ]
    const b = clausesToBuckets(clauses)
    expect(b.onSign).toEqual([{ from: 'me', to: 'you', give: { green: 2, red: 2 } }])
    expect(b.onEvent).toEqual([{ from: 'me', to: 'you', give: { red: { eventReq: 'red' } } }])
    expect(b.onReceive).toEqual([
      { from: 'me', to: 'you', give: { red: { percent: 50, of: { received: 'red' } } } }
    ])
  })
})

describe('parseAmount', () => {
  it('reads engine expressions back into draft amounts', () => {
    expect(parseAmount(3)).toMatchObject({ kind: 'number', count: 3, modifier: 'none' })
    expect(parseAmount({ all: 'red' })).toMatchObject({ kind: 'all' })
    expect(parseAmount({ percent: 25, of: { received: 'red' } })).toMatchObject({
      kind: 'percent',
      percent: 25
    })
    expect(parseAmount({ min: [{ all: 'red' }, 5] })).toMatchObject({
      kind: 'all',
      modifier: 'cap',
      modAmount: 5
    })
    expect(parseAmount({ sum: [2, 1] })).toMatchObject({
      kind: 'number',
      count: 2,
      modifier: 'plus',
      modAmount: 1
    })
  })
})

describe('contractToClauses', () => {
  it('round-trips with clausesToBuckets and groups colours that share an amount', () => {
    const clauses: ClauseDraft[] = [
      { key: 'a', trigger: 'now', from: 'me', to: 'you', colours: ['red', 'green'], amount: amt({ count: 2 }) },
      {
        key: 'b',
        trigger: 'receive',
        from: 'me',
        to: 'you',
        colours: ['red'],
        amount: amt({ kind: 'percent', percent: 25 })
      }
    ]
    const buckets = clausesToBuckets(clauses)
    const contract: Contract = {
      id: 'x',
      parties: ['me', 'you'],
      signed: ['me'],
      onSign: buckets.onSign,
      onEvent: buckets.onEvent,
      onReceive: buckets.onReceive,
      onEliminate: buckets.onEliminate,
      onDefault: [],
      expiresRound: null,
      unpaid: false,
      signFired: false
    }
    const back = contractToClauses(contract)
    expect(back.map((c) => ({ trigger: c.trigger, colours: c.colours, amount: c.amount }))).toEqual([
      { trigger: 'now', colours: ['red', 'green'], amount: amt({ count: 2 }) },
      { trigger: 'receive', colours: ['red'], amount: amt({ kind: 'percent', percent: 25 }) }
    ])
  })
})

describe('newClause', () => {
  it('starts as a single red, "exactly 1" gift on signing', () => {
    const c = newClause('me', 'you')
    expect(c).toMatchObject({ trigger: 'now', from: 'me', to: 'you', colours: ['red'] })
    expect(c.amount).toEqual(newAmount())
  })
})
