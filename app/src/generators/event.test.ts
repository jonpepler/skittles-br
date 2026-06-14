import { describe, it, expect } from 'vitest'
import {
  generateEvent,
  eventMagnitude,
  SKITTLE_COLOURS,
  EXAMPLE_EVENT,
  type SkittleSet
} from './event.js'

const sections = ['requirement', 'reward', 'penalty'] as const

function expectValidSet(set: SkittleSet): void {
  expect(Object.keys(set).sort()).toEqual([...SKITTLE_COLOURS].sort())
  for (const colour of SKITTLE_COLOURS) {
    expect(Number.isInteger(set[colour])).toBe(true)
    expect(set[colour]).toBeGreaterThanOrEqual(0)
  }
}

describe('generateEvent', () => {
  it('is deterministic: same (scale, seed) yields the same event', () => {
    expect(generateEvent(10, 'evt-1')).toEqual(generateEvent(10, 'evt-1'))
  })

  it('respects the seed (fixing the Python inverted-seed bug)', () => {
    // The Python original always re-randomised, so this would have failed there.
    const a = generateEvent(10, 'fixed-seed')
    const b = generateEvent(10, 'fixed-seed')
    expect(eventMagnitude(a)).toEqual(eventMagnitude(b))
  })

  it('has well-formed requirement/reward/penalty sets', () => {
    const event = generateEvent(25, 'shape')
    for (const section of sections) expectValidSet(event[section])
    expect(typeof event.name).toBe('string')
    expect(event.name.length).toBeGreaterThan(0)
    expect(typeof event.description).toBe('string')
  })

  it('scales magnitude up with the scale parameter', () => {
    // Same seed → same underlying x draws, so larger scale is monotonic.
    const small = eventMagnitude(generateEvent(1, 'scale'))
    const large = eventMagnitude(generateEvent(100, 'scale'))
    expect(large).toBeGreaterThan(small)
  })

  it('defaults scale to 1 and still produces a valid event', () => {
    const event = generateEvent(undefined, 'default-scale')
    for (const section of sections) expectValidSet(event[section])
  })

  it('produces valid events without a seed', () => {
    const event = generateEvent(10)
    for (const section of sections) expectValidSet(event[section])
  })

  it('different seeds (almost always) differ', () => {
    const magnitudes = new Set(
      Array.from({ length: 50 }, (_, i) => eventMagnitude(generateEvent(50, i)))
    )
    expect(magnitudes.size).toBeGreaterThan(1)
  })

  it('EXAMPLE_EVENT matches the documented Python example', () => {
    expect(eventMagnitude(EXAMPLE_EVENT)).toBe(13)
    for (const section of sections) expectValidSet(EXAMPLE_EVENT[section])
  })
})
