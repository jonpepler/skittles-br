import { describe, it, expect } from 'vitest'
import { makeRoomCode, normaliseRoomCode, ROOM_CODE_ALPHABET } from './roomCode.js'

describe('makeRoomCode', () => {
  it('has the requested length (default 4)', () => {
    expect(makeRoomCode()).toHaveLength(4)
    expect(makeRoomCode(6)).toHaveLength(6)
  })

  it('uses only unambiguous alphanumeric characters', () => {
    const allowed = new Set(ROOM_CODE_ALPHABET)
    for (let i = 0; i < 200; i++) {
      for (const ch of makeRoomCode(8)) expect(allowed.has(ch)).toBe(true)
    }
  })

  it('is (almost certainly) not constant', () => {
    const codes = new Set(Array.from({ length: 100 }, () => makeRoomCode()))
    expect(codes.size).toBeGreaterThan(90)
  })
})

describe('normaliseRoomCode', () => {
  it('trims, uppercases and strips noise', () => {
    expect(normaliseRoomCode('  a7kp ')).toBe('A7KP')
    expect(normaliseRoomCode('a7-k p!')).toBe('A7KP')
  })
})
