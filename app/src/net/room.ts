/**
 * Networking adapter.
 *
 * The game talks to a transport-agnostic `GameRoom`. In production the transport
 * is Trystero (WebRTC, brokered over public Nostr relays — the one irreducible
 * non-static piece). For automated multi-peer tests, where external relays
 * aren't reachable, a `BroadcastChannel` transport lets pages in the same
 * browser actually connect — exercising the real app, game logic and crypto
 * without a network. Selected at runtime (see `chooseTransport`).
 *
 * All game logic lives in ../game/state.ts so it can be tested without any
 * transport at all.
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

/** A named message channel between peers. */
export interface Channel<T> {
  send: (data: T, target?: Target) => void
  onMessage: (cb: (data: T, peerId: PeerId) => void) => void
}

/** The low-level transport the GameRoom is built on. */
export interface Transport {
  selfId: PeerId
  channel: <T>(name: string) => Channel<T>
  onPeerJoin: (cb: (peerId: PeerId) => void) => void
  onPeerLeave: (cb: (peerId: PeerId) => void) => void
  leave: () => void
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

/** Wire the named game channels over any transport. */
function buildGameRoom(t: Transport): GameRoom {
  const state = t.channel<GameState>('state')
  const snapshot = t.channel<GameState>('snapshot')
  const action = t.channel<GameAction>('action')
  const hello = t.channel<number>('hello')
  const backup = t.channel<BackupBlob>('backup')
  const share = t.channel<string>('share')
  const shareReq = t.channel<number>('shareReq')
  const shareResp = t.channel<string>('shareResp')

  return {
    selfId: t.selfId,
    sendState: (s, target) => state.send(s, target),
    setOnState: (cb) => state.onMessage(cb),
    sendSnapshot: (s, target) => snapshot.send(s, target),
    setOnSnapshot: (cb) => snapshot.onMessage(cb),
    sendAction: (a, target) => action.send(a, target),
    setOnAction: (cb) => action.onMessage(cb),
    sendBackup: (b, target) => backup.send(b, target),
    setOnBackup: (cb) => backup.onMessage(cb),
    sendShare: (s, target) => share.send(s, target),
    setOnShare: (cb) => share.onMessage(cb),
    sendShareRequest: (target) => shareReq.send(1, target),
    setOnShareRequest: (cb) => shareReq.onMessage((_d, peer) => cb(peer)),
    sendShareResponse: (s, target) => shareResp.send(s, target),
    setOnShareResponse: (cb) => shareResp.onMessage(cb),
    sendHello: (target) => hello.send(1, target),
    setOnHello: (cb) => hello.onMessage((_d, peer) => cb(peer)),
    setOnPeerJoin: (cb) => t.onPeerJoin(cb),
    setOnPeerLeave: (cb) => t.onPeerLeave(cb),
    leave: () => t.leave()
  }
}

function trysteroTransport(roomCode: string): Transport {
  const room = joinRoom({ appId: APP_ID }, roomCode)
  return {
    selfId,
    channel: <T>(name: string): Channel<T> => {
      const a = room.makeAction<any>(name)
      return {
        send: (data: T, target?: Target) => void a.send(data, target ? { target } : undefined),
        onMessage: (cb) => {
          a.onMessage = (data: T, ctx: { peerId: PeerId }) => cb(data, ctx.peerId)
        }
      }
    },
    onPeerJoin: (cb) => {
      room.onPeerJoin = cb
    },
    onPeerLeave: (cb) => {
      room.onPeerLeave = cb
    },
    leave: () => void room.leave()
  }
}

type LocalMsg =
  | { kind: 'msg'; channel: string; from: PeerId; to: PeerId[] | null; data: unknown }
  | { kind: 'beat'; from: PeerId }
  | { kind: 'bye'; from: PeerId }

/**
 * Same-browser transport over BroadcastChannel, for multi-page e2e tests. Peer
 * presence is tracked with heartbeats so a closed page is detected by timeout
 * (which is what drives the failover test). Not used in production.
 */
function localTransport(roomCode: string): Transport {
  const selfId = Math.random().toString(36).slice(2, 10)
  const bc = new BroadcastChannel(`skittles-room-${roomCode}`)
  const listeners = new Map<string, (data: unknown, peerId: PeerId) => void>()
  const pending = new Map<string, Array<[unknown, PeerId]>>()
  const lastSeen = new Map<PeerId, number>()
  const pendingJoins: PeerId[] = []
  let onJoin: ((p: PeerId) => void) | null = null
  let onLeave: ((p: PeerId) => void) | null = null

  const HEARTBEAT = 400
  const TIMEOUT = 1600

  const discover = (p: PeerId): void => {
    if (lastSeen.has(p)) return
    lastSeen.set(p, Date.now())
    if (onJoin) onJoin(p)
    else pendingJoins.push(p)
    bc.postMessage({ kind: 'beat', from: selfId } satisfies LocalMsg) // reply so they learn us
  }

  bc.onmessage = (ev: MessageEvent<LocalMsg>) => {
    const m = ev.data
    if (!m || m.from === selfId) return
    if (m.kind === 'beat') {
      if (lastSeen.has(m.from)) lastSeen.set(m.from, Date.now())
      else discover(m.from)
      return
    }
    if (m.kind === 'bye') {
      if (lastSeen.delete(m.from)) onLeave?.(m.from)
      return
    }
    if (m.to && !m.to.includes(selfId)) return
    const cb = listeners.get(m.channel)
    if (cb) cb(m.data, m.from)
    else {
      const buf = pending.get(m.channel) ?? []
      buf.push([m.data, m.from])
      pending.set(m.channel, buf)
    }
  }

  bc.postMessage({ kind: 'beat', from: selfId } satisfies LocalMsg)
  const beat = setInterval(
    () => bc.postMessage({ kind: 'beat', from: selfId } satisfies LocalMsg),
    HEARTBEAT
  )
  const prune = setInterval(() => {
    const now = Date.now()
    for (const [p, seen] of [...lastSeen]) {
      if (now - seen > TIMEOUT) {
        lastSeen.delete(p)
        onLeave?.(p)
      }
    }
  }, 500)
  const bye = (): void => bc.postMessage({ kind: 'bye', from: selfId } satisfies LocalMsg)
  if (typeof addEventListener !== 'undefined') addEventListener('pagehide', bye)

  return {
    selfId,
    channel: <T>(name: string): Channel<T> => ({
      send: (data: T, target?: Target) => {
        const to = target == null ? null : Array.isArray(target) ? target : [target]
        bc.postMessage({ kind: 'msg', channel: name, from: selfId, to, data } satisfies LocalMsg)
      },
      onMessage: (cb) => {
        listeners.set(name, cb as (d: unknown, p: PeerId) => void)
        const buf = pending.get(name)
        if (buf) {
          pending.delete(name)
          for (const [d, p] of buf) cb(d as T, p)
        }
      }
    }),
    onPeerJoin: (cb) => {
      onJoin = cb
      for (const p of pendingJoins.splice(0)) cb(p)
    },
    onPeerLeave: (cb) => {
      onLeave = cb
    },
    leave: () => {
      bye()
      clearInterval(beat)
      clearInterval(prune)
      if (typeof removeEventListener !== 'undefined') removeEventListener('pagehide', bye)
      bc.close()
    }
  }
}

/** Use the local transport when flagged (set by e2e tests before load). */
function chooseTransport(roomCode: string): Transport {
  const flagged =
    (typeof globalThis !== 'undefined' &&
      (globalThis as { __SKITTLES_TRANSPORT__?: string }).__SKITTLES_TRANSPORT__ === 'local') ||
    (() => {
      try {
        return new URLSearchParams(location.search).get('transport') === 'local'
      } catch {
        return false
      }
    })()
  return flagged ? localTransport(roomCode) : trysteroTransport(roomCode)
}

export function joinGameRoom(roomCode: string): GameRoom {
  return buildGameRoom(chooseTransport(roomCode))
}
