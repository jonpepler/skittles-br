import { useCallback, useEffect, useRef, useState } from 'react'
import { joinGameRoom, type GameRoom, type PeerId } from '../net/room.js'
import {
  addPlayer,
  applyAction,
  canStart as canStartGame,
  createGame,
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
}

/**
 * Join (or host) a game room and expose the live state plus the actions a
 * player can take. The host keeps the authoritative state in a ref, mutates it
 * through the pure reducer, and broadcasts every change; guests render whatever
 * the host sends and route their actions back to the host for validation.
 */
export function useGameRoom(roomCode: string, role: Role): GameRoomApi {
  const [state, setState] = useState<GameState | null>(null)
  const [connected, setConnected] = useState(false)
  const roomRef = useRef<GameRoom | null>(null)
  const authRef = useRef<GameState | null>(null) // host's authoritative copy
  const selfIdRef = useRef<PeerId | null>(null)

  useEffect(() => {
    const room = joinGameRoom(roomCode)
    roomRef.current = room
    selfIdRef.current = room.selfId

    if (role === 'host') {
      const commit = (next: GameState): void => {
        authRef.current = next
        setState(next)
      }
      const broadcast = (): void => {
        if (authRef.current) room.sendState(authRef.current)
      }

      commit(addPlayer(createGame(roomCode, room.selfId), room.selfId))

      room.setOnPeerJoin((peerId) => {
        commit(addPlayer(authRef.current!, peerId))
        broadcast()
      })
      room.setOnPeerLeave((peerId) => {
        commit(removePlayer(authRef.current!, peerId))
        broadcast()
      })
      room.setOnAction((action, peerId) => {
        commit(applyAction(authRef.current!, peerId, action))
        broadcast()
      })
      // A guest greeting us means they want the current state.
      room.setOnHello(() => broadcast())
    } else {
      room.setOnState((next) => setState(next))
      // When the host appears, announce ourselves so it (re)sends state.
      room.setOnPeerJoin(() => room.sendHello())
    }

    setConnected(true)

    return () => {
      room.leave()
      roomRef.current = null
      authRef.current = null
      setConnected(false)
    }
  }, [roomCode, role])

  const incrementSkittle = useCallback(
    (colour: SkittleColour) => {
      const room = roomRef.current
      if (!room) return
      if (role === 'host' && authRef.current && selfIdRef.current) {
        const next = applyAction(authRef.current, selfIdRef.current, {
          type: 'incrementSkittle',
          colour
        })
        authRef.current = next
        setState(next)
        room.sendState(next)
      } else {
        room.sendAction({ type: 'incrementSkittle', colour })
      }
    },
    [role]
  )

  const start = useCallback(() => {
    const room = roomRef.current
    if (!room || role !== 'host' || !authRef.current || !selfIdRef.current) return
    const next = applyAction(authRef.current, selfIdRef.current, { type: 'start' })
    authRef.current = next
    setState(next)
    room.sendState(next)
  }, [role])

  return {
    state,
    selfId: selfIdRef.current,
    connected,
    isHost: role === 'host',
    canStart: state ? canStartGame(state) : false,
    incrementSkittle,
    start
  }
}
