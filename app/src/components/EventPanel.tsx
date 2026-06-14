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

/** Displays the event currently in play. Resolution rules (how requirement,
 *  reward and penalty are applied) are intentionally left to the game design. */
export function EventPanel({ event, round }: { event: GameEvent; round: number }) {
  return (
    <div className="event">
      <div className="event__round">Event {round}</div>
      <h3 className="event__name">{event.name}</h3>
      <p className="event__description">{event.description}</p>
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
