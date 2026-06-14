import { describe, it, expect } from 'vitest'
import { generateName, generateNames } from './name.js'

describe('generateName', () => {
  it('is deterministic: same seed yields the same name', () => {
    expect(generateName('player-1')).toEqual(generateName('player-1'))
  })

  it('produces a non-empty string of letters and spaces only', () => {
    for (let i = 0; i < 200; i++) {
      const name = generateName(i)
      expect(name.length).toBeGreaterThan(0)
      // Letters and single spaces (qualifiers like "Republic of" included).
      expect(name).toMatch(/^[A-Za-z]+( [A-Za-z]+)*$/)
    }
  })

  it('every word is capitalised', () => {
    for (let i = 0; i < 100; i++) {
      const name = generateName(`cap-${i}`)
      // "of" is the one intentional lowercase connector (e.g. "Republic of X").
      for (const word of name.split(' ')) {
        if (word === 'of') continue
        expect(word[0]).toEqual(word[0]!.toUpperCase())
      }
    }
  })

  it('generates plenty of variety across seeds', () => {
    const names = new Set(Array.from({ length: 200 }, (_, i) => generateName(i)))
    expect(names.size).toBeGreaterThan(150)
  })

  it('never stacks a suffix onto an "... of" prefix', () => {
    for (let i = 0; i < 500; i++) {
      const name = generateName(`of-${i}`)
      // If it opens with "<Word> of", it must be exactly prefix + one body word.
      if (/^(Republic|Isle|Free State|Grand Duchy|Kingdom) of /.test(name)) {
        const trailing = name.split(' of ')[1]!
        expect(trailing.split(' ').length).toBeLessThanOrEqual(2)
      }
    }
  })
})

describe('generateNames', () => {
  it('returns the requested count', () => {
    expect(generateNames(12, 'lobby').length).toBe(12)
  })

  it('is deterministic from a base seed', () => {
    expect(generateNames(12, 'lobby')).toEqual(generateNames(12, 'lobby'))
  })

  it('derives distinct names within a set', () => {
    const names = generateNames(50, 'distinct')
    // Derived from `${seed}:${index}` so collisions should be rare.
    expect(new Set(names).size).toBeGreaterThan(45)
  })
})
