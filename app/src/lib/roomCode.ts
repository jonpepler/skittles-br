// Unambiguous alphabet — no 0/O/1/I to avoid confusion when sharing codes.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** Generate a short, shareable, unambiguous room code. */
export function makeRoomCode(length = 5): string {
  const values = new Uint32Array(length)
  crypto.getRandomValues(values)
  let out = ''
  for (let i = 0; i < length; i++) {
    out += ALPHABET[values[i]! % ALPHABET.length]
  }
  return out
}

/** Normalise user-entered codes (trim + uppercase). */
export function normaliseRoomCode(input: string): string {
  return input.trim().toUpperCase()
}
