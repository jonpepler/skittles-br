/**
 * A small, declarative "contracts" system for skittles — think smart-contracts,
 * but data, not code (so it's deterministic, safe to run on the host, and
 * serialisable over the wire).
 *
 * A contract bundles transfers between parties. Transfer amounts are
 * *expressions* (a fixed number, "all of my <colour>", or "the current event's
 * required <colour>"), and clauses fire on a trigger: once when everyone signs
 * (`onSign`) or every time an event is revealed (`onEvent`). Gifts, swaps,
 * n-way circular trades and recurring conditional deals are all just different
 * data in this one shape — e.g. "give me all your reds, and I'll give you
 * enough reds for every event" is an onSign transfer plus an onEvent transfer.
 */
import type { SkittleColour, GameEvent } from '../generators/event.js'
import { addSkittles, canAfford, emptySkittles, fromColours } from './skittles.js'
import type { GameState, PlayerState } from './types.js'

/** An expression that evaluates to a non-negative integer amount of a colour. */
export type AmountExpr =
  | number
  | { all: SkittleColour } // all of the giver's current holding of that colour
  | { eventReq: SkittleColour } // the current event's requirement for that colour
  | { min: AmountExpr[] }
  | { sum: AmountExpr[] }

/** How much of each colour a transfer moves (omitted colours = none). */
export type GiveSpec = Partial<Record<SkittleColour, AmountExpr>>

export type Transfer = { from: string; to: string; give: GiveSpec }

export type Contract = {
  id: string
  parties: string[]
  signed: string[]
  /** Transfers applied once, when every party has signed. */
  onSign: Transfer[]
  /** Transfers applied every time an event is revealed (recurring). */
  onEvent: Transfer[]
  /** Round after which the contract is dropped (null = no expiry). */
  expiresRound: number | null
  /** Whether the onSign clause has already fired. */
  signFired: boolean
}

export interface EvalContext {
  giver: PlayerState | undefined
  event: GameEvent | null
}

function computeAmount(expr: AmountExpr, ctx: EvalContext): number {
  if (typeof expr === 'number') return expr
  if ('all' in expr) return ctx.giver?.skittles?.[expr.all] ?? 0
  if ('eventReq' in expr) return ctx.event?.requirement[expr.eventReq] ?? 0
  if ('min' in expr) return Math.min(...expr.min.map((e) => evalAmount(e, ctx)))
  return expr.sum.reduce((acc: number, e) => acc + evalAmount(e, ctx), 0)
}

/** Evaluate an amount expression to a clamped, non-negative integer. */
export function evalAmount(expr: AmountExpr, ctx: EvalContext): number {
  const value = computeAmount(expr, ctx)
  return Math.max(0, Math.floor(Number.isFinite(value) ? value : 0))
}

function evalGive(give: GiveSpec, ctx: EvalContext) {
  return fromColours((c) => (give[c] === undefined ? 0 : evalAmount(give[c]!, ctx)))
}

export function allSigned(contract: Contract): boolean {
  return contract.parties.every((p) => contract.signed.includes(p))
}

/**
 * Apply one set of transfers atomically: every party must be present and not
 * out, and every giver must hold the *gross* amount they give. Returns the new
 * state, or null if the transfers can't be honoured (caller skips them).
 */
export function applyTransfers(
  state: GameState,
  transfers: Transfer[],
  event: GameEvent | null
): GameState | null {
  if (transfers.length === 0) return state

  const give: Record<string, ReturnType<typeof emptySkittles>> = {}
  const receive: Record<string, ReturnType<typeof emptySkittles>> = {}

  for (const t of transfers) {
    const from = state.players[t.from]
    const to = state.players[t.to]
    if (!from || !to || from.out || to.out || !from.skittles || !to.skittles) return null
    const amounts = evalGive(t.give, { giver: from, event })
    give[t.from] = addSkittles(give[t.from] ?? emptySkittles(), amounts)
    receive[t.to] = addSkittles(receive[t.to] ?? emptySkittles(), amounts)
  }

  // Every giver must be able to afford their total outgoing.
  for (const [id, owed] of Object.entries(give)) {
    if (!canAfford(state.players[id]!.skittles!, owed)) return null
  }

  const players = { ...state.players }
  for (const id of new Set([...Object.keys(give), ...Object.keys(receive)])) {
    const current = players[id]!.skittles!
    const next = fromColours(
      (c) => current[c] - (give[id]?.[c] ?? 0) + (receive[id]?.[c] ?? 0)
    )
    players[id] = { ...players[id]!, skittles: next }
  }
  return { ...state, players }
}

/** Fire a contract's onSign clause once (when fully signed). */
export function fireOnSign(state: GameState, contract: Contract): GameState {
  if (contract.signFired || !allSigned(contract)) return state
  return applyTransfers(state, contract.onSign, state.event) ?? state
}

/** Fire every fully-signed contract's onEvent clause for a freshly revealed event. */
export function fireOnEvent(state: GameState, event: GameEvent): GameState {
  let next = state
  for (const contract of state.contracts) {
    if (!allSigned(contract) || contract.onEvent.length === 0) continue
    next = applyTransfers(next, contract.onEvent, event) ?? next
  }
  return next
}

/** Drop contracts past their expiry round. */
export function expireContracts(state: GameState): GameState {
  const live = state.contracts.filter(
    (c) => c.expiresRound === null || state.round <= c.expiresRound
  )
  return live.length === state.contracts.length ? state : { ...state, contracts: live }
}
