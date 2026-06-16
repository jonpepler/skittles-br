/**
 * Editor-side model for composing contracts as "commands".
 *
 * A {@link ClauseDraft} is the editable form of one transfer-with-trigger. Its
 * {@link DraftAmount} bundles the colours *and* their counts into one unit
 * map — "exactly 2 red and 2 green" is `{ kind: 'number', units: { red: 2,
 * green: 2 } }` — with an optional limit ("but at most N" / "plus N"). These
 * pure helpers convert drafts to engine contracts and back, so the command
 * editor and the negotiation view share one source of truth and can be
 * unit-tested without the DOM.
 */
import { SKITTLE_COLOURS, type SkittleColour } from '../generators/event.js'
import type { AmountExpr, Contract, GiveSpec, Transfer } from '../game/contracts.js'

export type Trigger = 'now' | 'event' | 'receive' | 'eliminate' | 'default'

/** The base shape of an amount. Counts only matter for `number`; the other
 *  kinds ("all their", "the required"…) are dynamic and self-describing. */
export type AmountKind = 'number' | 'all' | 'eventReq' | 'received' | 'percent'
/** An optional limit applied to the base amount of every colour. */
export type Modifier = 'none' | 'cap' | 'plus'

export interface DraftAmount {
  kind: AmountKind
  /** Selected colours mapped to their count (count used only for `number`). */
  units: Partial<Record<SkittleColour, number>>
  /** Percentage for `percent` (always of what they received). */
  percent: number
  modifier: Modifier
  /** The limit count per colour, mirroring `units`, when modifier is set. */
  modUnits: Partial<Record<SkittleColour, number>>
}

export interface ClauseDraft {
  key: string
  trigger: Trigger
  from: string
  to: string
  amount: DraftAmount
}

let keySeq = 0
export function clauseKey(): string {
  return `c${keySeq++}`
}

export function newAmount(): DraftAmount {
  return { kind: 'number', units: { red: 1 }, percent: 50, modifier: 'none', modUnits: { red: 1 } }
}

export function newClause(from: string, to: string): ClauseDraft {
  return { key: clauseKey(), trigger: 'now', from, to, amount: newAmount() }
}

/** The colours an amount targets, in palette order. */
export function selectedColours(a: DraftAmount): SkittleColour[] {
  return SKITTLE_COLOURS.filter((c) => a.units[c] !== undefined)
}

function baseExpr(a: DraftAmount, colour: SkittleColour): AmountExpr {
  switch (a.kind) {
    case 'number':
      return a.units[colour] ?? 0
    case 'all':
      return { all: colour }
    case 'eventReq':
      return { eventReq: colour }
    case 'received':
      return { received: colour }
    case 'percent':
      return { percent: a.percent, of: { received: colour } }
  }
}

/** The engine expression for one colour of an amount (with its limit applied). */
export function colourExpr(a: DraftAmount, colour: SkittleColour): AmountExpr {
  const base = baseExpr(a, colour)
  const limit = a.modUnits[colour] ?? 0
  if (a.modifier === 'cap') return { min: [base, limit] }
  if (a.modifier === 'plus') return { sum: [base, limit] }
  return base
}

/** Spread one draft amount across its colours into an engine give-spec. */
export function amountToGive(a: DraftAmount): GiveSpec {
  const give: GiveSpec = {}
  for (const colour of selectedColours(a)) give[colour] = colourExpr(a, colour)
  return give
}

function bucketOf(t: Trigger): keyof Buckets {
  if (t === 'now') return 'onSign'
  if (t === 'event') return 'onEvent'
  if (t === 'eliminate') return 'onEliminate'
  if (t === 'default') return 'onDefault'
  return 'onReceive'
}

export interface Buckets {
  onSign: Transfer[]
  onEvent: Transfer[]
  onReceive: Transfer[]
  onEliminate: Transfer[]
  onDefault: Transfer[]
}

export function clausesToBuckets(clauses: ClauseDraft[]): Buckets {
  const buckets: Buckets = { onSign: [], onEvent: [], onReceive: [], onEliminate: [], onDefault: [] }
  for (const c of clauses) {
    buckets[bucketOf(c.trigger)].push({ from: c.from, to: c.to, give: amountToGive(c.amount) })
  }
  return buckets
}

const TRIGGER_OF: Record<keyof Buckets, Trigger> = {
  onSign: 'now',
  onEvent: 'event',
  onReceive: 'receive',
  onEliminate: 'eliminate',
  onDefault: 'default'
}

type Shape = Omit<DraftAmount, 'units' | 'modUnits'>

/** The kind/modifier shape of one engine expression, plus its count and cap. */
function parseExpr(expr: AmountExpr): { shape: Shape; count: number; limit: number } {
  const shape: Shape = { kind: 'number', percent: 50, modifier: 'none' }
  let base: AmountExpr = expr
  let limit = 1
  if (typeof expr === 'object' && 'min' in expr && expr.min.length === 2 && typeof expr.min[1] === 'number') {
    shape.modifier = 'cap'
    limit = expr.min[1]
    base = expr.min[0]!
  } else if (
    typeof expr === 'object' &&
    'sum' in expr &&
    expr.sum.length === 2 &&
    typeof expr.sum[1] === 'number'
  ) {
    shape.modifier = 'plus'
    limit = expr.sum[1]
    base = expr.sum[0]!
  }
  let count = 1
  if (typeof base === 'number') {
    shape.kind = 'number'
    count = base
  } else if ('all' in base) shape.kind = 'all'
  else if ('eventReq' in base) shape.kind = 'eventReq'
  else if ('received' in base) shape.kind = 'received'
  else if ('percent' in base) {
    shape.kind = 'percent'
    shape.percent = base.percent
  }
  return { shape, count, limit }
}

/** Reverse: turn an engine contract back into editable clause drafts, grouping
 *  colours that share a kind/modifier into one multi-colour clause. */
export function contractToClauses(c: Contract): ClauseDraft[] {
  const out: ClauseDraft[] = []
  const add = (trigger: Trigger, transfers: Transfer[]): void => {
    for (const t of transfers) {
      const groups = new Map<string, DraftAmount>()
      for (const colour of SKITTLE_COLOURS) {
        const expr = t.give[colour]
        if (expr === undefined) continue
        const { shape, count, limit } = parseExpr(expr)
        const key = JSON.stringify(shape)
        const amount = groups.get(key) ?? { ...shape, units: {}, modUnits: {} }
        amount.units[colour] = count
        amount.modUnits[colour] = limit
        groups.set(key, amount)
      }
      for (const amount of groups.values()) {
        out.push({ key: clauseKey(), trigger, from: t.from, to: t.to, amount })
      }
    }
  }
  for (const bucket of Object.keys(TRIGGER_OF) as (keyof Buckets)[]) {
    add(TRIGGER_OF[bucket], c[bucket])
  }
  return out
}
