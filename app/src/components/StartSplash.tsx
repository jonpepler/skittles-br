import { FlagImage } from './FlagImage.js'

type Civ = { seed: string; name: string }

/**
 * The cold-open shown when a game starts: your flag large and centred, rivals'
 * flags gridded small on either side, under a blunt statement of the odds.
 * Tap anywhere (or "Begin") to dismiss.
 */
export function StartSplash({
  self,
  opponents,
  onDismiss
}: {
  self: Civ
  opponents: Civ[]
  onDismiss: () => void
}) {
  const half = Math.ceil(opponents.length / 2)
  const sides = [opponents.slice(0, half), opponents.slice(half)]

  const grid = (civs: Civ[]) => (
    <div className="splash__side">
      {civs.map((o, i) => (
        <FlagImage key={`${o.seed}-${i}`} seed={o.seed} className="splash__opp-flag" />
      ))}
    </div>
  )

  return (
    <div className="splash" role="dialog" aria-label="Game start" onClick={onDismiss}>
      <div className="splash__card">
        <div className="splash__lineup">
          {grid(sides[0]!)}
          <FlagImage seed={self.seed} className="splash__self-flag" />
          {grid(sides[1]!)}
        </div>

        <p className="splash__message">
          This game is <span className="splash__hl splash__hl--red">not fair</span>.
          <br />
          Your goal is to <span className="splash__hl splash__hl--green">survive</span>.
        </p>

        <button type="button" className="btn btn--large splash__begin" onClick={onDismiss}>
          Begin
        </button>
      </div>
    </div>
  )
}
