/**
 * Deterministic, seedable pseudo-random number generator.
 *
 * The whole point of porting the old network "services" to bundled modules is
 * that they become pure functions of a seed. In the peer-to-peer model that
 * means peers can share a tiny seed instead of transmitting whole flags or
 * events — every browser computes identical output locally.
 *
 * We use mulberry32 (a small, fast, well-distributed 32-bit generator) with an
 * xmur3 string hash so seeds can be either a number or any string (e.g. a room
 * code + player index).
 */

/** Hash an arbitrary string into a 32-bit unsigned seed. */
function xmur3(str: string): number {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507)
  h = Math.imul(h ^ (h >>> 13), 3266489909)
  return (h ^= h >>> 16) >>> 0
}

/** Normalise a number | string | undefined seed into a 32-bit unsigned int. */
export function normaliseSeed(seed?: number | string): number {
  if (seed === undefined) {
    // No seed: derive a non-deterministic one. Avoid Math.random bias by mixing.
    return xmur3(`${Date.now()}:${Math.random()}`)
  }
  if (typeof seed === 'number') {
    // Fold floats / negatives into a stable 32-bit space.
    return xmur3(String(seed))
  }
  return xmur3(seed)
}

/** A small deterministic RNG with convenience helpers. */
export class Rng {
  private state: number

  constructor(seed?: number | string) {
    this.state = normaliseSeed(seed)
  }

  /** Next float in [0, 1). Equivalent to Math.random(). */
  next(): number {
    let t = (this.state += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /** Integer in [0, maxExclusive). Mirrors Go's rand.Intn / JS Math.floor(r*n). */
  int(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive)
  }

  /** Integer in [min, max] inclusive. */
  range(min: number, max: number): number {
    return min + this.int(max - min + 1)
  }

  /** Pick a uniformly random element from a non-empty array. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick called with empty array')
    return items[this.int(items.length)]!
  }

  /** True with the given probability (default 0.5). */
  bool(probability = 0.5): boolean {
    return this.next() < probability
  }
}
