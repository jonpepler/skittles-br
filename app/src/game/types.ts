import type { SkittleColour, SkittleSet } from '../generators/event.js'

/** Which side of the connection a client is playing. */
export type Role = 'host' | 'guest'

export type Phase = 'lobby' | 'active' | 'complete'

/**
 * Per-player state. `flagSeed` and `name` are derived deterministically from
 * the room code + peer id, so every peer renders the same flag/name for a
 * given player without transmitting them.
 *
 * Declared as a `type` (not `interface`) so it satisfies Trystero's JSON
 * payload constraint when sent over the wire.
 */
export type PlayerState = {
  id: string
  name: string
  flagSeed: string
  skittles: SkittleSet
}

export type GameState = {
  roomCode: string
  hostId: string
  phase: Phase
  players: Record<string, PlayerState>
}

/**
 * Actions a client may request of the host. The host is authoritative: it
 * validates every action before applying it. This is the fix for the original
 * Rails app's `NOTE`, where clients set their own skittle values directly.
 */
export type GameAction =
  | { type: 'incrementSkittle'; colour: SkittleColour }
  | { type: 'start' }
  | { type: 'reset' }
