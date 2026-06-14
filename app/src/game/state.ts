/**
 * Pure, host-authoritative game-state logic.
 *
 * Everything here is a pure function of (state, input) → new state, with no
 * networking. The host runs these functions and broadcasts the result; clients
 * just render what they receive. Keeping it pure makes the rules fully
 * unit-testable and keeps the transport (Trystero) a thin adapter.
 */
import { generateName } from '../generators/name.js'
import { SKITTLE_COLOURS, type SkittleColour, type SkittleSet } from '../generators/event.js'
import type { GameAction, GameState, PlayerState } from './types.js'

/** Minimum players before the host can start (was MIN_PLAYER_COUNT in Rails). */
export const MIN_PLAYERS = 2

export function emptySkittles(): SkittleSet {
  return { red: 0, orange: 0, yellow: 0, purple: 0, green: 0 }
}

/** Deterministic seed for a player's flag and civ name. */
export function playerSeed(roomCode: string, id: string): string {
  return `${roomCode}:${id}`
}

export function createGame(roomCode: string, hostId: string): GameState {
  return { roomCode, hostId, phase: 'lobby', players: {} }
}

/** Add a player (idempotent). Name + flag seed are derived from the room code. */
export function addPlayer(state: GameState, id: string): GameState {
  if (state.players[id]) return state
  const seed = playerSeed(state.roomCode, id)
  const player: PlayerState = {
    id,
    name: generateName(seed),
    flagSeed: seed,
    skittles: emptySkittles()
  }
  return { ...state, players: { ...state.players, [id]: player } }
}

/** Remove a player (idempotent). */
export function removePlayer(state: GameState, id: string): GameState {
  if (!state.players[id]) return state
  const players = { ...state.players }
  delete players[id]
  return { ...state, players }
}

export function playerCount(state: GameState): number {
  return Object.keys(state.players).length
}

/**
 * Deterministic host election: the connected peer with the lowest id wins.
 * Every peer can compute this identically, so failover needs no coordination.
 */
export function electHost(connectedIds: string[]): string | undefined {
  if (connectedIds.length === 0) return undefined
  return [...connectedIds].sort()[0]
}

/**
 * Hand authority to `newHostId` after the previous host left. The new host
 * adopts the last-known state, drops the departed host, and stamps itself as
 * host so the change propagates on its next broadcast.
 */
export function migrateHost(
  state: GameState,
  newHostId: string,
  departedHostId: string
): GameState {
  return { ...removePlayer(state, departedHostId), hostId: newHostId }
}

/** Whether the host is allowed to start the game right now. */
export function canStart(state: GameState): boolean {
  return state.phase === 'lobby' && playerCount(state) >= MIN_PLAYERS
}

/**
 * Apply a client-requested action on behalf of `senderId`, with validation.
 * Invalid requests return the state unchanged — this is the authority point.
 */
export function applyAction(
  state: GameState,
  senderId: string,
  action: GameAction
): GameState {
  switch (action.type) {
    case 'incrementSkittle': {
      if (state.phase !== 'active') return state
      const player = state.players[senderId]
      if (!player) return state
      if (!SKITTLE_COLOURS.includes(action.colour)) return state
      const colour: SkittleColour = action.colour
      const updated: PlayerState = {
        ...player,
        skittles: { ...player.skittles, [colour]: player.skittles[colour] + 1 }
      }
      return { ...state, players: { ...state.players, [senderId]: updated } }
    }
    case 'start': {
      if (senderId !== state.hostId) return state
      if (!canStart(state)) return state
      return { ...state, phase: 'active' }
    }
    case 'reset': {
      if (senderId !== state.hostId) return state
      const players: Record<string, PlayerState> = {}
      for (const [id, p] of Object.entries(state.players)) {
        players[id] = { ...p, skittles: emptySkittles() }
      }
      return { ...state, phase: 'lobby', players }
    }
    default:
      return state
  }
}
