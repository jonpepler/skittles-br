import { useState } from 'react'
import type { Role } from '../game/types.js'
import { makeRoomCode, normaliseRoomCode } from '../lib/roomCode.js'

/** Entry screen: create a new game (as host) or join one by code (as guest). */
export function Landing({ onStart }: { onStart: (roomCode: string, role: Role) => void }) {
  const [code, setCode] = useState('')

  const join = (e: React.FormEvent): void => {
    e.preventDefault()
    const normalised = normaliseRoomCode(code)
    if (normalised) onStart(normalised, 'guest')
  }

  return (
    <div className="landing">
      <h1 className="landing__title" aria-label="Skittles">
        {'Skittles'.split('').map((ch, i) => (
          <span key={i} className={`landing__letter landing__letter--${i % 5}`}>
            {ch}
          </span>
        ))}
      </h1>
      <p className="landing__tagline">A peer-to-peer game of flags and skittles.</p>

      <button className="btn btn--large" onClick={() => onStart(makeRoomCode(), 'host')}>
        Create game
      </button>

      <div className="landing__divider">or</div>

      <form className="landing__join" onSubmit={join}>
        <input
          className="landing__input"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="ROOM CODE"
          aria-label="Room code"
          autoComplete="off"
        />
        <button className="btn" type="submit" disabled={!code.trim()}>
          Join
        </button>
      </form>
    </div>
  )
}
