import { describe, it, expect } from 'vitest'
import { buildJoinUrl, parseRoomCode } from './joinLink.js'

describe('buildJoinUrl', () => {
  it('builds a link under the base path', () => {
    expect(buildJoinUrl('https://x.io', '/skittles-br/', 'A7KP')).toBe(
      'https://x.io/skittles-br/?room=A7KP'
    )
  })

  it('tolerates a base path without a trailing slash', () => {
    expect(buildJoinUrl('https://x.io', '/app', 'A7KP')).toBe('https://x.io/app/?room=A7KP')
  })
})

describe('parseRoomCode', () => {
  it('round-trips with buildJoinUrl', () => {
    const url = buildJoinUrl('https://x.io', '/skittles-br/', 'A7KP')
    expect(parseRoomCode(new URL(url).search)).toBe('A7KP')
  })

  it('normalises the extracted code', () => {
    expect(parseRoomCode('?room=a7kp')).toBe('A7KP')
  })

  it('returns null when absent or empty', () => {
    expect(parseRoomCode('')).toBeNull()
    expect(parseRoomCode('?foo=bar')).toBeNull()
    expect(parseRoomCode('?room=')).toBeNull()
  })
})
