import { useState } from 'react'
import { SKITTLE_COLOURS, type SkittleColour } from '../generators/event.js'
import { emptySkittles } from '../game/skittles.js'
import type { SkittleSet } from '../generators/event.js'
import type { AmountExpr, Contract, GiveSpec, Transfer } from '../game/contracts.js'
import type { PlayerState } from '../game/types.js'

type Template = 'gift' | 'swap' | 'cover'

/** Render a give-spec (literal / all / event-required amounts) as readable text. */
function describeGive(give: GiveSpec): string {
  const parts = SKITTLE_COLOURS.flatMap((c) => {
    const expr = give[c]
    if (expr === undefined) return []
    return [describeExpr(expr, c)]
  })
  return parts.length ? parts.join(', ') : 'nothing'
}

function describeExpr(expr: AmountExpr, colour: SkittleColour): string {
  if (typeof expr === 'number') return `${expr} ${colour}`
  if ('all' in expr) return `all ${colour}`
  if ('eventReq' in expr) return `required ${colour}`
  return `some ${colour}`
}

function nonEmpty(set: SkittleSet): GiveSpec {
  const give: GiveSpec = {}
  for (const c of SKITTLE_COLOURS) if (set[c] > 0) give[c] = set[c]
  return give
}

function AmountFields({
  label,
  value,
  onChange
}: {
  label: string
  value: SkittleSet
  onChange: (next: SkittleSet) => void
}) {
  return (
    <div className="trade__amounts">
      <span className="trade__amounts-label">{label}</span>
      {SKITTLE_COLOURS.map((c) => (
        <label key={c} className={`trade__amount skittle--${c}`}>
          <span className="skittle__dot" />
          <input
            type="number"
            min={0}
            aria-label={`${label} ${c}`}
            value={value[c]}
            onChange={(e) =>
              onChange({ ...value, [c]: Math.max(0, Math.floor(Number(e.target.value) || 0)) })
            }
          />
        </label>
      ))}
    </div>
  )
}

export function ContractsPanel({
  players,
  selfId,
  contracts,
  onPropose,
  onSign,
  onCancel
}: {
  players: PlayerState[]
  selfId: string
  contracts: Contract[]
  onPropose: (
    parties: string[],
    onSign: Transfer[],
    onEvent: Transfer[],
    expiresRound: number | null
  ) => void
  onSign: (contractId: string) => void
  onCancel: (contractId: string) => void
}) {
  const others = players.filter((p) => p.id !== selfId && !p.out)
  const [to, setTo] = useState(others[0]?.id ?? '')
  const [template, setTemplate] = useState<Template>('gift')
  const [give, setGive] = useState<SkittleSet>(emptySkittles())
  const [receive, setReceive] = useState<SkittleSet>(emptySkittles())
  const [colour, setColour] = useState<SkittleColour>('red')

  const nameOf = (id: string): string => players.find((p) => p.id === id)?.name ?? id

  const propose = (): void => {
    if (!to) return
    if (template === 'gift') {
      onPropose([selfId, to], [{ from: selfId, to, give: nonEmpty(give) }], [], null)
    } else if (template === 'swap') {
      onPropose(
        [selfId, to],
        [
          { from: selfId, to, give: nonEmpty(give) },
          { from: to, to: selfId, give: nonEmpty(receive) }
        ],
        [],
        null
      )
    } else {
      // Recurring cover: they give you all of <colour> now; you cover their
      // event-required <colour> on every event.
      onPropose(
        [selfId, to],
        [{ from: to, to: selfId, give: { [colour]: { all: colour } } }],
        [{ from: selfId, to, give: { [colour]: { eventReq: colour } } }],
        null
      )
    }
    setGive(emptySkittles())
    setReceive(emptySkittles())
  }

  return (
    <section className="contracts">
      <h2>Contracts</h2>

      {others.length === 0 ? (
        <p className="game__hint">No one to make a contract with yet.</p>
      ) : (
        <div className="contracts__form">
          <label>
            With{' '}
            <select value={to} onChange={(e) => setTo(e.target.value)} aria-label="Contract with">
              {others.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Type{' '}
            <select
              value={template}
              onChange={(e) => setTemplate(e.target.value as Template)}
              aria-label="Contract type"
            >
              <option value="gift">Gift</option>
              <option value="swap">Swap</option>
              <option value="cover">Cover my event {colour}</option>
            </select>
          </label>

          {(template === 'gift' || template === 'swap') && (
            <AmountFields label="You give" value={give} onChange={setGive} />
          )}
          {template === 'swap' && (
            <AmountFields label="You get" value={receive} onChange={setReceive} />
          )}
          {template === 'cover' && (
            <label>
              Colour{' '}
              <select
                value={colour}
                onChange={(e) => setColour(e.target.value as SkittleColour)}
                aria-label="Cover colour"
              >
                {SKITTLE_COLOURS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          )}

          <button className="btn" onClick={propose}>
            Propose contract
          </button>
        </div>
      )}

      {contracts.length > 0 && (
        <div className="contracts__list">
          {contracts.map((c) => {
            const mine = c.signed.includes(selfId)
            return (
              <div key={c.id} className="contracts__item">
                <div>
                  <strong>{c.parties.map(nameOf).join(' · ')}</strong>{' '}
                  <span className="game__hint">
                    ({c.signed.length}/{c.parties.length} signed)
                  </span>
                  <ul className="contracts__clauses">
                    {c.onSign.map((t, i) => (
                      <li key={`s${i}`}>
                        on sign: {nameOf(t.from)} → {nameOf(t.to)}: {describeGive(t.give)}
                      </li>
                    ))}
                    {c.onEvent.map((t, i) => (
                      <li key={`e${i}`}>
                        each event: {nameOf(t.from)} → {nameOf(t.to)}: {describeGive(t.give)}
                      </li>
                    ))}
                  </ul>
                </div>
                <span className="trade__offer-actions">
                  {!mine && (
                    <button className="btn" onClick={() => onSign(c.id)}>
                      Sign
                    </button>
                  )}
                  <button className="btn" onClick={() => onCancel(c.id)}>
                    Cancel
                  </button>
                </span>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
