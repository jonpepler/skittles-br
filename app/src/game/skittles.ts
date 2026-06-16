import { SKITTLE_COLOURS, type SkittleColour, type SkittleSet } from '../generators/event.js'
import { Rng } from '../lib/rng.js'

export function emptySkittles(): SkittleSet {
  return { red: 0, orange: 0, yellow: 0, purple: 0, green: 0 }
}

/**
 * Deal an unequal handful of skittles, seeded for determinism. A random total in
 * [min, max] is scattered one at a time across random colours, so distributions
 * come out lumpy — the recurring "this is not fair" allotment from the source
 * game, rather than a tidy even split.
 */
export function dealSkittles(seed: string, min: number, max: number): SkittleSet {
  const rng = new Rng(seed)
  const total = rng.range(min, max)
  const set = emptySkittles()
  for (let i = 0; i < total; i++) set[rng.pick(SKITTLE_COLOURS)]++
  return set
}

export function fromColours(fn: (colour: SkittleColour) => number): SkittleSet {
  const set = emptySkittles()
  for (const colour of SKITTLE_COLOURS) set[colour] = fn(colour)
  return set
}

export function addSkittles(a: SkittleSet, b: SkittleSet): SkittleSet {
  return fromColours((c) => a[c] + b[c])
}

/** Subtract, clamping each colour at zero. */
export function subSkittles(a: SkittleSet, b: SkittleSet): SkittleSet {
  return fromColours((c) => Math.max(0, a[c] - b[c]))
}

/** Whether `a` holds at least `b` of every colour. */
export function canAfford(a: SkittleSet, b: SkittleSet): boolean {
  return SKITTLE_COLOURS.every((c) => a[c] >= b[c])
}

export function isValidSet(s: SkittleSet | null | undefined): s is SkittleSet {
  return !!s && SKITTLE_COLOURS.every((c) => Number.isInteger(s[c]) && s[c] >= 0)
}
