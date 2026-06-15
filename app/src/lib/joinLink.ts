import { normaliseRoomCode } from './roomCode.js'

/**
 * Build a shareable join URL for a room code, e.g.
 * https://user.github.io/skittles-br/?room=amber-otter-canyon
 */
export function buildJoinUrl(origin: string, basePath: string, code: string): string {
  const base = basePath.endsWith('/') ? basePath : `${basePath}/`
  return `${origin}${base}?room=${encodeURIComponent(code)}`
}

/** Extract and normalise a room code from a URL query string, if present. */
export function parseRoomCode(search: string): string | null {
  const room = new URLSearchParams(search).get('room')
  if (!room) return null
  const normalised = normaliseRoomCode(room)
  return normalised || null
}
