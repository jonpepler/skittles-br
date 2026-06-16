import { SKITTLE_COLOURS, type SkittleColour, type SkittleSet } from '../generators/event.js'
import { neighboursOf } from '../game/state.js'
import type { GameState } from '../game/types.js'
import type { Rng } from '../lib/rng.js'

/**
 * Simulation bot policies. Income now arrives automatically (starting hand +
 * each round's allotment), so a {@link Policy} only decides social moves — for
 * now, whether to gift to a neighbour — from the *redacted* view a real player
 * would see. All choices are driven by a seeded {@link Rng}, so a whole game is
 * reproducible from its seed, which lets us trace balance changes across git
 * history rather than keeping a separate record.
 *
 * These are deliberately dumb archetypes: they tune the *physics* of the
 * economy (is it survivable-but-unfair? does anyone die on turn one?), not the
 * *politics* the real game is about. Negotiating/coalition bots are future work.
 */
export interface Policy {
  name: string
  /** Optionally gift one of a colour to a neighbour (models mutual aid). */
  aid(view: GameState, self: string, rng: Rng): { to: string; colour: SkittleColour } | null
  /** Optionally commit Force (red) to Attack a neighbour. */
  attack?(view: GameState, self: string, rng: Rng): { to: string; force: number } | null
}

const total = (s: SkittleSet | null): number =>
  s ? SKITTLE_COLOURS.reduce((a, c) => a + s[c], 0) : 0

/** Keeps to itself. */
export const ISOLATIONIST: Policy = {
  name: 'Isolationist',
  aid: () => null
}

/** Hoards — never gives anything away. (Distinct once trading bots exist.) */
export const HOARDER: Policy = {
  name: 'Hoarder',
  aid: () => null
}

/** Gifts spare red to its poorest living neighbour. */
export const PATRON: Policy = {
  name: 'Patron',
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

/** Attacks its weakest red-holding neighbour with just enough Force to win. */
export const AGGRESSOR: Policy = {
  name: 'Aggressor',
  aid: () => null,
  attack: (view, self) => {
    const me = view.players[self]
    if (!me?.skittles || me.skittles.red < 2) return null
    const targets = neighboursOf(view.order, self)
      .map((id) => view.players[id])
      .filter((p): p is NonNullable<typeof p> => !!p && !p.out && !!p.skittles)
    if (targets.length === 0) return null
    const weakest = targets.reduce((a, b) => (a.skittles!.red <= b.skittles!.red ? a : b))
    const need = weakest.skittles!.red + 1 // exceed whatever they can muster
    if (me.skittles.red < need) return null
    return { to: weakest.id, force: need }
  }
}

export const ARCHETYPES: Policy[] = [ISOLATIONIST, HOARDER, PATRON, AGGRESSOR]
