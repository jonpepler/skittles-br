import { describe, it, expect } from 'vitest'
import { makeRoomCode, normaliseRoomCode, ROOM_CODE_WORDS } from './roomCode.js'

describe('makeRoomCode', () => {
  it('produces three lowercase words joined by hyphens', () => {
    for (let i = 0; i < 100; i++) {
      expect(makeRoomCode()).toMatch(/^[a-z]+-[a-z]+-[a-z]+$/)
    }
  })

  it('honours a custom word count', () => {
    expect(makeRoomCode(2).split('-')).toHaveLength(2)
    expect(makeRoomCode(4).split('-')).toHaveLength(4)
  })

  it('only uses words from the list', () => {
    const allowed = new Set(ROOM_CODE_WORDS)
    for (const word of makeRoomCode(4).split('-')) {
      expect(allowed.has(word)).toBe(true)
    }
  })

  it('is (almost certainly) not constant', () => {
    const codes = new Set(Array.from({ length: 100 }, () => makeRoomCode()))
    expect(codes.size).toBeGreaterThan(90)
  })
})

describe('normaliseRoomCode', () => {
  it('lowercases and turns spaces into hyphens', () => {
    expect(normaliseRoomCode('  Brave Otter Maple ')).toBe('brave-otter-maple')
  })

  it('collapses repeats and strips stray characters', () => {
    expect(normaliseRoomCode('amber__otter--canyon!')).toBe('amber-otter-canyon')
  })

  it('accepts an already-valid code unchanged', () => {
    expect(normaliseRoomCode('amber-otter-canyon')).toBe('amber-otter-canyon')
  })
})
