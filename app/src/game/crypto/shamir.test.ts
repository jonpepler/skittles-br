import { describe, it, expect } from 'vitest'
import { split, combine } from './shamir.js'

// Compare via plain arrays — under jsdom, TextEncoder's Uint8Array is from a
// different realm than the module's, so toEqual on the typed arrays themselves
// gives false negatives even when the bytes match.
const secret = Array.from(new TextEncoder().encode('a-skittles-encryption-key-32-byte'))
const bytes = Uint8Array.from(secret)

describe('Shamir secret sharing', () => {
  it('reconstructs from exactly the threshold number of shares', () => {
    const shares = split(bytes, 5, 3)
    expect(Array.from(combine(shares.slice(0, 3)))).toEqual(secret)
  })

  it('reconstructs from any subset of at least k shares', () => {
    const shares = split(bytes, 5, 3)
    expect(Array.from(combine([shares[0]!, shares[2]!, shares[4]!]))).toEqual(secret)
    expect(Array.from(combine(shares))).toEqual(secret) // all five
  })

  it('does not reveal the secret with fewer than k shares', () => {
    const shares = split(bytes, 5, 3)
    expect(Array.from(combine(shares.slice(0, 2)))).not.toEqual(secret)
  })

  it('rejects invalid thresholds', () => {
    expect(() => split(bytes, 3, 4)).toThrow()
  })
})
