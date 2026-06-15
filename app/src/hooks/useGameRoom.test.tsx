import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App.js'
import { useGameRoom } from './useGameRoom.js'
import { addPlayer, createGame } from '../game/state.js'
import type { GameState } from '../game/types.js'

/**
 * Drives the whole app (Landing → GameScreen → useGameRoom) against a fake
 * Trystero room, so the host-authoritative wiring is exercised end-to-end
 * without a browser or any network. Captures the handlers the hook registers
 * and records every state broadcast.
 */
const h = vi.hoisted(() => {
  const room: {
    selfId: string
    sentStates: GameState[]
    sentSnapshots: GameState[]
    sentActions: unknown[]
    handlers: Record<string, (...args: never[]) => void>
    [key: string]: unknown
  } = { selfId: 'HOST', sentStates: [], sentSnapshots: [], sentActions: [], handlers: {} }

  room.sendState = (s: GameState) => room.sentStates.push(s)
  room.setOnState = (cb: never) => (room.handlers.onState = cb)
  room.sendSnapshot = (s: GameState) => room.sentSnapshots.push(s)
  room.setOnSnapshot = (cb: never) => (room.handlers.onSnapshot = cb)
  room.sendAction = (a: unknown) => room.sentActions.push(a)
  room.setOnAction = (cb: never) => (room.handlers.onAction = cb)
  room.sendHello = () => {}
  room.setOnHello = (cb: never) => (room.handlers.onHello = cb)
  room.setOnPeerJoin = (cb: never) => (room.handlers.onPeerJoin = cb)
  room.setOnPeerLeave = (cb: never) => (room.handlers.onPeerLeave = cb)
  room.leave = () => {}
  return { room }
})

vi.mock('../net/room.js', () => ({ joinGameRoom: () => h.room }))

const lastBroadcast = (): GameState => h.room.sentStates[h.room.sentStates.length - 1]!

describe('App end-to-end (fake transport)', () => {
  beforeEach(() => {
    h.room.sentStates = []
    h.room.sentActions = []
    h.room.handlers = {}
    // Clear any ?room= the previous test left in the URL (would auto-join).
    window.history.replaceState(null, '', '/')
  })

  it('hosts a game from create through to collecting a skittle', async () => {
    const user = userEvent.setup()
    render(<App />)

    // Create a game as host.
    await user.click(screen.getByRole('button', { name: 'Create game' }))

    // Lobby with just the host, below the player minimum.
    expect(screen.getByText(/Waiting for players \(1\/2\)/)).toBeInTheDocument()
    expect(screen.getByText('(you)')).toBeInTheDocument()

    // A guest connects — the host should admit them and be able to start.
    act(() => h.room.handlers.onPeerJoin!('GUEST' as never))
    const startBtn = await screen.findByRole('button', { name: 'Start game' })
    expect(startBtn).toBeEnabled()
    expect(lastBroadcast().players['GUEST']).toBeDefined()

    // Start the game.
    await user.click(startBtn)
    expect(screen.getByRole('heading', { name: 'Collect skittles' })).toBeInTheDocument()
    expect(lastBroadcast().phase).toBe('active')

    // Collect a green skittle — host applies it and rebroadcasts.
    await user.click(screen.getByRole('button', { name: /green: 0/ }))
    expect(lastBroadcast().players['HOST']!.skittles!.green).toBe(1)
    expect(screen.getByRole('button', { name: /green: 1/ })).toBeInTheDocument()

    // Host triggers an event, which the generator produces and broadcasts.
    await user.click(screen.getByRole('button', { name: 'Trigger event' }))
    expect(screen.getByText('Event 1')).toBeInTheDocument()
    expect(lastBroadcast().event).not.toBeNull()
  })

  it('validates guest actions through the host (ignores a non-player)', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Create game' }))
    act(() => h.room.handlers.onPeerJoin!('GUEST' as never))
    await user.click(await screen.findByRole('button', { name: 'Start game' }))

    // A spoofed action from someone who never joined must not change state.
    act(() =>
      (h.room.handlers.onAction as (a: unknown, p: string) => void)!(
        { type: 'incrementSkittle', colour: 'red' },
        'INTRUDER'
      )
    )
    const state = lastBroadcast()
    expect(state.players['INTRUDER']).toBeUndefined()

    // A legitimate action from the joined guest is applied.
    act(() =>
      (h.room.handlers.onAction as (a: unknown, p: string) => void)!(
        { type: 'incrementSkittle', colour: 'red' },
        'GUEST'
      )
    )
    expect(lastBroadcast().players['GUEST']!.skittles!.red).toBe(1)
  })
})

describe('event timer', () => {
  beforeEach(() => {
    h.room.sentStates = []
    h.room.handlers = {}
  })

  it('host auto-resolves the event after its window elapses', async () => {
    vi.useFakeTimers()
    try {
      const { result } = renderHook(() => useGameRoom('CODE', 'host'))
      const join = (id: string) =>
        (h.room.handlers.onPeerJoin as (p: string) => void)(id)

      act(() => join('GUEST')) // need two players to start
      act(() => result.current.start())
      act(() => result.current.triggerEvent())
      expect(result.current.state?.event).not.toBeNull()

      const window = result.current.state!.eventDuration * 1000
      await act(async () => {
        await vi.advanceTimersByTimeAsync(window + 100)
      })
      expect(result.current.state?.event).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('host migration', () => {
  beforeEach(() => {
    h.room.sentStates = []
    h.room.sentActions = []
    h.room.handlers = {}
  })

  const onState = (s: GameState, peerId: string) =>
    (h.room.handlers.onState as (s: GameState, p: string) => void)(s, peerId)
  const onPeerJoin = (peerId: string) =>
    (h.room.handlers.onPeerJoin as (p: string) => void)(peerId)
  const onPeerLeave = (peerId: string) =>
    (h.room.handlers.onPeerLeave as (p: string) => void)(peerId)

  it('promotes the lowest-id guest when the host leaves, keeping state', () => {
    // self is 'HOST'; 'AAAA' sorts lower and is the host, 'ZZZZ' higher. When
    // 'AAAA' leaves, the lowest remaining peer (self, 'HOST') must take over.
    const { result } = renderHook(() => useGameRoom('CODE', 'guest'))
    expect(result.current.isHost).toBe(false)

    let hosted = addPlayer(createGame('CODE', 'AAAA'), 'AAAA')
    hosted = addPlayer(hosted, 'HOST')
    hosted = addPlayer(hosted, 'ZZZZ')

    act(() => onPeerJoin('AAAA'))
    act(() => onPeerJoin('ZZZZ'))
    act(() => onState(hosted, 'AAAA'))
    expect(result.current.state?.hostId).toBe('AAAA')
    expect(result.current.isHost).toBe(false)

    // The host disconnects.
    act(() => onPeerLeave('AAAA'))

    expect(result.current.isHost).toBe(true)
    expect(result.current.state?.hostId).toBe('HOST')
    expect(result.current.state?.players['AAAA']).toBeUndefined()
    expect(result.current.state?.players['HOST']).toBeDefined()
    // The new host announced itself to the remaining peer.
    expect(lastBroadcast().hostId).toBe('HOST')
  })
})
