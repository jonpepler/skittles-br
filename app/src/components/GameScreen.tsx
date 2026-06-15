import { useGameRoom } from '../hooks/useGameRoom.js'
import type { Role } from '../game/types.js'
import { MIN_PLAYERS } from '../game/state.js'
import { PlayerCard } from './PlayerCard.js'
import { SkittlePanel } from './SkittlePanel.js'
import { EventPanel } from './EventPanel.js'
import { ShareInvite } from './ShareInvite.js'

export function GameScreen({
  roomCode,
  role,
  onLeave
}: {
  roomCode: string
  role: Role
  onLeave: () => void
}) {
  const game = useGameRoom(roomCode, role)
  const { state, selfId } = game

  const players = state ? Object.values(state.players) : []
  const self = selfId && state ? state.players[selfId] : undefined

  return (
    <div className="game">
      <header className="game__header">
        <div>
          <span className="game__label">Room</span>{' '}
          <span className="game__code">{roomCode}</span>
          {game.isHost && <span className="game__host"> · host</span>}
        </div>
        <div className="game__phase">{state?.phase ?? 'connecting…'}</div>
        <button className="btn" onClick={onLeave}>
          Leave
        </button>
      </header>

      {!state && <p className="game__hint">Connecting to peers…</p>}

      {state?.phase === 'lobby' && (
        <section>
          <ShareInvite code={roomCode} />
          {game.isHost ? (
            <>
              <label className="game__setting">
                Event window (seconds):{' '}
                <input
                  className="game__duration"
                  type="number"
                  min={5}
                  max={300}
                  value={state.eventDuration}
                  onChange={(e) => game.setEventDuration(Number(e.target.value))}
                />
              </label>
              <button
                className="btn btn--large"
                disabled={!game.canStart}
                onClick={game.start}
              >
                {game.canStart
                  ? 'Start game'
                  : `Waiting for players (${players.length}/${MIN_PLAYERS})`}
              </button>
            </>
          ) : (
            <p className="game__hint">Waiting for the host to start…</p>
          )}
        </section>
      )}

      {state?.phase === 'active' && self?.skittles && (
        <section>
          <h2>Collect skittles</h2>
          <SkittlePanel skittles={self.skittles} onIncrement={game.incrementSkittle} />

          {state.event ? (
            <EventPanel event={state.event} round={state.round} endsAt={state.eventEndsAt} />
          ) : (
            <p className="game__hint">No event yet.</p>
          )}
          {game.isHost && (
            <button className="btn" onClick={game.triggerEvent}>
              {state.event ? 'Next event' : 'Trigger event'}
            </button>
          )}
        </section>
      )}

      <section className="player-list">
        {players.map((player) => (
          <PlayerCard key={player.id} player={player} isSelf={player.id === selfId} />
        ))}
      </section>
    </div>
  )
}
