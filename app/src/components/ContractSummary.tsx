import { summarise, type Buckets } from '../game/summary.js'
import { statementTokens } from '../game/phrasing.js'
import { FactionTitle } from './FactionTitle.js'

/** Renders a contract's merged clauses as a few plain-English statements. */
export function ContractSummary({
  buckets,
  players,
  viewerId
}: {
  buckets: Buckets
  players: Record<string, { name: string; flagSeed: string }>
  viewerId: string
}) {
  const statements = summarise(buckets)
  if (statements.length === 0) {
    return <p className="summary summary--empty">No terms yet — add a clause.</p>
  }

  return (
    <div className="summary" aria-label="Contract summary">
      {statements.map((s, i) => {
        const tokens = statementTokens(s, viewerId)
        return (
          <p className="summary__line" key={i}>
            {tokens.map((t, j) => {
              if (t.kind === 'text') return <span key={j}>{t.text}</span>
              if (t.kind === 'when')
                return (
                  <span key={j} className="summary__when">
                    {t.text}
                  </span>
                )
              if (t.kind === 'faction') {
                const p = players[t.id]
                return (
                  <FactionTitle
                    key={j}
                    seed={p?.flagSeed ?? t.id}
                    name={p?.name ?? t.id}
                    self={t.id === viewerId}
                    size="sm"
                  />
                )
              }
              return <span key={j} className={`dot skittle--${t.colour}`} title={t.colour} />
            })}
          </p>
        )
      })}
    </div>
  )
}
