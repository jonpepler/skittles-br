import { SKITTLE_COLOURS } from '../generators/event.js'
import type { AmountExpr, GiveSpec } from '../game/contracts.js'
import { receivedColour, summarise, type Buckets } from '../game/summary.js'
import { FactionTitle } from './FactionTitle.js'

function amountText(expr: AmountExpr): string {
  if (typeof expr === 'number') return String(expr)
  if ('all' in expr) return 'all their'
  if ('eventReq' in expr) return 'the required'
  if ('received' in expr) return 'the received'
  if ('percent' in expr) return `${expr.percent}% of ${amountText(expr.of)}`
  if ('min' in expr) return `the smallest of (${expr.min.map(amountText).join(', ')})`
  return expr.sum.map(amountText).join(' + ')
}

function Give({ give }: { give: GiveSpec }) {
  const colours = SKITTLE_COLOURS.filter((c) => give[c] !== undefined)
  if (colours.length === 0) return <>nothing</>
  return (
    <>
      {colours.map((c, i) => (
        <span key={c}>
          {i > 0 && ', '}
          {amountText(give[c]!)} <span className={`dot skittle--${c}`} title={c} />
        </span>
      ))}
    </>
  )
}

/** Renders a contract's merged clauses as a few plain-English statements. */
export function ContractSummary({
  buckets,
  players,
  viewerId
}: {
  buckets: Buckets
  players: Record<string, { name: string }>
  viewerId: string
}) {
  const statements = summarise(buckets)
  if (statements.length === 0) {
    return <p className="summary summary--empty">No terms yet — add a clause.</p>
  }
  const faction = (id: string) => (
    <FactionTitle id={id} name={players[id]?.name ?? id} self={id === viewerId} size="sm" />
  )

  return (
    <div className="summary" aria-label="Contract summary">
      {statements.map((s, i) => {
        const verb = s.from === viewerId ? 'give' : 'gives'
        if (s.trigger === 'onReceive') {
          const rc = receivedColour(s.give)
          return (
            <p className="summary__line" key={i}>
              <span className="summary__when">Each time</span> {faction(s.from)} receives
              {rc && (
                <>
                  {' '}
                  <span className={`dot skittle--${rc}`} title={rc} />
                </>
              )}
              , they give {faction(s.to)} <Give give={s.give} />.
            </p>
          )
        }
        const when = s.trigger === 'onSign' ? 'On signing' : 'Each event'
        return (
          <p className="summary__line" key={i}>
            <span className="summary__when">{when}</span>, {faction(s.from)} {verb} {faction(s.to)}{' '}
            <Give give={s.give} />.
          </p>
        )
      })}
    </div>
  )
}
