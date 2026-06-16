import { useEffect, useRef, useState } from 'react'
import { useGameRoom } from '../hooks/useGameRoom.js'
import type { Phase, Role } from '../game/types.js'
import { MIN_PLAYERS } from '../game/state.js'
import { PlayerCard } from './PlayerCard.js'
import { FactionTitle } from './FactionTitle.js'
import { SkittlePanel } from './SkittlePanel.js'
import { EventPanel } from './EventPanel.js'
import { ShareInvite } from './ShareInvite.js'
import { TradePanel } from './TradePanel.js'
import { ContractsPanel } from './ContractsPanel.js'
import { GameLog } from './GameLog.js'
import { StartSplash } from './StartSplash.js'

const LENGTHS = [
  ['Short', 20],
  ['Normal', 40],
  ['Long', 60]
] as const

/** Game-length presets with a custom escape hatch. */
function GameLength({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [custom, setCustom] = useState(!LENGTHS.some(([, n]) => n === value))
  return (
    <div className="game__setting length">
      <span className="length__label">Game length</span>
      <div className="seg" role="group" aria-label="Game length">
        {LENGTHS.map(([label, n]) => (
          <button
            key={n}
            type="button"
            className={`seg__btn${!custom && value === n ? ' seg__btn--on' : ''}`}
            onClick={() => {
              setCustom(false)
              onChange(n)
            }}
          >
            {label}
            <span className="seg__n">{n}</span>
          </button>
        ))}
      </div>
      <label className="length__custom">
        <input type="checkbox" checked={custom} onChange={(e) => setCustom(e.target.checked)} />{' '}
        Custom
      </label>
      {custom && (
        <input
          className="game__rounds"
          type="number"
          min={1}
          aria-label="Custom rounds"
          value={value}
          onChange={(e) => onChange(Math.max(1, Number(e.target.value) || 1))}
        />
      )}
    </div>
  )
}

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

  // Show the cold-open once, when the game transitions from lobby to active
  // (not when joining/reconnecting into an already-running game).
  const [showSplash, setShowSplash] = useState(false)
  const prevPhase = useRef<Phase | undefined>(undefined)
  useEffect(() => {
    const phase = state?.phase
    if (phase === 'active' && prevPhase.current === 'lobby') setShowSplash(true)
    if (phase === 'lobby' || phase === 'complete') setShowSplash(false)
    prevPhase.current = phase
  }, [state?.phase])

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
              <GameLength value={state.maxRounds} onChange={game.setRounds} />
              <p className="game__hint">Everyone still alive at the end wins.</p>
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
            <p className="game__hint">You've been eliminated. Spectating.</p>
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

      {state && state.phase !== 'lobby' && (
        <GameLog log={state.log} players={state.players} selfId={selfId} />
      )}

      {showSplash && self && (
        <StartSplash
          self={{ seed: self.flagSeed, name: self.name }}
          opponents={players
            .filter((p) => p.id !== selfId)
            .map((p) => ({ seed: p.flagSeed, name: p.name }))}
          onDismiss={() => setShowSplash(false)}
        />
      )}
    </div>
  )
}
