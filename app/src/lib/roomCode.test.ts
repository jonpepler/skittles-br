import { describe, it, expect } from 'vitest'
import { makeRoomCode, normaliseRoomCode } from './roomCode.js'

describe('makeRoomCode', () => {
  it('has the requested length (default 5)', () => {
    expect(makeRoomCode()).toHaveLength(5)
    expect(makeRoomCode(8)).toHaveLength(8)
  })

  it('uses only unambiguous uppercase characters', () => {
    for (let i = 0; i < 200; i++) {
      expect(makeRoomCode(10)).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/)
    }
  })

  it('is (almost certainly) not constant', () => {
    const codes = new Set(Array.from({ length: 100 }, () => makeRoomCode()))
    expect(codes.size).toBeGreaterThan(90)
  })
})

describe('normaliseRoomCode', () => {
  it('trims and uppercases', () => {
    expect(normaliseRoomCode('  abc4e ')).toBe('ABC4E')
  })
})
