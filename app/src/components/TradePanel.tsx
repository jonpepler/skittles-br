import { useState } from 'react'
import { SKITTLE_COLOURS, type SkittleSet } from '../generators/event.js'
import { emptySkittles } from '../game/state.js'
import type { PlayerState, TradeOffer } from '../game/types.js'
import { FactionTitle } from './FactionTitle.js'

function CostList({ set }: { set: SkittleSet }) {
  const entries = SKITTLE_COLOURS.filter((c) => set[c] > 0)
  if (entries.length === 0) return <span className="event__none">nothing</span>
  return (
    <span className="trade__costs">
      {entries.map((c) => (
        <span key={c} className={`skittle skittle--${c}`}>
          <span className="skittle__dot" /> {set[c]}
        </span>
      ))}
    </span>
  )
}

function AmountInput({
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

/** Propose trades to any player and respond to offers. Self-contained (props
 *  only) so it can be tested without the networking hook. */
export function TradePanel({
  players,
  selfId,
  offers,
  onPropose,
  onAccept,
  onCancel
}: {
  players: PlayerState[]
  selfId: string
  offers: TradeOffer[]
  onPropose: (to: string, give: SkittleSet, receive: SkittleSet) => void
  onAccept: (offerId: string) => void
  onCancel: (offerId: string) => void
}) {
  const others = players.filter((p) => p.id !== selfId)
  const [to, setTo] = useState(others[0]?.id ?? '')
  const [give, setGive] = useState<SkittleSet>(emptySkittles())
  const [receive, setReceive] = useState<SkittleSet>(emptySkittles())

  const nameOf = (id: string): string => players.find((p) => p.id === id)?.name ?? id
  const seedOf = (id: string): string => players.find((p) => p.id === id)?.flagSeed ?? id
  const incoming = offers.filter((o) => o.to === selfId)
  const outgoing = offers.filter((o) => o.from === selfId)

  const submit = (e: React.FormEvent): void => {
    e.preventDefault()
    if (!to) return
    onPropose(to, give, receive)
    setGive(emptySkittles())
    setReceive(emptySkittles())
  }

  return (
    <section className="trade">
      <h2>Trade</h2>

      {others.length === 0 ? (
        <p className="game__hint">No one to trade with yet.</p>
      ) : (
        <form className="trade__form" onSubmit={submit}>
          <label>
            With{' '}
            <select value={to} onChange={(e) => setTo(e.target.value)} aria-label="Trade with">
              {others.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <AmountInput label="You give" value={give} onChange={setGive} />
          <AmountInput label="You get" value={receive} onChange={setReceive} />
          <button className="btn" type="submit">
            Propose trade
          </button>
        </form>
      )}

      {incoming.length > 0 && (
        <div className="trade__offers">
          <h3>Offers to you</h3>
          {incoming.map((o) => (
            <div key={o.id} className="trade__offer">
              <span>
                <FactionTitle seed={seedOf(o.from)} name={nameOf(o.from)} size="sm" />: you receive{' '}
                <CostList set={o.give} />, you give <CostList set={o.receive} />
              </span>
              <span className="trade__offer-actions">
                <button className="btn" onClick={() => onAccept(o.id)}>
                  Accept
                </button>
                <button className="btn" onClick={() => onCancel(o.id)}>
                  Decline
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {outgoing.length > 0 && (
        <div className="trade__offers">
          <h3>Your offers</h3>
          {outgoing.map((o) => (
            <div key={o.id} className="trade__offer">
              <span>
                To <FactionTitle seed={seedOf(o.to)} name={nameOf(o.to)} size="sm" />: you give{' '}
                <CostList set={o.give} />, you receive <CostList set={o.receive} />
              </span>
              <button className="btn" onClick={() => onCancel(o.id)}>
                Cancel
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
