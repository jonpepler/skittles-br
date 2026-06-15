/**
 * Editor-side model for composing contracts as "commands".
 *
 * A {@link ClauseDraft} is the editable form of one transfer-with-trigger. These
 * pure helpers convert drafts ↔ engine contracts and render readable English, so
 * the command editor and the negotiation view share one source of truth and can
 * be unit-tested without the DOM.
 */
import { SKITTLE_COLOURS, type SkittleColour } from '../generators/event.js'
import type { AmountExpr, Contract, Transfer } from '../game/contracts.js'

export type Trigger = 'now' | 'event' | 'receive' | 'eliminate'

export interface ClauseDraft {
  key: string
  trigger: Trigger
  receiveColour: SkittleColour
  from: string
  to: string
  colour: SkittleColour
  amount: AmountExpr
}

let keySeq = 0
export function clauseKey(): string {
  return `c${keySeq++}`
}

export function newClause(from: string, to: string): ClauseDraft {
  return {
    key: clauseKey(),
    trigger: 'now',
    receiveColour: 'red',
    from,
    to,
    colour: 'red',
    amount: 1
  }
}

function bucketOf(t: Trigger): keyof Buckets {
  if (t === 'now') return 'onSign'
  if (t === 'event') return 'onEvent'
  if (t === 'eliminate') return 'onEliminate'
  return 'onReceive'
}

export interface Buckets {
  onSign: Transfer[]
  onEvent: Transfer[]
  onReceive: Transfer[]
  onEliminate: Transfer[]
}

export function clausesToBuckets(clauses: ClauseDraft[]): Buckets {
  const buckets: Buckets = { onSign: [], onEvent: [], onReceive: [], onEliminate: [] }
  for (const c of clauses) {
    const transfer: Transfer = { from: c.from, to: c.to, give: { [c.colour]: c.amount } }
    buckets[bucketOf(c.trigger)].push(transfer)
  }
  return buckets
}

/** Reverse: turn an engine contract back into editable clause drafts. */
export function contractToClauses(c: Contract): ClauseDraft[] {
  const out: ClauseDraft[] = []
  const add = (trigger: Trigger, transfers: Transfer[]): void => {
    for (const t of transfers) {
      for (const colour of SKITTLE_COLOURS) {
        const amount = t.give[colour]
        if (amount === undefined) continue
        out.push({
          key: clauseKey(),
          trigger,
          receiveColour: colour,
          from: t.from,
          to: t.to,
          colour,
          amount
        })
      }
    }
  }
  add('now', c.onSign)
  add('event', c.onEvent)
  add('receive', c.onReceive)
  add('eliminate', c.onEliminate)
  return out
}

export function describeAmount(expr: AmountExpr, colour: SkittleColour): string {
  if (typeof expr === 'number') return `${expr} ${colour}`
  if ('all' in expr) return `all their ${expr.all}`
  if ('eventReq' in expr) return `the required ${expr.eventReq}`
  if ('received' in expr) return `the ${expr.received} they received`
  if ('percent' in expr) return `${expr.percent}% of (${describeAmount(expr.of, colour)})`
  if ('min' in expr) return `the smallest of (${expr.min.map((e) => describeAmount(e, colour)).join(', ')})`
  return `the total of (${expr.sum.map((e) => describeAmount(e, colour)).join(', ')})`
}

export function describeClause(c: ClauseDraft, nameOf: (id: string) => string): string {
  const when =
    c.trigger === 'now'
      ? 'When signed,'
      : c.trigger === 'event'
        ? 'Each event,'
        : c.trigger === 'eliminate'
          ? `If ${nameOf(c.from)} is eliminated,`
          : `Each time ${nameOf(c.from)} receives ${c.receiveColour},`
  return `${when} ${nameOf(c.from)} gives ${nameOf(c.to)} ${describeAmount(c.amount, c.colour)}.`
}
