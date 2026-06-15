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

/**
 * The public part of a threshold backup: ciphertext every guest may hold. The
 * index signature keeps it assignable to Trystero's JSON DataPayload.
 */
export interface BackupBlob {
  iv: string
  ciphertext: string
  [key: string]: string
}

export interface GameRoom {
  selfId: PeerId
  sendState: (state: GameState, target?: Target) => void
  setOnState: (cb: (state: GameState, peerId: PeerId) => void) => void
  /** Full (unredacted) state sent only to the failover successor. */
  sendSnapshot: (state: GameState, target?: Target) => void
  setOnSnapshot: (cb: (state: GameState, peerId: PeerId) => void) => void
  sendAction: (action: GameAction, target?: Target) => void
  setOnAction: (cb: (action: GameAction, peerId: PeerId) => void) => void
  /** Threshold failover: the public ciphertext, broadcast to all guests. */
  sendBackup: (blob: BackupBlob, target?: Target) => void
  setOnBackup: (cb: (blob: BackupBlob, peerId: PeerId) => void) => void
  /** Threshold failover: a guest's own encoded key share, sent privately. */
  sendShare: (share: string, target?: Target) => void
  setOnShare: (cb: (share: string, peerId: PeerId) => void) => void
  /** Promotion: the new host asks the other guests for their key shares. */
  sendShareRequest: (target?: Target) => void
  setOnShareRequest: (cb: (peerId: PeerId) => void) => void
  /** Promotion: a guest replies with its stored key share. */
  sendShareResponse: (share: string, target?: Target) => void
  setOnShareResponse: (cb: (share: string, peerId: PeerId) => void) => void
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
  const snapshot = room.makeAction<GameState>('snapshot')
  const action = room.makeAction<GameAction>('action')
  const hello = room.makeAction<number>('hello')
  const backup = room.makeAction<BackupBlob>('backup')
  const share = room.makeAction<string>('share')
  const shareReq = room.makeAction<number>('shareReq')
  const shareResp = room.makeAction<string>('shareResp')

  return {
    selfId,
    sendState: (s, target) => void state.send(s, target ? { target } : undefined),
    setOnState: (cb) => {
      state.onMessage = (data, ctx) => cb(data, ctx.peerId)
    },
    sendSnapshot: (s, target) => void snapshot.send(s, target ? { target } : undefined),
    setOnSnapshot: (cb) => {
      snapshot.onMessage = (data, ctx) => cb(data, ctx.peerId)
    },
    sendAction: (a, target) => void action.send(a, target ? { target } : undefined),
    setOnAction: (cb) => {
      action.onMessage = (data, ctx) => cb(data, ctx.peerId)
    },
    sendHello: (target) => void hello.send(1, target ? { target } : undefined),
    setOnHello: (cb) => {
      hello.onMessage = (_data, ctx) => cb(ctx.peerId)
    },
    sendBackup: (b, target) => void backup.send(b, target ? { target } : undefined),
    setOnBackup: (cb) => {
      backup.onMessage = (data, ctx) => cb(data, ctx.peerId)
    },
    sendShare: (s, target) => void share.send(s, target ? { target } : undefined),
    setOnShare: (cb) => {
      share.onMessage = (data, ctx) => cb(data, ctx.peerId)
    },
    sendShareRequest: (target) => void shareReq.send(1, target ? { target } : undefined),
    setOnShareRequest: (cb) => {
      shareReq.onMessage = (_data, ctx) => cb(ctx.peerId)
    },
    sendShareResponse: (s, target) => void shareResp.send(s, target ? { target } : undefined),
    setOnShareResponse: (cb) => {
      shareResp.onMessage = (data, ctx) => cb(data, ctx.peerId)
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
