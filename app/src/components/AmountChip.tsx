import type { AmountKind, DraftAmount, Modifier } from './contractDraft.js'

const clampPct = (n: number): number => Math.min(100, Math.max(0, Math.floor(n || 0)))
const clampN = (n: number): number => Math.max(0, Math.floor(n || 0))

/**
 * Edits one colour-free amount: a base ("exactly N", "all their", "the
 * required", "the received", "a percentage") with an optional limit ("but at
 * most N" / "plus N"). The clause supplies which colour(s) it applies to.
 */
export function AmountChip({
  value,
  onChange,
  label = 'amount'
}: {
  value: DraftAmount
  onChange: (next: DraftAmount) => void
  label?: string
}) {
  const set = (patch: Partial<DraftAmount>): void => onChange({ ...value, ...patch })

  return (
    <span className="amt">
      <select
        className="chip"
        aria-label={`${label} kind`}
        value={value.kind}
        onChange={(e) => set({ kind: e.target.value as AmountKind })}
      >
        <option value="number">exactly</option>
        <option value="all">all their</option>
        <option value="eventReq">the required</option>
        <option value="received">the received</option>
        <option value="percent">a percentage</option>
      </select>

      {value.kind === 'number' && (
        <input
          className="chip chip--num"
          type="number"
          min={0}
          aria-label={label}
          value={value.count}
          onChange={(e) => set({ count: clampN(Number(e.target.value)) })}
        />
      )}

      {value.kind === 'percent' && (
        <>
          <input
            className="chip chip--num"
            type="number"
            min={0}
            max={100}
            aria-label={`${label} percent`}
            value={value.percent}
            onChange={(e) => set({ percent: clampPct(Number(e.target.value)) })}
          />
          <span className="amt__kw">% of the received</span>
        </>
      )}

      <select
        className="chip"
        aria-label={`${label} limit`}
        value={value.modifier}
        onChange={(e) => set({ modifier: e.target.value as Modifier })}
      >
        <option value="none">(no limit)</option>
        <option value="cap">but at most</option>
        <option value="plus">plus</option>
      </select>

      {value.modifier !== 'none' && (
        <input
          className="chip chip--num"
          type="number"
          min={0}
          aria-label={`${label} limit amount`}
          value={value.modAmount}
          onChange={(e) => set({ modAmount: clampN(Number(e.target.value)) })}
        />
      )}
    </span>
  )
}
