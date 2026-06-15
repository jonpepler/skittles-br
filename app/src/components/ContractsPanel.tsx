import { useState } from 'react'
import { SKITTLE_COLOURS, type SkittleColour } from '../generators/event.js'
import type { AmountExpr, Contract, GiveSpec, Transfer } from '../game/contracts.js'
import type { PlayerState } from '../game/types.js'

type Trigger = 'now' | 'event' | 'receive'
type Direction = 'iGive' | 'theyGive'
type AmountKind = 'fixed' | 'allMine' | 'eventReq' | 'percentReceived' | 'percentAllMine'

interface ClauseDraft {
  trigger: Trigger
  receiveColour: SkittleColour
  direction: Direction
  amountKind: AmountKind
  colour: SkittleColour
  number: number
}

const AMOUNT_KINDS: Record<Trigger, AmountKind[]> = {
  now: ['fixed', 'allMine', 'percentAllMine'],
  event: ['fixed', 'allMine', 'eventReq', 'percentAllMine'],
  receive: ['percentReceived', 'fixed']
}

const AMOUNT_LABEL: Record<AmountKind, string> = {
  fixed: 'a fixed amount',
  allMine: 'all my',
  eventReq: "the event's required",
  percentReceived: '% of what I received',
  percentAllMine: '% of all my'
}

function newClause(): ClauseDraft {
  return {
    trigger: 'now',
    receiveColour: 'red',
    direction: 'iGive',
    amountKind: 'fixed',
    colour: 'red',
    number: 1
  }
}

function bucketOf(t: Trigger): 'onSign' | 'onEvent' | 'onReceive' {
  return t === 'now' ? 'onSign' : t === 'event' ? 'onEvent' : 'onReceive'
}

function clauseColour(c: ClauseDraft): SkittleColour {
  return c.amountKind === 'percentReceived' ? c.receiveColour : c.colour
}

function clauseExpr(c: ClauseDraft): AmountExpr {
  const colour = clauseColour(c)
  switch (c.amountKind) {
    case 'fixed':
      return c.number
    case 'allMine':
      return { all: colour }
    case 'eventReq':
      return { eventReq: colour }
    case 'percentReceived':
      return { percent: c.number, of: { received: c.receiveColour } }
    case 'percentAllMine':
      return { percent: c.number, of: { all: colour } }
  }
}

function clauseToTransfer(c: ClauseDraft, selfId: string, otherId: string): Transfer {
  // A "receive" clause always fires for the receiver (you), so you are the giver.
  const iGive = c.trigger === 'receive' ? true : c.direction === 'iGive'
  const from = iGive ? selfId : otherId
  const to = iGive ? otherId : selfId
  const give: GiveSpec = { [clauseColour(c)]: clauseExpr(c) }
  return { from, to, give }
}

/** Plain-English rendering of a clause, used for the live preview. */
function describeClause(c: ClauseDraft): string {
  const colour = clauseColour(c)
  const trigger =
    c.trigger === 'now'
      ? 'When signed,'
      : c.trigger === 'event'
        ? 'Each event,'
        : `Each time I receive ${c.receiveColour},`
  const giver = c.trigger === 'receive' || c.direction === 'iGive' ? 'I give you' : 'you give me'
  let amount: string
  switch (c.amountKind) {
    case 'fixed':
      amount = `${c.number} ${colour}`
      break
    case 'allMine':
      amount = `all my ${colour}`
      break
    case 'eventReq':
      amount = `the required ${colour}`
      break
    case 'percentReceived':
      amount = `${c.number}% of the ${c.receiveColour} I received`
      break
    case 'percentAllMine':
      amount = `${c.number}% of all my ${colour}`
      break
  }
  return `${trigger} ${giver} ${amount}.`
}

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
  if ('received' in expr) return `received ${colour}`
  if ('percent' in expr) return `${expr.percent}% of ${describeExpr(expr.of, colour)}`
  return `some ${colour}`
}

const Chip = ({
  label,
  value,
  options,
  onChange
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}) => (
  <select
    className="chip"
    aria-label={label}
    value={value}
    onChange={(e) => onChange(e.target.value)}
  >
    {options.map((o) => (
      <option key={o.value} value={o.value}>
        {o.label}
      </option>
    ))}
  </select>
)

const colourOptions = SKITTLE_COLOURS.map((c) => ({ value: c, label: c }))

function ClauseBuilder({
  clause,
  onChange
}: {
  clause: ClauseDraft
  onChange: (c: ClauseDraft) => void
}) {
  const set = (patch: Partial<ClauseDraft>): void => onChange({ ...clause, ...patch })
  const showColour = clause.amountKind !== 'percentReceived'
  const showNumber = ['fixed', 'percentReceived', 'percentAllMine'].includes(clause.amountKind)

  return (
    <div className="clause">
      <Chip
        label="When"
        value={clause.trigger}
        options={[
          { value: 'now', label: 'When signed' },
          { value: 'event', label: 'Each event' },
          { value: 'receive', label: 'Each time I receive' }
        ]}
        onChange={(v) => {
          const trigger = v as Trigger
          set({ trigger, amountKind: AMOUNT_KINDS[trigger][0]! })
        }}
      />
      {clause.trigger === 'receive' && (
        <Chip
          label="Received colour"
          value={clause.receiveColour}
          options={colourOptions}
          onChange={(v) => set({ receiveColour: v as SkittleColour })}
        />
      )}
      {clause.trigger !== 'receive' && (
        <Chip
          label="Direction"
          value={clause.direction}
          options={[
            { value: 'iGive', label: 'I give you' },
            { value: 'theyGive', label: 'you give me' }
          ]}
          onChange={(v) => set({ direction: v as Direction })}
        />
      )}
      {clause.trigger === 'receive' && <span className="clause__text">I give you</span>}
      {showNumber && (
        <input
          className="chip chip--num"
          type="number"
          min={0}
          aria-label="Amount"
          value={clause.number}
          onChange={(e) => set({ number: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
        />
      )}
      <Chip
        label="Amount kind"
        value={clause.amountKind}
        options={AMOUNT_KINDS[clause.trigger].map((k) => ({ value: k, label: AMOUNT_LABEL[k] }))}
        onChange={(v) => set({ amountKind: v as AmountKind })}
      />
      {showColour && (
        <Chip
          label="Colour"
          value={clause.colour}
          options={colourOptions}
          onChange={(v) => set({ colour: v as SkittleColour })}
        />
      )}
    </div>
  )
}

export function ContractsPanel({
  players,
  selfId,
  contracts,
  round,
  onPropose,
  onSign,
  onCancel
}: {
  players: PlayerState[]
  selfId: string
  contracts: Contract[]
  round: number
  onPropose: (
    parties: string[],
    onSign: Transfer[],
    onEvent: Transfer[],
    onReceive: Transfer[],
    expiresRound: number | null
  ) => void
  onSign: (contractId: string) => void
  onCancel: (contractId: string) => void
}) {
  const others = players.filter((p) => p.id !== selfId && !p.out)
  const [to, setTo] = useState(others[0]?.id ?? '')
  const [clauses, setClauses] = useState<ClauseDraft[]>([newClause()])
  const [expiresIn, setExpiresIn] = useState(0)

  const nameOf = (id: string): string => players.find((p) => p.id === id)?.name ?? id

  const propose = (): void => {
    if (!to) return
    const onSignT: Transfer[] = []
    const onEventT: Transfer[] = []
    const onReceiveT: Transfer[] = []
    for (const c of clauses) {
      const transfer = clauseToTransfer(c, selfId, to)
      const bucket = bucketOf(c.trigger)
      if (bucket === 'onSign') onSignT.push(transfer)
      else if (bucket === 'onEvent') onEventT.push(transfer)
      else onReceiveT.push(transfer)
    }
    onPropose([selfId, to], onSignT, onEventT, onReceiveT, expiresIn > 0 ? round + expiresIn : null)
    setClauses([newClause()])
    setExpiresIn(0)
  }

  return (
    <section className="contracts">
      <h2>Contracts</h2>

      {others.length === 0 ? (
        <p className="game__hint">No one to make a contract with yet.</p>
      ) : (
        <div className="contracts__builder">
          <label className="contracts__with">
            Contract with{' '}
            <select value={to} onChange={(e) => setTo(e.target.value)} aria-label="Contract with">
              {others.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          {clauses.map((clause, i) => (
            <div key={i} className="clause-row">
              <ClauseBuilder
                clause={clause}
                onChange={(c) => setClauses(clauses.map((x, j) => (j === i ? c : x)))}
              />
              <p className="clause__preview">{describeClause(clause)}</p>
              {clauses.length > 1 && (
                <button
                  className="btn clause__remove"
                  aria-label={`Remove clause ${i + 1}`}
                  onClick={() => setClauses(clauses.filter((_, j) => j !== i))}
                >
                  ✕
                </button>
              )}
            </div>
          ))}

          <div className="contracts__actions">
            <button className="btn" onClick={() => setClauses([...clauses, newClause()])}>
              + Add clause
            </button>
            <label className="contracts__expiry">
              Expires after{' '}
              <input
                className="chip chip--num"
                type="number"
                min={0}
                aria-label="Expires after rounds"
                value={expiresIn}
                onChange={(e) => setExpiresIn(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
              />{' '}
              rounds (0 = never)
            </label>
            <button className="btn btn--large" onClick={propose}>
              Propose contract
            </button>
          </div>
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
                    {c.onReceive.map((t, i) => (
                      <li key={`r${i}`}>
                        on receipt: {nameOf(t.from)} → {nameOf(t.to)}: {describeGive(t.give)}
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
