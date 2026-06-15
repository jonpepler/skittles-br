import { describe, it, expect } from 'vitest'
import { buildJoinUrl, parseRoomCode } from './joinLink.js'

describe('buildJoinUrl', () => {
  it('builds a link under the base path', () => {
    expect(buildJoinUrl('https://x.io', '/skittles-br/', 'amber-otter-canyon')).toBe(
      'https://x.io/skittles-br/?room=amber-otter-canyon'
    )
  })

  it('tolerates a base path without a trailing slash', () => {
    expect(buildJoinUrl('https://x.io', '/app', 'a-b-c')).toBe('https://x.io/app/?room=a-b-c')
  })
})

describe('parseRoomCode', () => {
  it('round-trips with buildJoinUrl', () => {
    const url = buildJoinUrl('https://x.io', '/skittles-br/', 'amber-otter-canyon')
    expect(parseRoomCode(new URL(url).search)).toBe('amber-otter-canyon')
  })

  it('normalises the extracted code', () => {
    expect(parseRoomCode('?room=Amber%20Otter%20Canyon')).toBe('amber-otter-canyon')
  })

  it('returns null when absent or empty', () => {
    expect(parseRoomCode('')).toBeNull()
    expect(parseRoomCode('?foo=bar')).toBeNull()
    expect(parseRoomCode('?room=')).toBeNull()
  })
})
