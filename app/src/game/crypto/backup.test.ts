// @vitest-environment node
// Uses WebCrypto's SubtleCrypto, which jsdom doesn't implement but Node does.
import { describe, it, expect } from 'vitest'
import { encryptBackup, restoreBackup } from './backup.js'

const peers = ['p1', 'p2', 'p3', 'p4']
const state = JSON.stringify({ roomCode: 'ABCD', players: { p1: { skittles: { red: 3 } } } })

describe('threshold-encrypted backup', () => {
  it('restores the state from a threshold of key shares', async () => {
    const backup = await encryptBackup(state, peers, 2)
    const twoShares = [backup.shares['p1']!, backup.shares['p3']!]
    expect(await restoreBackup(backup, twoShares)).toBe(state)
  })

  it('fails to restore with fewer than the threshold of shares', async () => {
    const backup = await encryptBackup(state, peers, 3)
    // Two shares (threshold 3) reconstruct the wrong key → AES-GCM auth fails.
    await expect(
      restoreBackup(backup, [backup.shares['p1']!, backup.shares['p2']!])
    ).rejects.toThrow()
  })

  it('keeps the ciphertext opaque (not the plaintext)', async () => {
    const backup = await encryptBackup(state, peers, 2)
    expect(backup.ciphertext).not.toContain('skittles')
    expect(Object.keys(backup.shares)).toEqual(peers)
  })
})
