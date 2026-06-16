import type { GameEvent, SkittleSet } from '../generators/event.js'
import type { Contract, Transfer } from './contracts.js'

/** Which side of the connection a client is playing. */
export type Role = 'host' | 'guest'

export type Phase = 'lobby' | 'active' | 'complete'

/**
 * Per-player state. `flagSeed` and `name` are derived deterministically from
 * the room code + peer id, so every peer renders the same flag/name for a
 * given player without transmitting them.
 *
 * `skittles` is `null` in a *redacted view* — i.e. for a player you aren't
 * allowed to see (not yourself or a neighbour). The authoritative state held by
 * the host always has non-null skittles.
 */
export type PlayerState = {
  id: string
  name: string
  flagSeed: string
  skittles: SkittleSet | null
  /** Eliminated (couldn't pay an event's requirement). Stays visible as "out". */
  out: boolean
}

/**
 * One chronicled happening. `eliminated` is public knowledge (the player shows
 * "out" to everyone); `event` (paying a cost for a reward) and `transfer`
 * (skittles moving between players) are redacted to neighbour-visibility like
 * skittle holdings are.
 */
export type LogBody =
  | { kind: 'eliminated'; player: string }
  | { kind: 'event'; player: string; paid: SkittleSet; gained: SkittleSet }
  | { kind: 'transfer'; from: string; to: string; skittles: SkittleSet }

export type LogEntry = LogBody & { id: number; round: number }

/** A proposed swap: `from` gives `give` to `to`, and receives `receive` back. */
export type TradeOffer = {
  id: string
  from: string
  to: string
  give: SkittleSet
  receive: SkittleSet
}

export type GameState = {
  roomCode: string
  hostId: string
  phase: Phase
  players: Record<string, PlayerState>
  /** Seating ring (join order); defines neighbours for visibility. */
  order: string[]
  /** Increments each time the host triggers an event (also seeds the event). */
  round: number
  /** The event currently in play, if any. */
  event: GameEvent | null
  /** Epoch ms when the current event resolves ("happens"), or null. */
  eventEndsAt: number | null
  /** Configurable reveal→resolve window, in seconds. */
  eventDuration: number
  /** Number of events the game runs for. Survivors after the last one win. */
  maxRounds: number
  /** When true, players only see their own + neighbours' skittles. */
  hideNonNeighbours: boolean
  /** Open trade offers awaiting acceptance (quick two-party swaps). */
  offers: TradeOffer[]
  /** Monotonic counter for assigning offer ids. */
  nextOfferId: number
  /** Declarative contracts (the general trade system). */
  contracts: Contract[]
  /** Monotonic counter for assigning contract ids. */
  nextContractId: number
  /** Chronicle of core happenings, oldest first (capped, redacted per viewer). */
  log: LogEntry[]
  /** Monotonic counter for assigning log-entry ids. */
  nextLogId: number
}

/**
 * Actions a client may request of the host. The host is authoritative: it
 * validates every action before applying it.
 */
export type GameAction =
  | { type: 'start'; hands?: SkittleSet }
  | { type: 'setEventDuration'; seconds: number }
  | { type: 'setRounds'; rounds: number }
  | { type: 'setVisibility'; hideNonNeighbours: boolean }
  | { type: 'triggerEvent'; event?: GameEvent; allotment?: SkittleSet }
  | { type: 'resolveEvent' }
  | { type: 'proposeTrade'; to: string; give: SkittleSet; receive: SkittleSet }
  | { type: 'acceptTrade'; offerId: string }
  | { type: 'cancelTrade'; offerId: string }
  | {
      type: 'proposeContract'
      parties: string[]
      onSign: Transfer[]
      onEvent: Transfer[]
      onReceive: Transfer[]
      onEliminate: Transfer[]
      onDefault: Transfer[]
      expiresRound: number | null
    }
  | { type: 'signContract'; contractId: string }
  | {
      type: 'reviseContract'
      contractId: string
      parties: string[]
      onSign: Transfer[]
      onEvent: Transfer[]
      onReceive: Transfer[]
      onEliminate: Transfer[]
      onDefault: Transfer[]
      expiresRound: number | null
    }
  | { type: 'cancelContract'; contractId: string }
  | { type: 'reset' }
