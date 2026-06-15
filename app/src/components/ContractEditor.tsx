import { useState } from 'react'
import type { PlayerState } from '../game/types.js'
import type { Transfer } from '../game/contracts.js'
import { AmountChip } from './AmountChip.js'
import { ColourPicker } from './ColourPicker.js'
import {
  type ClauseDraft,
  type Trigger,
  clausesToBuckets,
  describeClause,
  newClause
} from './contractDraft.js'

export interface EditorSubmit {
  (
    parties: string[],
    onSign: Transfer[],
    onEvent: Transfer[],
    onReceive: Transfer[],
    expiresRound: number | null
  ): void
}

/**
 * Compose a contract like a command: stacked clause "lines" of token chips with
 * nestable amounts, dynamic clauses and parties, and a live English preview.
 * Reused for both authoring a new contract and countering a received one.
 */
export function ContractEditor({
  players,
  selfId,
  round,
  initialParties,
  initialClauses,
  initialExpiresIn = 0,
  submitLabel,
  onSubmit,
  onCancel
}: {
  players: PlayerState[]
  selfId: string
  round: number
  initialParties?: string[]
  initialClauses?: ClauseDraft[]
  initialExpiresIn?: number
  submitLabel: string
  onSubmit: EditorSubmit
  onCancel?: () => void
}) {
  const firstOther = players.find((p) => p.id !== selfId && !p.out)?.id ?? selfId
  const [parties, setParties] = useState<string[]>(initialParties ?? [selfId, firstOther])
  const [clauses, setClauses] = useState<ClauseDraft[]>(
    initialClauses ?? [newClause(selfId, firstOther)]
  )
  const [expiresIn, setExpiresIn] = useState(initialExpiresIn)

  const nameOf = (id: string): string => players.find((p) => p.id === id)?.name ?? id
  const partyOptions = parties.map((id) => ({ id, name: nameOf(id) }))

  const patch = (key: string, p: Partial<ClauseDraft>): void =>
    setClauses(clauses.map((c) => (c.key === key ? { ...c, ...p } : c)))

  const addParty = (): void => {
    const candidate = players.find((p) => !p.out && !parties.includes(p.id))
    if (candidate) setParties([...parties, candidate.id])
  }
  const removeParty = (id: string): void => {
    if (id === selfId) return
    setParties(parties.filter((p) => p !== id))
    setClauses(clauses.filter((c) => c.from !== id && c.to !== id))
  }

  const submit = (): void => {
    if (clauses.length === 0) return
    const { onSign, onEvent, onReceive } = clausesToBuckets(clauses)
    onSubmit(parties, onSign, onEvent, onReceive, expiresIn > 0 ? round + expiresIn : null)
  }

  const PartySelect = ({
    label,
    value,
    onChange
  }: {
    label: string
    value: string
    onChange: (v: string) => void
  }) => (
    <select className="chip" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      {partyOptions.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  )

  return (
    <div className="editor">
      <div className="editor__parties">
        <span className="amt__kw">Parties:</span>
        {parties.map((id) => (
          <span key={id} className="editor__party">
            {nameOf(id)}
            {id === selfId && ' (you)'}
            {id !== selfId && (
              <button
                className="chip chip--x"
                aria-label={`remove party ${nameOf(id)}`}
                onClick={() => removeParty(id)}
              >
                ✕
              </button>
            )}
          </span>
        ))}
        {players.some((p) => !p.out && !parties.includes(p.id)) && (
          <button className="chip chip--add" onClick={addParty}>
            + party
          </button>
        )}
      </div>

      {clauses.map((c) => (
        <div key={c.key} className={`clause-card clause-card--${c.trigger}`}>
          {clauses.length > 1 && (
            <button
              className="clause-card__x"
              aria-label="Remove clause"
              onClick={() => setClauses(clauses.filter((x) => x.key !== c.key))}
            >
              ✕
            </button>
          )}
          <div className="clause">
            <select
              className="chip chip--when"
              aria-label="When"
              value={c.trigger}
              onChange={(e) => patch(c.key, { trigger: e.target.value as Trigger })}
            >
              <option value="now">When signed</option>
              <option value="event">Each event</option>
              <option value="receive">Each time… receives</option>
            </select>
            {c.trigger === 'receive' && (
              <ColourPicker
                label="Received colour"
                value={c.receiveColour}
                onChange={(col) => patch(c.key, { receiveColour: col })}
              />
            )}
            <PartySelect label="Giver" value={c.from} onChange={(v) => patch(c.key, { from: v })} />
            <span className="amt__kw">gives</span>
            <PartySelect label="Recipient" value={c.to} onChange={(v) => patch(c.key, { to: v })} />
            <AmountChip
              value={c.amount}
              defaultColour={c.colour}
              onChange={(amount) => patch(c.key, { amount })}
            />
            <ColourPicker
              label="Colour"
              value={c.colour}
              onChange={(col) => patch(c.key, { colour: col })}
            />
          </div>
          <p className="clause__preview">{describeClause(c, nameOf)}</p>
        </div>
      ))}

      <div className="contracts__actions">
        <button
          className="btn"
          onClick={() => setClauses([...clauses, newClause(selfId, parties.find((p) => p !== selfId) ?? selfId)])}
        >
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
        <button className="btn btn--large" onClick={submit}>
          {submitLabel}
        </button>
        {onCancel && (
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}
