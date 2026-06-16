/**
 * Pure, host-authoritative game-state logic.
 *
 * Everything here is a pure function of (state, input) → new state, with no
 * networking. The host runs these functions and broadcasts the result; clients
 * just render what they receive. Keeping it pure makes the rules fully
 * unit-testable and keeps the transport (Trystero) a thin adapter.
 */
import { generateName } from '../generators/name.js'
import { generateEvent } from '../generators/event.js'
import { SKITTLE_COLOURS, type SkittleSet } from '../generators/event.js'
import {
  addSkittles,
  canAfford,
  emptySkittles,
  isValidSet,
  subSkittles
} from './skittles.js'
import {
  allSigned,
  diffGains,
  expireContracts,
  fireOnDefault,
  fireOnEliminate,
  fireOnEvent,
  fireOnSign,
  fireReceives,
  type Contract,
  type Move
} from './contracts.js'
import type { GameAction, GameState, LogBody, PlayerState, TradeOffer } from './types.js'

// Re-export the skittle math so existing importers keep working.
export { addSkittles, canAfford, emptySkittles, subSkittles } from './skittles.js'

/** Minimum players before the host can start (was MIN_PLAYER_COUNT in Rails). */
export const MIN_PLAYERS = 2

/** Default reveal→resolve window for events, in seconds. */
export const DEFAULT_EVENT_DURATION = 30

/** Default number of events a game runs for ("Normal"). */
export const DEFAULT_ROUNDS = 40

/** Keep the chronicle bounded so synced state can't grow without limit. */
export const LOG_CAP = 500

/** Stamp ids + the current round onto log bodies and append (capped). */
function appendLog(state: GameState, bodies: LogBody[]): GameState {
  if (bodies.length === 0) return state
  let id = state.nextLogId
  const entries = bodies.map((b) => ({ ...b, id: id++, round: state.round }))
  const log = [...state.log, ...entries]
  return {
    ...state,
    log: log.length > LOG_CAP ? log.slice(log.length - LOG_CAP) : log,
    nextLogId: id
  }
}

/** Turn concrete contract/trade movements into transfer log bodies. */
function movesToLog(moves: Move[]): LogBody[] {
  return moves.map((m) => ({ kind: 'transfer', from: m.from, to: m.to, skittles: m.skittles }))
}

/** Deterministic seed for a player's flag and civ name. */
export function playerSeed(roomCode: string, id: string): string {
  return `${roomCode}:${id}`
}

export function createGame(roomCode: string, hostId: string): GameState {
  return {
    roomCode,
    hostId,
    phase: 'lobby',
    players: {},
    order: [],
    round: 0,
    event: null,
    eventEndsAt: null,
    eventDuration: DEFAULT_EVENT_DURATION,
    maxRounds: DEFAULT_ROUNDS,
    hideNonNeighbours: true,
    offers: [],
    nextOfferId: 0,
    contracts: [],
    nextContractId: 0,
    log: [],
    nextLogId: 0
  }
}

/** Add a player (idempotent). Name + flag seed are derived from the room code. */
export function addPlayer(state: GameState, id: string): GameState {
  if (state.players[id]) return state
  const seed = playerSeed(state.roomCode, id)
  const player: PlayerState = {
    id,
    name: generateName(seed),
    flagSeed: seed,
    skittles: emptySkittles(),
    out: false
  }
  return {
    ...state,
    players: { ...state.players, [id]: player },
    order: [...state.order, id]
  }
}

/** Remove a player (idempotent), along with any trade offers involving them. */
export function removePlayer(state: GameState, id: string): GameState {
  if (!state.players[id]) return state
  const players = { ...state.players }
  delete players[id]
  return {
    ...state,
    players,
    order: state.order.filter((p) => p !== id),
    offers: state.offers.filter((o) => o.from !== id && o.to !== id),
    contracts: state.contracts.filter((c) => !c.parties.includes(id))
  }
}

export function playerCount(state: GameState): number {
  return Object.keys(state.players).length
}

/**
 * The immediate left and right players in the seating ring. With two players
 * the single other player is the (sole) neighbour; with one, there are none.
 */
export function neighboursOf(order: string[], id: string): string[] {
  const i = order.indexOf(id)
  const n = order.length
  if (i === -1 || n <= 1) return []
  const left = order[(i - 1 + n) % n]!
  const right = order[(i + 1) % n]!
  return left === right ? [left] : [left, right]
}

/** The set of players `viewerId` is allowed to see (self + neighbours). */
export function visibleTo(state: GameState, viewerId: string): Set<string> {
  return new Set([viewerId, ...neighboursOf(state.order, viewerId)])
}

/**
 * Produce the view of the state that `viewerId` is allowed to see: other
 * players' skittles are nulled out, and trade offers are limited to those the
 * viewer is party to. This is what the host sends to each peer (true redaction,
 * not just UI hiding).
 */
export function redactStateFor(state: GameState, viewerId: string): GameState {
  // Trades and contracts are only relevant to the parties involved.
  const offers = state.offers.filter((o) => o.from === viewerId || o.to === viewerId)
  const contracts = state.contracts.filter((c) => c.parties.includes(viewerId))
  if (!state.hideNonNeighbours) return { ...state, offers, contracts }

  const visible = visibleTo(state, viewerId)
  const players: Record<string, PlayerState> = {}
  for (const [id, p] of Object.entries(state.players)) {
    players[id] = visible.has(id) ? p : { ...p, skittles: null }
  }
  // Eliminations are public; pay/gain and transfers leak holdings, so they're
  // shown only when the viewer can see a player they involve.
  const log = state.log.filter((e) => {
    if (e.kind === 'eliminated') return true
    if (e.kind === 'event') return visible.has(e.player)
    return visible.has(e.from) || visible.has(e.to)
  })
  return { ...state, players, offers, contracts, log }
}

/** Players still in the game (not eliminated). */
export function alivePlayers(state: GameState): PlayerState[] {
  return Object.values(state.players).filter((p) => !p.out)
}

/** The largest single skittle hoard held by any player (a wealth proxy). */
export function richestWealth(state: GameState): number {
  let richest = 0
  for (const p of Object.values(state.players)) {
    if (!p.skittles) continue
    const total = SKITTLE_COLOURS.reduce((acc, c) => acc + p.skittles![c], 0)
    if (total > richest) richest = total
  }
  return richest
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

function withSkittles(
  state: GameState,
  id: string,
  skittles: SkittleSet
): GameState {
  const player = state.players[id]
  if (!player) return state
  return { ...state, players: { ...state.players, [id]: { ...player, skittles } } }
}

/**
 * Resolve the current event: each surviving player who can afford the
 * requirement spends it for the reward; anyone who can't pay the gate is
 * eliminated (out of the game). Clears the event, and completes the game once
 * one (or no) player remains.
 */
export function resolveEvent(state: GameState): GameState {
  if (!state.event) return state
  const { requirement, reward, penalty, fail } = state.event

  // Players who can pay the requirement spend it for the reward; the rest are
  // defaulters, handled per the event's failure mode below.
  const players: Record<string, PlayerState> = {}
  const defaulters: string[] = []
  const bodies: LogBody[] = []
  for (const [id, p] of Object.entries(state.players)) {
    if (p.out || !isValidSet(p.skittles)) {
      players[id] = p
      continue
    }
    if (canAfford(p.skittles, requirement)) {
      players[id] = { ...p, skittles: addSkittles(subSkittles(p.skittles, requirement), reward) }
      bodies.push({ kind: 'event', player: id, paid: requirement, gained: reward })
    } else {
      players[id] = p // unchanged for now; consequences applied below
      defaulters.push(id)
    }
  }

  let resolved: GameState = { ...state, players, event: null, eventEndsAt: null }
  for (const id of defaulters) {
    if (fail === 'none') continue // opportunity missed: no default, no harm
    // "If I can't pay" collateral fires first, then the threat's consequence.
    const moves: Move[] = []
    resolved = fireOnDefault(resolved, id, moves)
    if (fail === 'eliminate') {
      resolved = fireOnEliminate(resolved, id, moves)
      const p = resolved.players[id]
      if (p) resolved = { ...resolved, players: { ...resolved.players, [id]: { ...p, out: true } } }
      bodies.push(...movesToLog(moves), { kind: 'eliminated', player: id })
    } else {
      const p = resolved.players[id]
      if (p?.skittles) {
        resolved = {
          ...resolved,
          players: { ...resolved.players, [id]: { ...p, skittles: subSkittles(p.skittles, penalty) } }
        }
      }
      bodies.push(...movesToLog(moves))
    }
  }
  resolved = appendLog(resolved, bodies)

  // The game runs to a fixed number of events. Everyone still alive at the end
  // wins (it isn't last-one-standing). It also ends early if no one is left.
  const survivors = alivePlayers(resolved).length
  const ended = survivors === 0 || resolved.round >= resolved.maxRounds
  return ended ? { ...resolved, phase: 'complete' } : resolved
}

/**
 * Apply a client-requested action on behalf of `senderId`, with validation.
 * Invalid requests return the state unchanged — this is the authority point.
 * `now` is injected (defaulting to the wall clock) to keep the reducer pure.
 */
export function applyAction(
  state: GameState,
  senderId: string,
  action: GameAction,
  now: number = Date.now()
): GameState {
  switch (action.type) {
    case 'incrementSkittle': {
      if (state.phase !== 'active') return state
      const player = state.players[senderId]
      if (player?.out || !isValidSet(player?.skittles)) return state
      if (!SKITTLE_COLOURS.includes(action.colour)) return state
      const colour = action.colour
      return withSkittles(state, senderId, {
        ...player!.skittles!,
        [colour]: player!.skittles![colour] + 1
      })
    }
    case 'start': {
      if (senderId !== state.hostId) return state
      if (!canStart(state)) return state
      return { ...state, phase: 'active' }
    }
    case 'setEventDuration': {
      if (senderId !== state.hostId) return state
      const seconds = Math.round(action.seconds)
      if (!Number.isFinite(seconds) || seconds < 5 || seconds > 300) return state
      return { ...state, eventDuration: seconds }
    }
    case 'setRounds': {
      if (senderId !== state.hostId) return state
      const rounds = Math.round(action.rounds)
      if (!Number.isFinite(rounds) || rounds < 1) return state
      return { ...state, maxRounds: rounds }
    }
    case 'setVisibility': {
      if (senderId !== state.hostId) return state
      return { ...state, hideNonNeighbours: action.hideNonNeighbours }
    }
    case 'triggerEvent': {
      if (senderId !== state.hostId) return state
      if (state.phase !== 'active') return state
      const round = state.round + 1
      // Escalation (and the tech era) rises with the richest player's wealth, so
      // events grow as the game progresses. Deterministic per (room, round).
      // `action.event` lets the host supply a specific event (used by tests, and
      // available for future scripted events); only the host can, as ever.
      const scale = playerCount(state) + Math.floor(richestWealth(state) / 6)
      const event = action.event ?? generateEvent(scale, `${state.roomCode}:event:${round}`)
      const revealed: GameState = {
        ...state,
        round,
        event,
        eventEndsAt: now + state.eventDuration * 1000
      }
      // Fire recurring contract clauses against the new event, react to the
      // resulting gains, then expire — logging every skittle movement.
      const moves: Move[] = []
      const fired = fireOnEvent(revealed, event, moves)
      const reacted = fireReceives(fired, diffGains(revealed, fired), 0, moves)
      return expireContracts(appendLog(reacted, movesToLog(moves)))
    }
    case 'resolveEvent': {
      if (senderId !== state.hostId) return state
      return resolveEvent(state)
    }
    case 'proposeTrade': {
      if (state.phase !== 'active') return state
      const from = state.players[senderId]
      const to = state.players[action.to]
      if (!from || !to || senderId === action.to || from.out || to.out) return state
      if (!isValidSet(action.give) || !isValidSet(action.receive)) return state
      if (!isValidSet(from.skittles) || !canAfford(from.skittles, action.give)) return state
      const offer: TradeOffer = {
        id: `offer-${state.nextOfferId}`,
        from: senderId,
        to: action.to,
        give: action.give,
        receive: action.receive
      }
      return { ...state, offers: [...state.offers, offer], nextOfferId: state.nextOfferId + 1 }
    }
    case 'acceptTrade': {
      const offer = state.offers.find((o) => o.id === action.offerId)
      if (!offer || offer.to !== senderId) return state
      const from = state.players[offer.from]
      const to = state.players[offer.to]
      if (from?.out || to?.out) return state
      if (!isValidSet(from?.skittles) || !isValidSet(to?.skittles)) return state
      if (!canAfford(from!.skittles!, offer.give)) return state
      if (!canAfford(to!.skittles!, offer.receive)) return state
      let next = withSkittles(
        state,
        offer.from,
        addSkittles(subSkittles(from!.skittles!, offer.give), offer.receive)
      )
      next = withSkittles(
        next,
        offer.to,
        addSkittles(subSkittles(to!.skittles!, offer.receive), offer.give)
      )
      const swapped = { ...next, offers: next.offers.filter((o) => o.id !== action.offerId) }
      const moves: Move[] = []
      const reacted = fireReceives(swapped, diffGains(state, swapped), 0, moves)
      const tradeBodies: LogBody[] = []
      if (SKITTLE_COLOURS.some((c) => offer.give[c] > 0)) {
        tradeBodies.push({ kind: 'transfer', from: offer.from, to: offer.to, skittles: offer.give })
      }
      if (SKITTLE_COLOURS.some((c) => offer.receive[c] > 0)) {
        tradeBodies.push({ kind: 'transfer', from: offer.to, to: offer.from, skittles: offer.receive })
      }
      return appendLog(reacted, [...tradeBodies, ...movesToLog(moves)])
    }
    case 'cancelTrade': {
      const offer = state.offers.find((o) => o.id === action.offerId)
      if (!offer || (offer.from !== senderId && offer.to !== senderId)) return state
      return { ...state, offers: state.offers.filter((o) => o.id !== action.offerId) }
    }
    case 'proposeContract': {
      if (state.phase !== 'active') return state
      const parties = action.parties
      const unique = new Set(parties)
      if (!parties.includes(senderId)) return state
      if (unique.size < 2 || unique.size !== parties.length) return state
      for (const id of parties) {
        const p = state.players[id]
        if (!p || p.out) return state
      }
      const transfers = [
        ...action.onSign,
        ...action.onEvent,
        ...action.onReceive,
        ...action.onEliminate,
        ...action.onDefault
      ]
      if (!transfers.every((t) => unique.has(t.from) && unique.has(t.to))) return state
      const contract: Contract = {
        id: `contract-${state.nextContractId}`,
        parties,
        signed: [senderId], // proposer signs on creation
        onSign: action.onSign,
        onEvent: action.onEvent,
        onReceive: action.onReceive,
        onEliminate: action.onEliminate,
        onDefault: action.onDefault,
        expiresRound: action.expiresRound,
        signFired: false,
        unpaid: false
      }
      return {
        ...state,
        contracts: [...state.contracts, contract],
        nextContractId: state.nextContractId + 1
      }
    }
    case 'signContract': {
      const idx = state.contracts.findIndex((c) => c.id === action.contractId)
      if (idx === -1) return state
      const contract = state.contracts[idx]!
      if (!contract.parties.includes(senderId) || contract.signed.includes(senderId)) return state

      const signedContract: Contract = { ...contract, signed: [...contract.signed, senderId] }
      const withSign = {
        ...state,
        contracts: state.contracts.map((c, i) => (i === idx ? signedContract : c))
      }
      if (!allSigned(signedContract) || signedContract.signFired) return withSign

      // Everyone has signed: fire the one-shot clause, then mark it fired and
      // drop the contract if it has no recurring (onEvent) clause.
      const moves: Move[] = []
      const fired = fireOnSign(withSign, signedContract, moves)
      const finalContract: Contract = { ...signedContract, signFired: true }
      const recurring =
        finalContract.onEvent.length > 0 ||
        finalContract.onReceive.length > 0 ||
        finalContract.onEliminate.length > 0 ||
        finalContract.onDefault.length > 0
      const contracts = fired.contracts
        .map((c) => (c.id === finalContract.id ? finalContract : c))
        .filter((c) => c.id !== finalContract.id || recurring)
      const result = { ...fired, contracts }
      // React to skittles moved by the onSign clause, then chronicle it all.
      const reacted = fireReceives(result, diffGains(state, result), 0, moves)
      return appendLog(reacted, movesToLog(moves))
    }
    case 'reviseContract': {
      // Counter-offer: a party rewrites a not-yet-active contract's clauses,
      // which resets agreement so everyone must sign the new version.
      const idx = state.contracts.findIndex((c) => c.id === action.contractId)
      if (idx === -1) return state
      const c = state.contracts[idx]!
      if (!c.parties.includes(senderId) || c.signFired) return state
      // A counter may also change the parties (so long as the reviser stays in).
      const parties = action.parties
      const unique = new Set(parties)
      if (!parties.includes(senderId)) return state
      if (unique.size < 2 || unique.size !== parties.length) return state
      for (const id of parties) {
        const p = state.players[id]
        if (!p || p.out) return state
      }
      const transfers = [
        ...action.onSign,
        ...action.onEvent,
        ...action.onReceive,
        ...action.onEliminate,
        ...action.onDefault
      ]
      if (!transfers.every((t) => unique.has(t.from) && unique.has(t.to))) return state
      const revised: Contract = {
        ...c,
        parties,
        onSign: action.onSign,
        onEvent: action.onEvent,
        onReceive: action.onReceive,
        onEliminate: action.onEliminate,
        onDefault: action.onDefault,
        expiresRound: action.expiresRound,
        signed: [senderId],
        unpaid: false
      }
      return { ...state, contracts: state.contracts.map((x, i) => (i === idx ? revised : x)) }
    }
    case 'cancelContract': {
      const contract = state.contracts.find((c) => c.id === action.contractId)
      if (!contract || !contract.parties.includes(senderId)) return state
      return { ...state, contracts: state.contracts.filter((c) => c.id !== action.contractId) }
    }
    case 'reset': {
      if (senderId !== state.hostId) return state
      const players: Record<string, PlayerState> = {}
      for (const [id, p] of Object.entries(state.players)) {
        players[id] = { ...p, skittles: emptySkittles(), out: false }
      }
      return {
        ...state,
        phase: 'lobby',
        players,
        event: null,
        eventEndsAt: null,
        offers: [],
        contracts: [],
        log: [],
        nextLogId: 0
      }
    }
    default:
      return state
  }
}
