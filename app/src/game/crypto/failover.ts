/**
 * Pure helpers for the threshold host-failover handshake.
 *
 * The host encrypts the full game state and hands each guest a Shamir share of
 * the key (see ./backup.ts). When the host leaves, the lowest-id remaining peer
 * collects shares from the others and reconstructs the state. This module holds
 * the side-effect-free decisions involved so they can be unit-tested without a
 * network or a browser: how big a threshold to use, who gets which share, and
 * turning a bag of collected shares into a restored plaintext.
 */
import { restoreBackup } from './backup.js'

/** The public half of a backup: enough for restoreBackup given key shares. */
export interface BackupBlob {
  iv: string
  ciphertext: string
}

/**
 * The Shamir threshold to use given the number of guests (everyone except the
 * host). Any 2 guests should be able to reconstruct, but with a single guest we
 * fall back to k=1 (that lone guest is the only possible successor anyway).
 */
export function thresholdFor(guestCount: number): number {
  return Math.min(guestCount, 2)
}

/** Whether threshold backup is worthwhile: it needs at least one guest. */
export function shouldBackup(guestCount: number): boolean {
  return guestCount > 0
}

/**
 * Whether the WebCrypto SubtleCrypto API is available. jsdom (the unit-test
 * env) lacks it, so callers must guard every encrypt/decrypt behind this and
 * fall back to the plaintext-snapshot path.
 */
export function cryptoAvailable(): boolean {
  return typeof crypto !== 'undefined' && !!crypto.subtle
}

/**
 * Collapse a map of peerId → encoded share (plus the promoter's own share) into
 * the distinct list `restoreBackup` expects. De-dupes by encoded value so a
 * peer echoing a share twice doesn't inflate the count.
 */
export function collectShares(
  ownShare: string | null,
  received: Iterable<string>
): string[] {
  const seen = new Set<string>()
  if (ownShare) seen.add(ownShare)
  for (const share of received) seen.add(share)
  return [...seen]
}

/**
 * Attempt to reconstruct the plaintext backup from collected shares. Returns
 * `null` (rather than throwing) when there aren't enough shares or decryption
 * fails, so the caller can fall back to its other recovery path.
 */
export async function tryRestore(
  backup: BackupBlob | null,
  shares: string[],
  threshold: number
): Promise<string | null> {
  if (!backup) return null
  if (shares.length < threshold) return null
  try {
    // restoreBackup only reads iv/ciphertext; shares come from the args.
    return await restoreBackup({ ...backup, shares: {} }, shares)
  } catch {
    return null
  }
}
