import { describe, it, expect } from 'vitest'
import { Rng, normaliseSeed } from './rng.js'

describe('Rng', () => {
  it('is deterministic: same seed yields the same sequence', () => {
    const a = new Rng('seed-1')
    const b = new Rng('seed-1')
    const seqA = Array.from({ length: 20 }, () => a.next())
    const seqB = Array.from({ length: 20 }, () => b.next())
    expect(seqA).toEqual(seqB)
  })

  it('different seeds yield different sequences', () => {
    const a = Array.from({ length: 20 }, ((r) => () => r.next())(new Rng('a')))
    const b = Array.from({ length: 20 }, ((r) => () => r.next())(new Rng('b')))
    expect(a).not.toEqual(b)
  })

  it('treats equal numeric and stringified-numeric seeds the same', () => {
    expect(new Rng(42).next()).toEqual(new Rng('42').next())
  })

  it('next() stays within [0, 1)', () => {
    const rng = new Rng('range')
    for (let i = 0; i < 1000; i++) {
      const v = rng.next()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('int(n) stays within [0, n)', () => {
    const rng = new Rng('int')
    for (let i = 0; i < 1000; i++) {
      const v = rng.int(7)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(7)
      expect(Number.isInteger(v)).toBe(true)
    }
  })

  it('range(min, max) is inclusive on both ends', () => {
    const rng = new Rng('inclusive')
    const seen = new Set<number>()
    for (let i = 0; i < 1000; i++) seen.add(rng.range(3, 6))
    expect([...seen].sort()).toEqual([3, 4, 5, 6])
  })

  it('pick returns an element and throws on empty', () => {
    const rng = new Rng('pick')
    expect(['x', 'y', 'z']).toContain(rng.pick(['x', 'y', 'z']))
    expect(() => rng.pick([])).toThrow()
  })

  it('normaliseSeed produces a 32-bit unsigned int', () => {
    const v = normaliseSeed('anything')
    expect(Number.isInteger(v)).toBe(true)
    expect(v).toBeGreaterThanOrEqual(0)
    expect(v).toBeLessThanOrEqual(0xffffffff)
  })

  it('un-seeded generators are (almost certainly) not identical', () => {
    expect(new Rng().next()).not.toEqual(new Rng().next())
  })
})
