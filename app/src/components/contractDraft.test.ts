import { describe, it, expect } from 'vitest'
import {
  amountToGive,
  clausesToBuckets,
  contractToClauses,
  newAmount,
  newClause,
  selectedColours,
  type ClauseDraft,
  type DraftAmount
} from './contractDraft.js'
import type { Contract } from '../game/contracts.js'

const amt = (p: Partial<DraftAmount> = {}): DraftAmount => ({ ...newAmount(), ...p })

describe('amountToGive', () => {
  it('spreads per-colour counts for an exact gift', () => {
    expect(amountToGive(amt({ kind: 'number', units: { red: 2, green: 3 } }))).toEqual({
      red: 2,
      green: 3
    })
  })

  it('fills each colour into a dynamic kind', () => {
    expect(amountToGive(amt({ kind: 'all', units: { red: 1, green: 1 } }))).toEqual({
      red: { all: 'red' },
      green: { all: 'green' }
    })
    expect(amountToGive(amt({ kind: 'percent', percent: 25, units: { red: 1 } }))).toEqual({
      red: { percent: 25, of: { received: 'red' } }
    })
  })

  it('wraps a per-colour cap as min and a top-up as sum', () => {
    expect(
      amountToGive(
        amt({ kind: 'percent', percent: 50, units: { red: 1 }, modifier: 'cap', modUnits: { red: 3 } })
      )
    ).toEqual({ red: { min: [{ percent: 50, of: { received: 'red' } }, 3] } })
    expect(
      amountToGive(amt({ kind: 'number', units: { red: 2, green: 2 }, modifier: 'plus', modUnits: { red: 1, green: 4 } }))
    ).toEqual({ red: { sum: [2, 1] }, green: { sum: [2, 4] } })
  })
})

describe('selectedColours', () => {
  it('returns chosen colours in palette order', () => {
    expect(selectedColours(amt({ units: { green: 1, red: 1 } }))).toEqual(['red', 'green'])
  })
})

describe('clausesToBuckets', () => {
  it('routes clauses into the right bucket', () => {
    const clauses: ClauseDraft[] = [
      { key: 'a', trigger: 'now', from: 'me', to: 'you', amount: amt({ units: { green: 2, red: 2 } }) },
      { key: 'b', trigger: 'event', from: 'me', to: 'you', amount: amt({ kind: 'eventReq', units: { red: 1 } }) }
    ]
    const b = clausesToBuckets(clauses)
    expect(b.onSign).toEqual([{ from: 'me', to: 'you', give: { red: 2, green: 2 } }])
    expect(b.onEvent).toEqual([{ from: 'me', to: 'you', give: { red: { eventReq: 'red' } } }])
  })
})

describe('contractToClauses', () => {
  it('round-trips and groups colours that share a kind/limit', () => {
    const clauses: ClauseDraft[] = [
      { key: 'a', trigger: 'now', from: 'me', to: 'you', amount: amt({ units: { red: 2, green: 3 } }) },
      {
        key: 'b',
        trigger: 'receive',
        from: 'me',
        to: 'you',
        amount: amt({ kind: 'percent', percent: 25, units: { red: 1 } })
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
    expect(back.map((c) => ({ trigger: c.trigger, amount: c.amount }))).toEqual([
      { trigger: 'now', amount: amt({ units: { red: 2, green: 3 }, modUnits: { red: 1, green: 1 } }) },
      { trigger: 'receive', amount: amt({ kind: 'percent', percent: 25, units: { red: 1 }, modUnits: { red: 1 } }) }
    ])
  })
})

describe('newClause', () => {
  it('starts as a single red, "exactly 1" gift on signing', () => {
    const c = newClause('me', 'you')
    expect(c).toMatchObject({ trigger: 'now', from: 'me', to: 'you' })
    expect(c.amount).toEqual(newAmount())
    expect(selectedColours(c.amount)).toEqual(['red'])
  })
})
