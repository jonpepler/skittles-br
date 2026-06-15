import { useState } from 'react'
import { Landing } from './components/Landing.js'
import { GameScreen } from './components/GameScreen.js'
import { buildJoinUrl, parseRoomCode } from './lib/joinLink.js'
import type { Role } from './game/types.js'

type Screen = { name: 'landing' } | { name: 'game'; roomCode: string; role: Role }

/** Reflect the current room in the URL so it can be shared/refreshed. */
function syncUrl(code: string | null): void {
  const url = code
    ? buildJoinUrl(window.location.origin, import.meta.env.BASE_URL, code)
    : `${window.location.origin}${import.meta.env.BASE_URL}`
  window.history.replaceState(null, '', url)
}

function initialScreen(): Screen {
  // A ?room= link opens straight into that game as a guest.
  const code = parseRoomCode(window.location.search)
  return code ? { name: 'game', roomCode: code, role: 'guest' } : { name: 'landing' }
}

export default function App() {
  const [screen, setScreen] = useState<Screen>(initialScreen)

  const enterGame = (roomCode: string, role: Role): void => {
    syncUrl(roomCode)
    setScreen({ name: 'game', roomCode, role })
  }

  const leaveGame = (): void => {
    syncUrl(null)
    setScreen({ name: 'landing' })
  }

  if (screen.name === 'game') {
    return (
      <GameScreen roomCode={screen.roomCode} role={screen.role} onLeave={leaveGame} />
    )
  }

  return <Landing onStart={enterGame} />
}
