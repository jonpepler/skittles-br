import { useCallback, useEffect, useRef, useState } from 'react'
import { joinGameRoom, type GameRoom, type PeerId } from '../net/room.js'
import {
  addPlayer,
  applyAction,
  canStart as canStartGame,
  createGame,
  electHost,
  migrateHost,
  removePlayer
} from '../game/state.js'
import type { GameState, Role } from '../game/types.js'
import type { SkittleColour } from '../generators/event.js'

export interface GameRoomApi {
  state: GameState | null
  selfId: PeerId | null
  connected: boolean
  isHost: boolean
  canStart: boolean
  incrementSkittle: (colour: SkittleColour) => void
  start: () => void
  triggerEvent: () => void
}

/**
 * Join a game room and expose the live state plus the actions a player can
 * take. Authority is dynamic: the connected peer with the lowest id is the
 * host, so if the host leaves the next-lowest peer promotes itself and adopts
 * the last broadcast state. Handlers therefore branch on the *current* host
 * status rather than a fixed role; `role` only seeds who creates the initial
 * lobby vs. who waits for it.
 */
export function useGameRoom(roomCode: string, role: Role): GameRoomApi {
  const [state, setState] = useState<GameState | null>(null)
  const [isHost, setIsHostState] = useState(role === 'host')
  const [connected, setConnected] = useState(false)

  const roomRef = useRef<GameRoom | null>(null)
  const selfIdRef = useRef<PeerId | null>(null)
  const stateRef = useRef<GameState | null>(null) // authoritative if host, else last seen
  const peersRef = useRef<Set<PeerId>>(new Set())
  const isHostRef = useRef(role === 'host')

  useEffect(() => {
    const room = joinGameRoom(roomCode)
    roomRef.current = room
    selfIdRef.current = room.selfId
    peersRef.current = new Set()

    const setHost = (value: boolean): void => {
      isHostRef.current = value
      setIsHostState(value)
    }
    const commit = (next: GameState): void => {
      stateRef.current = next
      setState(next)
    }
    const broadcast = (): void => {
      if (stateRef.current) room.sendState(stateRef.current)
    }
    /** A guest promotes itself if it's the lowest-id peer after the host left. */
    const electAndMaybePromote = (departedHostId: PeerId): void => {
      const remaining = [room.selfId, ...peersRef.current]
      if (electHost(remaining) !== room.selfId) return // someone more senior promotes
      if (!stateRef.current) return
      setHost(true)
      commit(migrateHost(stateRef.current, room.selfId, departedHostId))
      broadcast()
    }

    if (role === 'host') {
      setHost(true)
      commit(addPlayer(createGame(roomCode, room.selfId), room.selfId))
    } else {
      setHost(false)
    }

    room.setOnState((incoming, peerId) => {
      if (isHostRef.current) {
        // Split-brain resolution: yield only to a more senior (lower id) host.
        if (peerId < room.selfId) {
          setHost(false)
          commit(incoming)
        }
        return
      }
      commit(incoming)
    })

    room.setOnAction((action, peerId) => {
      if (!isHostRef.current || !stateRef.current) return
      commit(applyAction(stateRef.current, peerId, action))
      broadcast()
    })

    room.setOnHello(() => {
      if (isHostRef.current) broadcast()
    })

    room.setOnPeerJoin((peerId) => {
      peersRef.current.add(peerId)
      if (isHostRef.current && stateRef.current) {
        commit(addPlayer(stateRef.current, peerId))
        broadcast()
      } else {
        // Ask whoever is host to (re)send the current state.
        room.sendHello()
      }
    })

    room.setOnPeerLeave((peerId) => {
      peersRef.current.delete(peerId)
      if (isHostRef.current && stateRef.current) {
        commit(removePlayer(stateRef.current, peerId))
        broadcast()
      } else if (stateRef.current?.hostId === peerId) {
        electAndMaybePromote(peerId)
      }
    })

    setConnected(true)

    return () => {
      room.leave()
      roomRef.current = null
      stateRef.current = null
      peersRef.current = new Set()
      setConnected(false)
    }
  }, [roomCode, role])

  const incrementSkittle = useCallback((colour: SkittleColour) => {
    const room = roomRef.current
    if (!room) return
    if (isHostRef.current && stateRef.current && selfIdRef.current) {
      const next = applyAction(stateRef.current, selfIdRef.current, {
        type: 'incrementSkittle',
        colour
      })
      stateRef.current = next
      setState(next)
      room.sendState(next)
    } else {
      room.sendAction({ type: 'incrementSkittle', colour })
    }
  }, [])

  // Host-only actions the host applies locally; guests can't invoke these
  // (the UI only exposes them to the host, and applyAction validates anyway).
  const hostAction = useCallback((action: { type: 'start' | 'triggerEvent' }) => {
    const room = roomRef.current
    if (!room || !isHostRef.current || !stateRef.current || !selfIdRef.current) return
    const next = applyAction(stateRef.current, selfIdRef.current, action)
    stateRef.current = next
    setState(next)
    room.sendState(next)
  }, [])

  const start = useCallback(() => hostAction({ type: 'start' }), [hostAction])
  const triggerEvent = useCallback(() => hostAction({ type: 'triggerEvent' }), [hostAction])

  return {
    state,
    selfId: selfIdRef.current,
    connected,
    isHost,
    canStart: isHost && state ? canStartGame(state) : false,
    incrementSkittle,
    start,
    triggerEvent
  }
}
