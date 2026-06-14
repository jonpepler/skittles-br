/**
 * Trystero networking adapter.
 *
 * This is the one irreducible non-static piece: WebRTC peers need a broker to
 * exchange signaling before connecting directly. Trystero handles that over
 * public infrastructure (here, Nostr relays) so there's no server we host —
 * which is what makes a GitHub Pages deploy viable.
 *
 * The adapter is intentionally thin: it maps Trystero's API to typed
 * send/receive helpers for our three message kinds (state, action, hello).
 * All game logic lives in ../game/state.ts so it can be tested without a
 * network.
 */
import { joinRoom, selfId } from 'trystero/nostr'
import type { GameAction, GameState } from '../game/types.js'

const APP_ID = 'skittles-br'

export type PeerId = string
export type Target = PeerId | PeerId[]

export interface GameRoom {
  selfId: PeerId
  sendState: (state: GameState, target?: Target) => void
  setOnState: (cb: (state: GameState, peerId: PeerId) => void) => void
  sendAction: (action: GameAction, target?: Target) => void
  setOnAction: (cb: (action: GameAction, peerId: PeerId) => void) => void
  /** Late-joiner handshake: a guest pings the host to request current state. */
  sendHello: (target?: Target) => void
  setOnHello: (cb: (peerId: PeerId) => void) => void
  setOnPeerJoin: (cb: (peerId: PeerId) => void) => void
  setOnPeerLeave: (cb: (peerId: PeerId) => void) => void
  leave: () => void
}

export function joinGameRoom(roomCode: string): GameRoom {
  const room = joinRoom({ appId: APP_ID }, roomCode)
  const state = room.makeAction<GameState>('state')
  const action = room.makeAction<GameAction>('action')
  const hello = room.makeAction<number>('hello')

  return {
    selfId,
    sendState: (s, target) => void state.send(s, target ? { target } : undefined),
    setOnState: (cb) => {
      state.onMessage = (data, ctx) => cb(data, ctx.peerId)
    },
    sendAction: (a, target) => void action.send(a, target ? { target } : undefined),
    setOnAction: (cb) => {
      action.onMessage = (data, ctx) => cb(data, ctx.peerId)
    },
    sendHello: (target) => void hello.send(1, target ? { target } : undefined),
    setOnHello: (cb) => {
      hello.onMessage = (_data, ctx) => cb(ctx.peerId)
    },
    setOnPeerJoin: (cb) => {
      room.onPeerJoin = cb
    },
    setOnPeerLeave: (cb) => {
      room.onPeerLeave = cb
    },
    leave: () => void room.leave()
  }
}
