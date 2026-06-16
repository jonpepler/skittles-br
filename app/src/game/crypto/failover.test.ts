// @vitest-environment node
// tryRestore reaches restoreBackup → SubtleCrypto, which jsdom lacks but Node has.
import { describe, it, expect } from 'vitest'
import { encryptBackup } from './backup.js'
import {
  collectShares,
  shouldBackup,
  thresholdFor,
  tryRestore
} from './failover.js'

describe('thresholdFor', () => {
  it('uses 2 once there are at least two guests', () => {
    expect(thresholdFor(2)).toBe(2)
    expect(thresholdFor(3)).toBe(2)
    expect(thresholdFor(5)).toBe(2)
  })
  it('falls back to 1 for a single guest', () => {
    expect(thresholdFor(1)).toBe(1)
  })
  it('is 0 with no guests', () => {
    expect(thresholdFor(0)).toBe(0)
  })
})

describe('shouldBackup', () => {
  it('skips when there are no guests', () => {
    expect(shouldBackup(0)).toBe(false)
  })
  it('backs up with one or more guests', () => {
    expect(shouldBackup(1)).toBe(true)
    expect(shouldBackup(4)).toBe(true)
  })
})

describe('collectShares', () => {
  it('includes the promoter own share and de-dupes', () => {
    expect(collectShares('a', ['b', 'c'])).toEqual(['a', 'b', 'c'])
    expect(collectShares('a', ['a', 'b'])).toEqual(['a', 'b'])
    expect(collectShares(null, ['b', 'b', 'c'])).toEqual(['b', 'c'])
  })
})

describe('tryRestore', () => {
  const peers = ['p1', 'p2', 'p3']
  const state = JSON.stringify({ roomCode: 'ABCD', hostId: 'p1' })

  it('restores with a threshold of shares', async () => {
    const backup = await encryptBackup(state, peers, 2)
    const shares = collectShares(backup.shares['p1']!, [backup.shares['p3']!])
    expect(await tryRestore(backup, shares, 2)).toBe(state)
  })

  it('returns null below the threshold without throwing', async () => {
    const backup = await encryptBackup(state, peers, 2)
    expect(await tryRestore(backup, [backup.shares['p1']!], 2)).toBeNull()
  })

  it('returns null when shares reconstruct the wrong key', async () => {
    const backup = await encryptBackup(state, peers, 3)
    // Two shares for a threshold-3 secret → wrong key → AES-GCM auth fails.
    const shares = [backup.shares['p1']!, backup.shares['p2']!]
    expect(await tryRestore(backup, shares, 2)).toBeNull()
  })

  it('returns null with no backup', async () => {
    expect(await tryRestore(null, ['a', 'b'], 2)).toBeNull()
  })
})
