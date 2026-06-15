import { useEffect, useState } from 'react'
import { SKITTLE_COLOURS, type GameEvent, type SkittleSet } from '../generators/event.js'

function SkittleCosts({ set }: { set: SkittleSet }) {
  const entries = SKITTLE_COLOURS.filter((c) => set[c] > 0)
  if (entries.length === 0) return <span className="event__none">—</span>
  return (
    <span className="event__costs">
      {entries.map((colour) => (
        <span key={colour} className={`skittle skittle--${colour}`}>
          <span className="skittle__dot" /> {set[colour]}
        </span>
      ))}
    </span>
  )
}

/** Live countdown to when the event resolves ("happens"). */
function Countdown({ endsAt }: { endsAt: number }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, endsAt - Date.now()))
  useEffect(() => {
    const tick = (): void => setRemaining(Math.max(0, endsAt - Date.now()))
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [endsAt])

  const seconds = Math.ceil(remaining / 1000)
  return (
    <div className="event__timer">
      {remaining > 0 ? `Happens in ${seconds}s — trade now!` : 'Resolving…'}
    </div>
  )
}

/**
 * Displays the event currently in play. When it resolves, each player who can
 * afford the requirement spends it for the reward; everyone else takes the
 * penalty (see resolveEvent).
 */
export function EventPanel({
  event,
  round,
  endsAt
}: {
  event: GameEvent
  round: number
  endsAt: number | null
}) {
  return (
    <div className="event">
      <div className="event__round">Event {round}</div>
      <h3 className="event__name">{event.name}</h3>
      <p className="event__description">{event.description}</p>
      {endsAt != null && <Countdown endsAt={endsAt} />}
      <dl className="event__grid">
        <dt>Requires</dt>
        <dd>
          <SkittleCosts set={event.requirement} />
        </dd>
        <dt>Reward</dt>
        <dd>
          <SkittleCosts set={event.reward} />
        </dd>
        <dt>Penalty</dt>
        <dd>
          <SkittleCosts set={event.penalty} />
        </dd>
      </dl>
    </div>
  )
}
