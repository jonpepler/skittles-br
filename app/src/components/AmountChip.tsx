import { SKITTLE_COLOURS, type SkittleColour } from '../generators/event.js'
import {
  selectedColours,
  type AmountKind,
  type DraftAmount,
  type Modifier,
  type Trigger
} from './contractDraft.js'

const clampPct = (n: number): number => Math.min(100, Math.max(0, Math.floor(n || 0)))
const clampN = (n: number): number => Math.max(0, Math.floor(n || 0))

/**
 * Edits one amount: a kind ("exactly", "all their", "the required", "the
 * received", "a percentage") spread across coloured unit chips that each carry
 * their own count, with an optional limit ("but at most N" / "plus N") that's
 * only shown once added.
 *
 * The "received"-based kinds are only offered under the `receive` trigger,
 * since `received` evaluates to nothing in any other context.
 */
export function AmountChip({
  value,
  trigger,
  onChange
}: {
  value: DraftAmount
  trigger: Trigger
  onChange: (next: DraftAmount) => void
}) {
  const set = (patch: Partial<DraftAmount>): void => onChange({ ...value, ...patch })
  const showCounts = value.kind === 'number'

  const toggleColour = (c: SkittleColour): void => {
    const units = { ...value.units }
    const modUnits = { ...value.modUnits }
    if (units[c] !== undefined) {
      if (Object.keys(units).length === 1) return // keep at least one
      delete units[c]
      delete modUnits[c]
    } else {
      units[c] = 1
      modUnits[c] = 1
    }
    set({ units, modUnits })
  }
  const setCount = (c: SkittleColour, n: number): void =>
    set({ units: { ...value.units, [c]: clampN(n) } })
  const setCap = (c: SkittleColour, n: number): void =>
    set({ modUnits: { ...value.modUnits, [c]: clampN(n) } })

  const addLimit = (): void => {
    const modUnits: DraftAmount['modUnits'] = {}
    for (const c of selectedColours(value)) modUnits[c] = value.modUnits[c] ?? 1
    set({ modifier: 'cap', modUnits })
  }

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
        {trigger === 'receive' && <option value="received">the received</option>}
        {trigger === 'receive' && <option value="percent">a percentage</option>}
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
        <button type="button" className="amt__addlimit" onClick={addLimit}>
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
          <span className="units">
            {selectedColours(value).map((c) => (
              <span key={c} className="unit unit--on">
                <input
                  className="unit__n"
                  type="number"
                  min={0}
                  aria-label={`${c} limit`}
                  value={value.modUnits[c] ?? 0}
                  onChange={(e) => setCap(c, Number(e.target.value))}
                />
                <span className={`unit__dot skittle--${c}`} title={c} />
              </span>
            ))}
          </span>
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
