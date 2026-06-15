import { describe, it, expect } from 'vitest'
import { addPlayer, applyAction, createGame } from './state.js'
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

describe('contracts — authority', () => {
  it('only a party can sign or cancel', () => {
    let game = activeWith('a', 'b', 'c')
    game = give(game, 'a', set({ red: 2 }))
    game = applyAction(game, 'a', {
      type: 'proposeContract',
      parties: ['a', 'b'],
      onSign: [{ from: 'a', to: 'b', give: { red: 1 } }],
      onEvent: [],
      expiresRound: null
    })
    const id = game.contracts[0]!.id
    expect(applyAction(game, 'c', { type: 'signContract', contractId: id }).contracts).toHaveLength(1)
    expect(applyAction(game, 'c', { type: 'cancelContract', contractId: id }).contracts).toHaveLength(1)
    expect(applyAction(game, 'b', { type: 'cancelContract', contractId: id }).contracts).toHaveLength(0)
  })
})
