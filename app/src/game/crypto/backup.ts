/**
 * Threshold-encrypted state backup.
 *
 * The host encrypts the full game state under a fresh AES-GCM key, then splits
 * that key into one Shamir share per peer (threshold `k`). The ciphertext is
 * public (any peer may hold it), but it can only be decrypted once `k` peers
 * pool their shares — so the live host stays the only party that sees the
 * plaintext, yet failover survives losing a few peers, with no single
 * "successor" able to peek.
 *
 * This module is the cryptographic core; wiring the share-collection handshake
 * into the live failover path is the remaining step.
 */
import { combine, split, type Share } from './shamir.js'

const KEY_BYTES = 32
const IV_BYTES = 12

export interface EncryptedBackup {
  iv: string
  ciphertext: string
  /** peerId → encoded key share ("x:base64(y)"). */
  shares: Record<string, string>
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

function fromBase64(text: string): Uint8Array {
  const binary = atob(text)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function encodeShare(share: Share): string {
  return `${share.x}:${toBase64(share.y)}`
}

function decodeShare(text: string): Share {
  const idx = text.indexOf(':')
  return { x: Number(text.slice(0, idx)), y: fromBase64(text.slice(idx + 1)) }
}

/** Encrypt `plaintext` and split the key across `peerIds` with threshold `k`. */
export async function encryptBackup(
  plaintext: string,
  peerIds: string[],
  threshold: number
): Promise<EncryptedBackup> {
  const keyBytes = crypto.getRandomValues(new Uint8Array(KEY_BYTES))
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes as BufferSource,
    'AES-GCM',
    false,
    ['encrypt']
  )
  const encoded = new TextEncoder().encode(plaintext)
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      encoded as BufferSource
    )
  )

  const keyShares = split(keyBytes, peerIds.length, threshold)
  const shares: Record<string, string> = {}
  peerIds.forEach((id, i) => {
    shares[id] = encodeShare(keyShares[i]!)
  })

  return { iv: toBase64(iv), ciphertext: toBase64(cipher), shares }
}

/** Reconstruct the plaintext from the ciphertext and at least `k` key shares. */
export async function restoreBackup(
  backup: EncryptedBackup,
  encodedShares: string[]
): Promise<string> {
  const keyBytes = combine(encodedShares.map(decodeShare))
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes as BufferSource,
    'AES-GCM',
    false,
    ['decrypt']
  )
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(backup.iv) as BufferSource },
    key,
    fromBase64(backup.ciphertext) as BufferSource
  )
  return new TextDecoder().decode(plain)
}
