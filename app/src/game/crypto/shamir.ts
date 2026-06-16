/**
 * Shamir secret sharing over GF(256).
 *
 * Splits a byte secret (here, an encryption key) into `n` shares such that any
 * `k` of them reconstruct it and fewer reveal nothing. This is the basis of the
 * threshold-backup model: the host encrypts the full game state, splits the key
 * across peers, and any k surviving peers can recover it on failover — so no
 * single peer can read the hidden state, and a couple of departures don't lose
 * it.
 */

// GF(256) exp/log tables (AES field, primitive polynomial 0x11b, generator 3).
const EXP = new Uint8Array(512)
const LOG = new Uint8Array(256)
;(() => {
  let x = 1
  for (let i = 0; i < 255; i++) {
    EXP[i] = x
    LOG[x] = i
    // multiply by 3 == xtime(x) ^ x
    const xtime = ((x << 1) ^ (x & 0x80 ? 0x11b : 0)) & 0xff
    x = (xtime ^ x) & 0xff
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]!
})()

function gmul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0
  return EXP[LOG[a]! + LOG[b]!]!
}

function gdiv(a: number, b: number): number {
  if (b === 0) throw new Error('division by zero in GF(256)')
  if (a === 0) return 0
  return EXP[(LOG[a]! - LOG[b]! + 255) % 255]!
}

export interface Share {
  x: number
  y: Uint8Array
}

function evalPoly(coeffs: Uint8Array, x: number): number {
  // Horner's method in GF(256), high-degree coefficient first.
  let result = 0
  for (let i = coeffs.length - 1; i >= 0; i--) {
    result = gmul(result, x) ^ coeffs[i]!
  }
  return result
}

/**
 * Split `secret` into `n` shares with threshold `k` (any k reconstruct).
 * Share x-coordinates are 1..n.
 */
export function split(secret: Uint8Array, n: number, k: number): Share[] {
  if (k < 1 || k > n) throw new Error('require 1 <= k <= n')
  if (n > 255) throw new Error('at most 255 shares')

  const shares: Share[] = Array.from({ length: n }, (_, i) => ({
    x: i + 1,
    y: new Uint8Array(secret.length)
  }))

  const coeffs = new Uint8Array(k)
  for (let b = 0; b < secret.length; b++) {
    coeffs[0] = secret[b]!
    crypto.getRandomValues(coeffs.subarray(1)) // random higher-order coefficients
    for (const share of shares) share.y[b] = evalPoly(coeffs, share.x)
  }
  return shares
}

/** Reconstruct the secret from `shares` (needs at least the threshold count). */
export function combine(shares: Share[]): Uint8Array {
  if (shares.length === 0) throw new Error('no shares')
  const length = shares[0]!.y.length
  const secret = new Uint8Array(length)

  for (let b = 0; b < length; b++) {
    let value = 0
    for (let j = 0; j < shares.length; j++) {
      const xj = shares[j]!.x
      let num = 1
      let den = 1
      for (let m = 0; m < shares.length; m++) {
        if (m === j) continue
        const xm = shares[m]!.x
        num = gmul(num, xm) // interpolate at x = 0
        den = gmul(den, xj ^ xm)
      }
      value ^= gmul(shares[j]!.y[b]!, gdiv(num, den))
    }
    secret[b] = value
  }
  return secret
}
