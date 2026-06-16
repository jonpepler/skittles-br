import { describe, it, expect } from 'vitest'
import {
  MIN_PLAYERS,
  addPlayer,
  alivePlayers,
  applyAction,
  canStart,
  createGame,
  electHost,
  emptySkittles,
  migrateHost,
  neighboursOf,
  playerCount,
  playerSeed,
  redactStateFor,
  removePlayer,
  resolveEvent
} from './state.js'
import type { GameState } from './types.js'
import type { SkittleSet } from '../generators/event.js'

const set = (partial: Partial<SkittleSet>): SkittleSet => ({
  red: 0,
  orange: 0,
  yellow: 0,
  purple: 0,
  green: 0,
  ...partial
})

function activeWith(...ids: string[]): GameState {
  const lobby = ids.reduce((s, id) => addPlayer(s, id), createGame(ROOM, ids[0] ?? 'host'))
  return applyAction(lobby, ids[0]!, { type: 'start' })
}

function giveSkittles(state: GameState, id: string, skittles: SkittleSet): GameState {
  return { ...state, players: { ...state.players, [id]: { ...state.players[id]!, skittles } } }
}

const ROOM = 'ABCDE'

function lobbyWith(...ids: string[]) {
  return ids.reduce((s, id) => addPlayer(s, id), createGame(ROOM, ids[0] ?? 'host'))
}

describe('game state', () => {
  it('creates an empty lobby owned by the host', () => {
    const s = createGame(ROOM, 'host')
    expect(s).toMatchObject({
      roomCode: ROOM,
      hostId: 'host',
      phase: 'lobby',
      players: {},
      order: [],
      round: 0,
      event: null,
      eventEndsAt: null,
      offers: []
    })
  })

  it('adds a player with a derived name and flag seed', () => {
    const s = addPlayer(createGame(ROOM, 'host'), 'host')
    const p = s.players['host']!
    expect(p.flagSeed).toBe(playerSeed(ROOM, 'host'))
    expect(p.name.length).toBeGreaterThan(0)
    expect(p.skittles).toEqual(emptySkittles())
  })

  it('addPlayer is idempotent (no duplicate / no reset)', () => {
    let s = lobbyWith('host', 'p2')
    s = applyAction(s, 'host', { type: 'start' })
    s = applyAction(s, 'p2', { type: 'incrementSkittle', colour: 'red' })
    const before = s.players['p2']!.skittles!.red
    const after = addPlayer(s, 'p2')
    expect(after.players['p2']!.skittles!.red).toBe(before)
  })

  it('removePlayer removes only the named player and is idempotent', () => {
    const s = lobbyWith('host', 'p2')
    const removed = removePlayer(s, 'p2')
    expect(playerCount(removed)).toBe(1)
    expect(removePlayer(removed, 'p2')).toEqual(removed)
  })

  it('does not mutate the input state (pure)', () => {
    const s = createGame(ROOM, 'host')
    const frozen = JSON.stringify(s)
    addPlayer(s, 'host')
    expect(JSON.stringify(s)).toBe(frozen)
  })
})

describe('canStart', () => {
  it('requires the minimum number of players in the lobby', () => {
    expect(canStart(lobbyWith('host'))).toBe(false)
    expect(canStart(lobbyWith('host', 'p2'))).toBe(true)
    expect(MIN_PLAYERS).toBe(2)
  })

  it('is false once the game is active', () => {
    const active = applyAction(lobbyWith('host', 'p2'), 'host', { type: 'start' })
    expect(canStart(active)).toBe(false)
  })
})

describe('applyAction — authority and validation', () => {
  it('only the host may start, and only when allowed', () => {
    const lobby = lobbyWith('host', 'p2')
    expect(applyAction(lobby, 'p2', { type: 'start' }).phase).toBe('lobby')
    expect(applyAction(lobbyWith('host'), 'host', { type: 'start' }).phase).toBe('lobby')
    expect(applyAction(lobby, 'host', { type: 'start' }).phase).toBe('active')
  })

  it('increments a skittle by exactly one for the sender only', () => {
    const active = applyAction(lobbyWith('host', 'p2'), 'host', { type: 'start' })
    const next = applyAction(active, 'p2', { type: 'incrementSkittle', colour: 'green' })
    expect(next.players['p2']!.skittles!.green).toBe(1)
    expect(next.players['host']!.skittles!.green).toBe(0)
  })

  it('ignores skittle increments before the game is active', () => {
    const lobby = lobbyWith('host', 'p2')
    const next = applyAction(lobby, 'p2', { type: 'incrementSkittle', colour: 'red' })
    expect(next).toBe(lobby)
  })

  it('ignores increments from a non-player (the spoofing case)', () => {
    const active = applyAction(lobbyWith('host', 'p2'), 'host', { type: 'start' })
    const next = applyAction(active, 'intruder', { type: 'incrementSkittle', colour: 'red' })
    expect(next).toBe(active)
  })

  it('reset returns to lobby, zeroes skittles and clears the event (host only)', () => {
    let s = applyAction(lobbyWith('host', 'p2'), 'host', { type: 'start' })
    s = applyAction(s, 'p2', { type: 'incrementSkittle', colour: 'yellow' })
    s = applyAction(s, 'host', { type: 'triggerEvent' })
    expect(applyAction(s, 'p2', { type: 'reset' })).toBe(s) // guest can't reset
    const reset = applyAction(s, 'host', { type: 'reset' })
    expect(reset.phase).toBe('lobby')
    expect(reset.players['p2']!.skittles!.yellow).toBe(0)
    expect(reset.event).toBeNull()
  })
})

describe('events', () => {
  it('only the host may trigger an event, and only while active', () => {
    const active = applyAction(lobbyWith('host', 'p2'), 'host', { type: 'start' })
    expect(applyAction(active, 'p2', { type: 'triggerEvent' }).event).toBeNull()
    expect(applyAction(lobbyWith('host', 'p2'), 'host', { type: 'triggerEvent' }).event).toBeNull()
    const withEvent = applyAction(active, 'host', { type: 'triggerEvent' })
    expect(withEvent.event).not.toBeNull()
    expect(withEvent.round).toBe(1)
  })

  it('produces a deterministic event for a given room and round', () => {
    const active = applyAction(lobbyWith('host', 'p2'), 'host', { type: 'start' })
    const a = applyAction(active, 'host', { type: 'triggerEvent' }).event
    const b = applyAction(active, 'host', { type: 'triggerEvent' }).event
    expect(a).toEqual(b)
  })

  it('advances to a different event on the next round', () => {
    const active = applyAction(lobbyWith('host', 'p2'), 'host', { type: 'start' })
    const first = applyAction(active, 'host', { type: 'triggerEvent' })
    const second = applyAction(first, 'host', { type: 'triggerEvent' })
    expect(second.round).toBe(2)
    expect(second.event).not.toEqual(first.event)
  })
})

describe('host election and migration', () => {
  it('elects the lowest peer id', () => {
    expect(electHost(['m', 'a', 'z'])).toBe('a')
    expect(electHost(['solo'])).toBe('solo')
    expect(electHost([])).toBeUndefined()
  })

  it('migrates authority to the new host and drops the departed one', () => {
    const game = lobbyWith('aaa', 'mmm', 'zzz') // hostId defaults to 'aaa'
    const next = migrateHost(game, 'mmm', 'aaa')
    expect(next.hostId).toBe('mmm')
    expect(next.players['aaa']).toBeUndefined()
    expect(next.players['mmm']).toBeDefined()
    expect(next.players['zzz']).toBeDefined()
  })

  it('preserves in-progress state (phase and skittles) across migration', () => {
    let s = applyAction(lobbyWith('aaa', 'mmm'), 'aaa', { type: 'start' })
    s = applyAction(s, 'mmm', { type: 'incrementSkittle', colour: 'purple' })
    const migrated = migrateHost(s, 'mmm', 'aaa')
    expect(migrated.phase).toBe('active')
    expect(migrated.players['mmm']!.skittles!.purple).toBe(1)
  })
})

describe('neighbours and redaction', () => {
  it('computes left/right neighbours in the seating ring', () => {
    const order = ['a', 'b', 'c', 'd']
    expect(neighboursOf(order, 'a').sort()).toEqual(['b', 'd']) // wraps around
    expect(neighboursOf(order, 'c').sort()).toEqual(['b', 'd'])
    expect(neighboursOf([], 'a')).toEqual([])
    expect(neighboursOf(['a'], 'a')).toEqual([]) // alone: no neighbours
    expect(neighboursOf(['a', 'b'], 'a')).toEqual(['b']) // pair: the other once
  })

  it('hides non-neighbours’ skittles but keeps own and neighbours’', () => {
    const game = activeWith('a', 'b', 'c', 'd') // ring a-b-c-d
    const view = redactStateFor(game, 'a')
    expect(view.players['a']!.skittles).not.toBeNull() // self
    expect(view.players['b']!.skittles).not.toBeNull() // neighbour
    expect(view.players['d']!.skittles).not.toBeNull() // neighbour (wrap)
    expect(view.players['c']!.skittles).toBeNull() // across the ring: hidden
  })

  it('only shows trade offers the viewer is party to', () => {
    let game = activeWith('a', 'b', 'c')
    game = giveSkittles(game, 'a', set({ red: 1 }))
    game = giveSkittles(game, 'b', set({ green: 1 }))
    game = applyAction(game, 'a', { type: 'proposeTrade', to: 'b', give: set({ red: 1 }), receive: set({ green: 1 }) })
    game = applyAction(game, 'b', { type: 'proposeTrade', to: 'c', give: set({ green: 1 }), receive: set({ red: 1 }) })
    expect(redactStateFor(game, 'a').offers).toHaveLength(1)
    expect(redactStateFor(game, 'c').offers).toHaveLength(1)
    expect(redactStateFor(game, 'b').offers).toHaveLength(2)
  })

  it('shows everyone when neighbour-hiding is turned off', () => {
    const game = { ...activeWith('a', 'b', 'c', 'd'), hideNonNeighbours: false }
    const view = redactStateFor(game, 'a')
    expect(view.players['c']!.skittles).not.toBeNull() // across the ring, but visible
  })
})

describe('event resolution', () => {
  const eventWith = (state: GameState, requirement: SkittleSet, reward: SkittleSet): GameState => ({
    ...state,
    event: {
      name: 'E',
      description: '',
      kind: 'threat',
      fail: 'eliminate',
      requirement,
      reward,
      penalty: emptySkittles()
    }
  })

  it('spends the requirement for the reward when affordable', () => {
    let game = activeWith('a', 'b', 'c')
    game = giveSkittles(game, 'a', set({ red: 5, green: 2 }))
    game = giveSkittles(game, 'b', set({ red: 5 }))
    game = eventWith(game, set({ red: 2 }), set({ green: 3 }))
    const resolved = resolveEvent(game)
    expect(resolved.players['a']!.skittles).toEqual(set({ red: 3, green: 5 }))
    expect(resolved.players['a']!.out).toBe(false)
    expect(resolved.event).toBeNull()
  })

  it('eliminates players who cannot pay the requirement, leaving their skittles', () => {
    let game = activeWith('a', 'b', 'c')
    game = giveSkittles(game, 'a', set({ red: 5 }))
    game = giveSkittles(game, 'b', set({ red: 5 }))
    game = giveSkittles(game, 'c', set({ red: 1 }))
    game = eventWith(game, set({ red: 3 }), set({ green: 1 }))
    const resolved = resolveEvent(game)
    expect(resolved.players['c']!.out).toBe(true)
    expect(resolved.players['c']!.skittles).toEqual(set({ red: 1 }))
    expect(resolved.players['a']!.out).toBe(false)
  })

  it('does not end early when one player remains and rounds are left', () => {
    let game = activeWith('a', 'b') // maxRounds 5, round 0
    game = giveSkittles(game, 'a', set({ red: 3 }))
    game = eventWith(game, set({ red: 2 }), emptySkittles())
    const resolved = resolveEvent(game) // a survives, b eliminated, rounds remain
    expect(resolved.phase).toBe('active')
    expect(resolved.players['b']!.out).toBe(true)
  })

  it('ends after the final round, and everyone still alive wins', () => {
    let game = activeWith('a', 'b')
    game = giveSkittles(game, 'a', set({ red: 3 }))
    game = giveSkittles(game, 'b', set({ red: 3 }))
    game = { ...game, round: 5, maxRounds: 5 } // this is the last event
    game = eventWith(game, set({ red: 1 }), emptySkittles())
    const resolved = resolveEvent(game)
    expect(resolved.phase).toBe('complete')
    expect(alivePlayers(resolved).map((p) => p.id).sort()).toEqual(['a', 'b'])
  })

  it('ends immediately if everyone is eliminated', () => {
    let game = activeWith('a', 'b') // both hold nothing
    game = eventWith(game, set({ red: 1 }), emptySkittles())
    const resolved = resolveEvent(game)
    expect(resolved.phase).toBe('complete')
    expect(alivePlayers(resolved)).toHaveLength(0)
  })

  it('a missed opportunity does not eliminate anyone', () => {
    let game = activeWith('a', 'b') // both broke, can't invest
    game = {
      ...game,
      event: {
        name: 'Tech',
        description: '',
        kind: 'opportunity',
        fail: 'none',
        requirement: set({ red: 2 }),
        reward: set({ green: 3 }),
        penalty: emptySkittles()
      }
    }
    const resolved = resolveEvent(game)
    expect(resolved.phase).toBe('active')
    expect(resolved.players['a']!.out).toBe(false)
    expect(resolved.players['a']!.skittles).toEqual(set({})) // no change
  })

  it('a penalty event costs skittles rather than eliminating', () => {
    let game = activeWith('a', 'b')
    game = giveSkittles(game, 'a', set({ green: 5 })) // can't afford the red gate
    game = {
      ...game,
      event: {
        name: 'Raid',
        description: '',
        kind: 'threat',
        fail: 'penalty',
        requirement: set({ red: 2 }),
        reward: emptySkittles(),
        penalty: set({ green: 3 })
      }
    }
    const resolved = resolveEvent(game)
    expect(resolved.players['a']!.out).toBe(false)
    expect(resolved.players['a']!.skittles).toEqual(set({ green: 2 })) // lost 3 green
  })
})

describe('elimination', () => {
  it('stops an eliminated player from collecting or trading', () => {
    let game = activeWith('a', 'b')
    game = { ...game, players: { ...game.players, a: { ...game.players['a']!, out: true } } }
    expect(applyAction(game, 'a', { type: 'incrementSkittle', colour: 'red' })).toBe(game)
    expect(
      applyAction(game, 'a', { type: 'proposeTrade', to: 'b', give: set({}), receive: set({}) }).offers
    ).toHaveLength(0)
  })
})

describe('trading', () => {
  it('executes a trade when both parties accept and can afford it', () => {
    let game = activeWith('a', 'b')
    game = giveSkittles(game, 'a', set({ red: 3 }))
    game = giveSkittles(game, 'b', set({ green: 2 }))
    game = applyAction(game, 'a', { type: 'proposeTrade', to: 'b', give: set({ red: 2 }), receive: set({ green: 1 }) })
    expect(game.offers).toHaveLength(1)
    const done = applyAction(game, 'b', { type: 'acceptTrade', offerId: game.offers[0]!.id })
    expect(done.players['a']!.skittles).toEqual(set({ red: 1, green: 1 }))
    expect(done.players['b']!.skittles).toEqual(set({ red: 2, green: 1 }))
    expect(done.offers).toHaveLength(0)
  })

  it('rejects proposing a trade the proposer cannot afford', () => {
    let game = activeWith('a', 'b')
    game = giveSkittles(game, 'a', set({ red: 1 }))
    const next = applyAction(game, 'a', { type: 'proposeTrade', to: 'b', give: set({ red: 5 }), receive: set({ green: 1 }) })
    expect(next.offers).toHaveLength(0)
  })

  it('only the recipient can accept; only a party can cancel', () => {
    let game = activeWith('a', 'b', 'c')
    game = giveSkittles(game, 'a', set({ red: 2 }))
    game = applyAction(game, 'a', { type: 'proposeTrade', to: 'b', give: set({ red: 1 }), receive: set({ green: 1 }) })
    const id = game.offers[0]!.id
    expect(applyAction(game, 'c', { type: 'acceptTrade', offerId: id }).offers).toHaveLength(1) // not recipient
    expect(applyAction(game, 'c', { type: 'cancelTrade', offerId: id }).offers).toHaveLength(1) // not a party
    expect(applyAction(game, 'a', { type: 'cancelTrade', offerId: id }).offers).toHaveLength(0) // proposer cancels
  })

  it('drops a leaving player’s offers', () => {
    let game = activeWith('a', 'b')
    game = giveSkittles(game, 'a', set({ red: 2 }))
    game = applyAction(game, 'a', { type: 'proposeTrade', to: 'b', give: set({ red: 1 }), receive: set({ green: 1 }) })
    expect(removePlayer(game, 'a').offers).toHaveLength(0)
  })
})

describe('event duration', () => {
  it('lets the host set a clamped duration', () => {
    const game = activeWith('a', 'b')
    expect(applyAction(game, 'a', { type: 'setEventDuration', seconds: 45 }).eventDuration).toBe(45)
    expect(applyAction(game, 'a', { type: 'setEventDuration', seconds: 1 }).eventDuration).toBe(game.eventDuration) // too low
    expect(applyAction(game, 'b', { type: 'setEventDuration', seconds: 45 }).eventDuration).toBe(game.eventDuration) // not host
  })

  it('stamps an end time on the event using injected now', () => {
    const game = activeWith('a', 'b')
    const withDuration = applyAction(game, 'a', { type: 'setEventDuration', seconds: 20 })
    const triggered = applyAction(withDuration, 'a', { type: 'triggerEvent' }, 1_000_000)
    expect(triggered.eventEndsAt).toBe(1_000_000 + 20_000)
  })
})

describe('event log', () => {
  const threat = (state: GameState, requirement: SkittleSet, reward: SkittleSet): GameState => ({
    ...state,
    event: { name: 'E', description: '', kind: 'threat', fail: 'eliminate', requirement, reward, penalty: emptySkittles() }
  })

  it('chronicles event pay/gain and eliminations', () => {
    let game = activeWith('a', 'b')
    game = giveSkittles(game, 'a', set({ red: 5 })) // b holds nothing → eliminated
    game = threat(game, set({ red: 2 }), set({ green: 1 }))
    const resolved = resolveEvent(game)
    expect(resolved.log.find((e) => e.kind === 'event' && e.player === 'a')).toMatchObject({
      paid: set({ red: 2 }),
      gained: set({ green: 1 })
    })
    expect(resolved.log.some((e) => e.kind === 'eliminated' && e.player === 'b')).toBe(true)
  })

  it('logs both sides of an accepted trade', () => {
    let game = activeWith('a', 'b')
    game = giveSkittles(game, 'a', set({ red: 2 }))
    game = giveSkittles(game, 'b', set({ green: 2 }))
    game = applyAction(game, 'a', { type: 'proposeTrade', to: 'b', give: set({ red: 1 }), receive: set({ green: 1 }) })
    const done = applyAction(game, 'b', { type: 'acceptTrade', offerId: game.offers[0]!.id })
    const transfers = done.log.filter((e) => e.kind === 'transfer')
    expect(transfers).toHaveLength(2)
    expect(transfers).toContainEqual(expect.objectContaining({ from: 'a', to: 'b', skittles: set({ red: 1 }) }))
    expect(transfers).toContainEqual(expect.objectContaining({ from: 'b', to: 'a', skittles: set({ green: 1 }) }))
  })

  it('redacts transfers/events to neighbours, but eliminations are public', () => {
    let game = activeWith('a', 'b', 'c', 'd', 'e') // ring; a sees only a, b, e
    game = giveSkittles(game, 'c', set({ red: 2 }))
    game = giveSkittles(game, 'd', set({ green: 2 }))
    game = applyAction(game, 'c', { type: 'proposeTrade', to: 'd', give: set({ red: 1 }), receive: set({ green: 1 }) })
    game = applyAction(game, 'd', { type: 'acceptTrade', offerId: game.offers[0]!.id })

    expect(redactStateFor(game, 'a').log.some((e) => e.kind === 'transfer')).toBe(false)
    expect(redactStateFor(game, 'c').log.some((e) => e.kind === 'transfer')).toBe(true)

    const resolved = resolveEvent(threat(game, set({ red: 99 }), emptySkittles()))
    expect(redactStateFor(resolved, 'a').log.some((e) => e.kind === 'eliminated' && e.player === 'd')).toBe(true)
  })
})
