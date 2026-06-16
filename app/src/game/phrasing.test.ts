import { describe, it, expect } from 'vitest'
import { phraseStatement, statementTokens, type PhraseToken } from './phrasing.js'
import type { SummaryStatement, Trigger } from './summary.js'
import type { AmountExpr, GiveSpec } from './contracts.js'
import { SKITTLE_COLOURS } from '../generators/event.js'

const names: Record<string, string> = { me: 'Me', alice: 'Alice', bob: 'Bob' }
const nameOf = (id: string) => names[id] ?? id

function phrase(s: SummaryStatement, viewer = 'me'): string {
  return phraseStatement(s, nameOf, viewer)
}

describe('phraseStatement — triggers', () => {
  const give: GiveSpec = { red: 2 }

  it('on signing, third party', () => {
    expect(phrase({ trigger: 'onSign', from: 'alice', to: 'bob', give }, 'me')).toBe(
      'On signing, Alice gives Bob 2 red.'
    )
  })

  it('on signing, viewer is giver', () => {
    expect(phrase({ trigger: 'onSign', from: 'me', to: 'bob', give })).toBe(
      'On signing, you give Bob 2 red.'
    )
  })

  it('on signing, viewer is recipient', () => {
    expect(phrase({ trigger: 'onSign', from: 'alice', to: 'me', give })).toBe(
      'On signing, Alice gives you 2 red.'
    )
  })

  it('each event', () => {
    expect(phrase({ trigger: 'onEvent', from: 'alice', to: 'bob', give }, 'me')).toBe(
      'Each event, Alice gives Bob 2 red.'
    )
  })

  it('onReceive, third party', () => {
    const g: GiveSpec = { red: { percent: 50, of: { received: 'red' } } }
    expect(phrase({ trigger: 'onReceive', from: 'alice', to: 'bob', give: g }, 'me')).toBe(
      'Each time Alice receives red, Alice gives Bob 50% of the red they received.'
    )
  })

  it('onReceive, viewer is the receiver (subject/verb agreement)', () => {
    const g: GiveSpec = { red: { percent: 50, of: { received: 'red' } } }
    expect(phrase({ trigger: 'onReceive', from: 'me', to: 'bob', give: g })).toBe(
      'Each time you receive red, you give Bob 50% of the red you received.'
    )
  })

  it('onEliminate, third party', () => {
    expect(phrase({ trigger: 'onEliminate', from: 'alice', to: 'bob', give }, 'me')).toBe(
      'If Alice is eliminated, Alice gives Bob 2 red.'
    )
  })

  it('onEliminate, viewer is giver (are vs is)', () => {
    expect(phrase({ trigger: 'onEliminate', from: 'me', to: 'bob', give })).toBe(
      'If you are eliminated, you give Bob 2 red.'
    )
  })

  it('onDefault', () => {
    expect(phrase({ trigger: 'onDefault', from: 'alice', to: 'bob', give }, 'me')).toBe(
      "If Alice can't pay, Alice gives Bob 2 red."
    )
  })
})

describe('phraseStatement — amounts', () => {
  const base = { trigger: 'onSign' as Trigger, from: 'alice', to: 'bob' }

  it('singular vs plural', () => {
    expect(phrase({ ...base, give: { red: 1 } }, 'me')).toBe('On signing, Alice gives Bob 1 red.')
    expect(phrase({ ...base, give: { red: 5 } }, 'me')).toBe('On signing, Alice gives Bob 5 red.')
  })

  it('zero reads as nothing', () => {
    expect(phrase({ ...base, give: { red: 0 } }, 'me')).toBe('On signing, Alice gives Bob nothing.')
  })

  it('empty give reads as nothing', () => {
    expect(phrase({ ...base, give: {} }, 'me')).toBe('On signing, Alice gives Bob nothing.')
  })

  it('all their colour, with viewer possessive', () => {
    expect(phrase({ ...base, give: { green: { all: 'green' } } }, 'me')).toBe(
      'On signing, Alice gives Bob all their green.'
    )
    expect(phrase({ trigger: 'onSign', from: 'me', to: 'bob', give: { green: { all: 'green' } } })).toBe(
      'On signing, you give Bob all your green.'
    )
  })

  it('the required colour', () => {
    expect(phrase({ ...base, give: { red: { eventReq: 'red' } } }, 'me')).toBe(
      'On signing, Alice gives Bob the required red.'
    )
  })

  it('the colour they/you received', () => {
    expect(phrase({ ...base, give: { red: { received: 'red' } } }, 'me')).toBe(
      'On signing, Alice gives Bob the red they received.'
    )
    expect(phrase({ trigger: 'onSign', from: 'me', to: 'bob', give: { red: { received: 'red' } } })).toBe(
      'On signing, you give Bob the red you received.'
    )
  })

  it('percentage of a base, no doubled parentheses', () => {
    const g: GiveSpec = { red: { percent: 25, of: { all: 'red' } } }
    expect(phrase({ ...base, give: g }, 'me')).toBe(
      'On signing, Alice gives Bob 25% of all their red.'
    )
  })

  it('min of two reads as a cap: "A, but at most B"', () => {
    const g: GiveSpec = { red: { min: [{ all: 'red' }, 1] } }
    expect(phrase({ ...base, give: g }, 'me')).toBe(
      'On signing, Alice gives Bob all their red, but at most 1 red.'
    )
  })

  it('min of three: "the smallest of A, B and C"', () => {
    const g: GiveSpec = { red: { min: [{ all: 'red' }, 1, { eventReq: 'red' }] } }
    expect(phrase({ ...base, give: g }, 'me')).toBe(
      'On signing, Alice gives Bob the smallest of all their red, 1 red and the required red.'
    )
  })

  it('nested sum reads with plus', () => {
    const g: GiveSpec = { red: { sum: [1, { all: 'red' }] } }
    expect(phrase({ ...base, give: g }, 'me')).toBe(
      'On signing, Alice gives Bob 1 red plus all their red.'
    )
  })

  it('several colours: comma list with final and', () => {
    const g: GiveSpec = { red: 1, orange: 2, green: 3 }
    expect(phrase({ ...base, give: g }, 'me')).toBe(
      'On signing, Alice gives Bob 1 red, 2 orange and 3 green.'
    )
  })

  it('zero colour is dropped from a multi-colour list', () => {
    const g: GiveSpec = { red: 0, orange: 2 }
    expect(phrase({ ...base, give: g }, 'me')).toBe('On signing, Alice gives Bob 2 orange.')
  })
})

// ── Exhaustive permutation sweep: every read must be clean ──────────────────

const triggers: Trigger[] = ['onSign', 'onEvent', 'onReceive', 'onEliminate', 'onDefault']

function amountVariants(c: (typeof SKITTLE_COLOURS)[number]): AmountExpr[] {
  return [
    0,
    1,
    7,
    { all: c },
    { eventReq: c },
    { received: c },
    { percent: 50, of: { all: c } },
    { percent: 25, of: { received: c } },
    { min: [{ all: c }, 1] },
    { min: [{ all: c }, 1, { eventReq: c }] },
    { sum: [1, { all: c }] },
    { sum: [1, 2, { percent: 50, of: { all: c } }] }
  ]
}

describe('permutation sweep reads cleanly', () => {
  // Build all single-colour permutations and assert structural cleanliness.
  const cases: { s: SummaryStatement; viewer: string }[] = []
  const parties = [
    { from: 'alice', to: 'bob' },
    { from: 'me', to: 'bob' },
    { from: 'alice', to: 'me' }
  ]
  for (const trigger of triggers) {
    for (const c of SKITTLE_COLOURS) {
      for (const amount of amountVariants(c)) {
        for (const p of parties) {
          cases.push({ s: { trigger, from: p.from, to: p.to, give: { [c]: amount } }, viewer: 'me' })
        }
      }
    }
  }
  // A couple of multi-colour ones too.
  cases.push({
    s: { trigger: 'onSign', from: 'alice', to: 'bob', give: { red: 1, orange: 2, yellow: 3, green: 4 } },
    viewer: 'me'
  })

  it(`covers a large spread (${cases.length} permutations)`, () => {
    expect(cases.length).toBeGreaterThan(500)
  })

  it('every permutation reads cleanly', () => {
    const problems: string[] = []
    for (const { s, viewer } of cases) {
      const tokens = statementTokens(s, viewer)
      const sentence = phraseStatement(s, nameOf, viewer)
      for (const bad of detectAwkward(sentence, tokens)) {
        problems.push(`${JSON.stringify(s)} (viewer=${viewer}) -> "${sentence}" :: ${bad}`)
      }
    }
    expect(problems).toEqual([])
  })
})

/** Heuristics that flag awkward English in a phrased sentence. */
function detectAwkward(sentence: string, tokens: PhraseToken[]): string[] {
  const issues: string[] = []
  // "1 reds" / "1 oranges" etc.
  if (/\b1 \w+s\b/.test(sentence)) issues.push('singular noun with plural s')
  // "0 <colour>" should never appear (zero -> nothing / dropped).
  if (/\b0 (red|orange|yellow|purple|green)/.test(sentence)) issues.push('"0 <colour>"')
  // Doubled or stray parentheses.
  if (/[()]/.test(sentence)) issues.push('parentheses in summary')
  // Subject/verb: "you receives", "you gives", "they give " (3rd person plural) etc.
  if (/\byou (receives|gives|is)\b/.test(sentence)) issues.push('you + 3rd-person verb')
  if (/\bAlice (receive|give|are)\b/.test(sentence)) issues.push('name + bare verb')
  // Comma list immediately followed by a word without "and" (best-effort). The
  // "A, but at most B" cap is not a list, so it's exempt.
  if (
    /, \w[\w% ]*, \w[\w% ]*\./.test(sentence) &&
    !/ and /.test(sentence) &&
    !/but at most/.test(sentence)
  ) {
    issues.push('comma list missing "and"')
  }
  // Double spaces / space before punctuation.
  if (/ {2,}/.test(sentence)) issues.push('double space')
  if (/ \./.test(sentence)) issues.push('space before full stop')
  if (/ ,/.test(sentence)) issues.push('space before comma')
  // Must end in a single full stop.
  if (!sentence.endsWith('.') || sentence.endsWith('..')) issues.push('bad terminator')
  // Capitalised opening.
  if (!/^[A-Z]/.test(sentence)) issues.push('not capitalised')
  // The colour-dot rendering: every 'colour' token should map to a colour word
  // in the text (sanity that tokens and text agree).
  for (const t of tokens) {
    if (t.kind === 'colour' && !sentence.includes(t.colour)) {
      issues.push(`colour token ${t.colour} absent from text`)
    }
  }
  return issues
}
