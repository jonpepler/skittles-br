import { FlagImage } from './FlagImage.js'
import { FactionTitle } from './FactionTitle.js'
import { SkittleToken } from './SkittleToken.js'
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
          <FactionTitle seed={player.flagSeed} name={player.name} self={isSelf} />
          {player.out && <span className="player-card__out-badge"> OUT</span>}
        </div>
        {player.skittles ? (
          <div className="player-card__skittles">
            {SKITTLE_COLOURS.map((colour) => (
              <SkittleToken key={colour} colour={colour} count={player.skittles![colour]} />
            ))}
          </div>
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
