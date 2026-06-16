import { SKITTLE_COLOURS, type SkittleColour } from '../generators/event.js'
import type { AmountKind, DraftAmount, Modifier } from './contractDraft.js'

const clampPct = (n: number): number => Math.min(100, Math.max(0, Math.floor(n || 0)))
const clampN = (n: number): number => Math.max(0, Math.floor(n || 0))

/**
 * Edits one amount: a kind ("exactly", "all their", "the required", "the
 * received", "a percentage") spread across coloured unit chips that each carry
 * their own count, with an optional limit ("but at most N" / "plus N") that's
 * only shown once added.
 */
export function AmountChip({
  value,
  onChange
}: {
  value: DraftAmount
  onChange: (next: DraftAmount) => void
}) {
  const set = (patch: Partial<DraftAmount>): void => onChange({ ...value, ...patch })
  const showCounts = value.kind === 'number'

  const toggleColour = (c: SkittleColour): void => {
    const units = { ...value.units }
    if (units[c] !== undefined) {
      if (Object.keys(units).length === 1) return // keep at least one
      delete units[c]
    } else {
      units[c] = 1
    }
    set({ units })
  }
  const setCount = (c: SkittleColour, n: number): void =>
    set({ units: { ...value.units, [c]: clampN(n) } })

  return (
    <span className="amt">
      <select
        className="chip"
        aria-label="amount kind"
        value={value.kind}
        onChange={(e) => set({ kind: e.target.value as AmountKind })}
      >
        <option value="number">exactly</option>
        <option value="all">all their</option>
        <option value="eventReq">the required</option>
        <option value="received">the received</option>
        <option value="percent">a percentage</option>
      </select>

      {value.kind === 'percent' && (
        <>
          <input
            className="chip chip--num"
            type="number"
            min={0}
            max={100}
            aria-label="amount percent"
            value={value.percent}
            onChange={(e) => set({ percent: clampPct(Number(e.target.value)) })}
          />
          <span className="amt__kw">% of the received</span>
        </>
      )}

      <span className="units" role="group" aria-label="Colours">
        {SKITTLE_COLOURS.map((c) => {
          const on = value.units[c] !== undefined
          return (
            <span key={c} className={`unit${on ? ' unit--on' : ''}`}>
              {on && showCounts && (
                <input
                  className="unit__n"
                  type="number"
                  min={0}
                  aria-label={`${c} amount`}
                  value={value.units[c]}
                  onChange={(e) => setCount(c, Number(e.target.value))}
                />
              )}
              <button
                type="button"
                title={c}
                aria-label={c}
                aria-pressed={on}
                className={`unit__dot skittle--${c}`}
                onClick={() => toggleColour(c)}
              />
            </span>
          )
        })}
      </span>

      {value.modifier === 'none' ? (
        <button type="button" className="amt__addlimit" onClick={() => set({ modifier: 'cap' })}>
          ＋ limit
        </button>
      ) : (
        <span className="amt__limit">
          <select
            className="chip"
            aria-label="amount limit"
            value={value.modifier}
            onChange={(e) => set({ modifier: e.target.value as Modifier })}
          >
            <option value="cap">but at most</option>
            <option value="plus">plus</option>
          </select>
          <input
            className="chip chip--num"
            type="number"
            min={0}
            aria-label="amount limit amount"
            value={value.modAmount}
            onChange={(e) => set({ modAmount: clampN(Number(e.target.value)) })}
          />
          <button
            type="button"
            className="amt__dellimit"
            aria-label="remove limit"
            onClick={() => set({ modifier: 'none' })}
          >
            ✕
          </button>
        </span>
      )}
    </span>
  )
}
