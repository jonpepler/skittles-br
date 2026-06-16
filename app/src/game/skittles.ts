import { SKITTLE_COLOURS, type SkittleColour, type SkittleSet } from '../generators/event.js'

export function emptySkittles(): SkittleSet {
  return { red: 0, orange: 0, yellow: 0, purple: 0, green: 0 }
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
