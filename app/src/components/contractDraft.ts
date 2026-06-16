/**
 * Editor-side model for composing contracts as "commands".
 *
 * A {@link ClauseDraft} is the editable form of one transfer-with-trigger. The
 * colour(s) live on the clause (you can target several at once), and the
 * {@link DraftAmount} is colour-free: "exactly 3", "all their", "a percentage",
 * optionally capped ("but at most N") or topped up ("plus N"). These pure
 * helpers convert drafts to engine contracts and back, so the command editor
 * and the negotiation view share one source of truth and can be unit-tested
 * without the DOM.
 */
import { SKITTLE_COLOURS, type SkittleColour } from '../generators/event.js'
import type { AmountExpr, Contract, GiveSpec, Transfer } from '../game/contracts.js'

export type Trigger = 'now' | 'event' | 'receive' | 'eliminate' | 'default'

/** The base shape of an amount, before a colour is filled in. */
export type AmountKind = 'number' | 'all' | 'eventReq' | 'received' | 'percent'
/** An optional limit applied to the base amount. */
export type Modifier = 'none' | 'cap' | 'plus'

/** A colour-free amount: the clause supplies the colour(s) it applies to. */
export interface DraftAmount {
  kind: AmountKind
  /** Count for `number`. */
  count: number
  /** Percentage for `percent` (always of what they received). */
  percent: number
  modifier: Modifier
  /** The cap (`but at most`) or top-up (`plus`) count, when modifier is set. */
  modAmount: number
}

export interface ClauseDraft {
  key: string
  trigger: Trigger
  from: string
  to: string
  /** The colours this clause moves; the amount applies to each of them. */
  colours: SkittleColour[]
  amount: DraftAmount
}

let keySeq = 0
export function clauseKey(): string {
  return `c${keySeq++}`
}

export function newAmount(): DraftAmount {
  return { kind: 'number', count: 1, percent: 50, modifier: 'none', modAmount: 1 }
}

export function newClause(from: string, to: string): ClauseDraft {
  return { key: clauseKey(), trigger: 'now', from, to, colours: ['red'], amount: newAmount() }
}

function baseExpr(a: DraftAmount, colour: SkittleColour): AmountExpr {
  switch (a.kind) {
    case 'number':
      return a.count
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

/** Turn a colour-free draft amount into a concrete engine expression. */
export function materialize(a: DraftAmount, colour: SkittleColour): AmountExpr {
  const base = baseExpr(a, colour)
  if (a.modifier === 'cap') return { min: [base, a.modAmount] }
  if (a.modifier === 'plus') return { sum: [base, a.modAmount] }
  return base
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
    const give: GiveSpec = {}
    for (const colour of c.colours) give[colour] = materialize(c.amount, colour)
    buckets[bucketOf(c.trigger)].push({ from: c.from, to: c.to, give })
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

/** Read one engine expression back into a colour-free draft amount. */
export function parseAmount(expr: AmountExpr): DraftAmount {
  const a = newAmount()
  let base: AmountExpr = expr
  if (typeof expr === 'object' && 'min' in expr && expr.min.length === 2 && typeof expr.min[1] === 'number') {
    a.modifier = 'cap'
    a.modAmount = expr.min[1]
    base = expr.min[0]!
  } else if (
    typeof expr === 'object' &&
    'sum' in expr &&
    expr.sum.length === 2 &&
    typeof expr.sum[1] === 'number'
  ) {
    a.modifier = 'plus'
    a.modAmount = expr.sum[1]
    base = expr.sum[0]!
  }
  if (typeof base === 'number') {
    a.kind = 'number'
    a.count = base
  } else if ('all' in base) a.kind = 'all'
  else if ('eventReq' in base) a.kind = 'eventReq'
  else if ('received' in base) a.kind = 'received'
  else if ('percent' in base) {
    a.kind = 'percent'
    a.percent = base.percent
  }
  return a
}

/** Reverse: turn an engine contract back into editable clause drafts, grouping
 *  colours that share the same amount into a single multi-colour clause. */
export function contractToClauses(c: Contract): ClauseDraft[] {
  const out: ClauseDraft[] = []
  const add = (trigger: Trigger, transfers: Transfer[]): void => {
    for (const t of transfers) {
      const groups: { amount: DraftAmount; colours: SkittleColour[] }[] = []
      for (const colour of SKITTLE_COLOURS) {
        const expr = t.give[colour]
        if (expr === undefined) continue
        const amount = parseAmount(expr)
        const key = JSON.stringify(amount)
        const group = groups.find((g) => JSON.stringify(g.amount) === key)
        if (group) group.colours.push(colour)
        else groups.push({ amount, colours: [colour] })
      }
      for (const g of groups) {
        out.push({
          key: clauseKey(),
          trigger,
          from: t.from,
          to: t.to,
          colours: g.colours,
          amount: g.amount
        })
      }
    }
  }
  for (const bucket of Object.keys(TRIGGER_OF) as (keyof Buckets)[]) {
    add(TRIGGER_OF[bucket], c[bucket])
  }
  return out
}
