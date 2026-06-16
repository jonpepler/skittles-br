/**
 * Pure, unit-testable phrasing for contract summary statements.
 *
 * `phraseStatement` turns one merged {@link SummaryStatement} into a single
 * plain-English (British) sentence, rendering `nameOf(viewerId)` as "you" and
 * agreeing the verb accordingly ("you give" vs "X gives").
 *
 * To keep the rendered UI (which interleaves faction chips and colour dots)
 * from drifting from the tested wording, the same logic first builds a list of
 * {@link PhraseToken}s. `phraseStatement` simply flattens those tokens to text;
 * {@link ContractSummary} maps the very same tokens to JSX, swapping faction
 * names for chips and colour words for dots. One source of truth, two surfaces.
 */
import { SKITTLE_COLOURS, type SkittleColour } from '../generators/event.js'
import type { AmountExpr, GiveSpec } from './contracts.js'
import { type SummaryStatement } from './summary.js'

/** A piece of a phrased sentence. */
export type PhraseToken =
  | { kind: 'text'; text: string }
  /** The leading trigger phrase ("On signing", "Each time" …). UI styles it. */
  | { kind: 'when'; text: string }
  /** A reference to a faction; UI renders a chip, tests render the name. */
  | { kind: 'faction'; id: string }
  /** A colour mention; UI renders a dot, tests render the colour word. */
  | { kind: 'colour'; colour: SkittleColour }

const text = (s: string): PhraseToken => ({ kind: 'text', text: s })
const when = (s: string): PhraseToken => ({ kind: 'when', text: s })
const faction = (id: string): PhraseToken => ({ kind: 'faction', id })
const colour = (c: SkittleColour): PhraseToken => ({ kind: 'colour', colour: c })

/** Join a list of token-runs with commas and a final "and". */
function joinList(parts: PhraseToken[][]): PhraseToken[] {
  if (parts.length === 0) return []
  if (parts.length === 1) return parts[0]!
  const out: PhraseToken[] = []
  parts.forEach((part, i) => {
    if (i > 0) out.push(text(i === parts.length - 1 ? ' and ' : ', '))
    out.push(...part)
  })
  return out
}

/**
 * Phrase one amount expression as tokens. `colourCtx` is the colour the amount
 * is measured in (so "3" reads as "3 red"); `possessive` is "your"/"their" for
 * the giver, and `subjective` is "you"/"they" for `received` phrasing.
 */
function amountTokens(
  expr: AmountExpr,
  colourCtx: SkittleColour,
  possessive: string,
  subjective: string
): PhraseToken[] {
  if (typeof expr === 'number') {
    // Colour is a mass noun here ("3 red", not "3 reds"); the colour token
    // renders as a dot in the UI, so a trailing plural "s" would dangle.
    return [text(`${expr} `), colour(colourCtx)]
  }
  if ('all' in expr) {
    return [text(`all ${possessive} `), colour(expr.all)]
  }
  if ('eventReq' in expr) {
    return [text('the required '), colour(expr.eventReq)]
  }
  if ('received' in expr) {
    return [text('the '), colour(expr.received), text(` ${subjective} received`)]
  }
  if ('percent' in expr) {
    return [text(`${expr.percent}% of `), ...amountTokens(expr.of, colourCtx, possessive, subjective)]
  }
  if ('min' in expr) {
    const parts = expr.min.map((e) => amountTokens(e, colourCtx, possessive, subjective))
    // A binary min is a cap: "A, but at most B". More than two falls back to a
    // plain "the smallest of A, B and C".
    if (parts.length === 2) return [...parts[0]!, text(', but at most '), ...parts[1]!]
    return [text('the smallest of '), ...joinList(parts)]
  }
  // A sum reads as "A plus B (plus C)".
  const parts = expr.sum.map((e) => amountTokens(e, colourCtx, possessive, subjective))
  const out: PhraseToken[] = []
  parts.forEach((part, i) => {
    if (i > 0) out.push(text(' plus '))
    out.push(...part)
  })
  return out
}

/** True if this amount is literally zero (and so contributes nothing). */
function isZero(expr: AmountExpr): boolean {
  return typeof expr === 'number' && expr === 0
}

/** Phrase the "give" half: the colours and amounts being handed over. */
function giveTokens(give: GiveSpec, possessive: string, subjective: string): PhraseToken[] {
  const parts: PhraseToken[][] = []
  for (const c of SKITTLE_COLOURS) {
    const expr = give[c]
    if (expr === undefined || isZero(expr)) continue
    parts.push(amountTokens(expr, c, possessive, subjective))
  }
  if (parts.length === 0) return [text('nothing')]
  return joinList(parts)
}

/**
 * Build the tokens for one statement. Renders the viewer as "you" and agrees
 * the verb; otherwise names both parties.
 */
export function statementTokens(s: SummaryStatement, viewerId: string): PhraseToken[] {
  const fromIsViewer = s.from === viewerId
  const toIsViewer = s.to === viewerId
  const possessive = fromIsViewer ? 'your' : 'their'
  const subjective = fromIsViewer ? 'you' : 'they'

  const give = giveTokens(s.give, possessive, subjective)

  // "gives you" / "gives <Y>"; "give" agrees when the giver is you.
  const giveVerb = fromIsViewer ? 'give' : 'gives'
  const recipient: PhraseToken[] = toIsViewer ? [text('you')] : [faction(s.to)]

  // Subject of the main clause.
  const subject: PhraseToken[] = fromIsViewer ? [text('you')] : [faction(s.from)]

  const tail: PhraseToken[] = [
    ...subject,
    text(` ${giveVerb} `),
    ...recipient,
    text(' '),
    ...give,
    text('.')
  ]

  switch (s.trigger) {
    case 'onSign':
      return [when('On signing'), text(', '), ...tail]
    case 'onEvent':
      return [when('Each event'), text(', '), ...tail]
    case 'onReceive': {
      // The clause fires on *any* receipt; the colour only scopes the amount
      // ("the red you received"), so it must not appear in the trigger.
      const verb = fromIsViewer ? 'receive' : 'receives'
      return [when('Each time'), text(' '), ...subject, text(` ${verb} skittles, `), ...tail]
    }
    case 'onEliminate': {
      const verb = fromIsViewer ? 'are' : 'is'
      return [when('If'), text(' '), ...subject, text(` ${verb} eliminated, `), ...tail]
    }
    case 'onDefault':
      return [when('If'), text(' '), ...subject, text(" can't pay, "), ...tail]
  }
}

/** Flatten tokens to a plain sentence, using `nameOf` for factions. */
export function tokensToText(tokens: PhraseToken[], nameOf: (id: string) => string): string {
  return tokens
    .map((t) => {
      if (t.kind === 'text' || t.kind === 'when') return t.text
      if (t.kind === 'faction') return nameOf(t.id)
      return t.colour
    })
    .join('')
}

/** Phrase a statement as a single plain-English sentence. */
export function phraseStatement(
  s: SummaryStatement,
  nameOf: (id: string) => string,
  viewerId: string
): string {
  return tokensToText(statementTokens(s, viewerId), nameOf)
}
