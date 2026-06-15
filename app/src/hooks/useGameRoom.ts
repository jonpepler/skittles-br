import { useCallback, useEffect, useRef, useState } from 'react'
import { joinGameRoom, type GameRoom, type PeerId } from '../net/room.js'
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
import type { SkittleColour, SkittleSet } from '../generators/event.js'

export interface GameRoomApi {
  /** The state as this player is allowed to see it (neighbours' skittles only). */
  state: GameState | null
  selfId: PeerId | null
  connected: boolean
  isHost: boolean
  canStart: boolean
  incrementSkittle: (colour: SkittleColour) => void
  start: () => void
  triggerEvent: () => void
  setEventDuration: (seconds: number) => void
  proposeTrade: (to: string, give: SkittleSet, receive: SkittleSet) => void
  acceptTrade: (offerId: string) => void
  cancelTrade: (offerId: string) => void
}

/**
 * Join a game room and expose the live (redacted) state plus the actions a
 * player can take.
 *
 * Authority is dynamic: the lowest-id connected peer is host. The host holds
 * the full authoritative state, but sends every peer only a *redacted* view
 * (their own + neighbours' skittles). To keep host failover working despite
 * redaction, the host also sends the full state as a private snapshot to its
 * designated successor (the next-lowest peer); if the host leaves, that
 * successor promotes itself using the snapshot.
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
      for (const peer of peersRef.current) {
        room.sendState(redactStateFor(full, peer), peer)
      }
      const successor = electHost([...peersRef.current])
      if (successor) room.sendSnapshot(full, successor)
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
      const base = fullRef.current ?? viewRef.current
      if (!base) return
      setHost(true)
      publish(migrateHost(base, self, peerId))
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
      const next = applyAction(fullRef.current, selfIdRef.current, action)
      fullRef.current = next
      setState(redactStateFor(next, selfIdRef.current))
      for (const peer of peersRef.current) {
        room.sendState(redactStateFor(next, peer), peer)
      }
      const successor = electHost([...peersRef.current])
      if (successor) room.sendSnapshot(next, successor)
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
    triggerEvent: useCallback(() => dispatch({ type: 'triggerEvent' }), [dispatch]),
    setEventDuration: useCallback((seconds: number) => dispatch({ type: 'setEventDuration', seconds }), [dispatch]),
    proposeTrade: useCallback((to: string, give: SkittleSet, receive: SkittleSet) => dispatch({ type: 'proposeTrade', to, give, receive }), [dispatch]),
    acceptTrade: useCallback((offerId: string) => dispatch({ type: 'acceptTrade', offerId }), [dispatch]),
    cancelTrade: useCallback((offerId: string) => dispatch({ type: 'cancelTrade', offerId }), [dispatch])
  }
}
