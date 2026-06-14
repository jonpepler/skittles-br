import { describe, it, expect } from 'vitest'
import {
  MIN_PLAYERS,
  addPlayer,
  applyAction,
  canStart,
  createGame,
  electHost,
  emptySkittles,
  migrateHost,
  playerCount,
  playerSeed,
  removePlayer
} from './state.js'

const ROOM = 'ABCDE'

function lobbyWith(...ids: string[]) {
  return ids.reduce((s, id) => addPlayer(s, id), createGame(ROOM, ids[0] ?? 'host'))
}

describe('game state', () => {
  it('creates an empty lobby owned by the host', () => {
    const s = createGame(ROOM, 'host')
    expect(s).toEqual({ roomCode: ROOM, hostId: 'host', phase: 'lobby', players: {} })
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
    const before = s.players['p2']!.skittles.red
    const after = addPlayer(s, 'p2')
    expect(after.players['p2']!.skittles.red).toBe(before)
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
    expect(next.players['p2']!.skittles.green).toBe(1)
    expect(next.players['host']!.skittles.green).toBe(0)
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

  it('reset returns to lobby and zeroes all skittles (host only)', () => {
    let s = applyAction(lobbyWith('host', 'p2'), 'host', { type: 'start' })
    s = applyAction(s, 'p2', { type: 'incrementSkittle', colour: 'yellow' })
    expect(applyAction(s, 'p2', { type: 'reset' })).toBe(s) // guest can't reset
    const reset = applyAction(s, 'host', { type: 'reset' })
    expect(reset.phase).toBe('lobby')
    expect(reset.players['p2']!.skittles.yellow).toBe(0)
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
    expect(migrated.players['mmm']!.skittles.purple).toBe(1)
  })
})
