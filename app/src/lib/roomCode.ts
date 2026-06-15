// Unambiguous alphanumeric alphabet — no 0/O/1/I to keep codes easy to read
// and type. Four characters gives ~1M combinations.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** Generate a short alphanumeric room code, e.g. "A7KP". */
export function makeRoomCode(length = 4): string {
  const values = new Uint32Array(length)
  crypto.getRandomValues(values)
  let out = ''
  for (let i = 0; i < length; i++) {
    out += ALPHABET[values[i]! % ALPHABET.length]
  }
  return out
}

/** Normalise a user-entered code: trim, uppercase, strip non-alphanumerics. */
export function normaliseRoomCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export { ALPHABET as ROOM_CODE_ALPHABET }
