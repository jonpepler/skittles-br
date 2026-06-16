/**
 * Themed game-event generator.
 *
 * Events come in two kinds:
 *  - threat (barbarians, famine, raids): you must pay the requirement. If you
 *    can't, you either get eliminated or lose skittles, depending on the event.
 *  - opportunity (technologies): pay the requirement to gain the reward. If you
 *    can't, nothing bad happens, you just miss out and fall behind.
 *
 * Flavour advances through technological eras as the game escalates (driven by
 * the richest player's wealth, passed in as `scale`), so early events are
 * stone-age and later ones modern. Quantities scale with the same exponential
 * the original Python service used, and generation stays deterministic for a
 * given (scale, seed) so peers agree without transmitting the event.
 */
import { Rng } from '../lib/rng.js'

const W0 = 0.6
const W1 = 1
const S = (x: number, scale: number): number => scale * W0 * Math.exp(W1 * x)

export const SKITTLE_COLOURS = ['red', 'orange', 'yellow', 'purple', 'green'] as const

export type SkittleColour = (typeof SKITTLE_COLOURS)[number]
export type SkittleSet = Record<SkittleColour, number>

export type EventKind = 'threat' | 'opportunity'
/** What happens to a player who can't meet the event's requirement. */
export type EventFail = 'eliminate' | 'penalty' | 'none'

// A `type` (not `interface`) so it satisfies Trystero's JSON payload constraint
// when carried inside the game state over the wire.
export type GameEvent = {
  name: string
  description: string
  kind: EventKind
  /** Outcome for a player who can't pay the requirement. */
  fail: EventFail
  /** What you must pay (a threat's gate, or an opportunity's investment). */
  requirement: SkittleSet
  /** What you gain if you pay. */
  reward: SkittleSet
  /** What you lose if `fail` is 'penalty' and you can't pay. */
  penalty: SkittleSet
}

interface Era {
  name: string
  threats: string[]
  opportunities: string[]
}

// Roughly four skittle-events per era as the game escalates.
const ERAS: Era[] = [
  {
    name: 'Stone Age',
    threats: ['a Wolf Pack', 'a Hard Winter', 'a Rival Tribe'],
    opportunities: ['Fire', 'the Wheel', 'Stone Tools']
  },
  {
    name: 'Bronze Age',
    threats: ['Raiders', 'a Drought', 'a Locust Swarm'],
    opportunities: ['Bronze Casting', 'Irrigation', 'the Sail']
  },
  {
    name: 'Iron Age',
    threats: ['a Barbarian Horde', 'a Plague', 'a Siege'],
    opportunities: ['the Plough', 'Coinage', 'Paved Roads']
  },
  {
    name: 'Industrial Age',
    threats: ['Famine', 'a Bombardment', 'a Revolt'],
    opportunities: ['the Steam Engine', 'the Printing Press', 'Railways']
  },
  {
    name: 'Modern Age',
    threats: ['a Naval Blockade', 'a Market Crash', 'a Cyber Raid'],
    opportunities: ['Electrification', 'Vaccination', 'the Internet']
  }
]

export const EXAMPLE_EVENT: GameEvent = {
  name: 'Famine',
  description: 'Famine grips the land. Pay the requirement or be eliminated.',
  kind: 'threat',
  fail: 'eliminate',
  requirement: { red: 1, orange: 2, yellow: 0, purple: 0, green: 3 },
  reward: { red: 0, orange: 0, yellow: 1, purple: 0, green: 0 },
  penalty: { red: 0, orange: 0, yellow: 0, purple: 0, green: 0 }
}

function emptySet(): SkittleSet {
  return { red: 0, orange: 0, yellow: 0, purple: 0, green: 0 }
}

function describe(kind: EventKind, fail: EventFail, name: string): string {
  if (kind === 'opportunity') {
    return `${name} is within reach. Invest to leap ahead, or save your skittles and fall behind.`
  }
  if (fail === 'eliminate') return `${name} threatens the land. Pay the price or be eliminated.`
  return `${name} strikes. Pay to defend, or lose skittles.`
}

/**
 * Generate a themed event.
 *
 * @param scale Escalation level (driven by the richest player's wealth). Larger
 *              means bigger quantities and a later technological era.
 * @param seed  The same (scale, seed) pair always produces the same event.
 */
export function generateEvent(scale = 1, seed?: number | string): GameEvent {
  const rng = new Rng(seed)
  const era = ERAS[Math.min(ERAS.length - 1, Math.max(0, Math.floor(scale / 4)))]!

  const kind: EventKind = rng.bool(0.55) ? 'threat' : 'opportunity'
  const fail: EventFail =
    kind === 'opportunity' ? 'none' : rng.bool(0.5) ? 'eliminate' : 'penalty'
  const name = rng.pick(kind === 'threat' ? era.threats : era.opportunities)

  // 15 draws: five colours each for requirement, reward and penalty.
  const x = Array.from({ length: 15 }, () => rng.next())
  const fill = (offset: number, factor: number): SkittleSet => {
    const set = emptySet()
    SKITTLE_COLOURS.forEach((colour, i) => {
      set[colour] = Math.trunc(S(x[offset + i]!, scale) * factor)
    })
    return set
  }

  // Opportunities ask a modest investment for a strong reward; threats gate
  // harder and pay smaller spoils.
  const requirement = fill(0, kind === 'opportunity' ? 0.6 : 1)
  const reward = fill(5, kind === 'opportunity' ? 1 : 0.4)
  const penalty = fail === 'penalty' ? fill(10, 0.7) : emptySet()

  return { name, description: describe(kind, fail, name), kind, fail, requirement, reward, penalty }
}

/** Total number of skittles referenced by an event (handy for tests/balancing). */
export function eventMagnitude(event: GameEvent): number {
  const sumSet = (s: SkittleSet): number => SKITTLE_COLOURS.reduce((acc, c) => acc + s[c], 0)
  return sumSet(event.requirement) + sumSet(event.reward) + sumSet(event.penalty)
}
