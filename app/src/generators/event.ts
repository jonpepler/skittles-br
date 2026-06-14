/**
 * Random game-event generator.
 *
 * Ported from the Python `event-generator` service (eventanator/engine.py).
 * An event has a `requirement`, a `reward` and a `penalty`, each a map of the
 * five skittle colours. Quantities scale with a `scale` parameter through the
 * same exponential the Python service used:
 *
 *     S(x, scale) = scale * W0 * e^(W1 * x) + W2 * x
 *
 * Two deliberate changes from the Python original:
 *  1. The seed is respected. The Python `Event.__init__` had an inverted guard
 *     (`if not seed is None: seed = random.random()`) that overwrote any passed
 *     seed with a random one, so events were never actually reproducible. For
 *     the peer-to-peer model reproducibility is the whole point, so a provided
 *     seed now deterministically drives the event.
 *  2. Names/descriptions were Lorem Ipsum placeholders; they're now generated
 *     from a small thematic word bank (still a starting point — see TODO).
 */
import { Rng } from '../lib/rng.js'

// PARAMETERS — change these to tune how `scale` influences skittle counts.
const W0 = 0.6
const W1 = 1
const W2 = 0

const S = (x: number, scale: number): number =>
  scale * W0 * Math.exp(W1 * x) + W2 * x

export const SKITTLE_COLOURS = [
  'red',
  'orange',
  'yellow',
  'purple',
  'green'
] as const

export type SkittleColour = (typeof SKITTLE_COLOURS)[number]
export type SkittleSet = Record<SkittleColour, number>

export interface GameEvent {
  name: string
  description: string
  requirement: SkittleSet
  reward: SkittleSet
  penalty: SkittleSet
}

/** The canonical example event, matching the Python EXAMPLE_EVENT_DICT. */
export const EXAMPLE_EVENT: GameEvent = {
  name: 'Random Event Name',
  description: 'A longer form description (optional)',
  requirement: { red: 1, orange: 2, yellow: 0, purple: 0, green: 3 },
  reward: { red: 0, orange: 0, yellow: 3, purple: 1, green: 0 },
  penalty: { red: 1, orange: 1, yellow: 1, purple: 0, green: 0 }
}

// TODO: thematic flavour text is intentionally lightweight for now — a richer
// generator (tied to the requirement/reward shape) can replace this later.
const EVENT_ADJECTIVES = [
  'Great',
  'Sudden',
  'Bountiful',
  'Bitter',
  'Glorious',
  'Unexpected',
  'Lingering',
  'Distant',
  'Restless',
  'Golden'
]
const EVENT_NOUNS = [
  'Famine',
  'Harvest',
  'Uprising',
  'Festival',
  'Drought',
  'Discovery',
  'Migration',
  'Alliance',
  'Storm',
  'Bounty'
]

function makeName(rng: Rng): string {
  return `The ${rng.pick(EVENT_ADJECTIVES)} ${rng.pick(EVENT_NOUNS)}`
}

function makeDescription(rng: Rng, name: string): string {
  const verbs = ['sweeps across', 'unsettles', 'transforms', 'tests', 'rewards']
  const objects = [
    'the realm',
    'every civilisation',
    'the trade routes',
    'the borderlands',
    'the people'
  ]
  return `${name} ${rng.pick(verbs)} ${rng.pick(objects)}.`
}

function emptySet(): SkittleSet {
  return { red: 0, orange: 0, yellow: 0, purple: 0, green: 0 }
}

/**
 * Generate a random event.
 *
 * @param scale Scales the magnitude of skittle quantities (larger → bigger
 *              requirements/rewards/penalties). Defaults to 1.
 * @param seed  Optional seed. The same (scale, seed) pair always produces the
 *              same event. Omit for a non-deterministic event.
 */
export function generateEvent(scale = 1, seed?: number | string): GameEvent {
  const rng = new Rng(seed)

  // 15 draws — five colours each for requirement, reward and penalty.
  const x = Array.from({ length: 15 }, () => rng.next())
  // Math.trunc mirrors Python's int() (truncation toward zero); S is always
  // positive here so this is equivalent to flooring.
  const skittle = (i: number): number => Math.trunc(S(x[i]!, scale))

  const fill = (offset: number): SkittleSet => {
    const set = emptySet()
    SKITTLE_COLOURS.forEach((colour, i) => {
      set[colour] = skittle(offset + i)
    })
    return set
  }

  const name = makeName(rng)
  return {
    name,
    description: makeDescription(rng, name),
    requirement: fill(0),
    reward: fill(5),
    penalty: fill(10)
  }
}

/** Total number of skittles referenced by an event (handy for tests/balancing). */
export function eventMagnitude(event: GameEvent): number {
  const sumSet = (s: SkittleSet): number =>
    SKITTLE_COLOURS.reduce((acc, c) => acc + s[c], 0)
  return sumSet(event.requirement) + sumSet(event.reward) + sumSet(event.penalty)
}
