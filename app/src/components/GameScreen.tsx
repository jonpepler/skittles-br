import { useGameRoom } from '../hooks/useGameRoom.js'
import type { Role } from '../game/types.js'
import { MIN_PLAYERS } from '../game/state.js'
import { PlayerCard } from './PlayerCard.js'
import { FactionTitle } from './FactionTitle.js'
import { SkittlePanel } from './SkittlePanel.js'
import { EventPanel } from './EventPanel.js'
import { ShareInvite } from './ShareInvite.js'
import { TradePanel } from './TradePanel.js'
import { ContractsPanel } from './ContractsPanel.js'

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
  const survivors = players.filter((p) => !p.out)

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
                <input
                  type="checkbox"
                  checked={state.hideNonNeighbours}
                  onChange={(e) => game.setVisibility(e.target.checked)}
                />{' '}
                Hide non-neighbours' skittles
              </label>
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
              <label className="game__setting">
                Rounds (everyone alive at the end wins):{' '}
                <input
                  className="game__rounds"
                  type="number"
                  min={1}
                  max={20}
                  value={state.maxRounds}
                  onChange={(e) => game.setRounds(Number(e.target.value))}
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

      {state?.phase === 'active' && self && (
        <section>
          {self.out ? (
            <p className="game__hint">You've been eliminated — spectating.</p>
          ) : (
            self.skittles && (
              <>
                <h2>Collect skittles</h2>
                <SkittlePanel skittles={self.skittles} onIncrement={game.incrementSkittle} />
              </>
            )
          )}

          <p className="game__hint">
            Round {state.round} of {state.maxRounds}
          </p>
          {state.event ? (
            <EventPanel event={state.event} round={state.round} endsAt={state.eventEndsAt} />
          ) : (
            <p className="game__hint">No event yet.</p>
          )}
          {game.isHost && state.round < state.maxRounds && (
            <button className="btn" onClick={game.triggerEvent}>
              {state.round === 0 ? 'Trigger first event' : 'Next event'}
            </button>
          )}

          {!self.out && (
            <>
              <TradePanel
                players={players}
                selfId={selfId!}
                offers={state.offers}
                onPropose={game.proposeTrade}
                onAccept={game.acceptTrade}
                onCancel={game.cancelTrade}
              />
              <ContractsPanel
                players={players}
                selfId={selfId!}
                contracts={state.contracts}
                round={state.round}
                onPropose={game.proposeContract}
                onSign={game.signContract}
                onRevise={game.reviseContract}
                onCancel={game.cancelContract}
              />
            </>
          )}
        </section>
      )}

      {state?.phase === 'complete' && (
        <section className="complete">
          <h2>Game over</h2>
          {survivors.length > 0 ? (
            <>
              <p>Everyone who lasted wins:</p>
              <div className="complete__winners">
                {survivors.map((p) => (
                  <FactionTitle
                    key={p.id}
                    seed={p.flagSeed}
                    name={p.name}
                    self={p.id === selfId}
                  />
                ))}
              </div>
            </>
          ) : (
            <p>No survivors.</p>
          )}
          {game.isHost && (
            <button className="btn btn--large" onClick={game.reset}>
              Play again
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
