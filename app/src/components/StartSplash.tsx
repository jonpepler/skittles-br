import { FlagImage } from './FlagImage.js'

type Civ = { seed: string; name: string }

/**
 * The cold-open shown when a game starts: your flag large and centred, rivals'
 * flags ringed smaller around it, under a blunt statement of the odds. Tap
 * anywhere (or "Begin") to dismiss.
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
  const n = opponents.length
  return (
    <div className="splash" role="dialog" aria-label="Game start" onClick={onDismiss}>
      <div className="splash__inner">
        <div className="splash__arena">
          {opponents.map((o, i) => {
            const angle = (i / Math.max(1, n)) * 360
            return (
              <div
                key={`${o.seed}-${i}`}
                className="splash__opp"
                style={{
                  transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(var(--splash-ring, -7rem)) rotate(${-angle}deg)`
                }}
                title={o.name}
              >
                <FlagImage seed={o.seed} className="splash__opp-flag" />
              </div>
            )
          })}
          <div className="splash__self" title={self.name}>
            <FlagImage seed={self.seed} className="splash__self-flag" />
          </div>
        </div>

        <p className="splash__message">
          This game is not fair.
          <br />
          Your goal is to survive.
        </p>

        <button type="button" className="btn btn--large splash__begin" onClick={onDismiss}>
          Begin
        </button>
      </div>
    </div>
  )
}
