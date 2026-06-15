import { useCallback, useEffect, useRef, useState } from 'react'
import { joinGameRoom, type BackupBlob, type GameRoom, type PeerId } from '../net/room.js'
import {
  addPlayer,
  applyAction,
  canStart as canStartGame,
  createGame,
  electHost,
  migrateHost,
  redactStateFor,
  removePlayer
} from '../game/state.js'
import type { GameAction, GameState, Role } from '../game/types.js'
import type { Transfer } from '../game/contracts.js'
import type { SkittleColour, SkittleSet } from '../generators/event.js'
import { encryptBackup } from '../game/crypto/backup.js'
import {
  collectShares,
  cryptoAvailable,
  shouldBackup,
  thresholdFor,
  tryRestore
} from '../game/crypto/failover.js'

/** How long the promoter waits to gather key shares before falling back. */
const SHARE_COLLECT_MS = 3000

/**
 * Host: encrypt the full state and hand each guest its own key share, with the
 * public ciphertext sent to every guest. Fire-and-forget; never blocks the
 * caller. No-op when crypto is unavailable or there are no guests, leaving the
 * legacy plaintext snapshot as the only failover path.
 */
function distributeBackup(room: GameRoom, full: GameState, guests: PeerId[]): void {
  if (!cryptoAvailable() || !shouldBackup(guests.length)) return
  const k = thresholdFor(guests.length)
  void encryptBackup(JSON.stringify(full), guests, k)
    .then((backup) => {
      const blob: BackupBlob = { iv: backup.iv, ciphertext: backup.ciphertext }
      for (const guest of guests) {
        room.sendBackup(blob, guest)
        const ownShare = backup.shares[guest]
        if (ownShare) room.sendShare(ownShare, guest)
      }
    })
    .catch(() => {
      /* fall back to the snapshot path */
    })
}

export interface GameRoomApi {
  /** The state as this player is allowed to see it (neighbours' skittles only). */
  state: GameState | null
  selfId: PeerId | null
  connected: boolean
  isHost: boolean
  canStart: boolean
  incrementSkittle: (colour: SkittleColour) => void
  start: () => void
  reset: () => void
  triggerEvent: () => void
  setEventDuration: (seconds: number) => void
  setRounds: (rounds: number) => void
  setVisibility: (hideNonNeighbours: boolean) => void
  proposeTrade: (to: string, give: SkittleSet, receive: SkittleSet) => void
  acceptTrade: (offerId: string) => void
  cancelTrade: (offerId: string) => void
  proposeContract: (
    parties: string[],
    onSign: Transfer[],
    onEvent: Transfer[],
    onReceive: Transfer[],
    onEliminate: Transfer[],
    expiresRound: number | null
  ) => void
  signContract: (contractId: string) => void
  reviseContract: (
    contractId: string,
    parties: string[],
    onSign: Transfer[],
    onEvent: Transfer[],
    onReceive: Transfer[],
    onEliminate: Transfer[],
    expiresRound: number | null
  ) => void
  cancelContract: (contractId: string) => void
}

/**
 * Join a game room and expose the live (redacted) state plus the actions a
 * player can take.
 *
 * Authority is dynamic: the lowest-id connected peer is host. The host holds
 * the full authoritative state, but sends every peer only a *redacted* view
 * (their own + neighbours' skittles). To keep host failover working despite
 * redaction, the host encrypts the full state and splits the key across the
 * guests (Shamir threshold k = min(guests, 2)): every guest holds the public
 * ciphertext and its own key share, but no single guest can decrypt. When the
 * host leaves, the lowest-id remaining peer collects shares from the others,
 * reconstructs the state, and promotes itself.
 *
 * `crypto.subtle` is unavailable under jsdom (the unit-test env) and may be
 * absent on insecure origins, so the host also keeps the legacy single-
 * successor plaintext snapshot as a fallback path; promotion uses it when
 * threshold reconstruction can't run or doesn't gather enough shares in time.
 */
export function useGameRoom(roomCode: string, role: Role): GameRoomApi {
  const [state, setState] = useState<GameState | null>(null)
  const [isHost, setIsHostState] = useState(role === 'host')
  const [connected, setConnected] = useState(false)

  const roomRef = useRef<GameRoom | null>(null)
  const selfIdRef = useRef<PeerId | null>(null)
  const fullRef = useRef<GameState | null>(null) // authoritative (host) / snapshot backup
  const viewRef = useRef<GameState | null>(null) // last redacted view (guest fallback)
  const peersRef = useRef<Set<PeerId>>(new Set())
  const isHostRef = useRef(role === 'host')
  // Threshold-failover state held by guests: the public ciphertext and this
  // guest's own encoded key share. A guest can't decrypt alone.
  const backupRef = useRef<BackupBlob | null>(null)
  const shareRef = useRef<string | null>(null)
  // Shares the promoter is currently gathering, keyed by responder peer id.
  const collectingRef = useRef<Map<PeerId, string> | null>(null)

  useEffect(() => {
    const room = joinGameRoom(roomCode)
    roomRef.current = room
    selfIdRef.current = room.selfId
    peersRef.current = new Set()

    const self = room.selfId

    const setHost = (value: boolean): void => {
      isHostRef.current = value
      setIsHostState(value)
    }
    /** Host: store full state, render own redacted view, send everyone theirs. */
    const publish = (full: GameState): void => {
      fullRef.current = full
      setState(redactStateFor(full, self))
      const guests = [...peersRef.current]
      for (const peer of guests) {
        room.sendState(redactStateFor(full, peer), peer)
      }
      // Legacy single-successor plaintext snapshot: the failover fallback.
      const successor = electHost(guests)
      if (successor) room.sendSnapshot(full, successor)
      // Preferred path: distribute encrypted threshold shares to all guests.
      distributeBackup(room, full, guests)
    }
    const applyAsHost = (senderId: PeerId, action: GameAction): void => {
      if (!isHostRef.current || !fullRef.current) return
      publish(applyAction(fullRef.current, senderId, action))
    }

    if (role === 'host') {
      setHost(true)
      publish(addPlayer(createGame(roomCode, self), self))
    } else {
      setHost(false)
    }

    room.setOnState((view, peerId) => {
      if (isHostRef.current) {
        // Split-brain resolution: yield only to a more senior (lower id) host.
        if (peerId < self) {
          setHost(false)
          fullRef.current = null
        } else {
          return
        }
      }
      viewRef.current = view
      setState(view)
    })

    // Only the successor receives this; keep it as the failover backup.
    room.setOnSnapshot((full) => {
      if (!isHostRef.current) fullRef.current = full
    })

    // Guests cache the public ciphertext and their own key share. They can't
    // decrypt alone; the share is pooled with others on promotion.
    room.setOnBackup((blob) => {
      if (!isHostRef.current) backupRef.current = blob
    })
    room.setOnShare((share) => {
      if (!isHostRef.current) shareRef.current = share
    })

    // A promoting peer asked for our key share; reply privately if we hold one.
    room.setOnShareRequest((peerId) => {
      if (isHostRef.current) return
      if (shareRef.current) room.sendShareResponse(shareRef.current, peerId)
    })
    // Collect shares the promoter requested (ignored once collection ended).
    room.setOnShareResponse((share, peerId) => {
      collectingRef.current?.set(peerId, share)
    })

    room.setOnAction((action, peerId) => applyAsHost(peerId, action))

    room.setOnHello(() => {
      if (isHostRef.current && fullRef.current) publish(fullRef.current)
    })

    room.setOnPeerJoin((peerId) => {
      peersRef.current.add(peerId)
      if (isHostRef.current && fullRef.current) {
        publish(addPlayer(fullRef.current, peerId))
      } else {
        room.sendHello()
      }
    })

    /**
     * Promote self to host after the previous host left. Prefers reconstructing
     * the full state from pooled threshold shares; if crypto is unavailable or
     * not enough shares arrive in time, falls back to the local snapshot/view.
     */
    const promote = async (departedHostId: PeerId): Promise<void> => {
      // Try threshold reconstruction: ask the other guests for their shares,
      // pool them with our own, and decrypt once we have the threshold.
      const others = [...peersRef.current]
      const backup = backupRef.current
      if (cryptoAvailable() && backup && others.length > 0) {
        const collected = new Map<PeerId, string>()
        collectingRef.current = collected
        room.sendShareRequest()
        // The threshold matches what the (now-departed) host used for the guest
        // set that included us: min(guestCount, 2). The guest count at backup
        // time was the surviving peers plus ourselves.
        const k = thresholdFor(others.length + 1)
        await new Promise((resolve) => setTimeout(resolve, SHARE_COLLECT_MS))
        collectingRef.current = null
        const shares = collectShares(shareRef.current, collected.values())
        const restored = await tryRestore(backup, shares, k)
        if (restored) {
          try {
            const full = JSON.parse(restored) as GameState
            setHost(true)
            publish(migrateHost(full, self, departedHostId))
            return
          } catch {
            /* fall through to snapshot fallback */
          }
        }
      }
      // Fallback: the legacy plaintext snapshot, or our last redacted view.
      const base = fullRef.current ?? viewRef.current
      if (!base) return
      // Another peer may have promoted while we awaited shares.
      if (isHostRef.current) return
      setHost(true)
      publish(migrateHost(base, self, departedHostId))
    }

    room.setOnPeerLeave((peerId) => {
      peersRef.current.delete(peerId)
      if (isHostRef.current && fullRef.current) {
        publish(removePlayer(fullRef.current, peerId))
        return
      }
      // The host left: the lowest-id remaining peer promotes itself.
      const departedWasHost = (viewRef.current ?? fullRef.current)?.hostId === peerId
      if (!departedWasHost) return
      if (electHost([self, ...peersRef.current]) !== self) return
      void promote(peerId)
    })

    setConnected(true)

    return () => {
      room.leave()
      roomRef.current = null
      fullRef.current = null
      viewRef.current = null
      peersRef.current = new Set()
      setConnected(false)
    }
  }, [roomCode, role])

  // Host applies locally; guests send a request the host validates.
  const dispatch = useCallback((action: GameAction) => {
    const room = roomRef.current
    if (!room) return
    if (isHostRef.current && fullRef.current && selfIdRef.current) {
      const self = selfIdRef.current
      const next = applyAction(fullRef.current, self, action)
      fullRef.current = next
      setState(redactStateFor(next, self))
      const guests = [...peersRef.current]
      for (const peer of guests) {
        room.sendState(redactStateFor(next, peer), peer)
      }
      const successor = electHost(guests)
      if (successor) room.sendSnapshot(next, successor)
      // Refresh the encrypted threshold backup for the new state.
      distributeBackup(room, next, guests)
    } else {
      room.sendAction(action)
    }
  }, [])

  // Host only: when an event's window elapses, it "happens" (resolves).
  useEffect(() => {
    if (!isHost || !state?.event || state.eventEndsAt == null) return
    const ms = Math.max(0, state.eventEndsAt - Date.now())
    const timer = setTimeout(() => dispatch({ type: 'resolveEvent' }), ms)
    return () => clearTimeout(timer)
  }, [isHost, state?.event, state?.eventEndsAt, dispatch])

  return {
    state,
    selfId: selfIdRef.current,
    connected,
    isHost,
    canStart: isHost && state ? canStartGame(state) : false,
    incrementSkittle: useCallback((colour: SkittleColour) => dispatch({ type: 'incrementSkittle', colour }), [dispatch]),
    start: useCallback(() => dispatch({ type: 'start' }), [dispatch]),
    reset: useCallback(() => dispatch({ type: 'reset' }), [dispatch]),
    triggerEvent: useCallback(() => dispatch({ type: 'triggerEvent' }), [dispatch]),
    setEventDuration: useCallback((seconds: number) => dispatch({ type: 'setEventDuration', seconds }), [dispatch]),
    setRounds: useCallback((rounds: number) => dispatch({ type: 'setRounds', rounds }), [dispatch]),
    setVisibility: useCallback((hideNonNeighbours: boolean) => dispatch({ type: 'setVisibility', hideNonNeighbours }), [dispatch]),
    proposeTrade: useCallback((to: string, give: SkittleSet, receive: SkittleSet) => dispatch({ type: 'proposeTrade', to, give, receive }), [dispatch]),
    acceptTrade: useCallback((offerId: string) => dispatch({ type: 'acceptTrade', offerId }), [dispatch]),
    cancelTrade: useCallback((offerId: string) => dispatch({ type: 'cancelTrade', offerId }), [dispatch]),
    proposeContract: useCallback((parties: string[], onSign: Transfer[], onEvent: Transfer[], onReceive: Transfer[], onEliminate: Transfer[], expiresRound: number | null) => dispatch({ type: 'proposeContract', parties, onSign, onEvent, onReceive, onEliminate, expiresRound }), [dispatch]),
    signContract: useCallback((contractId: string) => dispatch({ type: 'signContract', contractId }), [dispatch]),
    reviseContract: useCallback((contractId: string, parties: string[], onSign: Transfer[], onEvent: Transfer[], onReceive: Transfer[], onEliminate: Transfer[], expiresRound: number | null) => dispatch({ type: 'reviseContract', contractId, parties, onSign, onEvent, onReceive, onEliminate, expiresRound }), [dispatch]),
    cancelContract: useCallback((contractId: string) => dispatch({ type: 'cancelContract', contractId }), [dispatch])
  }
}
