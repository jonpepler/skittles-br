import { describe, it, expect } from 'vitest'
import { addPlayer, applyAction, createGame, resolveEvent } from './state.js'
import { evalAmount } from './contracts.js'
import type { GameState } from './types.js'
import type { SkittleSet } from '../generators/event.js'

const ROOM = 'ROOM'

const set = (partial: Partial<SkittleSet>): SkittleSet => ({
  red: 0,
  orange: 0,
  yellow: 0,
  purple: 0,
  green: 0,
  ...partial
})

function activeWith(...ids: string[]): GameState {
  const lobby = ids.reduce((s, id) => addPlayer(s, id), createGame(ROOM, ids[0] ?? 'a'))
  return applyAction(lobby, ids[0]!, { type: 'start' })
}

function give(state: GameState, id: string, skittles: SkittleSet): GameState {
  return { ...state, players: { ...state.players, [id]: { ...state.players[id]!, skittles } } }
}

describe('evalAmount', () => {
  const ctx = {
    giver: { id: 'a', name: 'A', flagSeed: 'a', out: false, skittles: set({ red: 7, green: 2 }) },
    event: {
      name: 'E',
      description: '',
      kind: 'threat' as const,
      fail: 'eliminate' as const,
      requirement: set({ red: 3 }),
      reward: set({}),
      penalty: set({})
    }
  }
  it('evaluates literals, all-of-colour, event-requirement, min and sum', () => {
    expect(evalAmount(4, ctx)).toBe(4)
    expect(evalAmount({ all: 'red' }, ctx)).toBe(7)
    expect(evalAmount({ eventReq: 'red' }, ctx)).toBe(3)
    expect(evalAmount({ min: [{ all: 'red' }, 5] }, ctx)).toBe(5)
    expect(evalAmount({ sum: [2, { eventReq: 'red' }] }, ctx)).toBe(5)
  })

  it('evaluates received amounts and floored percentages', () => {
    const withReceived = { ...ctx, received: set({ red: 7 }) }
    expect(evalAmount({ received: 'red' }, withReceived)).toBe(7)
    expect(evalAmount({ percent: 50, of: { received: 'red' } }, withReceived)).toBe(3) // floor(3.5)
    expect(evalAmount({ percent: 10, of: { all: 'red' } }, ctx)).toBe(0) // floor(0.7)
    expect(evalAmount({ received: 'red' }, ctx)).toBe(0) // no receipt context
  })
})

describe('contracts — sign and fire', () => {
  it('a one-way gift fires once when the recipient signs', () => {
    let game = activeWith('a', 'b')
    game = give(game, 'a', set({ red: 3 }))
    game = applyAction(game, 'a', {
      type: 'proposeContract',
      parties: ['a', 'b'],
      onSign: [{ from: 'a', to: 'b', give: { red: 2 } }],
      onEvent: [],
      onReceive: [],
      onEliminate: [],
      expiresRound: null
    })
    expect(game.contracts).toHaveLength(1)
    const id = game.contracts[0]!.id
    const done = applyAction(game, 'b', { type: 'signContract', contractId: id })
    expect(done.players['a']!.skittles).toEqual(set({ red: 1 }))
    expect(done.players['b']!.skittles).toEqual(set({ red: 2 }))
    expect(done.contracts).toHaveLength(0) // no onEvent clause → completed
  })

  it('executes an atomic 3-way circular trade', () => {
    let game = activeWith('a', 'b', 'c')
    game = give(game, 'a', set({ red: 1 }))
    game = give(game, 'b', set({ green: 1 }))
    game = give(game, 'c', set({ yellow: 1 }))
    game = applyAction(game, 'a', {
      type: 'proposeContract',
      parties: ['a', 'b', 'c'],
      onSign: [
        { from: 'a', to: 'b', give: { red: 1 } },
        { from: 'b', to: 'c', give: { green: 1 } },
        { from: 'c', to: 'a', give: { yellow: 1 } }
      ],
      onEvent: [],
      onReceive: [],
      onEliminate: [],
      expiresRound: null
    })
    const id = game.contracts[0]!.id
    game = applyAction(game, 'b', { type: 'signContract', contractId: id })
    expect(game.contracts).toHaveLength(1) // not everyone signed yet
    game = applyAction(game, 'c', { type: 'signContract', contractId: id })
    expect(game.players['a']!.skittles).toEqual(set({ yellow: 1 }))
    expect(game.players['b']!.skittles).toEqual(set({ red: 1 }))
    expect(game.players['c']!.skittles).toEqual(set({ green: 1 }))
  })

  it('does not fire if a signer cannot afford their leg', () => {
    let game = activeWith('a', 'b')
    game = give(game, 'a', set({ red: 1 }))
    game = applyAction(game, 'a', {
      type: 'proposeContract',
      parties: ['a', 'b'],
      onSign: [{ from: 'a', to: 'b', give: { red: 5 } }],
      onEvent: [],
      onReceive: [],
      onEliminate: [],
      expiresRound: null
    })
    const id = game.contracts[0]!.id
    const after = applyAction(game, 'b', { type: 'signContract', contractId: id })
    expect(after.players['a']!.skittles).toEqual(set({ red: 1 })) // unchanged
  })
})

describe('contracts — recurring (the "cover my event reds" example)', () => {
  it('B gives A all reds now; A covers B’s required reds on every event', () => {
    let game = activeWith('a', 'b')
    game = give(game, 'a', set({ red: 10 }))
    game = give(game, 'b', set({ red: 4 }))

    // "Give me all your reds, and I'll give you enough reds for every event."
    game = applyAction(game, 'a', {
      type: 'proposeContract',
      parties: ['a', 'b'],
      onSign: [{ from: 'b', to: 'a', give: { red: { all: 'red' } } }],
      onEvent: [{ from: 'a', to: 'b', give: { red: { eventReq: 'red' } } }],
      onReceive: [],
      onEliminate: [],
      expiresRound: null
    })
    const id = game.contracts[0]!.id
    game = applyAction(game, 'b', { type: 'signContract', contractId: id })

    // onSign: B's 4 reds move to A.
    expect(game.players['a']!.skittles!.red).toBe(14)
    expect(game.players['b']!.skittles!.red).toBe(0)
    expect(game.contracts).toHaveLength(1) // recurring clause keeps it alive

    // First event: A transfers B exactly the reds the event requires.
    game = applyAction(game, 'a', { type: 'triggerEvent' }, 1000)
    const required = game.event!.requirement.red
    expect(game.players['b']!.skittles!.red).toBe(required)
    expect(game.players['a']!.skittles!.red).toBe(14 - required)
  })

  it('drops contracts past their expiry round', () => {
    let game = activeWith('a', 'b')
    game = give(game, 'a', set({ red: 5 }))
    game = applyAction(game, 'a', {
      type: 'proposeContract',
      parties: ['a', 'b'],
      onSign: [],
      onEvent: [{ from: 'a', to: 'b', give: { red: 1 } }],
      onReceive: [],
      onEliminate: [],
      expiresRound: 1
    })
    const id = game.contracts[0]!.id
    game = applyAction(game, 'b', { type: 'signContract', contractId: id })
    game = applyAction(game, 'a', { type: 'triggerEvent' }, 1000) // round 1: fires + still live
    expect(game.contracts).toHaveLength(1)
    game = applyAction(game, 'a', { type: 'triggerEvent' }, 2000) // round 2 > expiry: dropped
    expect(game.contracts).toHaveLength(0)
  })
})

describe('contracts — onReceive (percentage cut)', () => {
  it('pays a cut every time the party receives a colour in a trade', () => {
    let game = activeWith('a', 'b', 'c')
    game = give(game, 'c', set({ red: 4 }))

    // "Every time I (a) receive red in a trade, you (b) get 50% of it."
    game = applyAction(game, 'a', {
      type: 'proposeContract',
      parties: ['a', 'b'],
      onSign: [],
      onEvent: [],
      onReceive: [{ from: 'a', to: 'b', give: { red: { percent: 50, of: { received: 'red' } } } }],
      onEliminate: [],
      expiresRound: null
    })
    const id = game.contracts[0]!.id
    game = applyAction(game, 'b', { type: 'signContract', contractId: id })
    expect(game.contracts).toHaveLength(1) // onReceive keeps it alive

    // c gifts 4 red to a (a trade where a gives nothing back).
    game = applyAction(game, 'c', {
      type: 'proposeTrade',
      to: 'a',
      give: set({ red: 4 }),
      receive: set({})
    })
    const offerId = game.offers[0]!.id
    game = applyAction(game, 'a', { type: 'acceptTrade', offerId })

    // a received 4 red → pays b 50% (2). a keeps 2, b gets 2.
    expect(game.players['a']!.skittles!.red).toBe(2)
    expect(game.players['b']!.skittles!.red).toBe(2)
  })

  it('does not loop forever on mutually-triggering cuts', () => {
    let game = activeWith('a', 'b', 'c')
    game = give(game, 'c', set({ red: 100 }))
    // a → b and b → a both pay 50% of received red: a cascade that must terminate.
    game = applyAction(game, 'a', {
      type: 'proposeContract',
      parties: ['a', 'b'],
      onSign: [],
      onEvent: [],
      onReceive: [
        { from: 'a', to: 'b', give: { red: { percent: 50, of: { received: 'red' } } } },
        { from: 'b', to: 'a', give: { red: { percent: 50, of: { received: 'red' } } } }
      ],
      onEliminate: [],
      expiresRound: null
    })
    const id = game.contracts[0]!.id
    game = applyAction(game, 'b', { type: 'signContract', contractId: id })

    game = applyAction(game, 'c', {
      type: 'proposeTrade',
      to: 'a',
      give: set({ red: 100 }),
      receive: set({})
    })
    const offerId = game.offers[0]!.id
    // Should terminate (bounded cascade) rather than hang.
    game = applyAction(game, 'a', { type: 'acceptTrade', offerId })
    expect(game.players['a']!.skittles!.red).toBeGreaterThanOrEqual(0)
  })
})

describe('contracts — negotiation (revise / counter-offer)', () => {
  function proposed(): GameState {
    let game = activeWith('a', 'b')
    game = give(game, 'a', set({ red: 5 }))
    game = give(game, 'b', set({ green: 5 }))
    return applyAction(game, 'a', {
      type: 'proposeContract',
      parties: ['a', 'b'],
      onSign: [{ from: 'a', to: 'b', give: { red: 1 } }],
      onEvent: [],
      onReceive: [],
      onEliminate: [],
      expiresRound: null
    })
  }

  it('a counter-offer rewrites the clauses and resets agreement', () => {
    const game = proposed()
    const id = game.contracts[0]!.id
    // b counters: instead, b wants a swap (a gives 2 red, b gives 1 green).
    const countered = applyAction(game, 'b', {
      type: 'reviseContract',
      contractId: id,
      parties: ['a', 'b'],
      onSign: [
        { from: 'a', to: 'b', give: { red: 2 } },
        { from: 'b', to: 'a', give: { green: 1 } }
      ],
      onEvent: [],
      onReceive: [],
      onEliminate: [],
      expiresRound: null
    })
    const c = countered.contracts[0]!
    expect(c.signed).toEqual(['b']) // only the reviser; a must re-agree
    expect(c.onSign).toHaveLength(2)
  })

  it('fires the latest version once everyone re-signs', () => {
    let game = proposed()
    const id = game.contracts[0]!.id
    game = applyAction(game, 'b', {
      type: 'reviseContract',
      contractId: id,
      parties: ['a', 'b'],
      onSign: [
        { from: 'a', to: 'b', give: { red: 2 } },
        { from: 'b', to: 'a', give: { green: 1 } }
      ],
      onEvent: [],
      onReceive: [],
      onEliminate: [],
      expiresRound: null
    })
    // a agrees to b's counter.
    game = applyAction(game, 'a', { type: 'signContract', contractId: id })
    expect(game.players['a']!.skittles).toEqual(set({ red: 3, green: 1 }))
    expect(game.players['b']!.skittles).toEqual(set({ red: 2, green: 4 }))
  })

  it('can add a party in a counter-offer (all must re-sign)', () => {
    let game = activeWith('a', 'b', 'c')
    game = give(game, 'a', set({ red: 3 }))
    game = applyAction(game, 'a', {
      type: 'proposeContract',
      parties: ['a', 'b'],
      onSign: [{ from: 'a', to: 'b', give: { red: 1 } }],
      onEvent: [],
      onReceive: [],
      onEliminate: [],
      expiresRound: null
    })
    const id = game.contracts[0]!.id
    // b counters, pulling c in and routing a's red through to c.
    game = applyAction(game, 'b', {
      type: 'reviseContract',
      contractId: id,
      parties: ['a', 'b', 'c'],
      onSign: [{ from: 'a', to: 'c', give: { red: 1 } }],
      onEvent: [],
      onReceive: [],
      onEliminate: [],
      expiresRound: null
    })
    const c = game.contracts[0]!
    expect(c.parties).toEqual(['a', 'b', 'c'])
    expect(c.signed).toEqual(['b'])
    game = applyAction(game, 'a', { type: 'signContract', contractId: id })
    game = applyAction(game, 'c', { type: 'signContract', contractId: id })
    expect(game.players['c']!.skittles).toEqual(set({ red: 1 }))
    expect(game.players['a']!.skittles).toEqual(set({ red: 2 }))
  })

  it('rejects revision by a non-party', () => {
    const game = activeWith('a', 'b', 'c')
    const withContract = applyAction(give(game, 'a', set({ red: 2 })), 'a', {
      type: 'proposeContract',
      parties: ['a', 'b'],
      onSign: [{ from: 'a', to: 'b', give: { red: 1 } }],
      onEvent: [],
      onReceive: [],
      onEliminate: [],
      expiresRound: null
    })
    const id = withContract.contracts[0]!.id
    const after = applyAction(withContract, 'c', {
      type: 'reviseContract',
      contractId: id,
      parties: ['a', 'b'],
      onSign: [],
      onEvent: [],
      onReceive: [],
      onEliminate: [],
      expiresRound: null
    })
    expect(after).toBe(withContract)
  })
})

describe('contracts — authority', () => {
  it('only a party can sign or cancel', () => {
    let game = activeWith('a', 'b', 'c')
    game = give(game, 'a', set({ red: 2 }))
    game = applyAction(game, 'a', {
      type: 'proposeContract',
      parties: ['a', 'b'],
      onSign: [{ from: 'a', to: 'b', give: { red: 1 } }],
      onEvent: [],
      onReceive: [],
      onEliminate: [],
      expiresRound: null
    })
    const id = game.contracts[0]!.id
    expect(applyAction(game, 'c', { type: 'signContract', contractId: id }).contracts).toHaveLength(1)
    expect(applyAction(game, 'c', { type: 'cancelContract', contractId: id }).contracts).toHaveLength(1)
    expect(applyAction(game, 'b', { type: 'cancelContract', contractId: id }).contracts).toHaveLength(0)
  })
})

describe('contracts — onEliminate', () => {
  it('hands the eliminated player’s skittles to the beneficiary on resolution', () => {
    let game = activeWith('a', 'b', 'c') // three players so the game continues
    game = give(game, 'a', set({ red: 5 })) // can't afford the gate below
    game = give(game, 'b', set({ red: 9 }))
    game = give(game, 'c', set({ red: 9 }))

    // "If a is eliminated, a gives b all their red."
    game = applyAction(game, 'a', {
      type: 'proposeContract',
      parties: ['a', 'b'],
      onSign: [],
      onEvent: [],
      onReceive: [],
      onEliminate: [{ from: 'a', to: 'b', give: { red: { all: 'red' } } }],
      expiresRound: null
    })
    const id = game.contracts[0]!.id
    game = applyAction(game, 'b', { type: 'signContract', contractId: id })

    // An event that a can't pay but b and c can.
    game = {
      ...game,
      event: { name: 'E', description: '', kind: 'threat', fail: 'eliminate', requirement: set({ red: 7 }), reward: set({}), penalty: set({}) }
    }
    const resolved = resolveEvent(game)

    expect(resolved.players['a']!.out).toBe(true)
    expect(resolved.players['a']!.skittles).toEqual(set({ red: 0 }))
    // b spent 7 on the gate (9 → 2) then received a's 5 → 7.
    expect(resolved.players['b']!.skittles!.red).toBe(7)
  })
})

describe('contracts — unpaid recurring clause', () => {
  it('flags the contract instead of penalising when a payment is unaffordable', () => {
    let game = activeWith('a', 'b')
    // a promises to cover b's required red each event, but holds none.
    game = applyAction(game, 'a', {
      type: 'proposeContract',
      parties: ['a', 'b'],
      onSign: [],
      onEvent: [{ from: 'a', to: 'b', give: { red: { eventReq: 'red' } } }],
      onReceive: [],
      onEliminate: [],
      expiresRound: null
    })
    const id = game.contracts[0]!.id
    game = applyAction(game, 'b', { type: 'signContract', contractId: id })

    game = applyAction(game, 'a', { type: 'triggerEvent' }, 1000)
    const contract = game.contracts.find((c) => c.id === id)!
    expect(contract.unpaid).toBe(true) // a couldn't pay; flagged, not punished
    expect(game.players['a']!.out).toBe(false) // no automatic penalty

    // The owed party (b) decides to void it.
    const voided = applyAction(game, 'b', { type: 'cancelContract', contractId: id })
    expect(voided.contracts).toHaveLength(0)
  })
})
