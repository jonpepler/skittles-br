/**
 * Procedural civilisation-name generator.
 *
 * The old Node `name-generator` service just picked from a hardcoded list of
 * ~100 names. This rebuilds it as an actual generator that mashes syllables
 * into pronounceable-but-weird roots and dresses them with country-ish
 * qualifiers and suffixes — the "proper fun and weird" generated names that
 * were always the intent. The original list's flavour ("Republic of Amora",
 * "Isle of Rulaand", "Slandskitts Lisiacan", "Northern Kyrgia Rynited") guided
 * the word banks below.
 *
 * Seedable for the peer-to-peer model: e.g. `generateName(`${roomCode}:${pid}`)`
 * gives every peer the same civ name for a given player.
 */
import { Rng } from '../lib/rng.js'

const ONSETS = [
  'b', 'br', 'c', 'ch', 'd', 'dr', 'f', 'fl', 'g', 'gr', 'h', 'j', 'k', 'kr',
  'l', 'm', 'n', 'p', 'pr', 'qu', 'r', 's', 'sl', 'sk', 'st', 'sw', 't', 'tr',
  'ts', 'th', 'v', 'w', 'z', 'zh'
]

const NUCLEI = [
  'a', 'e', 'i', 'o', 'u', 'au', 'ai', 'ia', 'ou', 'eo', 'ya', 'oo', 'ae', 'ue'
]

const CODAS = [
  '', '', 'n', 'r', 's', 'l', 'm', 'ng', 'sk', 'st', 'rn', 'nd', 'th', 'k', 'ts'
]

// Recognisable "country" endings that show up in the original list.
const TAILS = ['', '', '', 'ia', 'land', 'stan', 'mark', 'burg', 'os', 'esh']

const PREFIXES = [
  'Republic of', 'Isle of', 'Northern', 'Southern', 'Central', 'South',
  'North', 'Eastern', 'Western', 'Greater', 'Free State of', 'Grand Duchy of',
  'United', 'Kingdom of'
]

const SUFFIXES = [
  'Territories', 'Lands', 'Republic', 'Island', 'Isles', 'Syndicate',
  'Confederacy', 'Union', 'Dominion', 'Federation'
]

function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1)
}

/** Build one mashed syllable. */
function syllable(rng: Rng): string {
  const onset = rng.bool(0.8) ? rng.pick(ONSETS) : ''
  const nucleus = rng.pick(NUCLEI)
  const coda = rng.pick(CODAS)
  return onset + nucleus + coda
}

/** Build a single root word from 2–3 syllables plus an optional tail. */
function root(rng: Rng): string {
  const count = rng.range(2, 3)
  let word = ''
  for (let i = 0; i < count; i++) word += syllable(rng)
  word += rng.pick(TAILS)
  return capitalise(word)
}

/**
 * Generate one civilisation name.
 *
 * @param seed Optional seed. The same seed always produces the same name. Omit
 *             for a non-deterministic name.
 */
export function generateName(seed?: number | string): string {
  const rng = new Rng(seed)

  // The body is one or (sometimes) two mashed roots.
  let body = root(rng)
  if (rng.bool(0.35)) body += ' ' + root(rng)

  const parts: string[] = []
  if (rng.bool(0.4)) parts.push(rng.pick(PREFIXES))
  parts.push(body)
  // Don't pile a suffix on top of an "X of" prefix — it reads oddly.
  const hasOfPrefix = parts[0]?.endsWith('of') ?? false
  if (!hasOfPrefix && rng.bool(0.4)) parts.push(rng.pick(SUFFIXES))

  return parts.join(' ')
}

/**
 * Generate `count` names from a single base seed. Each name is derived
 * deterministically from `${seed}:${index}`, so the whole set is reproducible.
 */
export function generateNames(count: number, seed?: number | string): string[] {
  const base = seed ?? `${Date.now()}:${Math.random()}`
  return Array.from({ length: count }, (_, i) => generateName(`${base}:${i}`))
}
