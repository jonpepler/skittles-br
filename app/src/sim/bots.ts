import { SKITTLE_COLOURS, type SkittleColour, type SkittleSet } from '../generators/event.js'
import { neighboursOf } from '../game/state.js'
import type { GameState } from '../game/types.js'
import type { Rng } from '../lib/rng.js'

/**
 * Simulation bot policies. A {@link Policy} decides, from the *redacted* view a
 * real player would see, how much to collect each round and whether to gift to
 * a neighbour. All choices are driven by a seeded {@link Rng}, so a whole game
 * is reproducible from its seed — the property that lets us trace balance
 * changes across git history rather than keeping a separate record.
 *
 * These are deliberately dumb archetypes: they tune the *physics* of the
 * economy (is it survivable-but-unfair? does anyone die on turn one?), not the
 * *politics* the real game is about. Negotiating/coalition bots are future work.
 */
export interface Policy {
  name: string
  /** How many of each colour to collect this round. */
  collect(view: GameState, self: string, rng: Rng): SkittleSet
  /** Optionally gift one of a colour to a neighbour (models mutual aid). */
  aid(view: GameState, self: string, rng: Rng): { to: string; colour: SkittleColour } | null
}

const zero = (): SkittleSet => ({ red: 0, orange: 0, yellow: 0, purple: 0, green: 0 })
const total = (s: SkittleSet | null): number =>
  s ? SKITTLE_COLOURS.reduce((a, c) => a + s[c], 0) : 0

/** Spread a budget evenly across all five colours. */
function spread(budget: number): SkittleSet {
  const out = zero()
  for (let i = 0; i < budget; i++) out[SKITTLE_COLOURS[i % SKITTLE_COLOURS.length]!]++
  return out
}

/** Collects evenly — naturally hedged against multi-colour threats. */
export const SPREADER: Policy = {
  name: 'Spreader',
  collect: (_v, _s, rng) => spread(rng.range(14, 20)),
  aid: () => null
}

/** Grabs more, but only two colours — richer, yet brittle to broad threats. */
export const HOARDER: Policy = {
  name: 'Hoarder',
  collect: (_v, _s, rng) => {
    const budget = rng.range(18, 26)
    const out = zero()
    const favs: SkittleColour[] = ['red', 'yellow']
    for (let i = 0; i < budget; i++) out[favs[i % favs.length]!]++
    return out
  },
  aid: () => null
}

/** Collects evenly and gifts spare red to its poorest living neighbour. */
export const PATRON: Policy = {
  name: 'Patron',
  collect: (_v, _s, rng) => spread(rng.range(14, 20)),
  aid: (view, self) => {
    const me = view.players[self]
    if (!me?.skittles || me.skittles.red < 2) return null
    const neighbours = neighboursOf(view.order, self)
      .map((id) => view.players[id])
      .filter((p) => p && !p.out && p.skittles)
    if (neighbours.length === 0) return null
    const poorest = neighbours.reduce((a, b) => (total(a!.skittles) <= total(b!.skittles) ? a : b))!
    return { to: poorest.id, colour: 'red' }
  }
}

export const ARCHETYPES: Policy[] = [SPREADER, HOARDER, PATRON]
