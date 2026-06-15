import { FlagImage } from './FlagImage.js'
import { FactionTitle } from './FactionTitle.js'
import { SKITTLE_COLOURS } from '../generators/event.js'
import type { PlayerState } from '../game/types.js'

export function PlayerCard({
  player,
  isSelf
}: {
  player: PlayerState
  isSelf: boolean
}) {
  return (
    <div
      className={`player-card${isSelf ? ' player-card--self' : ''}${player.out ? ' player-card--out' : ''}`}
    >
      <FlagImage seed={player.flagSeed} className="player-card__flag" />
      <div className="player-card__body">
        <div className="player-card__name">
          <FactionTitle id={player.id} name={player.name} self={isSelf} />
          {player.out && <span className="player-card__out-badge"> OUT</span>}
        </div>
        {player.skittles ? (
          <ul className="player-card__skittles">
            {SKITTLE_COLOURS.map((colour) => (
              <li key={colour} className={`skittle skittle--${colour}`}>
                <span className="skittle__dot" /> {player.skittles![colour]}
              </li>
            ))}
          </ul>
        ) : (
          // Not a neighbour — their skittles are hidden from you.
          <div className="player-card__hidden" title="Only neighbours' skittles are visible">
            🔒 hidden
          </div>
        )}
      </div>
    </div>
  )
}
