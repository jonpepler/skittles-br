import { describe, it, expect } from 'vitest'
import {
  clausesToBuckets,
  contractToClauses,
  describeAmount,
  describeClause,
  newClause,
  type ClauseDraft
} from './contractDraft.js'
import type { Contract } from '../game/contracts.js'

describe('clausesToBuckets', () => {
  it('routes clauses into onSign/onEvent/onReceive transfers', () => {
    const clauses: ClauseDraft[] = [
      { key: 'a', trigger: 'now', receiveColour: 'red', from: 'me', to: 'you', colour: 'green', amount: 2 },
      { key: 'b', trigger: 'event', receiveColour: 'red', from: 'me', to: 'you', colour: 'red', amount: { eventReq: 'red' } },
      { key: 'c', trigger: 'receive', receiveColour: 'red', from: 'me', to: 'you', colour: 'red', amount: { percent: 50, of: { received: 'red' } } }
    ]
    const b = clausesToBuckets(clauses)
    expect(b.onSign).toEqual([{ from: 'me', to: 'you', give: { green: 2 } }])
    expect(b.onEvent).toEqual([{ from: 'me', to: 'you', give: { red: { eventReq: 'red' } } }])
    expect(b.onReceive).toEqual([
      { from: 'me', to: 'you', give: { red: { percent: 50, of: { received: 'red' } } } }
    ])
  })
})

describe('contractToClauses', () => {
  it('round-trips with clausesToBuckets', () => {
    const clauses: ClauseDraft[] = [
      { key: 'a', trigger: 'now', receiveColour: 'red', from: 'me', to: 'you', colour: 'green', amount: 2 },
      { key: 'b', trigger: 'receive', receiveColour: 'red', from: 'me', to: 'you', colour: 'red', amount: { percent: 25, of: { received: 'red' } } }
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
      expiresRound: null,
      unpaid: false,
      signFired: false
    }
    const back = contractToClauses(contract)
    expect(back.map((c) => ({ trigger: c.trigger, from: c.from, to: c.to, colour: c.colour, amount: c.amount }))).toEqual([
      { trigger: 'now', from: 'me', to: 'you', colour: 'green', amount: 2 },
      { trigger: 'receive', from: 'me', to: 'you', colour: 'red', amount: { percent: 25, of: { received: 'red' } } }
    ])
  })
})

describe('describeAmount', () => {
  it('renders nested expressions in English', () => {
    expect(describeAmount(3, 'red')).toBe('3 red')
    expect(describeAmount({ all: 'green' }, 'red')).toBe('all their green')
    expect(
      describeAmount({ min: [{ percent: 50, of: { received: 'red' } }, 3] }, 'red')
    ).toBe('the smallest of (50% of (the red they received), 3 red)')
  })
})

describe('describeClause', () => {
  it('reads like a sentence', () => {
    const c = newClause('me', 'you')
    expect(describeClause({ ...c, amount: 2, colour: 'green' }, (id) => id)).toBe(
      'When signed, me gives you 2 green.'
    )
  })
})
