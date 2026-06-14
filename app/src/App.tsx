import { useState } from 'react'
import { Landing } from './components/Landing.js'
import { GameScreen } from './components/GameScreen.js'
import type { Role } from './game/types.js'

type Screen = { name: 'landing' } | { name: 'game'; roomCode: string; role: Role }

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'landing' })

  if (screen.name === 'game') {
    return (
      <GameScreen
        roomCode={screen.roomCode}
        role={screen.role}
        onLeave={() => setScreen({ name: 'landing' })}
      />
    )
  }

  return (
    <Landing onStart={(roomCode, role) => setScreen({ name: 'game', roomCode, role })} />
  )
}
